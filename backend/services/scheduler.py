"""
Scheduler and pacing helpers for publishing jobs.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta


def apply_jitter(base_time: datetime, pct_low: float = 0.10, pct_high: float = 0.20) -> tuple[datetime, int]:
    """
    Apply positive/negative jitter to scheduled datetime.
    Returns (new_time, jitter_seconds).
    """
    now = datetime.utcnow()
    delta = max(60.0, (base_time - now).total_seconds())
    pct = random.uniform(pct_low, pct_high)
    magnitude = int(delta * pct)
    sign = -1 if random.random() < 0.5 else 1
    jitter_seconds = sign * magnitude
    return base_time + timedelta(seconds=jitter_seconds), jitter_seconds


def comment_delay_seconds(min_seconds: int = 60, max_seconds: int = 180) -> int:
    return random.randint(min_seconds, max_seconds)


def backoff_seconds(attempt: int) -> int:
    attempt = max(1, attempt)
    return min(900, 2 ** attempt * 15)

