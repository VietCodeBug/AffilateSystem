import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const maxProducts = searchParams.get("max_products") || "20";

        // 2-minute timeout — Playwright cần thời gian mở browser + quét sản phẩm
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const res = await fetch(`${BACKEND_URL}/api/shopee/auto-crawl?max_products=${maxProducts}`, {
            method: "POST",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        if (error.name === "AbortError") {
            return NextResponse.json({ error: "Quá thời gian quét sản phẩm (2 phút)", products: [] }, { status: 408 });
        }
        return NextResponse.json({ error: "Lỗi kết nối backend", products: [] }, { status: 500 });
    }
}
