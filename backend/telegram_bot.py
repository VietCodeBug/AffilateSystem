"""
Telegram Bot — Nhận Link Shopee từ Điện Thoại
Gửi link sản phẩm Shopee vào bot → tự động rút gọn → lưu DB → hiện trên Dashboard

Hỗ trợ:
  - Gửi link Shopee → tự fetch tên sản phẩm, rút gọn, lưu DB
  - Gửi kèm danh mục: "📱 https://shopee.vn/..." hoặc "tech https://..."
  - /start — Hướng dẫn
  - /links — 5 link gần nhất
  - /stats — Thống kê
"""

import re
import uuid
import asyncio
import logging
import requests
from datetime import datetime
from threading import Thread

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, VN_TZ

logger = logging.getLogger("telegram_bot")

# ═══════════════════════════════════════════
# State
# ═══════════════════════════════════════════

_bot_running = False
_bot_username = ""
_links_received = 0


def get_telegram_status() -> dict:
    return {
        "running": _bot_running,
        "bot_username": _bot_username,
        "links_received": _links_received,
        "token_configured": bool(TELEGRAM_BOT_TOKEN),
    }


# ═══════════════════════════════════════════
# Category Detection
# ═══════════════════════════════════════════

CATEGORY_MAP = {
    # Emoji → Category name
    "📱": "📱 Công nghệ",
    "🍜": "🍜 Đồ ăn vặt",
    "😂": "😂 Đồ bựa",
    "👗": "👗 Thời trang",
    "🏠": "🏠 Gia dụng",
    "💄": "💄 Mỹ phẩm",
    "🎮": "📱 Công nghệ",
    "💻": "📱 Công nghệ",
    "👕": "👗 Thời trang",
    "👠": "👗 Thời trang",
    "🍕": "🍜 Đồ ăn vặt",
    "🧴": "💄 Mỹ phẩm",
    # Text shortcuts
    "tech": "📱 Công nghệ",
    "cn": "📱 Công nghệ",
    "food": "🍜 Đồ ăn vặt",
    "an": "🍜 Đồ ăn vặt",
    "fun": "😂 Đồ bựa",
    "fashion": "👗 Thời trang",
    "tt": "👗 Thời trang",
    "home": "🏠 Gia dụng",
    "gd": "🏠 Gia dụng",
    "beauty": "💄 Mỹ phẩm",
    "mp": "💄 Mỹ phẩm",
}

CATEGORY_KEYWORDS = {
    "📱 Công nghệ": ["điện thoại", "laptop", "máy tính", "tai nghe", "bàn phím", "chuột", "màn hình", "sạc", "cáp", "usb", "keyboard", "mouse", "phone", "tablet", "camera", "loa", "speaker", "gaming", "pc", "ram", "ssd"],
    "👗 Thời trang": ["áo", "quần", "váy", "giày", "dép", "nón", "mũ", "túi", "balô", "đồng hồ", "kính", "dress", "shirt", "shoes", "bag", "watch"],
    "🍜 Đồ ăn vặt": ["bánh", "kẹo", "snack", "trà", "cà phê", "coffee", "nước", "đồ ăn", "food", "mì", "bún", "phở"],
    "🏠 Gia dụng": ["bếp", "nồi", "chảo", "ly", "cốc", "bàn", "ghế", "giường", "tủ", "đèn", "quạt", "máy giặt", "máy lạnh", "tủ lạnh"],
    "💄 Mỹ phẩm": ["kem", "serum", "sữa rửa", "toner", "son", "phấn", "mascara", "dầu gội", "skincare", "makeup"],
    "😂 Đồ bựa": ["funny", "joke", "bựa", "hài", "troll"],
}


def detect_category(text: str, product_name: str) -> str:
    """Detect category from user text prefix or product name keywords."""
    text_lower = text.lower().strip()

    # Check emoji/keyword prefix in the message text (before the URL)
    for key, cat in CATEGORY_MAP.items():
        if text_lower.startswith(key):
            return cat

    # Auto-detect from product name
    name_lower = product_name.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower:
                return cat

    return "📱 Telegram"  # Default


# ═══════════════════════════════════════════
# URL Helpers
# ═══════════════════════════════════════════

SHOPEE_URL_PATTERN = re.compile(
    r'https?://(?:(?:www\.)?shopee\.vn|shope\.ee|s\.shopee\.vn|affiliate\.shopee\.vn)[^\s<>"\']*',
    re.IGNORECASE,
)


