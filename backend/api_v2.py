"""
Organic traffic and auto publisher APIs.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from config import VN_TZ
from database import (
    ContentMetricDB,
    ContentPackDB,
    ContentVariantDB,
    PlatformCredentialDB,
    PublishingJobDB,
    PublishingResultDB,
    SessionLocal,
    row_to_dict,
)
from services.content_engine import generate_content_pack
from services.credential_crypto import decrypt_token, encrypt_token
from services.publisher_clients import (
    PublisherError,
    fetch_facebook_metrics,
    fetch_threads_metrics,
    post_facebook_comment,
    post_facebook_feed,
    post_threads_text,
)
from services.quality_gate import duplicate_ratio
from services.scheduler import apply_jitter, backoff_seconds, comment_delay_seconds

router = APIRouter(prefix="/api", tags=["organic-publisher"])


def now_vn() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)


def parse_json_text(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def parse_datetime(iso_value: str) -> datetime:
    raw = iso_value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is not None:
        dt = dt.astimezone(VN_TZ).replace(tzinfo=None)
    return dt


def compute_rates(metrics: dict[str, int]) -> dict[str, float]:
    impressions = max(1, int(metrics.get("impressions", 0)))
    reactions = int(metrics.get("reactions", 0))
    comments = int(metrics.get("comments", 0))
    shares = int(metrics.get("shares", 0))
    clicks = int(metrics.get("clicks", 0))
    saves = int(metrics.get("saves", 0))
    return {
        "ctr": round(clicks / impressions, 6),
        "engagement_rate": round((reactions + comments + shares) / impressions, 6),
        "save_rate": round(saves / impressions, 6),
    }


class ContentPackGenerateRequest(BaseModel):
    product_id: str | None = None
    link_id: str | None = None
    product_name: str
    product_link: str = ""
    persona: str = "Hoi nguoi di lam van phong"
    platform_targets: list[str] = Field(default_factory=lambda: ["facebook", "threads"])
    tone: str = "balanced"


class ContentPackApproveRequest(BaseModel):
    selected_variant_id: str | None = None


class ContentPackSelectVariantRequest(BaseModel):
    variant_id: str


class CredentialUpsertRequest(BaseModel):
    platform: str
    account_id: str
    target_id: str = ""
    access_token: str
    scopes: list[str] = Field(default_factory=list)
    expires_at: str | None = None
    active: bool = True


class PublisherJobCreateRequest(BaseModel):
    pack_id: str
    platform: str
    target_id: str
    scheduled_at: str


class MetricIngestRequest(BaseModel):
    pack_id: str
    variant_id: str
    job_id: str
    platform: str
    window_label: str
    impressions: int = 0
    reactions: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    saves: int = 0
    raw_payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/content-packs/generate")
def generate_content_pack_api(req: ContentPackGenerateRequest):
    db = SessionLocal()
    try:
        pack_id = f"cp-{uuid.uuid4().hex[:12]}"
        payload = generate_content_pack(
            product_name=req.product_name,
            product_link=req.product_link,
            persona=req.persona,
            tone=req.tone,
            platform_targets=req.platform_targets,
        )

        pack = ContentPackDB(
            id=pack_id,
            link_id=req.link_id or req.product_id or "",
            product_name=req.product_name,
            product_link=req.product_link,
            persona=req.persona,
            tone=req.tone,
            platform_targets=json.dumps(req.platform_targets, ensure_ascii=False),
            status="draft",
            created_at=now_vn(),
            updated_at=now_vn(),
        )
        db.add(pack)

        recent_variants = db.query(ContentVariantDB).order_by(ContentVariantDB.created_at.desc()).limit(50).all()
        recent_texts = [v.post_text for v in recent_variants if v.post_text]

        variants_out = []
        for v in payload["variants"]:
            dup_ratio = duplicate_ratio(v["post_text"], recent_texts)
            risk_flags = list(v.get("risk_flags") or [])
            if dup_ratio >= 0.45:
                risk_flags.append("high_duplicate_ngram")
                v["spam_risk_score"] = min(100.0, v["spam_risk_score"] + dup_ratio * 30.0)
                v["quality_score"] = max(0.0, v["quality_score"] - dup_ratio * 25.0)

            variant_id = f"cv-{uuid.uuid4().hex[:12]}"
            db.add(
                ContentVariantDB(
                    id=variant_id,
                    pack_id=pack_id,
                    variant_label=v["variant_label"],
                    post_text=v["post_text"],
                    first_comment=v["first_comment"],
                    cta_level=v["cta_level"],
                    hashtags=json.dumps(v["hashtags"], ensure_ascii=False),
                    image_prompt=v["image_prompt"],
                    content_angle=v["content_angle"],
                    risk_flags=json.dumps(sorted(set(risk_flags)), ensure_ascii=False),
                    quality_score=float(v["quality_score"]),
                    spam_risk_score=float(v["spam_risk_score"]),
                    created_at=now_vn(),
                )
            )
            variants_out.append(
                {
                    "id": variant_id,
                    **v,
                    "risk_flags": sorted(set(risk_flags)),
                    "duplicate_ratio": round(dup_ratio, 4),
                }
            )

        best_variant = max(variants_out, key=lambda item: item["quality_score"], default=None)
        if best_variant:
            pack.selected_variant_id = best_variant["id"]

        db.commit()
        return {"pack_id": pack_id, "status": "draft", "variants": variants_out, "warning": payload.get("warning", "")}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.patch("/content-packs/{pack_id}/approve")
def approve_content_pack(pack_id: str, req: ContentPackApproveRequest):
    db = SessionLocal()
    try:
        pack = db.get(ContentPackDB, pack_id)
        if not pack:
            return {"error": "content pack not found"}
        selected = req.selected_variant_id or pack.selected_variant_id
        if not selected:
            variant = (
                db.query(ContentVariantDB)
                .filter(ContentVariantDB.pack_id == pack_id)
                .order_by(ContentVariantDB.quality_score.desc())
                .first()
            )
            selected = variant.id if variant else ""

        pack.status = "approved"
        pack.selected_variant_id = selected
        pack.approved_at = now_vn()
        pack.updated_at = now_vn()
        db.commit()
        return {"ok": True, "pack_id": pack_id, "status": pack.status, "selected_variant_id": selected}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.patch("/content-packs/{pack_id}/select-variant")
def select_content_variant(pack_id: str, req: ContentPackSelectVariantRequest):
    db = SessionLocal()
    try:
        pack = db.get(ContentPackDB, pack_id)
        if not pack:
            return {"error": "content pack not found"}
        variant = db.get(ContentVariantDB, req.variant_id)
        if not variant or variant.pack_id != pack_id:
            return {"error": "variant not found in content pack"}
        pack.selected_variant_id = req.variant_id
        pack.updated_at = now_vn()
        db.commit()
        return {"ok": True, "pack_id": pack_id, "selected_variant_id": req.variant_id}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.get("/content-packs")
def list_content_packs(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = SessionLocal()
    try:
        query = db.query(ContentPackDB)
        if status:
            query = query.filter(ContentPackDB.status == status)
        total = query.count()
        rows = (
            query.order_by(ContentPackDB.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "items": [row_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }
    finally:
        db.close()


@router.post("/platform-credentials")
def upsert_platform_credential(req: CredentialUpsertRequest):
    db = SessionLocal()
    try:
        cred_id = f"{req.platform}:{req.account_id}"
        expires_at = parse_datetime(req.expires_at) if req.expires_at else None
        encrypted_token = encrypt_token(req.access_token)
        existing = db.get(PlatformCredentialDB, cred_id)
        if existing:
            existing.target_id = req.target_id
            existing.encrypted_token = encrypted_token
            existing.scopes = json.dumps(req.scopes, ensure_ascii=False)
            existing.expires_at = expires_at
            existing.active = req.active
            existing.updated_at = now_vn()
        else:
            db.add(
                PlatformCredentialDB(
                    id=cred_id,
                    platform=req.platform,
                    account_id=req.account_id,
                    target_id=req.target_id,
                    encrypted_token=encrypted_token,
                    scopes=json.dumps(req.scopes, ensure_ascii=False),
                    expires_at=expires_at,
                    active=req.active,
                    created_at=now_vn(),
                    updated_at=now_vn(),
                )
            )
        db.commit()
        return {"ok": True, "credential_id": cred_id}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.get("/platform-credentials")
def list_platform_credentials(platform: str | None = Query(None)):
    db = SessionLocal()
    try:
        query = db.query(PlatformCredentialDB)
        if platform:
            query = query.filter(PlatformCredentialDB.platform == platform)
        rows = query.order_by(PlatformCredentialDB.updated_at.desc()).all()
        items = []
        for row in rows:
            payload = row_to_dict(row)
            payload["token_configured"] = bool(row.encrypted_token)
            payload.pop("encrypted_token", None)
            payload["scopes"] = parse_json_text(payload.get("scopes"), [])
            items.append(payload)
        return {"items": items}
    finally:
        db.close()


def _resolve_credential(db, platform: str, target_id: str) -> PlatformCredentialDB | None:
    # First by exact target match, then by any active credential for platform.
    cred = (
        db.query(PlatformCredentialDB)
        .filter(
            PlatformCredentialDB.platform == platform,
            PlatformCredentialDB.target_id == target_id,
            PlatformCredentialDB.active.is_(True),
        )
        .first()
    )
    if cred:
        return cred
    return (
        db.query(PlatformCredentialDB)
        .filter(PlatformCredentialDB.platform == platform, PlatformCredentialDB.active.is_(True))
        .order_by(PlatformCredentialDB.updated_at.desc())
        .first()
    )


@router.post("/publisher/jobs")
def create_publisher_job(req: PublisherJobCreateRequest):
    db = SessionLocal()
    try:
        pack = db.get(ContentPackDB, req.pack_id)
        if not pack:
            return {"error": "content pack not found"}
        if pack.status not in ("approved", "scheduled", "posted", "measured", "optimized"):
            return {"error": "content pack must be approved before scheduling"}

        variant_id = pack.selected_variant_id
        variant = db.get(ContentVariantDB, variant_id) if variant_id else None
        if not variant:
            return {"error": "selected variant not found"}

        scheduled_at = parse_datetime(req.scheduled_at)
        jittered_time, jitter_seconds = apply_jitter(scheduled_at)

        # Pacing rule: avoid 2 consecutive same angle on same platform + target.
        last_job = (
            db.query(PublishingJobDB)
            .filter(
                PublishingJobDB.platform == req.platform,
                PublishingJobDB.target_id == req.target_id,
                PublishingJobDB.status.in_(["scheduled", "running", "posted", "measured"]),
            )
            .order_by(PublishingJobDB.created_at.desc())
            .first()
        )
        if last_job:
            last_variant = db.get(ContentVariantDB, last_job.variant_id)
            if last_variant and last_variant.content_angle == variant.content_angle:
                jittered_time = jittered_time + timedelta(minutes=30)
                jitter_seconds += 1800

        job_id = f"job-{uuid.uuid4().hex[:12]}"
        db.add(
            PublishingJobDB(
                id=job_id,
                pack_id=req.pack_id,
                variant_id=variant.id,
                platform=req.platform,
                target_id=req.target_id,
                scheduled_at=scheduled_at,
                run_after=jittered_time,
                jitter_seconds=jitter_seconds,
                status="scheduled",
                attempts=0,
                created_at=now_vn(),
                updated_at=now_vn(),
            )
        )
        pack.status = "scheduled"
        pack.updated_at = now_vn()
        db.commit()
        return {
            "job_id": job_id,
            "pack_id": req.pack_id,
            "platform": req.platform,
            "scheduled_at": scheduled_at.isoformat(),
            "run_after": jittered_time.isoformat(),
            "jitter_seconds": jitter_seconds,
            "status": "scheduled",
        }
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.get("/publisher/jobs")
def list_publisher_jobs(
    status: str | None = Query(None),
    platform: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = SessionLocal()
    try:
        query = db.query(PublishingJobDB)
        if status:
            query = query.filter(PublishingJobDB.status == status)
        if platform:
            query = query.filter(PublishingJobDB.platform == platform)
        total = query.count()
        rows = (
            query.order_by(PublishingJobDB.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return {
            "items": [row_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }
    finally:
        db.close()


@router.post("/publisher/jobs/{job_id}/run")
def run_publisher_job(job_id: str):
    db = SessionLocal()
    try:
        job = db.get(PublishingJobDB, job_id)
        if not job:
            return {"error": "job not found"}
        variant = db.get(ContentVariantDB, job.variant_id)
        pack = db.get(ContentPackDB, job.pack_id)
        if not variant or not pack:
            return {"error": "job references missing content"}

        credential = _resolve_credential(db, job.platform, job.target_id)
        if not credential:
            return {"error": f"missing active credential for platform={job.platform}, target={job.target_id}"}

        token = decrypt_token(credential.encrypted_token)
        job.status = "running"
        job.attempts += 1
        job.updated_at = now_vn()
        db.commit()

        try:
            response_payload: dict[str, Any]
            post_id = ""
            comment_id = ""

            if job.platform == "facebook":
                response_payload = post_facebook_feed(
                    page_id=job.target_id,
                    access_token=token,
                    message=variant.post_text,
                )
                post_id = response_payload.get("id", "")
                if variant.first_comment:
                    # Keep API sync deterministic but still apply realistic delay.
                    delay = comment_delay_seconds()
                    comment_resp = post_facebook_comment(
                        post_id=post_id,
                        access_token=token,
                        message=variant.first_comment,
                    )
                    comment_id = comment_resp.get("id", "")
                    response_payload["first_comment_delay_seconds"] = delay
                    response_payload["first_comment_response"] = comment_resp
            elif job.platform == "threads":
                text = variant.post_text
                if pack.product_link and pack.product_link not in text:
                    text = f"{text}\n\n{pack.product_link}"
                response_payload = post_threads_text(
                    user_id=job.target_id,
                    access_token=token,
                    text=text,
                )
                post_id = response_payload.get("id", "")
            else:
                raise PublisherError(f"unsupported platform: {job.platform}")

            result_id = f"result-{uuid.uuid4().hex[:12]}"
            db.add(
                PublishingResultDB(
                    id=result_id,
                    job_id=job.id,
                    pack_id=pack.id,
                    variant_id=variant.id,
                    platform=job.platform,
                    status="posted",
                    platform_post_id=post_id,
                    platform_comment_id=comment_id,
                    posted_at=now_vn(),
                    response_payload=json.dumps(response_payload, ensure_ascii=False),
                )
            )
            job.status = "posted"
            job.last_error = ""
            job.updated_at = now_vn()
            pack.status = "posted"
            pack.updated_at = now_vn()
            db.commit()
            return {"ok": True, "job_id": job.id, "status": "posted", "result_id": result_id, "post_id": post_id}
        except Exception as publish_error:
            job.status = "failed"
            job.last_error = str(publish_error)
            retry_seconds = backoff_seconds(job.attempts)
            job.run_after = now_vn() + timedelta(seconds=retry_seconds)
            job.updated_at = now_vn()
            db.commit()
            return {"error": str(publish_error), "job_id": job.id, "retry_after_seconds": retry_seconds}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.get("/publisher/results")
def list_publisher_results(
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    platform: str | None = Query(None),
):
    db = SessionLocal()
    try:
        query = db.query(PublishingResultDB)
        if date_from:
            query = query.filter(PublishingResultDB.posted_at >= parse_datetime(date_from))
        if date_to:
            query = query.filter(PublishingResultDB.posted_at <= parse_datetime(date_to))
        if platform:
            query = query.filter(PublishingResultDB.platform == platform)
        rows = query.order_by(PublishingResultDB.posted_at.desc()).limit(500).all()
        return {"items": [row_to_dict(r) for r in rows], "total": len(rows)}
    finally:
        db.close()


@router.post("/metrics/ingest")
def ingest_metric(req: MetricIngestRequest):
    db = SessionLocal()
    try:
        rates = compute_rates(req.model_dump())
        metric_id = f"metric-{uuid.uuid4().hex[:12]}"
        db.add(
            ContentMetricDB(
                id=metric_id,
                pack_id=req.pack_id,
                variant_id=req.variant_id,
                job_id=req.job_id,
                platform=req.platform,
                window_label=req.window_label,
                collected_at=now_vn(),
                impressions=req.impressions,
                reactions=req.reactions,
                comments=req.comments,
                shares=req.shares,
                clicks=req.clicks,
                saves=req.saves,
                ctr=rates["ctr"],
                engagement_rate=rates["engagement_rate"],
                save_rate=rates["save_rate"],
                raw_payload=json.dumps(req.raw_payload, ensure_ascii=False),
            )
        )

        # Update pack state once at least one metric is captured.
        pack = db.get(ContentPackDB, req.pack_id)
        if pack and pack.status in ("posted", "scheduled"):
            pack.status = "measured"
            pack.updated_at = now_vn()
        db.commit()
        return {"ok": True, "metric_id": metric_id, **rates}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@router.get("/metrics/content/{pack_id}")
def content_metrics(pack_id: str):
    db = SessionLocal()
    try:
        rows = (
            db.query(ContentMetricDB)
            .filter(ContentMetricDB.pack_id == pack_id)
            .order_by(ContentMetricDB.collected_at.desc())
            .all()
        )
        if not rows:
            return {"pack_id": pack_id, "items": [], "summary": {}}

        summary = {
            "impressions": sum(r.impressions for r in rows),
            "reactions": sum(r.reactions for r in rows),
            "comments": sum(r.comments for r in rows),
            "shares": sum(r.shares for r in rows),
            "clicks": sum(r.clicks for r in rows),
            "saves": sum(r.saves for r in rows),
        }
        summary.update(compute_rates(summary))
        return {"pack_id": pack_id, "items": [row_to_dict(r) for r in rows], "summary": summary}
    finally:
        db.close()


@router.get("/metrics/leaderboard")
def metrics_leaderboard(window: str = Query("7d")):
    db = SessionLocal()
    try:
        if window not in {"7d", "30d"}:
            return {"error": "window must be 7d or 30d"}
        since = now_vn() - timedelta(days=7 if window == "7d" else 30)
        rows = db.query(ContentMetricDB).filter(ContentMetricDB.collected_at >= since).all()

        by_variant: dict[str, dict[str, Any]] = {}
        for r in rows:
            key = r.variant_id
            item = by_variant.setdefault(
                key,
                {
                    "variant_id": r.variant_id,
                    "pack_id": r.pack_id,
                    "impressions": 0,
                    "reactions": 0,
                    "comments": 0,
                    "shares": 0,
                    "clicks": 0,
                    "saves": 0,
                },
            )
            item["impressions"] += r.impressions
            item["reactions"] += r.reactions
            item["comments"] += r.comments
            item["shares"] += r.shares
            item["clicks"] += r.clicks
            item["saves"] += r.saves

        leaderboard = []
        for item in by_variant.values():
            item.update(compute_rates(item))
            score = item["engagement_rate"] * 0.6 + item["ctr"] * 0.4
            item["score"] = round(score, 6)
            variant = db.get(ContentVariantDB, item["variant_id"])
            item["content_angle"] = variant.content_angle if variant else ""
            leaderboard.append(item)

        leaderboard.sort(key=lambda x: x["score"], reverse=True)
        return {"window": window, "items": leaderboard[:100], "total": len(leaderboard)}
    finally:
        db.close()


@router.post("/publisher/jobs/{job_id}/collect-metrics")
def collect_metrics_for_job(job_id: str, window_label: str = Query("15m")):
    db = SessionLocal()
    try:
        job = db.get(PublishingJobDB, job_id)
        if not job:
            return {"error": "job not found"}
        result = (
            db.query(PublishingResultDB)
            .filter(PublishingResultDB.job_id == job_id)
            .order_by(PublishingResultDB.posted_at.desc())
            .first()
        )
        if not result or not result.platform_post_id:
            return {"error": "job has no platform post id"}
        cred = _resolve_credential(db, job.platform, job.target_id)
        if not cred:
            return {"error": "credential not found"}
        token = decrypt_token(cred.encrypted_token)

        if job.platform == "facebook":
            metrics = fetch_facebook_metrics(result.platform_post_id, token)
        elif job.platform == "threads":
            metrics = fetch_threads_metrics(result.platform_post_id, token)
        else:
            return {"error": f"unsupported platform {job.platform}"}

        rates = compute_rates(metrics)
        metric_id = f"metric-{uuid.uuid4().hex[:12]}"
        db.add(
            ContentMetricDB(
                id=metric_id,
                pack_id=job.pack_id,
                variant_id=job.variant_id,
                job_id=job.id,
                platform=job.platform,
                window_label=window_label,
                collected_at=now_vn(),
                impressions=metrics["impressions"],
                reactions=metrics["reactions"],
                comments=metrics["comments"],
                shares=metrics["shares"],
                clicks=metrics["clicks"],
                saves=metrics.get("saves", 0),
                ctr=rates["ctr"],
                engagement_rate=rates["engagement_rate"],
                save_rate=rates["save_rate"],
                raw_payload=json.dumps(metrics, ensure_ascii=False),
            )
        )
        pack = db.get(ContentPackDB, job.pack_id)
        if pack:
            pack.status = "measured"
            pack.updated_at = now_vn()
        job.status = "measured"
        job.updated_at = now_vn()
        db.commit()
        return {"ok": True, "metric_id": metric_id, "metrics": metrics, **rates}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()

