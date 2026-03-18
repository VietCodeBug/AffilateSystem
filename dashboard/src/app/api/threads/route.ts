import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        // Forward all query params directly to backend
        const params = new URLSearchParams();

        // Support both old (limit/offset) and new (page/page_size) params
        const page = searchParams.get("page") || "1";
        const pageSize = searchParams.get("page_size") || searchParams.get("limit") || "20";
        params.set("page", page);
        params.set("page_size", pageSize);

        const source = searchParams.get("source");
        if (source) params.set("source", source);

        const startDate = searchParams.get("start_date");
        if (startDate) params.set("start_date", startDate);

        const endDate = searchParams.get("end_date");
        if (endDate) params.set("end_date", endDate);

        const res = await fetch(`${BACKEND_URL}/api/threads?${params}`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Python backend chưa chạy", threads: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
            { status: 200 }
        );
    }
}
