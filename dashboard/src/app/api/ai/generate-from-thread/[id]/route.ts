import { NextResponse } from "next/server";

const BACKEND_URL = process.env.CRAWLER_BACKEND_URL || "http://localhost:8000";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Resolve promises in Next.js 15
        const { id } = await params;

        const { searchParams } = new URL(req.url);
        const productName = searchParams.get("product_name") || "";
        const productLink = searchParams.get("product_link") || "";

        const urlParams = new URLSearchParams();
        if (productName) urlParams.set("product_name", productName);
        if (productLink) urlParams.set("product_link", productLink);

        const res = await fetch(`${BACKEND_URL}/api/ai/generate-from-thread/${id}?${urlParams.toString()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json(
            { error: "Lỗi kết nối Backend Python", details: String(error) },
            { status: 500 }
        );
    }
}
