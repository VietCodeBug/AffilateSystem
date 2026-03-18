from datetime import datetime, timedelta

from services.scheduler import apply_jitter, backoff_seconds, comment_delay_seconds


def test_apply_jitter_returns_offset():
    base = datetime.utcnow() + timedelta(minutes=30)
    jittered, seconds = apply_jitter(base)
    assert isinstance(seconds, int)
    assert jittered != base


def test_comment_delay_range():
    for _ in range(10):
        delay = comment_delay_seconds(60, 180)
        assert 60 <= delay <= 180


def test_backoff_capped():
    assert backoff_seconds(1) == 30
    assert backoff_seconds(3) == 120
    assert backoff_seconds(20) == 900

