import services.content_engine as content_engine


def test_generate_content_pack_fallback(monkeypatch):
    monkeypatch.setattr(content_engine, "GEMINI_KEY", "")
    output = content_engine.generate_content_pack(
        product_name="Ban phim co",
        product_link="https://example.com/p",
        persona="Nguoi di lam",
        tone="balanced",
        platform_targets=["facebook", "threads"],
    )
    assert "variants" in output
    assert len(output["variants"]) == 3
    for variant in output["variants"]:
        assert variant["variant_label"] in {"A", "B", "C"}
        assert isinstance(variant["quality_score"], float)
        assert isinstance(variant["spam_risk_score"], float)

