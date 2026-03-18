import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 2-minute timeout — Playwright cần thời gian mở browser + thao tác
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const res = await fetch(`${BACKEND_URL}/api/shopee/generate-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        if (error.name === "AbortError") {
            return NextResponse.json({ error: "Quá thời gian tạo link (2 phút)" }, { status: 408 });
        }
        return NextResponse.json({ error: "Lỗi kết nối backend" }, { status: 500 });
    }
}