def extract_shopee_urls(text: str) -> list[str]:
    """Trích xuất tất cả URL Shopee từ text."""
    return SHOPEE_URL_PATTERN.findall(text)


def fetch_product_name(url: str) -> str:
    """
    Fetch tên sản phẩm thật từ URL Shopee bằng cách:
    1. Follow redirect (short URL → full URL)
    2. Parse tên từ full URL path
    3. Hoặc scrape <title> tag
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9",
        }

        # Follow redirects to get the real URL
        resp = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        final_url = resp.url

        # Thử lấy tên từ URL path (dạng shopee.vn/Ten-San-Pham-i.123.456)
        if "shopee.vn/" in final_url:
            path = final_url.split("shopee.vn/")[-1]
            # Bỏ phần -i.xxx.xxx ở cuối
            name_part = re.sub(r'-i\.\d+\.\d+.*$', '', path)
            # Bỏ query params
            name_part = name_part.split("?")[0]
            # Replace dấu - bằng space
            name_part = name_part.replace("-", " ").strip()
            # Capitalize
            if name_part and len(name_part) > 5:
                # Truncate nhưng giữ từ nguyên vẹn
                if len(name_part) > 80:
                    name_part = name_part[:80].rsplit(" ", 1)[0] + "..."
                return name_part

        # Fallback: parse <title> từ HTML
        if resp.status_code == 200:
            title_match = re.search(r'<title[^>]*>(.*?)</title>', resp.text, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()
                # Clean up shopee suffix
                title = re.sub(r'\s*[-|]\s*Shopee\s*(Việt Nam)?.*$', '', title, flags=re.IGNORECASE).strip()
                if title and len(title) > 3 and "shopee" not in title.lower():
                    if len(title) > 80:
                        title = title[:80].rsplit(" ", 1)[0] + "..."
                    return title

            # Try og:title meta tag
            og_match = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', resp.text, re.IGNORECASE)
            if og_match:
                og_title = og_match.group(1).strip()
                og_title = re.sub(r'\s*[-|]\s*Shopee.*$', '', og_title, flags=re.IGNORECASE).strip()
                if og_title and len(og_title) > 3:
                    if len(og_title) > 80:
                        og_title = og_title[:80].rsplit(" ", 1)[0] + "..."
                    return og_title

    except Exception as e:
        logger.warning(f"⚠️ Không fetch được tên sản phẩm: {e}")

    # Last resort: tên từ URL gốc
    try:
        path = url.split("/")[-1].split("?")[0]
        if path and len(path) > 3:
            return f"Shopee: {path[:50]}"
    except:
        pass

    return "Sản phẩm Shopee"


# ═══════════════════════════════════════════
# Bot Core
# ═══════════════════════════════════════════

async def _run_bot():
    """Chạy Telegram Bot polling loop."""
    global _bot_running, _bot_username, _links_received

    try:
        from telegram import Update, Bot
        from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters
    except ImportError:
        logger.error("❌ Chưa cài python-telegram-bot. Chạy: pip install python-telegram-bot")
        return

    if not TELEGRAM_BOT_TOKEN:
        logger.error("❌ TELEGRAM_BOT_TOKEN chưa được cấu hình trong .env")
        return

    # Import DB functions
    from database import db_create, LinkDB
    from services.shortener import shorten_url

    # ─── Handlers ───

    async def cmd_start(update: Update, context):
        await update.message.reply_text(
            "🎣 *Affiliate Shoppe Bot*\n\n"
            "Gửi link sản phẩm Shopee cho tôi, tôi sẽ tự động:\n"
            "✅ Lấy tên sản phẩm thật\n"
            "✅ Rút gọn link\n"
            "✅ Phân loại danh mục\n"
            "✅ Lưu vào Dashboard\n\n"
            "💡 *Cách gửi:*\n"
            "• Gửi link trực tiếp → tự phân loại\n"
            "• Gửi kèm emoji → chọn danh mục:\n"
            "  📱 link → Công nghệ\n"
            "  👗 link → Thời trang\n"
            "  🍜 link → Đồ ăn vặt\n"
            "  🏠 link → Gia dụng\n"
            "  💄 link → Mỹ phẩm\n"
            "  😂 link → Đồ bựa\n\n"
            "📊 Lệnh: /links — /stats",
            parse_mode="Markdown",
        )

    async def cmd_links(update: Update, context):
        """Xem 5 link gần nhất."""
        from database import db_get_all
        links = db_get_all(LinkDB, limit=5, offset=0)
        if not links:
            await update.message.reply_text("📭 Chưa có link nào trong hệ thống.")
            return

        text = "🔗 *5 link gần nhất:*\n\n"
        for i, link in enumerate(links, 1):
            name = link.get("name", "N/A")[:40]
            cat = link.get("collection_name", "")
            short = link.get("shortened_url", link.get("affiliate_url", ""))
            text += f"{i}. {name}\n   {cat} — {short}\n\n"
        await update.message.reply_text(text, parse_mode="Markdown")

    async def cmd_stats(update: Update, context):
        """Xem thống kê."""
        from database import db_count
        total = db_count(LinkDB)
        await update.message.reply_text(
            f"📊 *Thống kê:*\n"
            f"• Tổng link: {total}\n"
            f"• Link nhận qua Telegram: {_links_received}",
            parse_mode="Markdown",
        )

    async def handle_message(update: Update, context):
        """Xử lý tin nhắn chứa link Shopee."""
        global _links_received

        text = update.message.text or ""
        urls = extract_shopee_urls(text)

        if not urls:
            await update.message.reply_text(
                "🤔 Không tìm thấy link Shopee.\n"
                "Hãy gửi link dạng:\n"
                "• `https://shopee.vn/...`\n"
                "• `https://shope.ee/...`\n"
                "• `https://s.shopee.vn/...`",
                parse_mode="Markdown",
            )
            return

        # Gửi "đang xử lý" nếu nhiều link
        if len(urls) > 1:
            await update.message.reply_text(f"⏳ Đang xử lý {len(urls)} link...")

        results = []
        for url in urls:
            try:
                # Fetch tên sản phẩm thật từ trang Shopee
                name = fetch_product_name(url)
                print(f"📱 Telegram Bot: Fetched product name: {name}")

                # Detect danh mục
                category = detect_category(text, name)

                # Rút gọn link
                short_data = shorten_url(url)
                short_url = short_data.get("shortened", url)
                service = short_data.get("service", "direct")

                # Lưu vào DB
                link_id = f"tele-{uuid.uuid4().hex[:10]}"
                now = datetime.now(VN_TZ).replace(tzinfo=None)
                link_data = {
                    "id": link_id,
                    "name": name,
                    "original_url": url,
                    "affiliate_url": url,
                    "shortened_url": short_url,
                    "shortener": service,
                    "collection_name": category,
                    "clicks": 0,
                    "orders": 0,
                    "commission": 0.0,
                    "created_at": now,
                }
                db_create(LinkDB, link_data)
                _links_received += 1

                results.append(f"✅ *{name[:60]}*\n   {category}\n   🔗 `{short_url}`")
                logger.info(f"📱 Telegram → {category}: {name} → {short_url}")

            except Exception as e:
                logger.error(f"❌ Lỗi xử lý link {url}: {e}")
                results.append(f"❌ Lỗi: {url[:50]}...")

        reply = "🎣 *Đã thêm vào Dashboard!*\n\n" + "\n\n".join(results)
        reply += "\n\n💡 _Gửi kèm emoji để chọn danh mục (📱👗🍜🏠💄😂)_"
        await update.message.reply_text(reply, parse_mode="Markdown")

    # ─── Build & Run ───

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("links", cmd_links))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Get bot info
    bot_info = await app.bot.get_me()
    _bot_username = bot_info.username or ""
    _bot_running = True

    logger.info(f"🤖 Telegram Bot @{_bot_username} đang chạy!")
    print(f"🤖 Telegram Bot: @{_bot_username} — Đang chạy!")

    try:
        await app.initialize()
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)

        # Keep running until cancelled
        while _bot_running:
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"❌ Telegram Bot error: {e}")
    finally:
        _bot_running = False
        try:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()
        except Exception:
            pass


def start_telegram_bot():
    """Khởi động Telegram Bot trong thread riêng."""
    if not TELEGRAM_BOT_TOKEN:
        print("⚠️ Telegram Bot: Chưa cấu hình TELEGRAM_BOT_TOKEN")
        return

    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run_bot())
        except Exception as e:
            print(f"❌ Telegram Bot crashed: {e}")
        finally:
            loop.close()

    thread = Thread(target=_run, daemon=True)
    thread.start()
    print("🚀 Telegram Bot thread started!")


def stop_telegram_bot():
    """Dừng Telegram Bot."""
    global _bot_running
    _bot_running = False
