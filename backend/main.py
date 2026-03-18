"""
Affiliate Shoppe — Backend v4.0
Bait & Hook Architecture: Crawler + AI Brain + Campaign Engine
Database: TiDB MySQL (Cloud)
"""

import uuid
import random
import json
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import GEMINI_KEY, VN_TZ
from database import (
    init_db, SessionLocal,
    ThreadDB, CampaignDB, LinkDB, SettingDB,
    db_get_all, db_get_by_id, db_count, db_create,
    db_update, db_delete, db_upsert, row_to_dict,
)
from crawlers.voz import crawl_voz, fetch_voz_content
from crawlers.reddit import crawl_reddit
from services.ai_brain import generate_bait_and_hook
from services.shortener import shorten_url
from api_v2 import router as organic_router


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class GenerateRequest(BaseModel):
    product_name: str
    product_link: str = ""
    page_persona: str = "Hội những người đi làm văn phòng"
    source_content: str = ""

class AffLinkCreate(BaseModel):
    name: str
    original_url: str
    collection: str = "📱 Công nghệ"

class CampaignUpdate(BaseModel):
    status: str

class ShopeeGenerateRequest(BaseModel):
    product_url: str

class ShopeeBulkRequest(BaseModel):
    urls: list[str]

class ShopeeCookieRequest(BaseModel):
    cookie_string: str

class ShopeeCredentialRequest(BaseModel):
    email: str
    password: str

class SettingsPayload(BaseModel):
    settings: dict


# ═══════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    init_db()
    gemini_status = "✅ Configured" if GEMINI_KEY else "❌ Missing"
    print(f"🧠 Gemini API: {gemini_status}")
    print(f"🗄️ Database: TiDB MySQL (Cloud)")

    # Start Telegram Bot
    from telegram_bot import start_telegram_bot, stop_telegram_bot
    start_telegram_bot()

    print(f"🚀 Bait & Hook Backend v4 ready!")
    yield

    # Shutdown
    stop_telegram_bot()

