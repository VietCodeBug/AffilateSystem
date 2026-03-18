"""
Shopee Affiliate Bot — Playwright Automation
Tự động tạo link Affiliate Shopee bằng giả lập trình duyệt.
Cách hoạt động:
  1. Lần đầu: Chạy login() → Mở trình duyệt → Bạn login Shopee → Bot lưu cookies
  2. Các lần sau: Bot dùng cookies → tự mở trang tạo link → paste URL → copy link affiliate
"""

import os
import json
import asyncio
import threading
from concurrent.futures import Future
from pathlib import Path


def _run_in_thread(async_fn, *args):
    """
    Chạy async function trong thread riêng với event loop mới.
    Giải quyết lỗi NotImplementedError trên Windows khi
    chạy Playwright async trong uvicorn event loop.
    """
    result_future: Future = Future()

    def _run():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(async_fn(*args))
            result_future.set_result(result)
        except Exception as e:
            result_future.set_exception(e)
        finally:
            loop.close()

    thread = threading.Thread(target=_run)
    thread.start()
    thread.join(timeout=360)  # 6 phút max
    if thread.is_alive():
        return {"error": "Timeout — quá thời gian chờ"}
    return result_future.result()

COOKIES_FILE = Path(__file__).parent / "shopee_cookies.json"
USER_INFO_FILE = Path(__file__).parent / "shopee_user.json"

# ═══════════════════════════════════════════
# Cookie Management
# ═══════════════════════════════════════════

def save_cookies(cookies: list[dict]):
    """Lưu cookies vào file JSON."""
    with open(COOKIES_FILE, "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu {len(cookies)} cookies vào {COOKIES_FILE}")

