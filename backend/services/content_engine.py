"""
Content pack generation logic (multi-variant, organic-first).
"""

from __future__ import annotations

import json
import re
from typing import Any

from google import genai

from config import GEMINI_KEY
from services.quality_gate import score_quality

CONTENT_PILLARS = [
    "doi_song_di_lam",
    "tiet_kiem_thuc_dung",
    "review_trai_nghiem_that",
    "tinh_huong_hai_meme",
    "checklist_tip_ngan",
]


def _fallback_variants(product_name: str, product_link: str) -> list[dict[str, Any]]:
    base_hashtags = ["#review", "#tips", "#songthucdung"]
    return [
        {
            "variant_label": "A",
            "post_text": f"Ai di lam cung co mot mon do nho ma cuu ngay met moi. Hom nay minh thu {product_name} va thay kha on cho nhung ngay gap.",
            "first_comment": f"Minh de link tham khao o day neu can: {product_link}",
            "cta_level": "soft",
            "hashtags": base_hashtags,
            "image_prompt": "Realistic office desk setup with practical gadget, natural light",
            "content_angle": "storytelling_daily_life",
        },
        {
            "variant_label": "B",
            "post_text": f"Khi deadline dap mat thi ai cung hoa meme. May ma co {product_name} nen do cang duoc chut.",
            "first_comment": f"Link minh da tham khao: {product_link}",
            "cta_level": "soft",
            "hashtags": ["#memevanphong", "#workinglife", "#reviewthat"],
            "image_prompt": "Funny office meme scene with subtle product presence",
            "content_angle": "meme_observation",
        },
        {
            "variant_label": "C",
            "post_text": f"Neu chi duoc chon 1 mon de toi uu goc lam viec, ban chon gi? Minh dang test {product_name}.",
            "first_comment": f"Ban nao can xem nhanh thi minh de link o day: {product_link}",
            "cta_level": "hard",
            "hashtags": ["#hoidap", "#productivity", "#goclam"],
            "image_prompt": "Question style social post visual, minimal office setup",
            "content_angle": "question_poll",
        },
    ]


def _build_prompt(
    product_name: str,
    product_link: str,
    persona: str,
    tone: str,
    platform_targets: list[str],
) -> str:
    platforms = ", ".join(platform_targets)
    pillars = ", ".join(CONTENT_PILLARS)
    return f"""
You are an organic social content strategist.
Generate EXACTLY 3 Vietnamese variants (A/B/C) for affiliate-friendly social content.

Input:
- Product name: {product_name}
- Product link: {product_link}
- Persona: {persona}
- Tone: {tone}
- Platform targets: {platforms}

Rules:
- Prioritize natural organic engagement over direct selling.
- Variant A: daily-life storytelling.
- Variant B: meme/observation.
- Variant C: question/poll.
- Keep post_text 90-450 chars, first_comment 20-180 chars.
- 70% soft CTA, 30% hard CTA across variants.
- Avoid hard-sell phrases like "mua ngay", "chot don", "gia sieu re".
- Must include these content pillars contextually over time: {pillars}

Return STRICT JSON only, no markdown:
{{
  "variants": [
    {{
      "variant_label": "A",
      "post_text": "...",
      "first_comment": "...",
      "cta_level": "soft|hard",
      "hashtags": ["#a","#b"],
      "image_prompt": "...",
      "content_angle": "...",
      "risk_flags": []
    }}
  ]
}}
""".strip()


def _parse_response(raw: str) -> dict[str, Any]:
    cleaned = (raw or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def generate_content_pack(
    product_name: str,
    product_link: str,
    persona: str,
    tone: str,
    platform_targets: list[str],
) -> dict[str, Any]:
    variants = None
    error_message = ""
    if GEMINI_KEY:
        try:
            client = genai.Client(api_key=GEMINI_KEY)
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=_build_prompt(
                    product_name=product_name,
                    product_link=product_link,
                    persona=persona,
                    tone=tone,
                    platform_targets=platform_targets,
                ),
            )
            parsed = _parse_response(resp.text)
            variants = parsed.get("variants")
        except Exception as e:
            error_message = str(e)

    if not isinstance(variants, list) or len(variants) < 3:
        variants = _fallback_variants(product_name, product_link)

    finalized = []
    for idx, v in enumerate(variants[:3]):
        post_text = (v.get("post_text") or "").strip()
        first_comment = (v.get("first_comment") or "").strip()
        quality, spam_risk, risk_flags = score_quality(post_text, first_comment)
        merged_flags = sorted(set((v.get("risk_flags") or []) + risk_flags))
        finalized.append(
            {
                "variant_label": v.get("variant_label") or ["A", "B", "C"][idx],
                "post_text": post_text,
                "first_comment": first_comment,
                "cta_level": (v.get("cta_level") or "soft").lower(),
                "hashtags": v.get("hashtags") or [],
                "image_prompt": v.get("image_prompt") or "",
                "content_angle": v.get("content_angle") or "",
                "risk_flags": merged_flags,
                "quality_score": quality,
                "spam_risk_score": spam_risk,
            }
        )

    output = {"variants": finalized}
    if error_message:
        output["warning"] = f"Gemini fallback used: {error_message}"
    return output

