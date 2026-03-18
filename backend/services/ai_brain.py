"""
AI Brain — Gemini Dual Content Generator
Generates Bait (viral post) + Hook (sales comment) pairs.
"""

import re
import json
from google import genai
from config import GEMINI_KEY


def generate_bait_and_hook(product_name: str, product_link: str = "",
                           page_persona: str = "", source_content: str = "") -> dict:
    """Call Gemini to generate Bait (viral post) + Hook (sales comment) pair."""
    if not GEMINI_KEY:
        return {"error": "Chưa cấu hình GEMINI_KEY trong .env"}

    client = genai.Client(api_key=GEMINI_KEY)

    persona_desc = page_persona or "Hội những người đi làm văn phòng"
    source_hint = ""
    if source_content:
        source_hint = f"\n\nLấy cảm hứng từ nội dung này (nhưng viết lại hoàn toàn, KHÔNG copy): {source_content[:500]}"

    prompt = f"""Bạn là hệ thống tạo content tự động cho Fanpage Facebook: "{persona_desc}".
Nhiệm vụ: Tạo ra 1 cặp nội dung "Mồi nhử & Lưỡi câu" (Bait & Hook) để đăng bài tự động.

Sản phẩm cần quảng cáo: {product_name}
{f'Link sản phẩm: {product_link}' if product_link else ''}
{source_hint}

📝 YÊU CẦU:

1. **BAIT (Mồi nhử — Bài đăng chính):**
   - Thuần túy giải trí/tâm sự/hài hước, KHÔNG nhắc một chữ nào đến sản phẩm hay mua bán
   - Mục đích duy nhất: Câu Like, Share, Tag bạn bè, gây đồng cảm hoặc tò mò
   - Phong cách: Gen Z, vô tri, hài hước hoặc sầu đời kiểu "meme văn phòng"
   - Độ dài: 2-5 câu, có thể dùng emoji nhưng đừng quá nhiều
   - PHẢI viết bằng tiếng Việt

2. **HOOK (Lưỡi câu — Comment bẻ lái):**
   - Một bình luận ngắn (1-2 câu) tạo cú "bẻ lái" (twist) từ nội dung bài đăng sang sản phẩm
   - Phải tự nhiên, không nhìn giống quảng cáo, kiểu "than vãn" hoặc "tấu hài" rồi chèn link
   - Kết thúc bằng: {product_link if product_link else '[LINK]'}
   - PHẢI viết bằng tiếng Việt

⚠️ QUAN TRỌNG: Trả về KẾT QUẢ dưới dạng JSON hợp lệ, KHÔNG có markdown code block:
{{
  "bait": "nội dung bài đăng...",
  "hook": "nội dung comment bẻ lái...",
  "suggested_image": "mô tả ảnh phù hợp cho bài đăng, bằng tiếng Anh, dùng để prompt AI vẽ"
}}

Chỉ trả về JSON, không giải thích gì thêm."""

    print(f"🤖 [AI_GENERATE] Start generation for product: '{product_name}'")
    print(f"   => Persona: {persona_desc}")
    print(f"   => Sending Request to Gemini...")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw = response.text.strip()
        print(f"✅ [AI_GENERATE] Gemini Response Received:")
        print(f"--- RAW START ---\n{raw}\n--- RAW END ---")

        # Clean markdown code blocks if any
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        return {
            "bait": result.get("bait", ""),
            "hook": result.get("hook", ""),
            "suggested_image": result.get("suggested_image", ""),
        }
    except json.JSONDecodeError as e:
        print(f"❌ [AI_GENERATE] Error Parse JSON: {e}")
        return {"bait": raw[:500], "hook": "", "suggested_image": "", "warning": "AI response was not valid JSON", "error": f"JSON Decode: {e}"}
    except Exception as e:
        print(f"❌ [AI_GENERATE] Unknown Error: {e}")
        return {"error": str(e)}
