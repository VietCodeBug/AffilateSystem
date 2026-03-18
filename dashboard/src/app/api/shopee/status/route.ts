import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/shopee/status`, { cache: "no-store" });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { logged_in: false, username: "", avatar: "", message: "Backend chưa chạy" },
            { status: 200 }
        );
    }
}
