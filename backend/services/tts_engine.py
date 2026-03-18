"""
TTS Engine — Text-to-Speech tiếng Việt sử dụng edge-tts.
Sinh audio MP3 từ text tiếng Việt cho từng đoạn subtitle.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any


# Vietnamese voices available in edge-tts
VN_VOICES = {
    "female": "vi-VN-HoaiMyNeural",
    "male": "vi-VN-NamMinhNeural",
}

DEFAULT_VOICE = VN_VOICES["female"]


async def _generate_speech_async(
    text: str,
    output_path: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "+0%",
    pitch: str = "+0Hz",
) -> str:
    """Async generate speech using edge-tts."""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(output_path)
    return output_path


def generate_speech(
    text: str,
    output_path: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "+0%",
) -> str:
    """
    Tạo file audio MP3 từ text tiếng Việt.
    Returns path to generated audio file.
    """
    if not text.strip():
        return ""

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(
            _generate_speech_async(text, output_path, voice, rate)
        )
    finally:
        loop.close()

    return output_path


def generate_batch(
    entries: list[dict[str, Any]],
    output_dir: str,
    voice: str = DEFAULT_VOICE,
    rate: str = "+0%",
    progress_callback=None,
) -> list[dict[str, Any]]:
    """
    Sinh audio cho danh sách subtitle entries.
    Mỗi entry cần có: start, end, text_vn (text tiếng Việt).
    Returns entries với thêm field audio_path.
    """
    os.makedirs(output_dir, exist_ok=True)
    results = []

    for i, entry in enumerate(entries):
        text = entry.get("text_vn", "").strip()
        if not text:
            entry["audio_path"] = ""
            results.append(entry)
            continue

        audio_path = os.path.join(output_dir, f"tts_{i:04d}.mp3")
        try:
            generate_speech(text, audio_path, voice, rate)
            entry["audio_path"] = audio_path
            print(f"   🔊 [{i+1}/{len(entries)}] \"{text[:40]}...\" → {audio_path}")
        except Exception as e:
            print(f"   ⚠️ TTS error [{i+1}]: {e}")
            entry["audio_path"] = ""

        if progress_callback:
            progress_callback("tts", i + 1, len(entries), text)

        results.append(entry)

    return results


async def _list_voices_async() -> list[dict]:
    """List all available Vietnamese voices."""
    import edge_tts
    voices = await edge_tts.list_voices()
    return [v for v in voices if v.get("Locale", "").startswith("vi")]


def list_vietnamese_voices() -> list[dict]:
    """List available Vietnamese voices from edge-tts."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_list_voices_async())
    finally:
        loop.close()