def load_cookies() -> list[dict]:
    """Đọc cookies từ file JSON."""
    if not COOKIES_FILE.exists():
        return []
    with open(COOKIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def has_cookies() -> bool:
    """Kiểm tra đã có cookies chưa."""
    cookies = load_cookies()
    return len(cookies) > 0


def save_user_info(info: dict):
    """Lưu thông tin user Shopee."""
    with open(USER_INFO_FILE, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    print(f"✅ Đã lưu thông tin user: {info.get('username', 'unknown')}")


def get_user_info() -> dict:
    """Đọc thông tin user Shopee."""
    if not USER_INFO_FILE.exists():
        return {}
    try:
        with open(USER_INFO_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def shopee_logout():
    """Xóa cookies & user info → đăng xuất."""
    if COOKIES_FILE.exists():
        COOKIES_FILE.unlink()
    if USER_INFO_FILE.exists():
        USER_INFO_FILE.unlink()
    print("🚪 Đã đăng xuất Shopee — xóa cookies & user info")
    return {"success": True, "message": "Đã đăng xuất Shopee"}


# ═══════════════════════════════════════════
# Login — Mở trình duyệt cho user login thủ công
# ═══════════════════════════════════════════

async def shopee_login():
    """
    Mở trình duyệt Chromium CÓ giao diện cho user đăng nhập.
    Sau khi user login xong → nhấn Enter ở terminal → bot lưu cookies.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "Chưa cài playwright. Chạy: pip install playwright && playwright install chromium"}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,  # Mở trình duyệt có giao diện
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        page = await context.new_page()
        
        # Inject stealth script
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        
        print("🌐 Đang mở Shopee Affiliate Portal...")
        await page.goto("https://affiliate.shopee.vn/", wait_until="domcontentloaded", timeout=30000)
        
        print("=" * 50)
        print("👉 HÃY ĐĂNG NHẬP SHOPEE TRÊN TRÌNH DUYỆT VỪA MỞ")
        print("👉 Sau khi login thành công, quay lại terminal này")
        print("=" * 50)
        
        # Chờ user login — kiểm tra mỗi 3 giây xem đã login chưa
        max_wait = 300  # Chờ tối đa 5 phút
        waited = 0
        logged_in = False
        
        while waited < max_wait:
            await asyncio.sleep(3)
            waited += 3
            
            # Kiểm tra xem có đang ở trang affiliate dashboard không
            current_url = page.url
            if "affiliate.shopee" in current_url and ("dashboard" in current_url or "offer" in current_url or "/home" in current_url):
                logged_in = True
                break
            
            # Hoặc kiểm tra xem có element login thành công không
            try:
                logged_el = await page.query_selector(".user-name, .username, [class*='avatar'], [class*='user-info']")
                if logged_el:
                    logged_in = True
                    break
            except:
                pass
            
            if waited % 15 == 0:
                print(f"⏳ Đang chờ bạn login... ({waited}s)")
        
        if not logged_in:
            # Dù chưa detect, vẫn save cookies cho chắc
            print("⚠️ Không detect được login tự động, nhưng vẫn lưu cookies...")
        
        # === Trích xuất thông tin user ===
        user_info = {"username": "", "avatar": "", "shop_name": ""}
        try:
            # First try DOM
            username_el = await page.query_selector(".user-name, .username")
            if username_el:
                user_info["username"] = await username_el.inner_text()
            
            avatar_el = await page.query_selector("[class*='avatar'] img")
            if avatar_el:
                user_info["avatar"] = await avatar_el.get_attribute("src")
                
            # If not in DOM, sometimes we can extract from local storage or context state
            if not user_info["username"]:
                state = await context.storage_state()
                # Often Shopee saves user info in localStorage or we can just read from cookies
                for c in state.get('cookies', []):
                    if c['name'] == 'username':
                        user_info["username"] = c['value']
        
        except Exception as e:
            print(f"⚠️ Không trích xuất được user info: {e}")

        save_user_info(user_info)

        # Lưu cookies
        cookies = await context.cookies()
        save_cookies(cookies)
        
        await browser.close()
        
        return {
            "success": True, 
            "message": "Đã lưu session thành công", 
            "user_info": user_info
        }

async def shopee_cookie_login(raw_cookie_string: str):
    """
    Đăng nhập bằng cách paste chuỗi Cookie thủ công lấy từ trình duyệt.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "Chưa cài playwright"}

    # Parse chuỗi cookie
    parsed_cookies = []
    for item in raw_cookie_string.split(";"):
        item = item.strip()
        if not item or "=" not in item:
            continue
        name, val = item.split("=", 1)
        parsed_cookies.append({
            "name": name,
            "value": val,
            "domain": ".shopee.vn",
            "path": "/"
        })

    if not parsed_cookies:
        return {"error": "Chuỗi cookie không hợp lệ"}

    # Lưu tạm cookies
    save_cookies(parsed_cookies)

    # Thử check xem cookie có hoạt động không bằng Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        await context.add_cookies(parsed_cookies)
        page = await context.new_page()

        print("🌐 Đang kiểm tra cookie...")
        await page.goto("https://affiliate.shopee.vn/", wait_until="domcontentloaded", timeout=15000)
        
        # Đợi 3s xem có chuyển hướng sang trang login không
        await asyncio.sleep(3)
        current_url = page.url
        
        if "login" in current_url:
            await browser.close()
            # Xóa session lỗi
            shopee_logout()
            return {"error": "Cookie đã hết hạn hoặc không hợp lệ (Bị đẩy về trang đăng nhập)"}

        # Lấy thông tin tài khoản
        user_info = {"username": "", "avatar": "", "shop_name": ""}
        try:
            username_el = await page.query_selector(".user-name, .username")
            if username_el:
                user_info["username"] = await username_el.inner_text()
            
            avatar_el = await page.query_selector("[class*='avatar'] img")
            if avatar_el:
                user_info["avatar"] = await avatar_el.get_attribute("src")
        except Exception:
            pass
            
        # Thử lấy từ network state nếu không có trong DOM
        if not user_info["username"]:
            try:
                # Tìm cookie SPC_U chứa username base64 hash hoặc token
                for c in parsed_cookies:
                    if c["name"] == "SPC_U" and c["value"]:
                        user_info["username"] = "Cookie User" 
            except Exception:
                pass

        if not user_info["username"]:
             user_info["username"] = "Tài khoản (Tĩnh)"

        save_user_info(user_info)
        await browser.close()

        return {
            "success": True,
            "message": "Đã ăn cookie thành công!",
            "user_info": user_info
        }

# ═══════════════════════════════════════════
# Credential Login — Nhập email/password tự động
# ═══════════════════════════════════════════

async def shopee_credential_login(email: str, password: str):
    """
    Đăng nhập Shopee bằng email/password.
    Playwright mở trình duyệt CÓ giao diện → tự điền email + mật khẩu.
    Nếu Shopee yêu cầu captcha/OTP → user tự xử lý trên popup.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "Chưa cài playwright. Chạy: pip install playwright && playwright install chromium"}

    print(f"🔐 Đăng nhập Shopee với email: {email}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,  # MỞ CỬA SỔ BROWSER cho user thấy
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        page = await context.new_page()

        # Stealth scripts
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        """)

        try:
            # === Bước 1: Mở trang Shopee Affiliate → tự redirect sang login ===
            print("🌐 Đang mở trang đăng nhập Shopee...")
            await page.goto("https://affiliate.shopee.vn/", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)

            # === Bước 2: Tìm và điền Email ===
            print("📧 Đang tự điền email...")
            email_filled = False
            email_selectors = [
                'input[name="loginKey"]',
                'input[type="text"][autocomplete]',
                'input[placeholder*="Email"]',
                'input[placeholder*="email"]',
                'input[placeholder*="Số điện thoại"]',
                'input[placeholder*="Phone"]',
                'input[name="email"]',
                'input[name="username"]',
                'input[type="text"]',
            ]
            for sel in email_selectors:
                try:
                    el = await page.wait_for_selector(sel, timeout=3000)
                    if el:
                        await el.click()
                        await el.fill("")
                        await page.wait_for_timeout(200)
                        await el.type(email, delay=30)
                        email_filled = True
                        print(f"  ✅ Đã điền email vào: {sel}")
                        break
                except:
                    continue

            if not email_filled:
                print("  ⚠️ Không tìm thấy ô email, chờ user tự nhập...")

            await page.wait_for_timeout(500)

            # === Bước 3: Tìm và điền Password ===
            print("🔑 Đang tự điền mật khẩu...")
            pw_filled = False
            pw_selectors = [
                'input[name="password"]',
                'input[type="password"]',
                'input[placeholder*="Mật khẩu"]',
                'input[placeholder*="Password"]',
                'input[placeholder*="password"]',
            ]
            for sel in pw_selectors:
                try:
                    el = await page.wait_for_selector(sel, timeout=3000)
                    if el:
                        await el.click()
                        await el.fill("")
                        await page.wait_for_timeout(200)
                        await el.type(password, delay=30)
                        pw_filled = True
                        print(f"  ✅ Đã điền mật khẩu vào: {sel}")
                        break
                except:
                    continue

            if not pw_filled:
                print("  ⚠️ Không tìm thấy ô mật khẩu, chờ user tự nhập...")

            await page.wait_for_timeout(500)

            # === Bước 4: Nhấn nút Login ===  
            print("🖱️ Đang tìm nút đăng nhập...")
            login_clicked = False
            login_btn_selectors = [
                'button:has-text("Đăng nhập")',
                'button:has-text("Log In")',
                'button:has-text("Login")',
                'button[type="submit"]',
                'button.btn-solid-primary',
                '[class*="login"] button',
                'form button',
            ]
            for sel in login_btn_selectors:
                try:
                    btn = await page.wait_for_selector(sel, timeout=2000)
                    if btn:
                        await btn.click()
                        login_clicked = True
                        print(f"  ✅ Đã nhấn nút login: {sel}")
                        break
                except:
                    continue

            if not login_clicked:
                print("  ⚠️ Không tìm thấy nút login, chờ user tự nhấn...")

            # === Bước 5: Chờ login thành công (tối đa 5 phút) ===
            print("=" * 50)
            print("⏳ Đang chờ đăng nhập thành công...")
            print("👉 Nếu có CAPTCHA hoặc OTP → hãy xử lý trên cửa sổ trình duyệt")
            print("=" * 50)

            max_wait = 300  # 5 phút
            waited = 0
            logged_in = False

            while waited < max_wait:
                await asyncio.sleep(3)
                waited += 3

                current_url = page.url
                # Detect đã login xong (URL chuyển sang dashboard)
                if "affiliate.shopee" in current_url and (
                    "dashboard" in current_url or 
                    "offer" in current_url or 
                    "/home" in current_url or
                    "shopee_offer" in current_url
                ):
                    logged_in = True
                    break

                # Detect nếu vẫn ở trang affiliate nhưng không phải login page
                if "affiliate.shopee.vn" in current_url and "login" not in current_url and "signup" not in current_url:
                    # Thử tìm element chứng tỏ đã login
                    try:
                        user_el = await page.query_selector("[class*='avatar'], [class*='user-info'], [class*='user-name']")
                        if user_el:
                            logged_in = True
                            break
                    except:
                        pass

                if waited % 15 == 0:
                    print(f"  ⏳ Đang chờ... ({waited}s)")

            if not logged_in:
                print("⚠️ Chưa detect login, nhưng vẫn lưu cookies...")

            # === Bước 6: Trích xuất thông tin user ===
            user_info = {"username": email.split("@")[0], "avatar": "", "shop_name": ""}
            try:
                # Đợi thêm chút cho page load hết
                await page.wait_for_timeout(2000)

                # Thử lấy username từ DOM
                username_selectors = [
                    ".user-name", ".username",
                    "[class*='user-name']", "[class*='username']",
                    "[class*='account-name']",
                ]
                for sel in username_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            text = (await el.inner_text()).strip()
                            if text and len(text) > 1 and len(text) < 100:
                                user_info["username"] = text
                                print(f"  👤 Username: {text}")
                                break
                    except:
                        continue

                # Thử lấy avatar
                avatar_selectors = [
                    "[class*='avatar'] img",
                    "[class*='user'] img",
                    ".header-menu img",
                ]
                for sel in avatar_selectors:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            src = await el.get_attribute("src")
                            if src and src.startswith("http"):
                                user_info["avatar"] = src
                                break
                    except:
                        continue

                # Fallback: lấy từ cookies
                if user_info["username"] == email.split("@")[0]:
                    state = await context.storage_state()
                    for c in state.get("cookies", []):
                        if c["name"] == "SPC_U" and c["value"]:
                            user_info["username"] = f"Shopee #{c['value']}"
                            break

            except Exception as e:
                print(f"  ⚠️ Không trích xuất được user info: {e}")

            save_user_info(user_info)

            # Lưu cookies
            cookies = await context.cookies()
            save_cookies(cookies)

            await browser.close()

            return {
                "success": True,
                "message": f"Đã đăng nhập thành công! ({user_info['username']})",
                "user_info": user_info,
                "cookies_count": len(cookies),
            }

        except Exception as e:
            print(f"❌ Lỗi credential login: {e}")
            try:
                await browser.close()
            except:
                pass
            return {"error": f"Lỗi đăng nhập: {str(e)}"}


# ═══════════════════════════════════════════
# Generate Affiliate Link — Tự động tạo link
# ═══════════════════════════════════════════

async def generate_affiliate_link(product_url: str) -> dict:
    """
    Dùng Playwright headless để:
    1. Mở trang Shopee Affiliate với cookies đã lưu
    2. Dán URL sản phẩm
    3. Bấm tạo link
    4. Copy link affiliate trả về
    """
    if not has_cookies():
        return {"error": "Chưa đăng nhập Shopee. Gọi /api/shopee/login trước."}
    
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "Chưa cài playwright. Chạy: pip install playwright && playwright install chromium"}
    
    print(f"🤖 Đang tạo affiliate link cho: {product_url}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,  # Chạy ẩn
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="vi-VN",
        )
        
        # Load cookies
        cookies = load_cookies()
        if cookies:
            await context.add_cookies(cookies)
            print(f"🍪 Đã load {len(cookies)} cookies")
        
        page = await context.new_page()
        
        # Stealth
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        
        try:
            # Bước 1: Mở trang tạo link
            print("📄 Mở trang Shopee Affiliate Offer...")
            await page.goto(
                "https://affiliate.shopee.vn/offer/product_offer",
                wait_until="domcontentloaded",
                timeout=20000
            )
            await page.wait_for_timeout(2000)
            
            # Kiểm tra xem có bị redirect về trang login không
            if "login" in page.url.lower() or "signup" in page.url.lower():
                await browser.close()
                return {"error": "Session hết hạn. Vui lòng chạy /api/shopee/login lại."}
            
            # Bước 2: Tìm ô input để paste URL
            print("🔍 Tìm ô nhập link sản phẩm...")
            
            # Thử nhiều selector có thể
            input_selectors = [
                'input[placeholder*="link"]',
                'input[placeholder*="URL"]',
                'input[placeholder*="sản phẩm"]',
                'input[placeholder*="product"]',
                'input[placeholder*="Nhập"]',
                'input[placeholder*="Dán"]',
                'input[type="text"]',
                'textarea',
                '.search-input input',
                '[class*="search"] input',
                '[class*="link-generator"] input',
            ]
            
            input_el = None
            for selector in input_selectors:
                try:
                    input_el = await page.wait_for_selector(selector, timeout=3000)
                    if input_el:
                        print(f"  ✅ Tìm thấy input: {selector}")
                        break
                except:
                    continue
            
            if not input_el:
                # Thử trực tiếp dán URL vào thanh tìm kiếm chung
                screenshot_path = Path(__file__).parent / "debug_shopee.png"
                await page.screenshot(path=str(screenshot_path))
                print(f"📸 Đã chụp screenshot debug: {screenshot_path}")
                await browser.close()
                return {
                    "error": "Không tìm thấy ô nhập URL trên trang Shopee Affiliate. Có thể giao diện đã thay đổi.",
                    "debug_screenshot": str(screenshot_path)
                }
            
            # Bước 3: Nhập URL sản phẩm
            print(f"📝 Nhập URL: {product_url[:60]}...")
            await input_el.click()
            await input_el.fill("")
            await page.wait_for_timeout(300)
            await input_el.type(product_url, delay=50)
            await page.wait_for_timeout(1000)
            
            # Bước 4: Bấm nút tạo link
            print("🔍 Tìm nút tạo link...")
            button_selectors = [
                'button:has-text("Tạo link")',
                'button:has-text("Tạo Link")',
                'button:has-text("Generate")',
                'button:has-text("Lấy link")',
                'button:has-text("Tìm")',
                'button:has-text("Search")',
                '[class*="generate"] button',
                '[class*="submit"] button',
                'button[type="submit"]',
            ]
            
            btn_el = None
            for selector in button_selectors:
                try:
                    btn_el = await page.wait_for_selector(selector, timeout=2000)
                    if btn_el:
                        print(f"  ✅ Tìm thấy nút: {selector}")
                        break
                except:
                    continue
            
            if btn_el:
                await btn_el.click()
                print("  ✅ Đã bấm nút tạo link")
            else:
                # Thử nhấn Enter thay vì click button
                await input_el.press("Enter")
                print("  ⚠️ Không tìm thấy nút, thử nhấn Enter")
            
            # Bước 5: Chờ kết quả và copy link
            print("⏳ Đang chờ link affiliate được tạo...")
            await page.wait_for_timeout(5000)
            
            # Tìm link affiliate trong kết quả
            affiliate_link = None
            
            # Thử tìm trong các element chứa link
            link_selectors = [
                '[class*="affiliate-link"]',
                '[class*="short-link"]',
                '[class*="generated"]',
                'input[readonly]',
                'input[value*="shope.ee"]',
                'input[value*="s.shopee"]',
                '[class*="copy"] input',
                'a[href*="shope.ee"]',
                'a[href*="s.shopee"]',
            ]
            
            for selector in link_selectors:
                try:
                    el = await page.query_selector(selector)
                    if el:
                        # Thử lấy value (nếu là input)
                        val = await el.get_attribute("value")
                        if val and ("shope.ee" in val or "s.shopee" in val or "shopee" in val):
                            affiliate_link = val
                            break
                        # Thử lấy href (nếu là <a>)
                        href = await el.get_attribute("href")
                        if href and ("shope.ee" in href or "s.shopee" in href):
                            affiliate_link = href
                            break
                        # Thử lấy text
                        text = await el.inner_text()
                        if text and ("shope.ee" in text or "s.shopee" in text):
                            affiliate_link = text.strip()
                            break
                except:
                    continue
            
            # Fallback: quét toàn bộ page tìm link shopee affiliate
            if not affiliate_link:
                page_text = await page.content()
                import re
                matches = re.findall(r'https?://(?:shope\.ee|s\.shopee\.vn)/[^\s"\'<>]+', page_text)
                if matches:
                    affiliate_link = matches[0]
                    print(f"  🔎 Tìm được link qua regex: {affiliate_link}")
            
            # Cập nhật cookies mới
            new_cookies = await context.cookies()
            save_cookies(new_cookies)
            
            await browser.close()
            
            if affiliate_link:
                print(f"✅ Thành công! Link: {affiliate_link}")
                return {
                    "success": True,
                    "affiliate_link": affiliate_link,
                    "original_url": product_url
                }
            else:
                screenshot_path = Path(__file__).parent / "debug_shopee_result.png"
                await page.screenshot(path=str(screenshot_path))
                return {
                    "error": "Không tìm thấy link affiliate trong kết quả. Có thể cần login lại.",
                    "debug_screenshot": str(screenshot_path)
                }
                
        except Exception as e:
            print(f"❌ Lỗi: {e}")
            try:
                screenshot_path = Path(__file__).parent / "debug_shopee_error.png"
                await page.screenshot(path=str(screenshot_path))
            except:
                pass
            await browser.close()
            return {"error": f"Lỗi Playwright: {str(e)}"}


