"""
Video Translator — Pipeline dịch video Douyin/Bilibili sang tiếng Việt.
Download → OCR phụ đề Trung → Dịch VN → TTS tiếng Việt → FFmpeg overlay → Output.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from google import genai

from config import GEMINI_KEY, VN_TZ

# Job tracking
_jobs: dict[str, dict[str, Any]] = {}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
WORK_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_video")


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


# ═══════════════════════════════════════════
# Step 1: Download Video
# ═══════════════════════════════════════════

def download_video(url: str, output_dir: str) -> dict[str, Any]:
    """
    Download video từ Douyin/Bilibili/TikTok bằng yt-dlp.
    Returns {video_path, title, duration}.
    """
    _ensure_dir(output_dir)
    output_template = os.path.join(output_dir, "source_video.%(ext)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "-f", "best[height<=1080]",
        "-o", output_template,
        "--write-subs",
        "--sub-lang", "zh,zh-CN,zh-Hans,en",
        "--no-check-certificates",
        url,
    ]

    print(f"⬇️ Downloading video: {url}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp error: {result.stderr[:500]}")

    # Find downloaded video file
    video_file = None
    for f in Path(output_dir).glob("source_video.*"):
        if f.suffix.lower() in (".mp4", ".webm", ".mkv", ".flv"):
            video_file = str(f)
            break

    if not video_file:
        raise RuntimeError("Video file not found after download")

    # Get video info
    info_cmd = ["yt-dlp", "--dump-json", "--no-download", url]
    info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=30)
    title = "Untitled"
    duration = 0
    if info_result.returncode == 0:
        try:
            info = json.loads(info_result.stdout)
            title = info.get("title", "Untitled")
            duration = info.get("duration", 0)
        except Exception:
            pass

    print(f"   ✅ Downloaded: {title} ({duration}s)")
    return {"video_path": video_file, "title": title, "duration": duration}


# ═══════════════════════════════════════════
# Step 2: Translate Subtitles CN → VN
# ═══════════════════════════════════════════

def translate_subtitles(
    entries: list[dict[str, Any]],
    progress_callback=None,
) -> list[dict[str, Any]]:
    """
    Dùng Gemini dịch batch subtitle từ tiếng Trung sang tiếng Việt.
    """
    if not GEMINI_KEY or not entries:
        return entries

    client = genai.Client(api_key=GEMINI_KEY)

    # Batch translate for efficiency
    texts = [e["text"] for e in entries]
    batch_text = "\n---\n".join(f"[{i}] {t}" for i, t in enumerate(texts))

    prompt = f"""Dịch tất cả các câu sau từ tiếng Trung sang tiếng Việt.
Giữ nguyên số thứ tự [0], [1], [2]... 
Chỉ trả về bản dịch, không giải thích.
Mỗi câu một dòng, format: [số] bản dịch

