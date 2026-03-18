"""
Reddit Crawler — Cào bài từ Reddit JSON API
"""

from datetime import datetime
import requests as http_requests

from config import REDDIT_SUBS, VN_TZ
from database import ThreadDB, SessionLocal


def crawl_reddit(subreddits: list[str] | None = None) -> dict:
    """Cào Reddit bằng JSON API — không cần API key."""
    subs = subreddits or REDDIT_SUBS
    all_threads = []

    for sub in subs:
        try:
            url = f"https://www.reddit.com/r/{sub}/hot.json?limit=25"
            resp = http_requests.get(url, headers={
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
                    "time_text": time_text,
                    "prefix": f"r/{sub}",
                    "content": content,
                    "thumbnail": thumbnail,
                    "score": p.get("ups", 0),
                })

        except Exception as e:
            print(f"⚠️ Reddit r/{sub} error: {e}")
            continue

    new_count = _save_threads(all_threads)

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
                author=t.get("author", "anonymous"),
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
