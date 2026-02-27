"""
Affiliate Shoppe — Backend v3.0
Bait & Hook Architecture: Crawler + AI Brain + Campaign Engine
Database: Firebase Firestore + Realtime DB
"""

import os
import re
import json
import hashlib
import random
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from contextlib import asynccontextmanager

import requests
from curl_cffi import requests as cf_requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

# Load .env from project root
load_dotenv(Path(__file__).parent.parent / ".env")

# ═══════════════════════════════════════════
# Config
# ═══════════════════════════════════════════

GEMINI_KEY = os.getenv("GEMINI_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
}

VN_TZ = timezone(timedelta(hours=7))

# Reddit subreddits to crawl
REDDIT_SUBS = [
    "vozforums",
    "VietNam",
    "TroChuyenLinhTinh",
    "funny",
    "memes",
    "AskReddit",
]

# URL Shortener services for rotation
SHORTENER_SERVICES = ["tinyurl", "isgd", "clckru"]

# Firebase Config
FIREBASE_API_KEY = "AIzaSyDr45dIRNX8wE12nZzA7FlspVv-hIThPQk"
FIREBASE_PROJECT_ID = "affialtesystem"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"
RTDB_URL = "https://affialtesystem-default-rtdb.firebaseio.com"

# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class GenerateRequest(BaseModel):
    product_name: str
    product_link: str = ""
    page_persona: str = "Hội những người đi làm văn phòng"
    source_content: str = ""  # optional: crawled content as inspiration

class AffLinkCreate(BaseModel):
    name: str
    original_url: str
    collection: str = "📱 Công nghệ"

class CampaignUpdate(BaseModel):
    status: str  # draft, approved, posted, failed


# ═══════════════════════════════════════════
# Firebase Firestore Helper (REST API)
# ═══════════════════════════════════════════

def _to_firestore_value(v):
    """Convert Python value to Firestore REST API format."""
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    return {"stringValue": str(v)}

def _from_firestore_value(v):
    """Convert Firestore REST API value to Python."""
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    if "nullValue" in v:
        return None
    return str(v)

def _to_firestore_doc(data: dict) -> dict:
    """Convert dict to Firestore document format."""
    return {"fields": {k: _to_firestore_value(v) for k, v in data.items()}}

def _from_firestore_doc(doc: dict) -> dict:
    """Convert Firestore document to dict."""
    fields = doc.get("fields", {})
    result = {k: _from_firestore_value(v) for k, v in fields.items()}
    # Extract ID from document name
    name = doc.get("name", "")
    if name:
        result["id"] = name.split("/")[-1]
    return result

def firestore_set(collection: str, doc_id: str, data: dict) -> bool:
    """Create or replace document."""
    url = f"{FIRESTORE_URL}/{collection}/{doc_id}?key={FIREBASE_API_KEY}"
    resp = requests.patch(url, json=_to_firestore_doc(data), timeout=10)
    return resp.status_code == 200

def firestore_get(collection: str, doc_id: str) -> dict | None:
    """Get a single document."""
    url = f"{FIRESTORE_URL}/{collection}/{doc_id}?key={FIREBASE_API_KEY}"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        return None
    return _from_firestore_doc(resp.json())

def firestore_add(collection: str, data: dict) -> str:
    """Add document with auto-generated ID."""
    url = f"{FIRESTORE_URL}/{collection}?key={FIREBASE_API_KEY}"
    resp = requests.post(url, json=_to_firestore_doc(data), timeout=10)
    if resp.status_code == 200:
        doc = resp.json()
        return doc.get("name", "").split("/")[-1]
    return ""

def firestore_delete(collection: str, doc_id: str) -> bool:
    """Delete document."""
    url = f"{FIRESTORE_URL}/{collection}/{doc_id}?key={FIREBASE_API_KEY}"
    resp = requests.delete(url, timeout=10)
    return resp.status_code == 200

def firestore_query(collection: str) -> list[dict]:
    """Get all documents in collection."""
    url = f"{FIRESTORE_URL}/{collection}?key={FIREBASE_API_KEY}&pageSize=200"
    resp = requests.get(url, timeout=15)
    if resp.status_code != 200:
        return []
    data = resp.json()
    docs = data.get("documents", [])
    return [_from_firestore_doc(d) for d in docs]


