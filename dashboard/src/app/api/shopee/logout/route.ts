import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function POST() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/shopee/logout`, { method: "POST" });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: "Lỗi kết nối backend" }, { status: 500 });
    }
}
