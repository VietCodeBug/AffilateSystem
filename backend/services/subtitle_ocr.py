"""
Subtitle OCR — Trích phụ đề từ video bằng Gemini Vision API.
Crop vùng subtitle (dưới cùng video) → gửi frame lên Gemini → nhận text.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image
from google import genai

from config import GEMINI_KEY


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def extract_frames(
    video_path: str,
    output_dir: str,
    interval: float = 1.0,
    subtitle_crop_ratio: float = 0.18,
) -> list[dict[str, Any]]:
    """
    Trích frame từ video mỗi `interval` giây.
    Crop vùng subtitle (phần dưới cùng, ~18% chiều cao).
    Returns list of {timestamp, frame_path, cropped_path}.
    """
    _ensure_dir(output_dir)
    frames_dir = os.path.join(output_dir, "frames")
    crops_dir = os.path.join(output_dir, "crops")
    _ensure_dir(frames_dir)
    _ensure_dir(crops_dir)

    # Extract frames using FFmpeg
    pattern = os.path.join(frames_dir, "frame_%05d.png")
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps=1/{interval}",
        "-q:v", "2",
        pattern,
    ]
    subprocess.run(cmd, capture_output=True, text=True, check=True)

    # Crop subtitle region from each frame
    frame_files = sorted(Path(frames_dir).glob("frame_*.png"))
    results = []

    for idx, frame_path in enumerate(frame_files):
        timestamp = idx * interval
        img = Image.open(frame_path)
        w, h = img.size
        
        # Crop bottom portion (subtitle area)
        crop_top = int(h * (1 - subtitle_crop_ratio))
        cropped = img.crop((0, crop_top, w, h))

        crop_path = os.path.join(crops_dir, f"crop_{idx:05d}.png")
        cropped.save(crop_path)

        results.append({
            "index": idx,
            "timestamp": timestamp,
            "frame_path": str(frame_path),
            "cropped_path": crop_path,
        })

    return results


def ocr_frame_gemini(image_path: str) -> str:
    """
    Dùng Gemini Vision API đọc text từ ảnh crop subtitle.
    Returns text tiếng Trung (hoặc rỗng nếu không có chữ).
    """
    if not GEMINI_KEY:
        return ""

    try:
        client = genai.Client(api_key=GEMINI_KEY)

        # Upload image
        img = Image.open(image_path)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "parts": [
                        {"text": "Extract ALL text visible in this image. This is a subtitle region from a video. Return ONLY the text content, nothing else. If there is no text, return empty string. Do NOT add any explanation."},
                        {"inline_data": {"mime_type": "image/png", "data": Path(image_path).read_bytes()}},
                    ]
                }
            ],
        )
        text = (response.text or "").strip()

        # Filter out generic responses
        if text.lower() in ("", "no text", "empty", "none", "n/a"):
            return ""
        return text
    except Exception as e:
        print(f"⚠️ OCR error for {image_path}: {e}")
        return ""


def deduplicate_subtitles(
    raw_entries: list[dict[str, Any]],
    interval: float = 1.0,
) -> list[dict[str, Any]]:
    """
    Gộp các frame liên tiếp có cùng text thành 1 entry subtitle.
    Returns list of {start, end, text}.
    """
    if not raw_entries:
        return []

    merged = []
    current_text = ""
    current_start = 0.0

    for entry in raw_entries:
        text = entry.get("text", "").strip()
        ts = entry["timestamp"]

        if text == current_text:
            # Same text, extend duration
            continue
        else:
            # New text — save previous if exists
            if current_text:
                merged.append({
                    "start": current_start,
                    "end": ts,
                    "text": current_text,
                })
            current_text = text
            current_start = ts

    # Save last entry
    if current_text:
        merged.append({
            "start": current_start,
            "end": current_start + interval,
            "text": current_text,
        })

    return merged


def format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT timestamp format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def subtitles_to_srt(entries: list[dict[str, Any]]) -> str:
    """Convert subtitle entries to SRT format."""
    lines = []
    for i, entry in enumerate(entries, 1):
        start_str = format_srt_time(entry["start"])
        end_str = format_srt_time(entry["end"])
        lines.append(f"{i}")
        lines.append(f"{start_str} --> {end_str}")
        lines.append(entry["text"])
        lines.append("")
    return "\n".join(lines)


def extract_all_subtitles(
    video_path: str,
    work_dir: str,
    interval: float = 1.0,
    crop_ratio: float = 0.18,
    progress_callback=None,
) -> list[dict[str, Any]]:
    """
    Full pipeline: extract frames → OCR → deduplicate → return subtitles.
    """
    print(f"📸 Extracting frames from video (every {interval}s)...")
    frames = extract_frames(video_path, work_dir, interval, crop_ratio)
    print(f"   → {len(frames)} frames extracted")

    print(f"🔍 OCR-ing subtitle frames with Gemini Vision...")
    raw_entries = []
    for i, frame in enumerate(frames):
        text = ocr_frame_gemini(frame["cropped_path"])
        frame["text"] = text
        raw_entries.append(frame)

        if progress_callback:
            progress_callback("ocr", i + 1, len(frames), text)

        if text:
            print(f"   [{i+1}/{len(frames)}] {frame['timestamp']:.1f}s → \"{text[:50]}...\"")

    print(f"🔗 Deduplicating subtitles...")
    merged = deduplicate_subtitles(raw_entries, interval)
    print(f"   → {len(merged)} unique subtitle entries")

    return merged
