import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Use AbortController for setting timeout manually just in case
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 mins

        const backendUrl = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/api/shopee/cookie-login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return NextResponse.json({ error: "Quá thời gian kiểm tra cookie", success: false }, { status: 408 });
        }
        return NextResponse.json({ error: "Lỗi proxy kết nối tới backend", success: false }, { status: 500 });
    }
}
