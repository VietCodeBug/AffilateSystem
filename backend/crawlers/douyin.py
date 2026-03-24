"""
Douyin Crawler — Tìm kiếm và lấy video từ Douyin (TikTok China)
Sử dụng curl_cffi để bypass TLS fingerprint detection.
"""

import json
import random
import re
import time
import hashlib
from typing import Optional
from urllib.parse import quote, urlencode

from curl_cffi import requests as curl_requests


class DouyinCrawler:
    """Crawler tìm kiếm video trên Douyin và lấy link không watermark."""

    # Douyin web search API
    SEARCH_API = "https://www.douyin.com/aweme/v1/web/search/item/"
    VIDEO_DETAIL_API = "https://www.douyin.com/aweme/v1/web/aweme/detail/"

    # Common mobile User-Agents
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ]

    def __init__(self, cookie: str = "", delay_min: float = 2.0, delay_max: float = 5.0):
        """
        Args:
            cookie: Cookie Douyin từ browser (cần thiết để tránh bị block).
            delay_min: Delay tối thiểu giữa các request (giây).
            delay_max: Delay tối đa giữa các request (giây).
        """
        self.cookie = cookie
        self.delay_min = delay_min
        self.delay_max = delay_max
        self._session = None

    @property
    def session(self):
        """Lazy-init curl_cffi session with browser impersonation."""
        if self._session is None:
            self._session = curl_requests.Session(impersonate="chrome120")
        return self._session

    def _build_headers(self) -> dict:
        """Tạo headers giả lập browser."""
        headers = {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Referer": "https://www.douyin.com/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Origin": "https://www.douyin.com",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
        if self.cookie:
            headers["Cookie"] = self.cookie
        return headers

    def _handle_rate_limit(self):
        """Random delay giữa các request để tránh bị rate-limit."""
        delay = random.uniform(self.delay_min, self.delay_max)
        time.sleep(delay)

    def _generate_ms_token(self) -> str:
        """Generate a fake msToken parameter."""
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        return "".join(random.choice(chars) for _ in range(107)) + "=="

    def _generate_verifyFp(self) -> str:
        """Generate a fake verifyFp parameter."""
        chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        fp = "verify_" + "".join(random.choice(chars) for _ in range(32))
        return fp

    def search_videos(self, keyword: str, offset: int = 0, count: int = 10) -> dict:
        """
        Tìm kiếm video theo keyword trên Douyin.

        Args:
            keyword: Từ khóa tìm kiếm.
            offset: Offset cho pagination (0, 10, 20, ...).
            count: Số video mỗi page (mặc định 10).

        Returns:
            dict: {
                "videos": [{"id", "title", "url", "author", "views", "likes", "video_url"}],
                "has_more": bool,
                "cursor": int  (offset tiếp theo)
            }
        """
        self._handle_rate_limit()

        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "channel": "channel_pc_web",
            "search_channel": "aweme_video_web",
            "keyword": keyword,
            "search_source": "normal_search",
            "query_correct_type": "1",
            "is_filter_search": "0",
            "from_group_id": "",
            "offset": offset,
            "count": count,
            "need_filter_settings": "1",
            "list_type": "single",
            "version_code": "170400",
            "version_name": "17.4.0",
            "cookie_enabled": "true",
            "screen_width": "1920",
            "screen_height": "1080",
            "browser_language": "zh-CN",
            "browser_platform": "Win32",
            "browser_name": "Chrome",
            "browser_version": "122.0.0.0",
            "browser_online": "true",
            "engine_name": "Blink",
            "engine_version": "122.0.0.0",
            "os_name": "Windows",
            "os_version": "10",
            "cpu_core_num": "12",
            "device_memory": "8",
            "platform": "PC",
            "downlink": "10",
            "effective_type": "4g",
            "round_trip_time": "50",
            "msToken": self._generate_ms_token(),
        }

        try:
            resp = self.session.get(
                self.SEARCH_API,
                params=params,
                headers=self._build_headers(),
                timeout=15,
            )

            if resp.status_code != 200:
                print(f"⚠️ Douyin search API trả về status {resp.status_code}")
                return {"videos": [], "has_more": False, "cursor": offset}

            data = resp.json()
            status_code = data.get("status_code", -1)

            if status_code != 0:
                print(f"⚠️ Douyin API error: status_code={status_code}")
                return {"videos": [], "has_more": False, "cursor": offset}

            videos = []
            aweme_list = data.get("data", [])

            for item in aweme_list:
                aweme_info = item.get("aweme_info", item)
                video_info = self._parse_video_info(aweme_info)
                if video_info:
                    videos.append(video_info)

            has_more = data.get("has_more", 0) == 1
            next_cursor = offset + count

            return {
                "videos": videos,
                "has_more": has_more,
                "cursor": next_cursor,
            }

        except Exception as e:
            print(f"❌ Douyin search error: {e}")
            return {"videos": [], "has_more": False, "cursor": offset}

    def _parse_video_info(self, aweme: dict) -> Optional[dict]:
        """Parse video info từ aweme data."""
        try:
            aweme_id = aweme.get("aweme_id", "")
            if not aweme_id:
                return None

            # Lấy thông tin cơ bản
            desc = aweme.get("desc", "").strip()
            author_info = aweme.get("author", {})
            author_name = author_info.get("nickname", "unknown")

            # Lấy statistics
            stats = aweme.get("statistics", {})
            play_count = stats.get("play_count", 0)
            digg_count = stats.get("digg_count", 0)
            comment_count = stats.get("comment_count", 0)
            share_count = stats.get("share_count", 0)

            # Lấy video URL
            video_data = aweme.get("video", {})
            video_url = self._extract_video_url(video_data)

            # URL Douyin public
            douyin_url = f"https://www.douyin.com/video/{aweme_id}"

            return {
                "id": aweme_id,
                "title": desc or f"Video {aweme_id}",
                "url": douyin_url,
                "author": author_name,
                "views": play_count,
                "likes": digg_count,
                "comments": comment_count,
                "shares": share_count,
                "video_url": video_url,
                "video_data": video_data,  # Raw data for fallback extraction
            }

        except Exception as e:
            print(f"⚠️ Parse video info error: {e}")
            return None

    def _extract_video_url(self, video_data: dict) -> str:
        """
        Trích xuất video URL không watermark từ video data.

        Ưu tiên:
        1. play_addr (không watermark)
        2. download_addr
        3. play_addr_lowbr (chất lượng thấp hơn, không watermark)
        """
        # Thử lấy play_addr (thường không có watermark)
        play_addr = video_data.get("play_addr", {})
        url_list = play_addr.get("url_list", [])
        if url_list:
            return url_list[0]

        # Fallback: download_addr
        download_addr = video_data.get("download_addr", {})
        url_list = download_addr.get("url_list", [])
        if url_list:
            return url_list[0]

        # Fallback: bit_rate list
        bit_rate = video_data.get("bit_rate", [])
        if bit_rate:
            best = max(bit_rate, key=lambda x: x.get("bit_rate", 0))
            play_addr = best.get("play_addr", {})
            url_list = play_addr.get("url_list", [])
            if url_list:
                return url_list[0]

        return ""

    def get_no_watermark_url(self, video_url: str) -> str:
        """
        Chuyển đổi video URL sang link không watermark.

        Kỹ thuật:
        - Thay thế "playwm" → "play" trong URL
        - Thay thế "watermark=1" → "watermark=0"
        - Follow redirect để lấy link cuối cùng
        """
        if not video_url:
            return ""

        # Kỹ thuật 1: Thay đổi URL pattern
        no_wm_url = video_url.replace("/playwm/", "/play/")
        no_wm_url = no_wm_url.replace("watermark=1", "watermark=0")

        # Kỹ thuật 2: Follow redirect để lấy link cuối cùng
        try:
            resp = self.session.head(
                no_wm_url,
                headers={
                    "User-Agent": random.choice(self.USER_AGENTS),
                    "Referer": "https://www.douyin.com/",
                },
                allow_redirects=True,
                timeout=10,
            )
            if resp.status_code == 200:
                return str(resp.url)
            # Nếu HEAD fail, thử GET
            return no_wm_url
        except Exception:
            return no_wm_url

    def get_video_detail(self, video_id: str) -> Optional[dict]:
        """
        Lấy chi tiết video từ Douyin API theo video ID.

        Args:
            video_id: ID video Douyin.

        Returns:
            dict hoặc None nếu lỗi.
        """
        self._handle_rate_limit()

        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "channel": "channel_pc_web",
            "aweme_id": video_id,
            "version_code": "170400",
            "version_name": "17.4.0",
            "cookie_enabled": "true",
            "platform": "PC",
            "msToken": self._generate_ms_token(),
        }

        try:
            resp = self.session.get(
                self.VIDEO_DETAIL_API,
                params=params,
                headers=self._build_headers(),
                timeout=15,
            )

            if resp.status_code != 200:
                return None

            data = resp.json()
            if data.get("status_code", -1) != 0:
                return None

            aweme_detail = data.get("aweme_detail", {})
            return self._parse_video_info(aweme_detail)

        except Exception as e:
            print(f"❌ Get video detail error: {e}")
            return None

    def search_all_pages(self, keyword: str, max_pages: int = 1, count: int = 10):
        """
        Generator: Tìm kiếm video qua nhiều page.

        Args:
            keyword: Từ khóa tìm kiếm.
            max_pages: Số page tối đa.
            count: Số video mỗi page.

        Yields:
            tuple: (page_number, videos_list)
        """
        offset = 0
        for page in range(1, max_pages + 1):
            print(f"\n📄 [Page {page}/{max_pages}] Đang tìm kiếm '{keyword}'...")

            result = self.search_videos(keyword, offset=offset, count=count)
            videos = result["videos"]

            if not videos:
                print(f"   ⚠️ Không tìm thấy video ở page {page}")
                break

            print(f"   ✅ Tìm được {len(videos)} video")
            yield page, videos

            if not result["has_more"]:
                print(f"   ℹ️ Đã hết video để tìm (page {page})")
                break

            offset = result["cursor"]

    def close(self):
        """Đóng session."""
        if self._session:
            self._session.close()
            self._session = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
