from services.quality_gate import contains_banned_phrase, duplicate_ratio, score_quality


def test_banned_phrase_detection():
    text = "Deal nay mua ngay de chot don nhe"
    flags = contains_banned_phrase(text)
    assert "mua ngay" in flags
    assert "chot don" in flags


def test_duplicate_ratio_detects_overlap():
    candidate = "hom nay di lam met, toi uu goc lam viec bang meo nho"
    existing = ["toi uu goc lam viec bang meo nho cho dan van phong"]
    ratio = duplicate_ratio(candidate, existing, n=3)
    assert ratio > 0.2


def test_quality_score_reasonable():
    quality, spam, risk = score_quality(
        "Di lam muon nhung van muon goc ban gon gon cho do lo stress.",
        "Minh de link tham khao o comment nhe.",
    )
    assert quality >= 50
    assert spam <= 50
    assert "missing_first_comment" not in risk

