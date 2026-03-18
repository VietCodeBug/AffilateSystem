"""
Database connection and ORM models for Affiliate Shoppe backend.
"""

from __future__ import annotations

from datetime import datetime
from math import ceil

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from config import TIDB_URL, VN_TZ

if not TIDB_URL:
    raise RuntimeError("TIDB_URL not set in .env")

engine = create_engine(
    TIDB_URL,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False,
    connect_args={"ssl": {"ssl_mode": "VERIFY_IDENTITY"}} if "tidbcloud" in TIDB_URL else {},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def now_vn_naive() -> datetime:
    return datetime.now(VN_TZ).replace(tzinfo=None)


class ThreadDB(Base):
    __tablename__ = "threads"
    id = Column(String(100), primary_key=True)
    source = Column(String(20), index=True)
    title = Column(Text)
    url = Column(Text)
    author = Column(String(200), default="anonymous")
    replies = Column(Integer, default=0)
    views = Column(String(50), default="0")
    time_text = Column(String(200), default="")
    prefix = Column(String(100), default="")
    content = Column(Text, default="")
    thumbnail = Column(Text, default="")
    score = Column(Integer, default=0)
    crawled_at = Column(DateTime, default=now_vn_naive, index=True)
    sent_to_ai = Column(Boolean, default=False)
    deleted = Column(Boolean, default=False, index=True)


class CampaignDB(Base):
    __tablename__ = "campaigns"
    id = Column(String(100), primary_key=True)
    product_name = Column(String(500), default="")
    product_link = Column(Text, default="")
    bait = Column(Text, default="")
    hook = Column(Text, default="")
    shortened_link = Column(Text, default="")
    page_persona = Column(String(500), default="")
    source_thread_id = Column(String(100), default="")
    suggested_image = Column(Text, default="")
    status = Column(String(20), default="draft", index=True)
    created_at = Column(DateTime, default=now_vn_naive)


class LinkDB(Base):
    __tablename__ = "links"
    id = Column(String(100), primary_key=True)
    name = Column(String(500), default="")
    original_url = Column(Text, default="")
    affiliate_url = Column(Text, default="")
    shortened_url = Column(Text, default="")
    shortener = Column(String(50), default="")
    collection_name = Column(String(100), default="tech")
    clicks = Column(Integer, default=0)
    orders = Column(Integer, default=0)
    commission = Column(Float, default=0.0)
    created_at = Column(DateTime, default=now_vn_naive)


class SettingDB(Base):
    __tablename__ = "settings"
    key_name = Column(String(100), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=now_vn_naive, onupdate=now_vn_naive)


class ContentPackDB(Base):
    __tablename__ = "content_packs"
    id = Column(String(100), primary_key=True)
    link_id = Column(String(100), default="", index=True)
    product_name = Column(String(500), default="")
    product_link = Column(Text, default="")
    persona = Column(String(500), default="")
    tone = Column(String(100), default="balanced")
    platform_targets = Column(Text, default='["facebook","threads"]')
    status = Column(String(30), default="draft", index=True)
    selected_variant_id = Column(String(100), default="")
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_vn_naive, index=True)
    updated_at = Column(DateTime, default=now_vn_naive, onupdate=now_vn_naive)


class ContentVariantDB(Base):
    __tablename__ = "content_variants"
    id = Column(String(100), primary_key=True)
    pack_id = Column(String(100), index=True)
    variant_label = Column(String(20), default="A")
    post_text = Column(Text, default="")
    first_comment = Column(Text, default="")
    cta_level = Column(String(20), default="soft")
    hashtags = Column(Text, default="[]")
    image_prompt = Column(Text, default="")
    content_angle = Column(String(120), default="")
    risk_flags = Column(Text, default="[]")
    quality_score = Column(Float, default=0.0)
    spam_risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=now_vn_naive)


