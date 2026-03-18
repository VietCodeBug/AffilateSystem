"""
Central configuration for Affiliate Shoppe backend.
"""

import os
from datetime import timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root.
load_dotenv(Path(__file__).parent.parent / ".env")

GEMINI_KEY = os.getenv("GEMINI_KEY", "")
TIDB_URL = os.getenv("TIDB_URL", "")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# New platform credentials for official publisher integrations.
FACEBOOK_GRAPH_VERSION = os.getenv("FACEBOOK_GRAPH_VERSION", "v21.0")
FACEBOOK_GRAPH_BASE = f"https://graph.facebook.com/{FACEBOOK_GRAPH_VERSION}"
THREADS_GRAPH_BASE = os.getenv("THREADS_GRAPH_BASE", "https://graph.threads.net/v1.0")

# Used to encrypt platform access tokens at rest.
PLATFORM_CREDENTIAL_SECRET = os.getenv("PLATFORM_CREDENTIAL_SECRET", "")

# Timezone (UTC+7 / Vietnam).
VN_TZ = timezone(timedelta(hours=7))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
}

REDDIT_SUBS = [
    "vozforums",
    "VietNam",
    "TroChuyenLinhTinh",
    "funny",
    "memes",
    "AskReddit",
]

SHORTENER_SERVICES = ["tinyurl", "isgd", "clckru"]

# Google Drive Integration
GOOGLE_DRIVE_API_KEY = os.getenv("GOOGLE_DRIVE_API_KEY", "")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")

