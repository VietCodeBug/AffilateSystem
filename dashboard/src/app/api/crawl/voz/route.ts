import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/crawl/voz`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Python backend chưa chạy — chạy: python backend/main.py", threads: [], source: "voz" },
            { status: 200 }
        );
    }
}
