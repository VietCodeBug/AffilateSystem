"""
Unit tests cho Douyin Download Service.
"""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add backend to path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.douyin_service import DouyinDownloadService


class TestGenerateFilename:
    """Test generate_filename method."""

    def test_format_correct(self):
        """Tên file đúng format ddMMyyyy_VideoN.mp4."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            filename = service.generate_filename(index=1)
            today = datetime.now().strftime("%d%m%Y")
            assert filename == f"{today}_Video1.mp4"

    def test_auto_increment(self):
        """Counter tự động tăng khi không truyền index."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            f1 = service.generate_filename()
            f2 = service.generate_filename()
            f3 = service.generate_filename()
            today = datetime.now().strftime("%d%m%Y")
            assert f1 == f"{today}_Video1.mp4"
            assert f2 == f"{today}_Video2.mp4"
            assert f3 == f"{today}_Video3.mp4"

    def test_custom_index(self):
        """Truyền index cụ thể."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            filename = service.generate_filename(index=42)
            today = datetime.now().strftime("%d%m%Y")
            assert filename == f"{today}_Video42.mp4"


class TestDuplicateDetection:
    """Test is_duplicate method."""

    def test_not_duplicate(self):
        """Video mới không phải duplicate."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            assert service.is_duplicate("video_123") is False

    def test_is_duplicate(self):
        """Video đã tải là duplicate."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            # Giả lập đã tải
            service._history["video_123"] = "24032026_Video1.mp4"
            assert service.is_duplicate("video_123") is True

    def test_history_persistence(self):
        """History được lưu và load lại đúng."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Tạo service và save history
            service1 = DouyinDownloadService(output_dir=tmpdir)
            service1._history["video_abc"] = "24032026_Video1.mp4"
            service1._save_history()

            # Tạo service mới, load history
            service2 = DouyinDownloadService(output_dir=tmpdir)
            assert service2.is_duplicate("video_abc") is True
            assert service2.is_duplicate("video_xyz") is False


class TestEnsureOutputDir:
    """Test output directory creation."""

    def test_create_new_dir(self):
        """Tạo folder mới nếu chưa có."""
        with tempfile.TemporaryDirectory() as tmpdir:
            new_dir = os.path.join(tmpdir, "sub", "folder", "output")
            service = DouyinDownloadService(output_dir=new_dir)
            assert os.path.isdir(new_dir)

    def test_existing_dir(self):
        """Không lỗi nếu folder đã tồn tại."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            assert os.path.isdir(tmpdir)


class TestGetStats:
    """Test get_stats method."""

    def test_empty_stats(self):
        """Stats trống khi chưa tải gì."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            stats = service.get_stats()
            assert stats["total_downloaded"] == 0
            assert stats["downloaded_today"] == 0

    def test_stats_with_downloads(self):
        """Stats đúng sau khi tải."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = DouyinDownloadService(output_dir=tmpdir)
            today = datetime.now().strftime("%d%m%Y")
            service._history = {
                "v1": f"{today}_Video1.mp4",
                "v2": f"{today}_Video2.mp4",
                "v3": "01012025_Video1.mp4",  # Ngày khác
            }
            stats = service.get_stats()
            assert stats["total_downloaded"] == 3
            assert stats["downloaded_today"] == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
