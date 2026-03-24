"""
Douyin Video Downloader — CLI Tool
Tải video từ Douyin theo keyword, không watermark.

Usage:
    python douyin_downloader.py
    python douyin_downloader.py --keyword "ABC" --pages 3 --output "./output/douyin"
    python douyin_downloader.py -k "ABC" -p 3 -o "./output/douyin"
"""

import argparse
import os
import sys
import time
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

from crawlers.douyin import DouyinCrawler
from services.douyin_service import DouyinDownloadService

# Load .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def print_banner():
    """In banner chào mừng."""
    print()
    print("=" * 60)
    print("  🎬 DOUYIN VIDEO DOWNLOADER")
    print("  Tải video Douyin không watermark")
    print("=" * 60)
    print()


def print_summary(total: int, success: int, skipped: int, failed: int, output_dir: str):
    """In summary kết quả."""
    print()
    print("=" * 60)
    print("  📊 KẾT QUẢ")
    print(f"  ✅ Tải thành công: {success}/{total}")
    print(f"  ⏭️  Bỏ qua (trùng): {skipped}")
    print(f"  ❌ Thất bại:        {failed}")
    print(f"  📁 Thư mục:         {output_dir}")
    print("=" * 60)
    print()


def format_size(size_bytes: int) -> str:
    """Format bytes thành human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def interactive_input() -> dict:
    """Lấy input từ người dùng (interactive mode)."""
    keyword = input("🔍 Nhập keyword tìm kiếm: ").strip()
    if not keyword:
        print("❌ Keyword không được để trống!")
        sys.exit(1)

    pages_str = input("📄 Số page cần tải (mặc định 1): ").strip()
    pages = int(pages_str) if pages_str.isdigit() else 1

    default_output = os.environ.get("DOUYIN_DEFAULT_OUTPUT", "./output/douyin")
    output = input(f"📁 Folder lưu file (mặc định {default_output}): ").strip()
    if not output:
        output = default_output

    return {
        "keyword": keyword,
        "pages": pages,
        "output": output,
    }


def run_download(keyword: str, pages: int, output_dir: str):
    """Chạy download workflow chính."""
    # Load config từ .env
    cookie = os.environ.get("DOUYIN_COOKIE", "")
    delay_min = float(os.environ.get("DOUYIN_DELAY_MIN", "2"))
    delay_max = float(os.environ.get("DOUYIN_DELAY_MAX", "5"))

    if not cookie:
        print("⚠️  Không tìm thấy DOUYIN_COOKIE trong .env")
        print("   Tool vẫn chạy nhưng có thể bị Douyin block.")
        print("   Để tăng tỉ lệ thành công, hãy thêm cookie vào file .env")
        print()

    # Khởi tạo crawler và download service
    crawler = DouyinCrawler(
        cookie=cookie,
        delay_min=delay_min,
        delay_max=delay_max,
    )
    downloader = DouyinDownloadService(output_dir=output_dir)

    # Counters
    total_found = 0
    total_success = 0
    total_skipped = 0
    total_failed = 0

    start_time = time.time()

    try:
        print(f"🔍 Bắt đầu tìm kiếm: '{keyword}'")
        print(f"📄 Số page: {pages}")
        print(f"📁 Lưu vào: {os.path.abspath(output_dir)}")
        print()

        for page_num, videos in crawler.search_all_pages(keyword, max_pages=pages):
            total_found += len(videos)

            for i, video in enumerate(videos, 1):
                video_id = video["id"]
                title = video["title"][:50]
                video_url = video.get("video_url", "")

                prefix = f"   [{page_num}-{i:02d}]"

                # Check duplicate
                if downloader.is_duplicate(video_id):
                    print(f"{prefix} ⏭️  Đã tồn tại — {title}")
                    total_skipped += 1
                    continue

                if not video_url:
                    print(f"{prefix} ⚠️  Không có URL — {title}")
                    total_failed += 1
                    continue

                # Xử lý bỏ watermark
                no_wm_url = crawler.get_no_watermark_url(video_url)

                # Download
                filename = downloader.generate_filename()
                print(f"{prefix} ⬇️  Đang tải {filename}...", end="", flush=True)

                result = downloader.download_video(
                    video_url=no_wm_url or video_url,
                    video_id=video_id,
                    filename=filename,
                )

                if result["success"]:
                    size_str = format_size(result.get("file_size", 0))
                    retry_info = f" (retry {result['retries']})" if result["retries"] > 0 else ""
                    print(f"\r{prefix} ✅ {filename} — {size_str}{retry_info}")
                    total_success += 1
                else:
                    print(f"\r{prefix} ❌ {filename} — {result.get('error', 'Unknown error')}")
                    total_failed += 1

    except KeyboardInterrupt:
        print("\n\n⚠️ Đã dừng bởi người dùng (Ctrl+C)")

    finally:
        elapsed = time.time() - start_time
        elapsed_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed / 60:.1f}m"

        print_summary(total_found, total_success, total_skipped, total_failed, os.path.abspath(output_dir))
        print(f"⏱️  Thời gian: {elapsed_str}")

        # Hiển thị stats
        stats = downloader.get_stats()
        print(f"📈 Tổng đã tải (all time): {stats['total_downloaded']}")
        print(f"📈 Đã tải hôm nay: {stats['downloaded_today']}")
        print()

        crawler.close()
        downloader.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="🎬 Douyin Video Downloader — Tải video không watermark",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python douyin_downloader.py                         # Interactive mode
  python douyin_downloader.py -k "dance" -p 3         # Tải 3 pages keyword "dance"
  python douyin_downloader.py -k "cat" -o D:\\Videos   # Lưu vào D:\\Videos
        """,
    )
    parser.add_argument("-k", "--keyword", help="Từ khóa tìm kiếm")
    parser.add_argument("-p", "--pages", type=int, default=1, help="Số page cần tải (mặc định: 1)")
    parser.add_argument(
        "-o", "--output",
        default=os.environ.get("DOUYIN_DEFAULT_OUTPUT", "./output/douyin"),
        help="Thư mục lưu video",
    )

    args = parser.parse_args()

    print_banner()

    if args.keyword:
        # CLI mode
        run_download(args.keyword, args.pages, args.output)
    else:
        # Interactive mode
        params = interactive_input()
        run_download(params["keyword"], params["pages"], params["output"])


if __name__ == "__main__":
    main()