# ═══════════════════════════════════════════
# Bulk Generate — Tạo nhiều link cùng lúc
# ═══════════════════════════════════════════

async def bulk_generate_links(urls: list[str]) -> list[dict]:
    """Tạo link affiliate cho nhiều URL."""
    results = []
    for i, url in enumerate(urls):
        print(f"\n📦 [{i+1}/{len(urls)}] Đang xử lý: {url[:60]}...")
        result = await generate_affiliate_link(url)
        results.append(result)
        # Delay giữa các request để tránh bị Shopee chặn
        if i < len(urls) - 1:
            await asyncio.sleep(2)
    return results


# ═══════════════════════════════════════════
# Auto Crawl — Tự động quét sản phẩm Shopee Affiliate
# ═══════════════════════════════════════════

async def auto_crawl_products(max_products: int = 20) -> dict:
    """
    Tự động mở Shopee Affiliate → quét danh sách sản phẩm có sẵn
    → lấy link affiliate cho từng sản phẩm.
    """
    if not has_cookies():
        return {"error": "Chưa đăng nhập Shopee. Gọi /api/shopee/login trước.", "products": []}

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "Chưa cài playwright.", "products": []}

    print(f"🛒 Auto-crawl: Quét tối đa {max_products} sản phẩm từ Shopee Affiliate...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            locale="vi-VN",
        )

        # Load cookies
        cookies = load_cookies()
        if cookies:
            await context.add_cookies(cookies)

        page = await context.new_page()
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)

        products = []

        try:
            # Mở trang product offer
            print("📄 Mở trang Shopee Affiliate Product Offer...")
            await page.goto(
                "https://affiliate.shopee.vn/offer/product_offer",
                wait_until="domcontentloaded",
                timeout=20000
            )
            await page.wait_for_timeout(3000)

            # Check login
            if "login" in page.url.lower() or "signup" in page.url.lower():
                await browser.close()
                return {"error": "Session hết hạn. Vui lòng đăng nhập lại.", "products": []}

            # Quét sản phẩm trên trang
            print("🔍 Đang quét sản phẩm...")

            # Thử nhiều selector cho danh sách sản phẩm
            product_selectors = [
                "[class*='product-card']",
                "[class*='ProductCard']",
                "[class*='product-item']",
                "[class*='offer-card']",
                "[class*='OfferCard']",
                "[class*='item-card']",
                ".product-list > div",
                "[class*='product'] [class*='card']",
                "table tbody tr",
                "[class*='list'] [class*='item']",
            ]

            product_elements = []
            for sel in product_selectors:
                try:
                    els = await page.query_selector_all(sel)
                    if els and len(els) >= 2:
                        product_elements = els[:max_products]
                        print(f"  ✅ Tìm thấy {len(els)} sản phẩm qua selector: {sel}")
                        break
                except:
                    continue

            if not product_elements:
                # Fallback: quét tất cả links có chứa shopee product URL
                print("  ⚠️ Không tìm thấy cards, thử quét links...")
                all_links = await page.query_selector_all("a[href*='shopee.vn/']")
                seen_urls = set()
                for link_el in all_links[:max_products * 2]:
                    try:
                        href = await link_el.get_attribute("href") or ""
                        if "shopee.vn/" in href and href not in seen_urls and "affiliate" not in href:
                            seen_urls.add(href)
                            text = (await link_el.inner_text()).strip()
                            if text and len(text) > 3:
                                # Lấy ảnh nếu có
                                img = await link_el.query_selector("img")
                                img_src = ""
                                if img:
                                    img_src = await img.get_attribute("src") or ""

                                products.append({
                                    "name": text[:200],
                                    "url": href,
                                    "image": img_src,
                                    "commission": "",
                                    "affiliate_link": "",
                                })
                    except:
                        continue
            else:
                # Parse từng product card
                for el in product_elements:
                    try:
                        # Tên sản phẩm
                        name = ""
                        for name_sel in ["[class*='name']", "[class*='title']", "h3", "h4", "a", "span"]:
                            try:
                                name_el = await el.query_selector(name_sel)
                                if name_el:
                                    text = (await name_el.inner_text()).strip()
                                    if text and len(text) > 3 and len(text) < 300:
                                        name = text
                                        break
                            except:
                                continue

                        if not name:
                            continue

                        # URL sản phẩm
                        url = ""
                        link = await el.query_selector("a[href*='shopee']")
                        if link:
                            url = await link.get_attribute("href") or ""
                        if not url:
                            link = await el.query_selector("a")
                            if link:
                                url = await link.get_attribute("href") or ""

                        # Ảnh
                        img_src = ""
                        img = await el.query_selector("img")
                        if img:
                            img_src = await img.get_attribute("src") or ""

                        # Commission
                        commission = ""
                        for comm_sel in ["[class*='commission']", "[class*='rate']", "[class*='percent']"]:
                            try:
                                comm_el = await el.query_selector(comm_sel)
                                if comm_el:
                                    commission = (await comm_el.inner_text()).strip()
                                    break
                            except:
                                continue

                        # Tìm nút "Lấy link" hoặc "Get link" trong card
                        aff_link = ""
                        for btn_sel in [
                            "button:has-text('Lấy link')",
                            "button:has-text('Get link')",
                            "button:has-text('Tạo link')",
                            "[class*='copy'] input",
                            "input[value*='shope.ee']",
                        ]:
                            try:
                                btn = await el.query_selector(btn_sel)
                                if btn:
                                    tag = await btn.evaluate("el => el.tagName")
                                    if tag == "INPUT":
                                        aff_link = await btn.get_attribute("value") or ""
                                    else:
                                        await btn.click()
                                        await page.wait_for_timeout(500)
                                    break
                            except:
                                continue

                        products.append({
                            "name": name,
                            "url": url,
                            "image": img_src,
                            "commission": commission,
                            "affiliate_link": aff_link,
                        })

                    except Exception as e:
                        print(f"  ⚠️ Lỗi parse product: {e}")
                        continue

            # Cập nhật cookies
            new_cookies = await context.cookies()
            save_cookies(new_cookies)

            await browser.close()

            print(f"✅ Auto-crawl hoàn tất: {len(products)} sản phẩm")
            return {
                "success": True,
                "products": products,
                "total": len(products),
                "message": f"Đã quét được {len(products)} sản phẩm từ Shopee Affiliate",
            }

        except Exception as e:
            print(f"❌ Auto-crawl error: {e}")
            try:
                ss = Path(__file__).parent / "debug_autocrawl.png"
                await page.screenshot(path=str(ss))
                print(f"📸 Debug screenshot: {ss}")
            except:
                pass
            await browser.close()
            return {"error": f"Lỗi quét sản phẩm: {str(e)}", "products": []}


# ═══════════════════════════════════════════
# CLI Test
# ═══════════════════════════════════════════

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        print("🔐 Bắt đầu đăng nhập Shopee...")
        result = asyncio.run(shopee_login())
        print(result)
    elif len(sys.argv) > 1:
        url = sys.argv[1]
        print(f"🔗 Tạo link cho: {url}")
        result = asyncio.run(generate_affiliate_link(url))
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Usage:")
        print("  python shopee_bot.py login          — Đăng nhập Shopee (lần đầu)")
        print("  python shopee_bot.py <product_url>  — Tạo link affiliate")
