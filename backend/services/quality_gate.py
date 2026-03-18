"""
Quality and spam guard utilities for generated content.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Iterable

BANNED_PHRASES = {
    "mua ngay",
    "chot don",
    "inbox gia",
    "gia sieu re",
    "bao hanh tron doi",
}


def normalize_text(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def contains_banned_phrase(text: str) -> list[str]:
    normalized = normalize_text(text)
    return [p for p in BANNED_PHRASES if p in normalized]


def ngrams(text: str, n: int = 3) -> set[str]:
    tokens = re.findall(r"\w+", normalize_text(text))
    if len(tokens) < n:
        return set(tokens)
    return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def duplicate_ratio(candidate: str, existing_texts: Iterable[str], n: int = 3) -> float:
    cand = ngrams(candidate, n=n)
    if not cand:
        return 0.0
    best = 0.0
    for text in existing_texts:
        base = ngrams(text, n=n)
        if not base:
            continue
        overlap = len(cand & base) / max(1, len(cand))
        best = max(best, overlap)
    return best


def score_quality(post_text: str, first_comment: str) -> tuple[float, float, list[str]]:
    """
    Returns: (quality_score 0-100, spam_risk_score 0-100, risk_flags)
    """
    risk_flags: list[str] = []
    post_len = len((post_text or "").strip())
    comment_len = len((first_comment or "").strip())

    quality = 60.0
    if 90 <= post_len <= 450:
        quality += 20
    elif post_len < 50:
        quality -= 20
        risk_flags.append("post_too_short")
    elif post_len > 700:
        quality -= 10
        risk_flags.append("post_too_long")

    if 20 <= comment_len <= 180:
        quality += 10
    elif comment_len == 0:
        quality -= 15
        risk_flags.append("missing_first_comment")

    banned_in_post = contains_banned_phrase(post_text)
    banned_in_comment = contains_banned_phrase(first_comment)
    if banned_in_post or banned_in_comment:
        risk_flags.extend([f"banned:{p}" for p in sorted(set(banned_in_post + banned_in_comment))])
        quality -= 25

    punctuation = Counter(ch for ch in post_text if ch in "!?")
    if sum(punctuation.values()) > 8:
        quality -= 8
        risk_flags.append("excessive_punctuation")

    spam = max(0.0, min(100.0, 100.0 - quality))
    quality = max(0.0, min(100.0, quality))
    return quality, spam, sorted(set(risk_flags))

