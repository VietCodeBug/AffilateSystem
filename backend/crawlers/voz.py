"""
Voz Crawler — Cào bài từ Voz Forum
"""

import re
import hashlib
from datetime import datetime
from bs4 import BeautifulSoup
from curl_cffi import requests as cf_requests

from config import HEADERS, VN_TZ
from database import ThreadDB, SessionLocal


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
            "time_text": time_text,
            "prefix": prefix,
            "content": "",
        })

    new_count = _save_threads(threads)

    return {
        "source": "voz",
        "sourceName": "Voz Forum",
        "sourceUrl": url,
        "total": len(threads),
        "new": new_count,
        "crawledAt": datetime.now(VN_TZ).isoformat(),
        "threads": threads,
    }


def _save_threads(threads: list[dict]) -> int:
    """Save threads to TiDB, skip duplicates."""
    db = SessionLocal()
    saved = 0
    try:
        for t in threads:
            tid = t.get("id", "")
            if not tid:
                continue
            existing = db.query(ThreadDB).get(tid)
            if existing:
                continue
            record = ThreadDB(
                id=tid,
                source=t.get("source", ""),
                title=t.get("title", ""),
                url=t.get("url", ""),
                author=t.get("author", "Ẩn danh"),
                replies=t.get("replies", 0),
                views=t.get("views", "0"),
                time_text=t.get("time_text", ""),
                prefix=t.get("prefix", ""),
                content=t.get("content", ""),
                thumbnail=t.get("thumbnail", ""),
                score=t.get("score", 0),
                crawled_at=datetime.now(VN_TZ).replace(tzinfo=None),
                sent_to_ai=False,
                deleted=False,
            )
            db.add(record)
            saved += 1
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"❌ Save threads error: {e}")
    finally:
        db.close()
    return saved
