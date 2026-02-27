import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const res = await fetch(`${BACKEND_URL}/api/threads/${id}/content`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { error: "Backend không phản hồi", content: "" },
            { status: 200 }
        );
    }
}