# ═══════════════════════════════════════════
# Realtime DB Helper (REST API)
# ═══════════════════════════════════════════

def rtdb_set(path: str, data) -> bool:
    """Set value at path."""
    url = f"{RTDB_URL}/{path}.json?key={FIREBASE_API_KEY}"
    resp = requests.put(url, json=data, timeout=5)
    return resp.status_code == 200

def rtdb_update(path: str, data: dict) -> bool:
    """Update value at path."""
    url = f"{RTDB_URL}/{path}.json?key={FIREBASE_API_KEY}"
    resp = requests.patch(url, json=data, timeout=5)
    return resp.status_code == 200

def rtdb_push(path: str, data) -> str:
    """Push new child to path."""
    url = f"{RTDB_URL}/{path}.json?key={FIREBASE_API_KEY}"
    resp = requests.post(url, json=data, timeout=5)
    if resp.status_code == 200:
        return resp.json().get("name", "")
    return ""

def rtdb_get(path: str):
    """Get value at path."""
    url = f"{RTDB_URL}/{path}.json?key={FIREBASE_API_KEY}"
    resp = requests.get(url, timeout=5)
    if resp.status_code == 200:
        return resp.json()
    return None


# ═══════════════════════════════════════════
# Thread operations (via Firestore)
# ═══════════════════════════════════════════

def save_threads(threads: list[dict]) -> int:
    """Save threads to Firestore, skip duplicates."""
    saved = 0
    for t in threads:
        tid = t.get("id", "")
        if not tid:
            continue
        # Check if exists
        existing = firestore_get("threads", tid)
        if existing:
            continue
        doc_data = {
            "source": t.get("source", ""),
            "title": t.get("title", ""),
            "url": t.get("url", ""),
            "author": t.get("author", "Ẩn danh"),
            "replies": t.get("replies", 0),
            "views": t.get("views", "0"),
            "time_text": t.get("time", ""),
            "prefix": t.get("prefix", ""),
            "content": t.get("content", ""),
            "thumbnail": t.get("thumbnail", ""),
            "score": t.get("score", 0),
            "crawled_at": datetime.now(VN_TZ).isoformat(),
            "sent_to_ai": False,
            "deleted": False,
        }
        if firestore_set("threads", tid, doc_data):
            saved += 1
    return saved

def get_threads(source: str | None = None, limit: int = 50):
    all_threads = firestore_query("threads")
    # Filter
    filtered = [t for t in all_threads if not t.get("deleted", False)]
    if source:
        filtered = [t for t in filtered if t.get("source") == source]
    # Sort by crawled_at desc
    filtered.sort(key=lambda x: x.get("crawled_at", ""), reverse=True)
    return filtered[:limit]

def get_thread_by_id(thread_id: str):
    return firestore_get("threads", thread_id)

def count_threads(source: str | None = None):
    return len(get_threads(source=source, limit=9999))

def delete_thread(thread_id: str):
    thread = firestore_get("threads", thread_id)
    if thread:
        thread["deleted"] = True
        firestore_set("threads", thread_id, thread)


# ═══════════════════════════════════════════
# Voz Crawler
# ═══════════════════════════════════════════

def fetch_voz_content(url: str) -> str:
    """Cào nội dung chi tiết 1 bài Voz."""
    try:
        resp = cf_requests.get(url, headers=HEADERS, timeout=10, impersonate="chrome")
        if resp.status_code != 200:
            return ""
        soup = BeautifulSoup(resp.text, "lxml")
        first_post = soup.select_one(".message-body .bbWrapper")
        if first_post:
            for tag in first_post.select("blockquote, script, style"):
                tag.decompose()
            return first_post.get_text(separator="\n", strip=True)[:2000]
        return ""
    except Exception:
        return ""


