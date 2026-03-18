import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const controller = new AbortController();
        // 5-minute timeout — user may need to handle captcha/OTP
        const timeoutId = setTimeout(() => controller.abort(), 300000);

        const backendUrl = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/api/shopee/credential-login`, {
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
            return NextResponse.json({ error: "Quá thời gian đăng nhập (5 phút)", success: false }, { status: 408 });
        }
        return NextResponse.json({ error: "Lỗi kết nối tới backend", success: false }, { status: 500 });
    }
}
