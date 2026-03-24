"""
Douyin Download Service — Quản lý tải video, đặt tên file, tránh trùng lặp.
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from curl_cffi import requests as curl_requests


class DouyinDownloadService:
    """Service tải video Douyin và quản lý file."""

    HISTORY_FILE = "download_history.json"
    MAX_RETRIES = 3
    CHUNK_SIZE = 8192  # 8KB chunks

    def __init__(self, output_dir: str = "./output/douyin"):
        """
        Args:
            output_dir: Thư mục lưu video.
        """
        self.output_dir = Path(output_dir)
        self._history: dict = {}
        self._video_counter: int = 0
        self._session = None
        self._ensure_output_dir()
        self._load_history()

    @property
    def session(self):
        """Lazy-init curl_cffi session."""
        if self._session is None:
            self._session = curl_requests.Session(impersonate="chrome120")
        return self._session

    def _ensure_output_dir(self):
        """Tạo output directory nếu chưa có."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _load_history(self):
        """Load download history từ JSON file."""
        history_path = self.output_dir / self.HISTORY_FILE
        if history_path.exists():
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    self._history = json.load(f)
                # Set counter dựa trên video đã tải hôm nay
                today_prefix = datetime.now().strftime("%d%m%Y")
                today_count = sum(
                    1 for fname in self._history.values()
                    if fname.startswith(today_prefix)
                )
                self._video_counter = today_count
            except Exception as e:
                print(f"⚠️ Không đọc được history file: {e}")
                self._history = {}

    def _save_history(self):
        """Lưu download history ra JSON file."""
        history_path = self.output_dir / self.HISTORY_FILE
        try:
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(self._history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ Không lưu được history file: {e}")

    def is_duplicate(self, video_id: str) -> bool:
        """Kiểm tra video đã tải chưa."""
        return video_id in self._history

    def generate_filename(self, index: Optional[int] = None) -> str:
        """
        Tạo tên file theo format: ddMMyyyy_VideoN.mp4

        Args:
            index: Số thứ tự video. Nếu None, tự động tăng counter.

        Returns:
            str: Tên file (ví dụ: 24032026_Video1.mp4)
        """
        if index is None:
            self._video_counter += 1
            index = self._video_counter

        date_str = datetime.now().strftime("%d%m%Y")
        return f"{date_str}_Video{index}.mp4"

    def download_video(
        self,
        video_url: str,
        video_id: str,
        filename: Optional[str] = None,
        retry_count: int = 0,
    ) -> dict:
        """
        Tải video từ URL.

        Args:
            video_url: URL video (đã bỏ watermark).
            video_id: ID video Douyin.
            filename: Tên file. Nếu None, tự generate.
            retry_count: Số lần đã retry (internal).

        Returns:
            dict: {
                "success": bool,
                "filename": str,
                "filepath": str,
                "error": str (nếu lỗi),
                "retries": int
            }
        """
        if not filename:
            filename = self.generate_filename()

        filepath = self.output_dir / filename

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Referer": "https://www.douyin.com/",
                "Accept": "*/*",
                "Accept-Encoding": "identity",
            }

            resp = self.session.get(
                video_url,
                headers=headers,
                timeout=60,
                allow_redirects=True,
            )

            if resp.status_code != 200:
                raise Exception(f"HTTP {resp.status_code}")

            # Kiểm tra content type
            content_type = resp.headers.get("content-type", "")
            if "video" not in content_type and "octet-stream" not in content_type:
                # Một số URL trả về redirect hoặc JSON thay vì video
                if len(resp.content) < 10000:  # Quá nhỏ, không phải video
                    raise Exception(f"Response không phải video (content-type: {content_type}, size: {len(resp.content)})")

            # Lưu file
            with open(filepath, "wb") as f:
                f.write(resp.content)

            # Kiểm tra file size hợp lệ
            file_size = filepath.stat().st_size
            if file_size < 50000:  # < 50KB có lẽ không phải video
                filepath.unlink(missing_ok=True)
                raise Exception(f"File quá nhỏ ({file_size} bytes), có thể không phải video")

            # Lưu history
            self._history[video_id] = filename
            self._save_history()

            return {
                "success": True,
                "filename": filename,
                "filepath": str(filepath),
                "file_size": file_size,
                "retries": retry_count,
            }

        except Exception as e:
            if retry_count < self.MAX_RETRIES:
                wait = (retry_count + 1) * 2  # Exponential-ish backoff
                print(f"   ⏳ Retry {retry_count + 1}/{self.MAX_RETRIES} sau {wait}s...")
                time.sleep(wait)
                return self.download_video(
                    video_url, video_id, filename, retry_count + 1
                )

            # Xóa file lỗi nếu có
            if filepath.exists():
                filepath.unlink(missing_ok=True)

            return {
                "success": False,
                "filename": filename,
                "filepath": str(filepath),
                "error": str(e),
                "retries": retry_count,
            }

    def get_stats(self) -> dict:
        """Trả về thống kê download."""
        today_prefix = datetime.now().strftime("%d%m%Y")
        today_count = sum(
            1 for fname in self._history.values()
            if fname.startswith(today_prefix)
        )
        return {
            "total_downloaded": len(self._history),
            "downloaded_today": today_count,
            "output_dir": str(self.output_dir),
        }

    def close(self):
        """Đóng session."""
        if self._session:
            self._session.close()
            self._session = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
