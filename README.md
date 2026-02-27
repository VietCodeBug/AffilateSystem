# 🎣 Affiliate Shoppe — Bait & Hook System 

Một hệ thống tự động hóa hoàn chỉnh dành cho Affiliate Shoppe, tích hợp **AI Brain (Gemini 2.5 Flash)** và cơ sở dữ liệu thời gian thực **Firebase (Firestore & Realtime Database)**.

Thuật toán đăng bài theo chiến lược "Mồi Nhử & Lưỡi Câu" giúp tiếp cận tự nhiên, tăng tỷ lệ chuyển đổi và viral mạnh mẽ.

---

## 🌟 Các tính năng chính (Tính năng v3.0)

1. **🧠 AI Brain — Bait & Hook Generator**
   - Sự kết hợp cùng Gemini 2.5 Flash cho ra một cặp **Bài đăng (Mồi nhử)** thuần túy giải trí (vô tri / meme văn phòng) và **Comment (Lưỡi câu)** chứa link điều hướng (affiliate).
   - Prompt thiết kế tối ưu với tính tự nhiên cao, giọng văn Gen Z hài hước.

2. **🤖 Trình thu thập tự động (Web Crawlers)**
   - Cào bài viết từ **Reddit** (các sub: `r/vozforums`, `r/VietNam`, `r/TroChuyenLinhTinh`...).
   - Cào bài viết từ **Voz Forum** (`f17` - Chuyện trò linh tinh).
   - Nội dung cào về được sử dụng làm cảm hứng (Source Content) cho AI Brain "xào nấu" thành Content Bait & Hook cực mới.

3. **🔗 Trình Quản lý và Rút gọn Link (Link Shortener)**
   - Nhập link Affiliate Shopee, hệ thống tự động xoay vòng lấy domain rút gọn (`tinyurl`, `is.gd`, `clck.ru`) tránh việc bị AI nền tảng MXH quét và cấm tên miền gốc.
   - Thống kê tự động dữ liệu: Tổng click, số lượng đơn, doanh thu hoa hồng.

4. **⚡ Database Thời gian thực — Firebase**
   - **Firestore:** Quản lý mọi tài liệu (Threads đã cào, Campaigns Content tự sinh, Affiliate Links sinh ra).
   - **Realtime DB:** Quản lý trạng thái Publisher, các Feed trực tiếp cho bảng điều khiển Dashboard (Counters, Post Logs).

5. **🖥️ Dashboard Vận hành Modern UI**
   - Áp dụng Next.js (App Router), Tailwind CSS cùng với `shadcn/ui` thiết kế hiện đại.
   - Live synchronization giữa các Clients nhờ Firebase real-time listeners. 
   - Quản lý duyệt bài (Approve / Reject), thay đổi Content, hoặc yêu cầu AI Re-generate nhanh chóng.

---

## 🛠️ Công Nghệ / Kiến Trúc (Tech Stack)

### **Frontend (Dashboard Client):**
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Styling:** Tailwind CSS + Shadcn/UI
- **Database Client:** Firebase SDK V9 (Firestore + Realtime/RTDB)
- **Ngôn ngữ:** TypeScript

### **Backend (Crawler & AI Brain):**
- **Framework:** Python 3.10+ (FastAPI)
- **AI Core:** Google GenAI (Gemini 2.5 Flash API)
- **Database Client:** Firebase API REST trực tiếp (Không dùng Admin SDK nhằm tối ưu hoá cấu hình).
- **Scraping:** BeautifulSoup4, curl_cffi (Fake Browser TLS impersonation)

---

## 🚀 Hướng Dẫn Cài Đặt (Installation)

### 1. Backend (Python FastAPI)
```bash
cd backend
python -m venv .venv
# Activate virtualenv (Windows)
.venv\\Scripts\\activate
pip install -r requirements.txt
```
Tạo file `.env` chứa 2 thông số API:
```env
GEMINI_KEY="YOUR_GEMINI_API_KEY_HERE"
```
Khởi động Server Backend:
```bash
python main.py
```

### 2. Frontend (Next.js Dashboard)
```bash
cd dashboard
npm install
```
Thiết lập URL trỏ về Python Backend trong Component hoặc trong `.env.local` nếu cần:
```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
```
Khởi động Dev Server Của Dashboard Next.js:
```bash
npm run dev
```

---

## 🔗 Luồng hoạt động (Workflow)
1. **Content Hunter:** Chạy hệ thống Crawlers để cào bài Voz/Reddit lấy content Base.
2. **AI Writer:** Gửi content source hoặc tự gửi thông tin Sản Phẩm cho AI. Trí tuệ nhân tạo sẽ chẻ nhỏ ra thành **Bait Post** và **Hook Comment**. Tạo 1 bản ráp nháp vào kho Campaigns (Firestore).
3. **Admin Verification:** Quản trị viên vào hệ thống chỉnh sửa hoặc Accept -> Trạng thái **"Approved"**.
4. **Publisher (Comming Soon):** Quét kho bài, đẩy Bait Post vào Groups, Fanpages Facebook, Threads, Telegram Channel -> Sau đó tiếp tục thả Hook Comment đính kèm Link.

_Made for the Affiliate Shoppe System._