{batch_text}"""

    print(f"🌐 Translating {len(entries)} subtitle entries CN → VN...")
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = (response.text or "").strip()

        # Parse translations
        import re
        translations = {}
        for line in raw.split("\n"):
            line = line.strip()
            match = re.match(r"\[(\d+)\]\s*(.*)", line)
            if match:
                idx = int(match.group(1))
                trans = match.group(2).strip()
                translations[idx] = trans

        # Apply translations
        for i, entry in enumerate(entries):
            entry["text_vn"] = translations.get(i, entry["text"])
            if progress_callback:
                progress_callback("translate", i + 1, len(entries), entry["text_vn"])

        print(f"   ✅ Translated {len(translations)}/{len(entries)} entries")

    except Exception as e:
        print(f"   ⚠️ Translation error: {e}")
        # Fallback: keep original text
        for entry in entries:
            entry.setdefault("text_vn", entry["text"])

    return entries


# ═══════════════════════════════════════════
# Step 3: Compose Final Video
# ═══════════════════════════════════════════

def compose_final_video(
    video_path: str,
    tts_entries: list[dict[str, Any]],
    vn_subtitles: list[dict[str, Any]],
    output_path: str,
    work_dir: str,
) -> str:
    """
    FFmpeg: overlay phụ đề tiếng Việt + mix audio TTS.
    1. Tạo file SRT tiếng Việt
    2. Tạo audio track từ TTS segments
    3. Overlay subtitle + replace audio
    """
    _ensure_dir(os.path.dirname(output_path))

    # --- Create Vietnamese SRT file ---
    from services.subtitle_ocr import subtitles_to_srt, format_srt_time
    srt_content = subtitles_to_srt([
        {"start": e["start"], "end": e["end"], "text": e.get("text_vn", e["text"])}
        for e in vn_subtitles
    ])
    srt_path = os.path.join(work_dir, "subtitles_vn.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    # --- Merge TTS audio segments into one track ---
    tts_files = [e for e in tts_entries if e.get("audio_path") and os.path.exists(e.get("audio_path", ""))]

    if tts_files:
        # Create filter_complex for audio mixing with timing
        audio_inputs = []
        filter_parts = []
        for i, entry in enumerate(tts_files):
            audio_inputs.extend(["-i", entry["audio_path"]])
            delay_ms = int(entry["start"] * 1000)
            filter_parts.append(f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[a{i}]")

        # Mix all TTS audio tracks
        mix_inputs = "".join(f"[a{i}]" for i in range(len(tts_files)))
        filter_parts.append(f"{mix_inputs}amix=inputs={len(tts_files)}:duration=longest[tts_mixed]")

        # Mix original audio (lowered) with TTS
        filter_parts.append("[0:a]volume=0.15[orig_low]")
        filter_parts.append("[orig_low][tts_mixed]amix=inputs=2:duration=first[final_audio]")

        filter_complex = ";".join(filter_parts)

        # Build FFmpeg command: overlay subtitles + mix audio
        # Escape SRT path for FFmpeg subtitles filter (Windows paths need escaping)
        srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")

        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            *audio_inputs,
            "-filter_complex", filter_complex,
            "-vf", f"subtitles='{srt_escaped}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,MarginV=25'",
            "-map", "0:v",
            "-map", "[final_audio]",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-shortest",
            output_path,
        ]
    else:
        # No TTS audio — just overlay subtitles
        srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vf", f"subtitles='{srt_escaped}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,MarginV=25'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "copy",
            output_path,
        ]

    print(f"🎬 Composing final video...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        print(f"   ⚠️ FFmpeg error: {result.stderr[:500]}")
        # Fallback: just overlay subtitles without audio mixing
        fallback_cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vf", f"subtitles='{srt_escaped}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,MarginV=25'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-c:a", "copy",
            output_path,
        ]
        subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=300, check=True)

    print(f"   ✅ Output: {output_path}")
    return output_path


# ═══════════════════════════════════════════
# Main Pipeline
# ═══════════════════════════════════════════

def translate_video(
    url: str,
    voice: str = "vi-VN-HoaiMyNeural",
    subtitle_interval: float = 1.5,
    crop_ratio: float = 0.18,
) -> dict[str, Any]:
    """
    Full pipeline: Download → OCR → Translate → TTS → Compose → Output.
    Returns job result with output_path.
    """
    job_id = f"vtrans-{uuid.uuid4().hex[:10]}"
    timestamp = datetime.now(VN_TZ).strftime("%Y%m%d_%H%M%S")

    work_dir = os.path.join(WORK_DIR, job_id)
    _ensure_dir(work_dir)
    _ensure_dir(OUTPUT_DIR)

    job = {
        "id": job_id,
        "url": url,
        "status": "downloading",
        "progress": 0,
        "message": "Đang tải video...",
        "created_at": datetime.now(VN_TZ).isoformat(),
        "output_path": "",
        "title": "",
        "subtitles_cn": [],
        "subtitles_vn": [],
        "error": "",
    }
    _jobs[job_id] = job

    try:
        # Step 1: Download
        job["status"] = "downloading"
        job["message"] = "Đang tải video..."
        job["progress"] = 5
        dl = download_video(url, work_dir)
        video_path = dl["video_path"]
        job["title"] = dl["title"]
        job["progress"] = 15

        # Step 2: OCR subtitles
        job["status"] = "ocr"
        job["message"] = "Đang đọc phụ đề..."
        from services.subtitle_ocr import extract_all_subtitles

        def ocr_progress(stage, current, total, text=""):
            job["progress"] = 15 + int(35 * current / max(1, total))
            job["message"] = f"OCR: {current}/{total} frames"

        cn_subs = extract_all_subtitles(
            video_path, work_dir,
            interval=subtitle_interval,
            crop_ratio=crop_ratio,
            progress_callback=ocr_progress,
        )
        job["subtitles_cn"] = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in cn_subs]
        job["progress"] = 50

        if not cn_subs:
            job["status"] = "done"
            job["message"] = "Không tìm thấy phụ đề trong video"
            job["progress"] = 100
            return job

        # Step 3: Translate CN → VN
        job["status"] = "translating"
        job["message"] = "Đang dịch sang tiếng Việt..."

        def trans_progress(stage, current, total, text=""):
            job["progress"] = 50 + int(15 * current / max(1, total))
            job["message"] = f"Dịch: {current}/{total}"

        vn_subs = translate_subtitles(cn_subs, progress_callback=trans_progress)
        job["subtitles_vn"] = [{"start": s["start"], "end": s["end"], "text_cn": s["text"], "text_vn": s.get("text_vn", "")} for s in vn_subs]
        job["progress"] = 65

        # Step 4: TTS
        job["status"] = "tts"
        job["message"] = "Đang tạo giọng đọc tiếng Việt..."
        from services.tts_engine import generate_batch

        tts_dir = os.path.join(work_dir, "tts")

        def tts_progress(stage, current, total, text=""):
            job["progress"] = 65 + int(15 * current / max(1, total))
            job["message"] = f"TTS: {current}/{total}"

        tts_entries = generate_batch(
            vn_subs, tts_dir, voice=voice,
            progress_callback=tts_progress,
        )
        job["progress"] = 80

        # Step 5: Compose final video
        job["status"] = "composing"
        job["message"] = "Đang ghép video..."
        output_filename = f"{timestamp}_{job_id}.mp4"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        compose_final_video(
            video_path=video_path,
            tts_entries=tts_entries,
            vn_subtitles=vn_subs,
            output_path=output_path,
            work_dir=work_dir,
        )

        job["output_path"] = output_path
        job["output_filename"] = output_filename
        job["status"] = "done"
        job["message"] = "Hoàn tất! Video đã sẵn sàng."
        job["progress"] = 100

        print(f"🎉 Video translated successfully: {output_path}")

    except Exception as e:
        job["status"] = "error"
        job["message"] = f"Lỗi: {str(e)}"
        job["error"] = str(e)
        print(f"❌ Translation error: {e}")

    return job


def get_job(job_id: str) -> dict[str, Any] | None:
    """Get job status by ID."""
    return _jobs.get(job_id)


def list_jobs() -> list[dict[str, Any]]:
    """List all translation jobs."""
    return sorted(_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)


def list_output_files() -> list[dict[str, Any]]:
    """List completed videos in output directory."""
    _ensure_dir(OUTPUT_DIR)
    files = []
    for f in Path(OUTPUT_DIR).glob("*.mp4"):
        stat = f.stat()
        files.append({
            "filename": f.name,
            "path": str(f),
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime, VN_TZ).isoformat(),
        })
    return sorted(files, key=lambda x: x["created_at"], reverse=True)