class PublishingJobDB(Base):
    __tablename__ = "publishing_jobs"
    id = Column(String(100), primary_key=True)
    pack_id = Column(String(100), index=True)
    variant_id = Column(String(100), index=True)
    platform = Column(String(20), index=True)  # facebook | threads
    target_id = Column(String(200), default="")  # page_id or threads_user_id
    scheduled_at = Column(DateTime, index=True)
    run_after = Column(DateTime, index=True)
    jitter_seconds = Column(Integer, default=0)
    status = Column(String(30), default="scheduled", index=True)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, default="")
    created_at = Column(DateTime, default=now_vn_naive)
    updated_at = Column(DateTime, default=now_vn_naive, onupdate=now_vn_naive)


class PublishingResultDB(Base):
    __tablename__ = "publishing_results"
    id = Column(String(100), primary_key=True)
    job_id = Column(String(100), index=True)
    pack_id = Column(String(100), index=True)
    variant_id = Column(String(100), index=True)
    platform = Column(String(20), index=True)
    status = Column(String(30), default="posted", index=True)
    platform_post_id = Column(String(200), default="", index=True)
    platform_comment_id = Column(String(200), default="")
    posted_at = Column(DateTime, default=now_vn_naive, index=True)
    response_payload = Column(Text, default="")


class ContentMetricDB(Base):
    __tablename__ = "content_metrics"
    id = Column(String(100), primary_key=True)
    pack_id = Column(String(100), index=True)
    variant_id = Column(String(100), index=True)
    job_id = Column(String(100), index=True)
    platform = Column(String(20), index=True)
    window_label = Column(String(20), index=True)  # 15m|2h|24h|72h
    collected_at = Column(DateTime, default=now_vn_naive, index=True)
    impressions = Column(Integer, default=0)
    reactions = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    ctr = Column(Float, default=0.0)
    engagement_rate = Column(Float, default=0.0)
    save_rate = Column(Float, default=0.0)
    raw_payload = Column(Text, default="")


class PlatformCredentialDB(Base):
    __tablename__ = "platform_credentials"
    id = Column(String(100), primary_key=True)
    platform = Column(String(20), index=True)
    account_id = Column(String(200), index=True)
    target_id = Column(String(200), default="")
    encrypted_token = Column(Text, default="")
    scopes = Column(Text, default="[]")
    expires_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=now_vn_naive)
    updated_at = Column(DateTime, default=now_vn_naive, onupdate=now_vn_naive)


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def db_get_all(model, filters=None, order_by=None, page=1, page_size=20):
    db = SessionLocal()
    try:
        query = db.query(model)
        if filters:
            for f in filters:
                query = query.filter(f)
        total = query.count()
        if order_by is not None:
            query = query.order_by(order_by)
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, ceil(total / page_size) if page_size else 1),
        }
    finally:
        db.close()


def db_get_by_id(model, record_id):
    db = SessionLocal()
    try:
        return db.get(model, record_id)
    finally:
        db.close()


def db_create(model, data: dict):
    db = SessionLocal()
    try:
        record = model(**data)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        print(f"DB create error: {e}")
        return None
    finally:
        db.close()


def db_update(model, record_id, data: dict):
    db = SessionLocal()
    try:
        record = db.get(model, record_id)
        if not record:
            return None
        for key, value in data.items():
            setattr(record, key, value)
        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        print(f"DB update error: {e}")
        return None
    finally:
        db.close()


def db_delete(model, record_id):
    db = SessionLocal()
    try:
        record = db.get(model, record_id)
        if not record:
            return False
        db.delete(record)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"DB delete error: {e}")
        return False
    finally:
        db.close()


def db_count(model, filters=None):
    db = SessionLocal()
    try:
        query = db.query(model)
        if filters:
            for f in filters:
                query = query.filter(f)
        return query.count()
    finally:
        db.close()


def db_upsert(model, record_id, data: dict):
    db = SessionLocal()
    try:
        existing = db.get(model, record_id)
        if existing:
            for key, value in data.items():
                setattr(existing, key, value)
            db.commit()
            db.refresh(existing)
            return existing
        payload = dict(data)
        payload.setdefault("id", record_id)
        record = model(**payload)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        print(f"DB upsert error: {e}")
        return None
    finally:
        db.close()


def row_to_dict(row):
    if row is None:
        return None
    output = {}
    for col in row.__table__.columns:
        value = getattr(row, col.name)
        output[col.name] = value.isoformat() if isinstance(value, datetime) else value
    return output

