import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const source = searchParams.get("source") || "";
        const limit = searchParams.get("limit") || "50";
        const offset = searchParams.get("offset") || "0";

        const params = new URLSearchParams({ limit, offset });
        if (source) params.set("source", source);

        const res = await fetch(`${BACKEND_URL}/api/threads?${params}`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Python backend chưa chạy", threads: [], total: 0 },
            { status: 200 }
        );
    }
}
