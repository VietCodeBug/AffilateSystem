"""
URL Shortener — Rotating shortener services
"""

import random
import requests
from config import SHORTENER_SERVICES


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