def crawl_voz() -> dict:
    """Cào Voz Forum — Chuyện trò linh tinh (f17)."""
    url = "https://voz.vn/f/chuyen-tro-linh-tinh.17/"
    try:
        resp = cf_requests.get(url, headers=HEADERS, timeout=15, impersonate="chrome")
        resp.raise_for_status()
    except Exception as e:
        return {"error": str(e), "threads": [], "source": "voz"}

    soup = BeautifulSoup(resp.text, "lxml")
    threads = []

    for item in soup.select(".structItem--thread"):
        title_el = item.select_one(".structItem-title")
        if not title_el:
            continue

        link_el = None
        for a in title_el.find_all("a"):
            if "labelLink" not in a.get("class", []):
                link_el = a
                break

        if not link_el:
            continue

        title = link_el.get_text(strip=True)
        href = link_el.get("href", "")
        if not title:
            continue

        match = re.search(r"\.(\d+)/?$", href)
        thread_id = f"voz-{match.group(1)}" if match else f"voz-{hashlib.md5(title.encode()).hexdigest()[:10]}"

        author_el = item.select_one(".structItem-minor .username, .structItem-parts .username")
        author = author_el.get_text(strip=True) if author_el else "Ẩn danh"

        cells = item.select(".structItem-cell--meta .pairs dd")
        replies = 0
        views = "0"
        if len(cells) >= 1:
            replies_text = cells[0].get_text(strip=True).replace(".", "").replace(",", "")
            try:
                replies = int(replies_text)
            except ValueError:
                pass
        if len(cells) >= 2:
            views = cells[1].get_text(strip=True)

        time_el = item.select_one("time.structItem-latestDate, time")
        time_text = ""
        if time_el:
            time_text = time_el.get_text(strip=True) or time_el.get("title", "")

        prefix_el = item.select_one(".label, .labelLink")
        prefix = prefix_el.get_text(strip=True) if prefix_el else ""

        full_url = href if href.startswith("http") else f"https://voz.vn{href}"

        threads.append({
            "id": thread_id,
            "source": "voz",
            "title": title,
            "url": full_url,
            "author": author,
            "replies": replies,
            "views": views,
            "time": time_text,
            "prefix": prefix,
            "content": "",
        })

    new_count = save_threads(threads)

    return {
        "source": "voz",
        "sourceName": "Voz Forum",
        "sourceUrl": url,
        "total": len(threads),
        "new": new_count,
        "crawledAt": datetime.now(VN_TZ).isoformat(),
        "threads": threads,
    }


# ═══════════════════════════════════════════
# Reddit Crawler
# ═══════════════════════════════════════════

def crawl_reddit(subreddits: list[str] | None = None) -> dict:
    """Cào Reddit bằng JSON API — không cần API key."""
    subs = subreddits or REDDIT_SUBS
    all_threads = []

    for sub in subs:
        try:
            url = f"https://www.reddit.com/r/{sub}/hot.json?limit=25"
            resp = requests.get(url, headers={
                "User-Agent": "windows:affiliateshoppebot:v1.0 (by /u/AffiliateBot)",
                "Accept": "application/json",
            }, timeout=10)

            if resp.status_code != 200:
                continue

            data = resp.json()
            posts = data.get("data", {}).get("children", [])

            for post in posts:
                p = post.get("data", {})
                if p.get("stickied"):
                    continue

                post_id = f"reddit-{p.get('id', '')}"
                title = p.get("title", "").strip()
                if not title:
                    continue

                content = p.get("selftext", "")[:2000]
                if not content and p.get("url"):
                    is_reddit = "reddit.com" in p.get("url", "")
                    if not is_reddit:
                        content = f"🔗 Link: {p['url']}"

                thumbnail = p.get("thumbnail", "")
                if thumbnail in ("self", "default", "nsfw", "spoiler", ""):
                    thumbnail = ""

                created_utc = p.get("created_utc", 0)
                if created_utc:
                    dt = datetime.fromtimestamp(created_utc, tz=VN_TZ)
                    time_text = dt.strftime("%d/%m %H:%M")
                else:
                    time_text = ""

                views_raw = p.get("ups", 0)
                if views_raw >= 1000:
                    views_str = f"{views_raw / 1000:.1f}K"
                else:
                    views_str = str(views_raw)

                all_threads.append({
                    "id": post_id,
                    "source": "reddit",
                    "title": title,
                    "url": f"https://www.reddit.com{p.get('permalink', '')}",
                    "author": p.get("author", "anonymous"),
                    "replies": p.get("num_comments", 0),
                    "views": views_str,
                    "time": time_text,
                    "prefix": f"r/{sub}",
                    "content": content,
                    "thumbnail": thumbnail,
                    "score": p.get("ups", 0),
                })

        except Exception as e:
            print(f"⚠️ Reddit r/{sub} error: {e}")
            continue

    new_count = save_threads(all_threads)

    return {
        "source": "reddit",
        "sourceName": "Reddit",
        "sourceUrl": "https://www.reddit.com",
        "subreddits": subs,
        "total": len(all_threads),
        "new": new_count,
        "crawledAt": datetime.now(VN_TZ).isoformat(),
        "threads": all_threads,
    }


