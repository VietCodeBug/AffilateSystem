import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const res = await fetch(
            `${BACKEND_URL}/api/video/translate/${jobId}/status`,
            { cache: "no-store" }
        );
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Python backend chưa chạy" },
            { status: 500 }
        );
    }
}
