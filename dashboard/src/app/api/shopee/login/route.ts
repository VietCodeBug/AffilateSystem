import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function POST() {
    try {
        // Long timeout because login waits for user to login manually (up to 5 min)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 310000); // 5 min + 10s buffer

        const res = await fetch(`${BACKEND_URL}/api/shopee/login`, {
            method: "POST",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json(
                { error: "Login timeout (5 phút). Thử lại." },
                { status: 408 }
            );
        }
        return NextResponse.json(
            { error: "Lỗi kết nối backend" },
            { status: 500 }
        );
    }
}