# ═══════════════════════════════════════════
# AI Brain — Gemini Dual Content Generator
# ═══════════════════════════════════════════

def generate_bait_and_hook(product_name: str, product_link: str = "",
                           page_persona: str = "", source_content: str = "") -> dict:
    """Call Gemini to generate Bait (viral post) + Hook (sales comment) pair."""
    if not GEMINI_KEY:
        return {"error": "Chưa cấu hình GEMINI_KEY trong .env"}

    client = genai.Client(api_key=GEMINI_KEY)

    persona_desc = page_persona or "Hội những người đi làm văn phòng"
    source_hint = ""
    if source_content:
        source_hint = f"\n\nLấy cảm hứng từ nội dung này (nhưng viết lại hoàn toàn, KHÔNG copy): {source_content[:500]}"

    prompt = f"""Bạn là hệ thống tạo content tự động cho Fanpage Facebook: "{persona_desc}".
Nhiệm vụ: Tạo ra 1 cặp nội dung "Mồi nhử & Lưỡi câu" (Bait & Hook) để đăng bài tự động.

Sản phẩm cần quảng cáo: {product_name}
{f'Link sản phẩm: {product_link}' if product_link else ''}
{source_hint}

📝 YÊU CẦU:

1. **BAIT (Mồi nhử — Bài đăng chính):**
   - Thuần túy giải trí/tâm sự/hài hước, KHÔNG nhắc một chữ nào đến sản phẩm hay mua bán
   - Mục đích duy nhất: Câu Like, Share, Tag bạn bè, gây đồng cảm hoặc tò mò
   - Phong cách: Gen Z, vô tri, hài hước hoặc sầu đời kiểu "meme văn phòng"
   - Độ dài: 2-5 câu, có thể dùng emoji nhưng đừng quá nhiều
   - PHẢI viết bằng tiếng Việt

2. **HOOK (Lưỡi câu — Comment bẻ lái):**
   - Một bình luận ngắn (1-2 câu) tạo cú "bẻ lái" (twist) từ nội dung bài đăng sang sản phẩm
   - Phải tự nhiên, không nhìn giống quảng cáo, kiểu "than vãn" hoặc "tấu hài" rồi chèn link
   - Kết thúc bằng: {product_link if product_link else '[LINK]'}
   - PHẢI viết bằng tiếng Việt

⚠️ QUAN TRỌNG: Trả về KẾT QUẢ dưới dạng JSON hợp lệ, KHÔNG có markdown code block:
{{
  "bait": "nội dung bài đăng...",
  "hook": "nội dung comment bẻ lái...",
  "suggested_image": "mô tả ảnh phù hợp cho bài đăng, bằng tiếng Anh, dùng để prompt AI vẽ"
}}

Chỉ trả về JSON, không giải thích gì thêm."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = response.text.strip()
        # Clean markdown code blocks if any
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        return {
            "bait": result.get("bait", ""),
            "hook": result.get("hook", ""),
            "suggested_image": result.get("suggested_image", ""),
        }
    except json.JSONDecodeError:
        return {"bait": raw[:500], "hook": "", "suggested_image": "", "warning": "AI response was not valid JSON"}
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════
# Campaign operations (via Firestore)
# ═══════════════════════════════════════════

def create_campaign(bait: str, hook: str, product_name: str, product_link: str = "",
                    shortened_link: str = "", page_persona: str = "",
                    source_thread_id: str = "", suggested_image: str = "") -> dict:
    campaign_id = f"camp-{uuid.uuid4().hex[:12]}"
    now = datetime.now(VN_TZ).isoformat()
    data = {
        "bait_content": bait,
        "hook_comment": hook,
        "product_name": product_name,
        "product_link": product_link,
        "shortened_link": shortened_link,
        "page_persona": page_persona,
        "source_thread_id": source_thread_id,
        "suggested_image": suggested_image,
        "status": "draft",
        "post_id": "",
        "created_at": now,
        "posted_at": "",
        "error_msg": "",
    }
    firestore_set("campaigns", campaign_id, data)
    return {"id": campaign_id, "status": "draft", "created_at": now}

def get_campaigns(status: str | None = None, limit: int = 50):
    all_camps = firestore_query("campaigns")
    if status:
        all_camps = [c for c in all_camps if c.get("status") == status]
    all_camps.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return all_camps[:limit]

def update_campaign_status(campaign_id: str, status: str):
    camp = firestore_get("campaigns", campaign_id)
    if camp:
        camp["status"] = status
        if "id" in camp:
            del camp["id"]  # Don't save 'id' as a field
        firestore_set("campaigns", campaign_id, camp)

def delete_campaign(campaign_id: str):
    firestore_delete("campaigns", campaign_id)

def count_campaigns(status: str | None = None):
    return len(get_campaigns(status=status, limit=9999))


# ═══════════════════════════════════════════
# URL Shortener
# ═══════════════════════════════════════════

def shorten_url(url: str) -> dict:
    """Shorten URL using rotating services."""
    service = random.choice(SHORTENER_SERVICES)
    try:
        if service == "tinyurl":
            resp = requests.get(f"https://tinyurl.com/api-create.php?url={url}", timeout=5)
            if resp.status_code == 200:
                return {"shortened": resp.text.strip(), "service": "tinyurl"}
        elif service == "isgd":
            resp = requests.get(f"https://is.gd/create.php?format=simple&url={url}", timeout=5)
            if resp.status_code == 200:
                return {"shortened": resp.text.strip(), "service": "is.gd"}
        elif service == "clckru":
            resp = requests.get(f"https://clck.ru/--?url={url}", timeout=5)
            if resp.status_code == 200:
                return {"shortened": resp.text.strip(), "service": "clck.ru"}
    except Exception:
        pass
    # Fallback
    try:
        resp = requests.get(f"https://tinyurl.com/api-create.php?url={url}", timeout=5)
        if resp.status_code == 200:
            return {"shortened": resp.text.strip(), "service": "tinyurl"}
    except Exception:
        pass
    return {"shortened": url, "service": "none"}


# ═══════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    gemini_status = "✅ Configured" if GEMINI_KEY else "❌ Missing"
    print(f"🧠 Gemini API: {gemini_status}")
    print(f"🔥 Firebase: {FIREBASE_PROJECT_ID}")
    print(f"🚀 Bait & Hook Backend v3 ready!")
    yield

app = FastAPI(title="Affiliate Shoppe — Bait & Hook", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "Affiliate Shoppe — Bait & Hook",
        "version": "3.0.0",
        "database": "Firebase Firestore + Realtime DB",
        "gemini": "configured" if GEMINI_KEY else "missing",
        "firebase_project": FIREBASE_PROJECT_ID,
        "endpoints": {
            "crawl": ["/api/crawl/voz", "/api/crawl/reddit", "/api/crawl/all"],
            "threads": ["/api/threads", "/api/threads/{id}", "/api/threads/{id}/content"],
            "ai": ["/api/ai/generate", "/api/ai/generate-from-thread/{id}"],
            "campaigns": ["/api/campaigns", "/api/campaigns/{id}"],
            "links": ["/api/links", "/api/links/shorten"],
            "stats": ["/api/stats"],
        },
    }


# ─── Crawl endpoints ───

@app.get("/api/crawl/voz")
def api_crawl_voz():
    """Cào Voz Forum — Chuyện trò linh tinh."""
    return crawl_voz()


@app.get("/api/crawl/reddit")
def api_crawl_reddit(subs: str | None = Query(None, description="Comma-separated subreddits")):
    """Cào Reddit — hot posts from subreddits."""
    sub_list = subs.split(",") if subs else None
    return crawl_reddit(sub_list)


@app.get("/api/crawl/all")
def api_crawl_all():
    """Cào tất cả nguồn."""
    results = {}
    results["voz"] = crawl_voz()
    results["reddit"] = crawl_reddit()
    return {
        "results": results,
        "totalNew": sum(r.get("new", 0) for r in results.values()),
        "crawledAt": datetime.now(VN_TZ).isoformat(),
    }


# ─── Thread endpoints ───

@app.get("/api/threads")
def api_threads(
    source: str | None = Query(None, description="Filter by source: voz, reddit"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Danh sách bài đã cào (từ Firestore)."""
    threads = get_threads(source=source, limit=limit + offset)
    total = len(threads)
    threads = threads[offset:offset + limit]
    return {
        "threads": threads,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/threads/{thread_id}")
def api_thread_detail(thread_id: str):
    """Chi tiết 1 bài."""
    thread = get_thread_by_id(thread_id)
    if not thread:
        return {"error": "Không tìm thấy bài viết", "thread": None}
    return {"thread": thread}


@app.get("/api/threads/{thread_id}/content")
def api_thread_content(thread_id: str):
    """Lấy nội dung chi tiết (cào on-demand cho Voz)."""
    thread = get_thread_by_id(thread_id)
    if not thread:
        return {"error": "Không tìm thấy bài viết", "content": ""}

    if thread.get("content"):
        return {"content": thread["content"], "source": thread.get("source", "")}

    if thread.get("source") == "voz" and thread.get("url"):
        content = fetch_voz_content(thread["url"])
        if content:
            thread["content"] = content
            tid = thread.get("id", thread_id)
            if "id" in thread:
                del thread["id"]
            firestore_set("threads", tid, thread)
            return {"content": content, "source": "voz"}

    return {"content": "Không có nội dung chi tiết", "source": thread.get("source", "")}


@app.delete("/api/threads/{thread_id}")
def api_delete_thread(thread_id: str):
    """Xóa (soft delete) một bài."""
    delete_thread(thread_id)
    return {"ok": True, "deleted": thread_id}


# ─── AI Brain endpoints ───

@app.post("/api/ai/generate")
def api_ai_generate(req: GenerateRequest):
    """Sinh content kép: Bait (bài đăng viral) + Hook (comment bẻ lái chốt sale)."""
    result = generate_bait_and_hook(
        product_name=req.product_name,
        product_link=req.product_link,
        page_persona=req.page_persona,
        source_content=req.source_content,
    )
    if "error" in result:
        return {"error": result["error"]}

    campaign = create_campaign(
        bait=result["bait"],
        hook=result["hook"],
        product_name=req.product_name,
        product_link=req.product_link,
        page_persona=req.page_persona,
        suggested_image=result.get("suggested_image", ""),
    )

    return {
        "campaign_id": campaign["id"],
        "bait": result["bait"],
        "hook": result["hook"],
        "suggested_image": result.get("suggested_image", ""),
        "product_name": req.product_name,
        "product_link": req.product_link,
        "status": "draft",
        "created_at": campaign["created_at"],
    }


@app.post("/api/ai/generate-from-thread/{thread_id}")
def api_ai_generate_from_thread(
    thread_id: str,
    product_name: str = Query(..., description="Tên sản phẩm"),
    product_link: str = Query("", description="Link sản phẩm"),
    page_persona: str = Query("Hội những người đi làm văn phòng", description="Persona Page"),
):
    """Sinh content kép từ bài đã cào."""
    thread = get_thread_by_id(thread_id)
    if not thread:
        return {"error": "Không tìm thấy bài viết"}

    source_content = thread.get("content") or thread.get("title", "")

    result = generate_bait_and_hook(
        product_name=product_name,
        product_link=product_link,
        page_persona=page_persona,
        source_content=source_content,
    )
    if "error" in result:
        return {"error": result["error"]}

    campaign = create_campaign(
        bait=result["bait"],
        hook=result["hook"],
        product_name=product_name,
        product_link=product_link,
        page_persona=page_persona,
        source_thread_id=thread_id,
        suggested_image=result.get("suggested_image", ""),
    )

    # Mark thread as sent to AI
    thread["sent_to_ai"] = True
    tid = thread.get("id", thread_id)
    if "id" in thread:
        del thread["id"]
    firestore_set("threads", tid, thread)

    return {
        "campaign_id": campaign["id"],
        "bait": result["bait"],
        "hook": result["hook"],
        "suggested_image": result.get("suggested_image", ""),
        "source_thread": thread.get("title", ""),
        "product_name": product_name,
        "status": "draft",
        "created_at": campaign["created_at"],
    }


# ─── Campaign endpoints ───

@app.get("/api/campaigns")
def api_campaigns(
    status: str | None = Query(None, description="Filter: draft, approved, posted, failed"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Danh sách chiến dịch."""
    campaigns = get_campaigns(status=status, limit=limit)
    total = len(campaigns)
    return {"campaigns": campaigns, "total": total}


@app.get("/api/campaigns/{campaign_id}")
def api_campaign_detail(campaign_id: str):
    """Chi tiết chiến dịch."""
    camp = firestore_get("campaigns", campaign_id)
    if not camp:
        return {"error": "Không tìm thấy chiến dịch"}
    return {"campaign": camp}


@app.patch("/api/campaigns/{campaign_id}")
def api_update_campaign(campaign_id: str, data: CampaignUpdate):
    """Cập nhật trạng thái chiến dịch."""
    update_campaign_status(campaign_id, data.status)
    return {"ok": True, "campaign_id": campaign_id, "status": data.status}


@app.delete("/api/campaigns/{campaign_id}")
def api_delete_campaign(campaign_id: str):
    """Xóa chiến dịch."""
    delete_campaign(campaign_id)
    return {"ok": True, "deleted": campaign_id}


# ─── Affiliate Links endpoints ───

@app.get("/api/links")
def api_links(collection_filter: str | None = Query(None, alias="collection")):
    """Danh sách link affiliate."""
    all_links = firestore_query("affiliate_links")
    if collection_filter and collection_filter != "Tất cả":
        all_links = [l for l in all_links if collection_filter in l.get("collection_name", "")]
    all_links.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"links": all_links, "total": len(all_links)}


@app.post("/api/links")
def api_create_link(req: AffLinkCreate):
    """Thêm link affiliate mới (tự động rút gọn)."""
    short_result = shorten_url(req.original_url)
    link_id = f"aff-{uuid.uuid4().hex[:10]}"
    now = datetime.now(VN_TZ).isoformat()
    data = {
        "name": req.name,
        "original_url": req.original_url,
        "shortened_url": short_result["shortened"],
        "shortener": short_result["service"],
        "collection_name": req.collection,
        "clicks": 0,
        "orders": 0,
        "commission": 0.0,
        "created_at": now,
    }
    firestore_set("affiliate_links", link_id, data)
    return {"link": {"id": link_id, **data}}


@app.delete("/api/links/{link_id}")
def api_delete_link(link_id: str):
    """Xóa link affiliate."""
    firestore_delete("affiliate_links", link_id)
    return {"ok": True, "deleted": link_id}


@app.post("/api/links/shorten")
def api_shorten(url: str = Query(..., description="URL to shorten")):
    """Rút gọn link (rotate service)."""
    return shorten_url(url)


@app.get("/api/links/random")
def api_random_link():
    """Lấy random 1 link affiliate."""
    all_links = firestore_query("affiliate_links")
    if not all_links:
        return {"error": "Chưa có link nào"}
    return {"link": random.choice(all_links)}


# ─── Stats endpoint ───

@app.get("/api/stats")
def api_stats():
    """Thống kê tổng."""
    return {
        "voz": count_threads("voz"),
        "reddit": count_threads("reddit"),
        "total_threads": count_threads(),
        "campaigns": {
            "total": count_campaigns(),
            "draft": count_campaigns("draft"),
            "approved": count_campaigns("approved"),
            "posted": count_campaigns("posted"),
        },
        "gemini": "configured" if GEMINI_KEY else "missing",
        "database": "firebase",
    }


# ═══════════════════════════════════════════
# Run
# ═══════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    print("🎣 Affiliate Shoppe — Bait & Hook Backend v3")
    print("🔥 Database: Firebase Firestore + Realtime DB")
    print("=" * 48)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
