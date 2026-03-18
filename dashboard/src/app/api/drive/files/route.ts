import { NextResponse, NextRequest } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const params = new URLSearchParams();

        // Forward all query params to backend
        searchParams.forEach((value, key) => {
            params.set(key, value);
        });

        const res = await fetch(`${BACKEND_URL}/api/drive/files?${params}`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Python backend chưa chạy", files: [] },
            { status: 200 }
        );
    }
}
