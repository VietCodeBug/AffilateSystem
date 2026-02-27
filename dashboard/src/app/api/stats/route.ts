import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/stats`, { cache: "no-store" });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ voz: 0, xamvn: 0, total: 0 }, { status: 200 });
    }
}