app = FastAPI(title="Affiliate Shoppe — Bait & Hook", version="4.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(organic_router)


# ─── Root ───

@app.get("/")
def root():
    return {
        "name": "🎣 Affiliate Shoppe — Bait & Hook Backend",
        "version": "4.0.0",
        "database": "TiDB MySQL",
        "endpoints": {
            "crawl": ["/api/crawl/voz", "/api/crawl/reddit", "/api/crawl/all"],
            "threads": ["/api/threads", "/api/threads/{id}", "/api/threads/{id}/content"],
            "ai": ["/api/ai/generate", "/api/ai/generate-from-thread/{thread_id}"],
            "campaigns": ["/api/campaigns", "/api/campaigns/{id}"],
            "links": ["/api/links"],
            "settings": ["/api/settings"],
            "stats": ["/api/stats"],
        },
    }


# ─── Crawl endpoints ───

@app.post("/api/crawl/voz")
def api_crawl_voz():
    """Cào Voz Forum — Chuyện trò linh tinh."""
    return crawl_voz()

@app.post("/api/crawl/reddit")
def api_crawl_reddit(subs: str | None = Query(None, description="Comma-separated subreddits")):
    """Cào Reddit — hot posts from subreddits."""
    sub_list = subs.split(",") if subs else None
    return crawl_reddit(sub_list)

@app.post("/api/crawl/all")
def api_crawl_all():
    """Cào tất cả nguồn."""
    voz_result = crawl_voz()
    reddit_result = crawl_reddit()
    return {
        "results": [voz_result, reddit_result],
        "total_new": (voz_result.get("new", 0) + reddit_result.get("new", 0)),
        "crawledAt": datetime.now(VN_TZ).isoformat(),
    }


# ─── Thread endpoints ───

@app.get("/api/threads")
def api_threads(
    source: str | None = Query(None, description="Filter by source: voz, reddit"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None, description="ISO format start date"),
    end_date: str | None = Query(None, description="ISO format end date"),
):
    """Danh sách bài đã cào (paginated)."""
    filters = [ThreadDB.deleted == False]
    if source:
        filters.append(ThreadDB.source == source)
    if start_date:
        filters.append(ThreadDB.crawled_at >= start_date)
    if end_date:
        filters.append(ThreadDB.crawled_at <= end_date)

    result = db_get_all(
        ThreadDB,
        filters=filters,
        order_by=ThreadDB.crawled_at.desc(),
        page=page,
        page_size=page_size,
    )
    return {
        "threads": [row_to_dict(t) for t in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


@app.get("/api/threads/{thread_id}")
def api_thread_detail(thread_id: str):
    """Chi tiết 1 bài."""
    thread = db_get_by_id(ThreadDB, thread_id)
    if not thread:
        return {"error": "Thread not found"}
    return {"thread": row_to_dict(thread)}


@app.get("/api/threads/{thread_id}/content")
def api_thread_content(thread_id: str):
    """Lấy nội dung chi tiết (cào on-demand cho Voz)."""
    thread = db_get_by_id(ThreadDB, thread_id)
    if not thread:
        return {"error": "Thread not found"}

    if thread.content:
        return {"content": thread.content, "cached": True}

    if thread.source == "voz" and thread.url:
        content = fetch_voz_content(thread.url)
        if content:
            db_update(ThreadDB, thread_id, {"content": content})
            return {"content": content, "cached": False}

    return {"content": "", "cached": False}


@app.delete("/api/threads/{thread_id}")
def api_delete_thread(thread_id: str):
    """Soft delete một bài."""
    db_update(ThreadDB, thread_id, {"deleted": True})
    return {"ok": True}


# ─── AI Brain endpoints ───

@app.post("/api/ai/generate")
async def api_ai_generate(req: GenerateRequest):
    """Sinh content kép: Bait + Hook."""
    result = generate_bait_and_hook(
        product_name=req.product_name,
        product_link=req.product_link,
        page_persona=req.page_persona,
        source_content=req.source_content,
    )

    if result.get("error"):
        return result

    # Shorten product link
    short_link = ""
    if req.product_link:
        s = shorten_url(req.product_link)
        short_link = s.get("shortened", req.product_link)

    # Create campaign
    campaign_id = f"camp-{uuid.uuid4().hex[:12]}"
    now = datetime.now(VN_TZ).replace(tzinfo=None)
    db_create(CampaignDB, {
        "id": campaign_id,
        "product_name": req.product_name,
        "product_link": req.product_link,
        "bait": result.get("bait", ""),
        "hook": result.get("hook", ""),
        "shortened_link": short_link,
        "page_persona": req.page_persona,
        "suggested_image": result.get("suggested_image", ""),
        "status": "draft",
        "created_at": now,
    })

    return {
        **result,
        "campaign_id": campaign_id,
        "shortened_link": short_link,
    }


@app.post("/api/ai/generate-from-thread/{thread_id}")
async def api_ai_generate_from_thread(
    thread_id: str,
    product_name: str = Query(..., description="Tên sản phẩm"),
    product_link: str = Query("", description="Link sản phẩm"),
    page_persona: str = Query("Hội những người đi làm văn phòng", description="Persona Page"),
):
    """Sinh content kép từ bài đã cào."""
    print(f"\n🚀 [API] generate-from-thread called: thread_id={thread_id}, product={product_name}")

    thread = db_get_by_id(ThreadDB, thread_id)
    if not thread:
        return {"error": f"Thread {thread_id} not found"}

    print(f"   => Thread found: '{thread.title[:50]}...' (source={thread.source})")

    source_content = thread.content or thread.title

    result = generate_bait_and_hook(
        product_name=product_name,
        product_link=product_link,
        page_persona=page_persona,
        source_content=source_content,
    )

    if result.get("error"):
        return result

    short_link = ""
    if product_link:
        s = shorten_url(product_link)
        short_link = s.get("shortened", product_link)

    campaign_id = f"camp-{uuid.uuid4().hex[:12]}"
    now = datetime.now(VN_TZ).replace(tzinfo=None)
    db_create(CampaignDB, {
        "id": campaign_id,
        "product_name": product_name,
        "product_link": product_link,
        "bait": result.get("bait", ""),
        "hook": result.get("hook", ""),
        "shortened_link": short_link,
        "page_persona": page_persona,
        "source_thread_id": thread_id,
        "suggested_image": result.get("suggested_image", ""),
        "status": "draft",
        "created_at": now,
    })

    # Mark thread as sent
    db_update(ThreadDB, thread_id, {"sent_to_ai": True})

    return {
        **result,
        "campaign_id": campaign_id,
        "shortened_link": short_link,
        "thread_title": thread.title,
    }


# ─── Campaign endpoints ───

@app.get("/api/campaigns")
def api_campaigns(
    status: str | None = Query(None, description="Filter: draft, approved, posted, failed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Danh sách chiến dịch (paginated)."""
    filters = []
    if status:
        filters.append(CampaignDB.status == status)

    result = db_get_all(
        CampaignDB,
        filters=filters,
        order_by=CampaignDB.created_at.desc(),
        page=page,
        page_size=page_size,
    )
    return {
        "campaigns": [row_to_dict(c) for c in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


@app.get("/api/campaigns/{campaign_id}")
def api_campaign_detail(campaign_id: str):
    """Chi tiết chiến dịch."""
    camp = db_get_by_id(CampaignDB, campaign_id)
    if not camp:
        return {"error": "Campaign not found"}
    return {"campaign": row_to_dict(camp)}


@app.patch("/api/campaigns/{campaign_id}")
def api_update_campaign(campaign_id: str, data: CampaignUpdate):
    """Cập nhật trạng thái chiến dịch."""
    db_update(CampaignDB, campaign_id, {"status": data.status})
    return {"ok": True, "status": data.status}


@app.delete("/api/campaigns/{campaign_id}")
def api_delete_campaign(campaign_id: str):
    """Xóa chiến dịch."""
    db_delete(CampaignDB, campaign_id)
    return {"ok": True}


# ─── Affiliate Links endpoints ───

@app.get("/api/links")
def api_links(
    collection_filter: str | None = Query(None, alias="collection"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Danh sách link affiliate (paginated)."""
    filters = []
    if collection_filter:
        filters.append(LinkDB.collection_name == collection_filter)

    result = db_get_all(
        LinkDB,
        filters=filters,
        order_by=LinkDB.created_at.desc(),
        page=page,
        page_size=page_size,
    )
    return {
        "links": [row_to_dict(l) for l in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


@app.post("/api/links")
def api_create_link(req: AffLinkCreate):
    """Thêm link affiliate mới (auto shorten)."""
    short = shorten_url(req.original_url)
    link_id = f"link-{uuid.uuid4().hex[:12]}"
    now = datetime.now(VN_TZ).replace(tzinfo=None)

    link_data = {
        "id": link_id,
        "name": req.name,
        "original_url": req.original_url,
        "shortened_url": short.get("shortened", req.original_url),
        "shortener": short.get("service", "none"),
        "collection_name": req.collection,
        "clicks": 0,
        "orders": 0,
        "commission": 0.0,
        "created_at": now,
    }
    db_create(LinkDB, link_data)
    link_data["created_at"] = now.isoformat()
    return {"link": link_data}


@app.delete("/api/links/{link_id}")
def api_delete_link(link_id: str):
    """Xóa link affiliate."""
    db_delete(LinkDB, link_id)
    return {"ok": True}


@app.get("/api/links/random")
def api_random_link():
    """Lấy random 1 link affiliate."""
    result = db_get_all(LinkDB, page=1, page_size=999)
    items = result["items"]
    if not items:
        return {"error": "Chưa có link nào"}
    chosen = random.choice(items)
    return {"link": row_to_dict(chosen)}


# ─── Settings endpoints ───

@app.get("/api/settings")
def api_get_settings():
    """Đọc tất cả settings."""
    db = SessionLocal()
    try:
        rows = db.query(SettingDB).all()
        settings = {}
        for row in rows:
            try:
                settings[row.key_name] = json.loads(row.value)
            except (json.JSONDecodeError, TypeError):
                settings[row.key_name] = row.value
        return {"settings": settings}
    finally:
        db.close()


@app.post("/api/settings")
def api_save_settings(payload: SettingsPayload):
    """Lưu settings vào DB."""
    db = SessionLocal()
    try:
        for key, value in payload.settings.items():
            val_str = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
            existing = db.query(SettingDB).get(key)
            if existing:
                existing.value = val_str
                existing.updated_at = datetime.now(VN_TZ).replace(tzinfo=None)
            else:
                db.add(SettingDB(
                    key_name=key,
                    value=val_str,
                    updated_at=datetime.now(VN_TZ).replace(tzinfo=None),
                ))
        db.commit()
        return {"ok": True, "saved": len(payload.settings)}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


# ─── Stats endpoint ───

@app.get("/api/stats")
def api_stats():
    """Thống kê tổng."""
    return {
        "voz": db_count(ThreadDB, [ThreadDB.source == "voz", ThreadDB.deleted == False]),
        "reddit": db_count(ThreadDB, [ThreadDB.source == "reddit", ThreadDB.deleted == False]),
        "total_threads": db_count(ThreadDB, [ThreadDB.deleted == False]),
        "campaigns": {
            "total": db_count(CampaignDB),
            "draft": db_count(CampaignDB, [CampaignDB.status == "draft"]),
            "approved": db_count(CampaignDB, [CampaignDB.status == "approved"]),
            "posted": db_count(CampaignDB, [CampaignDB.status == "posted"]),
        },
        "links": db_count(LinkDB),
        "gemini": "configured" if GEMINI_KEY else "missing",
        "database": "tidb_mysql",
    }

# ─── Telegram Bot endpoints ───

from telegram_bot import get_telegram_status

@app.get("/api/telegram/status")
def api_telegram_status():
    """Kiểm tra trạng thái Telegram Bot."""
    return get_telegram_status()


# ─── Shopee Bot endpoints ───

from shopee_bot import shopee_login, generate_affiliate_link, bulk_generate_links, has_cookies, get_user_info, shopee_logout, auto_crawl_products, shopee_cookie_login, shopee_credential_login, _run_in_thread

@app.get("/api/shopee/status")
def api_shopee_status():
    """Kiểm tra trạng thái login Shopee."""
    logged_in = has_cookies()
    user_info = get_user_info() if logged_in else {}
    return {
        "logged_in": logged_in,
        "username": user_info.get("username", ""),
        "avatar": user_info.get("avatar", ""),
        "message": f"Đã đăng nhập: {user_info.get('username', 'Shopee User')}" if logged_in else "Chưa đăng nhập. Gọi /api/shopee/login"
    }

@app.post("/api/shopee/login")
def api_shopee_login():
    """Mở trình duyệt cho user đăng nhập Shopee."""
    result = _run_in_thread(shopee_login)
    return result

@app.post("/api/shopee/cookie-login")
def api_shopee_cookie_login(req: ShopeeCookieRequest):
    """Đăng nhập bằng cách truyền raw cookie string."""
    if not req.cookie_string.strip():
        return {"error": "Cookie trống."}
    result = _run_in_thread(shopee_cookie_login, req.cookie_string.strip())
    return result

@app.post("/api/shopee/credential-login")
def api_shopee_credential_login(req: ShopeeCredentialRequest):
    """Đăng nhập bằng email/password — Playwright tự điền vào form."""
    if not req.email.strip() or not req.password.strip():
        return {"error": "Email hoặc mật khẩu trống."}
    result = _run_in_thread(shopee_credential_login, req.email.strip(), req.password.strip())
    return result

@app.post("/api/shopee/logout")
def api_shopee_logout():
    """Đăng xuất Shopee — xóa cookies & user info."""
    return shopee_logout()

@app.post("/api/shopee/generate-link")
def api_shopee_generate(req: ShopeeGenerateRequest):
    """Tự động tạo link affiliate Shopee."""
    if not req.product_url.strip():
        return {"error": "Thiếu product_url"}
    result = _run_in_thread(generate_affiliate_link, req.product_url.strip())

    if result.get("success") and result.get("affiliate_link"):
        aff_link = result["affiliate_link"]
        short = shorten_url(aff_link)
        link_id = f"aff-{uuid.uuid4().hex[:12]}"
        now = datetime.now(VN_TZ).replace(tzinfo=None)
        link_data = {
            "id": link_id,
            "name": f"Shopee Auto — {req.product_url[:50]}",
            "original_url": req.product_url,
            "affiliate_url": aff_link,
            "shortened_url": short.get("shortened", aff_link),
            "shortener": short.get("service", "direct"),
            "collection_name": "📱 Công nghệ",
            "clicks": 0,
            "orders": 0,
            "commission": 0.0,
            "created_at": now,
        }
        db_create(LinkDB, link_data)
        result["saved_link"] = {**link_data, "created_at": now.isoformat()}

    return result

@app.post("/api/shopee/bulk-generate")
def api_shopee_bulk(req: ShopeeBulkRequest):
    """Tạo link affiliate cho nhiều URL."""
    if not req.urls:
        return {"error": "Thiếu danh sách URLs"}
    results = _run_in_thread(bulk_generate_links, req.urls)
    return {"results": results, "total": len(results)}

@app.post("/api/shopee/auto-crawl")
def api_shopee_auto_crawl(max_products: int = Query(20, ge=1, le=50)):
    """Tự động quét sản phẩm từ Shopee Affiliate Portal."""
    result = _run_in_thread(auto_crawl_products, max_products)
    return result



# ─── Google Drive endpoints ───

from services.google_drive import list_files as drive_list_files, get_file_detail as drive_file_detail, get_folder_stats as drive_folder_stats, get_embed_url, get_download_url

@app.get("/api/drive/files")
def api_drive_files(
    folder_id: str | None = Query(None, description="Folder ID (default: root folder)"),
    page_size: int = Query(50, ge=1, le=100),
    page_token: str | None = Query(None),
    mime_filter: str | None = Query(None, description="Filter: video, image, audio"),
    search: str | None = Query(None, description="Search by name"),
):
    """Danh sách files từ Google Drive."""
    return drive_list_files(
        folder_id=folder_id,
        page_size=page_size,
        page_token=page_token,
        mime_filter=mime_filter,
        search_query=search,
    )

@app.get("/api/drive/files/{file_id}")
def api_drive_file_detail(file_id: str):
    """Chi tiết 1 file trên Drive."""
    detail = drive_file_detail(file_id)
    if detail.get("error"):
        return detail
    detail["embedUrl"] = get_embed_url(file_id, detail.get("mimeType", ""))
    detail["downloadUrl"] = get_download_url(file_id)
    return detail

@app.get("/api/drive/stats")
def api_drive_stats(folder_id: str | None = Query(None)):
    """Thống kê folder Drive."""
    return drive_folder_stats(folder_id)



# ─── Video Translator endpoints ───

from services.video_translator import translate_video, get_job, list_jobs, list_output_files
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse

class VideoTranslateRequest(BaseModel):
    url: str
    voice: str = "vi-VN-HoaiMyNeural"
    subtitle_interval: float = 1.5
    crop_ratio: float = 0.18

@app.post("/api/video/translate")
def api_video_translate(req: VideoTranslateRequest, background_tasks: BackgroundTasks):
    """Bắt đầu dịch video (background task)."""
    import uuid
    job_id = f"vtrans-{uuid.uuid4().hex[:10]}"

    def run_translation():
        translate_video(
            url=req.url,
            voice=req.voice,
            subtitle_interval=req.subtitle_interval,
            crop_ratio=req.crop_ratio,
        )

    background_tasks.add_task(run_translation)
    return {"job_id": job_id, "status": "started", "message": "Đang bắt đầu dịch video..."}

@app.get("/api/video/translate/{job_id}/status")
def api_video_status(job_id: str):
    """Kiểm tra tiến trình dịch video."""
    job = get_job(job_id)
    if not job:
        return {"error": "Job not found"}
    return job

@app.get("/api/video/translate/history")
def api_video_history():
    """Danh sách video đã dịch."""
    return {
        "jobs": list_jobs(),
        "output_files": list_output_files(),
    }

@app.get("/api/video/output/{filename}")
def api_video_output(filename: str):
    """Tải video đã dịch."""
    import os
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    file_path = os.path.join(output_dir, filename)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="video/mp4", filename=filename)


# ═══════════════════════════════════════════
# Run
# ═══════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    print("🎣 Affiliate Shoppe — Bait & Hook Backend v4")
    print("🗄️ Database: TiDB MySQL (Cloud)")
    print("🤖 Shopee Bot: Playwright Automation")
    print("📁 Google Drive: Media Library")
    print("=" * 48)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

