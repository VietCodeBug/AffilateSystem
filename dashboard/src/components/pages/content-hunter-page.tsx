"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Play, Wand2, Trash2, Clock, Loader2, RefreshCw, CheckCircle,
    ExternalLink, MessageCircle, Eye, AlertTriangle, ArrowUpRight, ThumbsUp,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";

/* ─── Types ─── */
interface CrawledThread {
    id: string;
    title: string;
    url: string;
    author: string;
    replies: number;
    views: string;
    time: string;
    time_text?: string;
    prefix?: string;
    source: string;
    content?: string;
    thumbnail?: string;
    score?: number;
}

interface SourceInfo {
    key: string;
    name: string;
    logo: string;
    logoClass: string;
    apiPath: string;
    status: "idle" | "crawling" | "done" | "error";
    total: number;
    today: number;
    progress: number;
    error?: string;
}

/* ─── Component ─── */
export function ContentHunterPage() {
    const [sources, setSources] = useState<SourceInfo[]>([
        { key: "voz", name: "Voz Forum", logo: "V", logoClass: "bg-gradient-to-br from-rose-500 to-rose-600", apiPath: "voz", status: "idle", total: 0, today: 0, progress: 0 },
        { key: "reddit", name: "Reddit", logo: "R", logoClass: "bg-gradient-to-br from-orange-500 to-red-500", apiPath: "reddit", status: "idle", total: 0, today: 0, progress: 0 },
    ]);
    const [threads, setThreads] = useState<CrawledThread[]>([]);
    const [filter, setFilter] = useState("Tất cả");
    const [dateFilter, setDateFilter] = useState("3_days"); // "today", "yesterday", "3_days", "all"
    const [crawlDialogOpen, setCrawlDialogOpen] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 30;

    // Loading states for actions
    const [sendingAI, setSendingAI] = useState<Record<string, boolean>>({});

    // Detail modal state
    const [selectedThread, setSelectedThread] = useState<CrawledThread | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailContent, setDetailContent] = useState("");

    /* ─── Load stored threads from DB on mount & filter change ─── */
    const loadStored = useCallback(async (isLoadMore = false, currentPage = page) => {
        if (!isLoadMore) setInitialLoading(true);
        try {
            // Calculate date ranges
            let startDateParam = "";
            const now = new Date();
            if (dateFilter === "today") {
                now.setHours(0, 0, 0, 0);
                startDateParam = now.toISOString();
            } else if (dateFilter === "yesterday") {
                const yest = new Date(now);
                yest.setDate(yest.getDate() - 1);
                yest.setHours(0, 0, 0, 0);
                startDateParam = yest.toISOString();

                // End of yesterday
                const endYest = new Date(now);
                endYest.setDate(endYest.getDate() - 1);
                endYest.setHours(23, 59, 59, 999);
            } else if (dateFilter === "3_days") {
                const past = new Date(now);
                past.setDate(past.getDate() - 3);
                startDateParam = past.toISOString();
            }

            const offset = (currentPage - 1) * LIMIT;
            let url = `/api/threads?limit=${LIMIT}&offset=${offset}`;
            if (startDateParam) url += `&start_date=${encodeURIComponent(startDateParam)}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.threads) {
                const loadedThreads = data.threads.map((t: CrawledThread) => ({
                    ...t,
                    time: t.time || t.time_text || "",
                    source: t.source || "unknown",
                }));

                if (isLoadMore) {
                    setThreads(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const newToAdd = loadedThreads.filter((nt: CrawledThread) => !existingIds.has(nt.id));
                        return [...prev, ...newToAdd];
                    });
                } else {
                    setThreads(loadedThreads);
                }

                setHasMore(loadedThreads.length === LIMIT);
            }

            // Stats
            if (!isLoadMore) {
                const statsRes = await fetch("/api/stats");
                const stats = await statsRes.json();
                setSources((prev) =>
                    prev.map((s) => ({
                        ...s,
                        total: stats[s.key] || 0,
                    }))
                );
            }
        } catch {
            // Backend not running
        } finally {
            setInitialLoading(false);
        }
    }, [dateFilter, page]);

    useEffect(() => {
        loadStored(page > 1, page);
    }, [page, dateFilter, loadStored]);

    // Handle date filter change
    const handleDateFilterChange = (val: string) => {
        setDateFilter(val);
        setPage(1); // Reset pagination
    };

    /* ─── View thread detail ─── */
    const viewDetail = async (thread: CrawledThread) => {
        setSelectedThread(thread);
        setDetailOpen(true);

        // If already has content inline, show it
        if (thread.content && thread.content.length > 5) {
            setDetailContent(thread.content);
            return;
        }

        // Fetch content on demand
        setDetailLoading(true);
        setDetailContent("");
        try {
            const res = await fetch(`/api/threads/${thread.id}/content`);
            const data = await res.json();
            setDetailContent(data.content || "Không có nội dung chi tiết.");
        } catch {
            setDetailContent("Lỗi tải nội dung.");
        } finally {
            setDetailLoading(false);
        }
    };

    /* ─── Crawl a single source ─── */
    const crawlSource = useCallback(async (sourceKey: string) => {
        const src = sources.find((s) => s.key === sourceKey);
        if (!src) return;

        setSources((prev) =>
            prev.map((s) =>
                s.key === sourceKey ? { ...s, status: "crawling" as const, progress: 10, error: undefined } : s
            )
        );

        const toastId = `crawl-${sourceKey}`;
        toast.loading(`Đang cào ${src.name}...`, { id: toastId });

        const progressTimer = setInterval(() => {
            setSources((prev) =>
                prev.map((s) =>
                    s.key === sourceKey && s.status === "crawling"
                        ? { ...s, progress: Math.min(s.progress + Math.random() * 15, 90) }
                        : s
                )
            );
        }, 400);

        try {
            const res = await fetch(`/api/crawl/${src.apiPath}`);
            const data = await res.json();

            clearInterval(progressTimer);

            if (data.error && data.threads?.length === 0) {
                setSources((prev) =>
                    prev.map((s) =>
                        s.key === sourceKey
                            ? { ...s, status: "error" as const, progress: 0, error: data.error }
                            : s
                    )
                );
                toast.error(`Lỗi cào ${src.name}`, { id: toastId, description: data.error });
                return;
            }

            const newThreads: CrawledThread[] = (data.threads || []).map(
                (t: CrawledThread) => ({ ...t, source: t.source || sourceKey })
            );

            setThreads((prev) => {
                const existingIds = new Set(prev.map((t) => t.id));
                const toAdd = newThreads.filter((t) => !existingIds.has(t.id));
                return [...toAdd, ...prev];
            });

            setSources((prev) =>
                prev.map((s) =>
                    s.key === sourceKey
                        ? { ...s, status: "done" as const, progress: 100, total: s.total + newThreads.length, today: s.today + newThreads.length }
                        : s
                )
            );

            toast.success(`Đã cào xong ${src.name}!`, { id: toastId, description: `${newThreads.length} bài mới` });

            setTimeout(() => {
                setSources((prev) =>
                    prev.map((s) =>
                        s.key === sourceKey ? { ...s, status: "idle" as const, progress: 0 } : s
                    )
                );
            }, 3000);
        } catch {
            clearInterval(progressTimer);
            setSources((prev) =>
                prev.map((s) =>
                    s.key === sourceKey
                        ? { ...s, status: "error" as const, progress: 0, error: "Python backend chưa chạy" }
                        : s
                )
            );
            toast.error(`Lỗi cào ${src.name}`, { id: toastId, description: "Chạy: python backend/main.py" });
        }
    }, [sources]);

    const crawlAll = () => {
        sources.forEach((s) => {
            if (s.status !== "crawling") crawlSource(s.key);
        });
    };

    const deleteThread = (id: string) => {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        toast("Đã xóa bài viết");
    };

    const sendToAI = async (thread: CrawledThread) => {
        if ((thread as any).sent_to_ai) return; // Prevent double send

        setSendingAI(prev => ({ ...prev, [thread.id]: true }));
        try {
            const productName = prompt("Tên sản phẩm muốn gợi ý cho bài này?", "Bàn phím cơ văn phòng");
            if (!productName) {
                setSendingAI(prev => ({ ...prev, [thread.id]: false }));
                return;
            }

            const res = await fetch(`/api/ai/generate-from-thread/${thread.id}?product_name=${encodeURIComponent(productName)}`, {
                method: "POST"
            });
            const data = await res.json();

            if (data.error) {
                toast.error("Lỗi AI", { description: data.error });
                setSendingAI(prev => ({ ...prev, [thread.id]: false }));
            } else {
                toast.success(`Đã gửi sang AI Writer`, { description: `Đã tạo chiến dịch cho "${productName}"` });

                // Update local list to mark as sent immediately
                setThreads(prev => prev.map(t =>
                    t.id === thread.id ? { ...t, sent_to_ai: true } : t
                ));

                // Keep it showing as loading for just a moment longer for UX
                setTimeout(() => {
                    setSendingAI(prev => ({ ...prev, [thread.id]: false }));
                }, 500);
            }
        } catch (error) {
            toast.error("Lỗi kết nối", { description: "Không thể gọi API AI" });
            setSendingAI(prev => ({ ...prev, [thread.id]: false }));
        }
    };

    /* ─── Filter ─── */
    const filterOptions = ["Tất cả", "Voz", "Reddit"];
    const filtered = filter === "Tất cả"
        ? threads
        : threads.filter((t) => {
            if (filter === "Voz") return t.source === "voz";
            if (filter === "Reddit") return t.source === "reddit";
            return true;
        });

    const sourceColor = (src: string) => src === "voz" ? "bg-rose-500" : "bg-orange-500";
    const sourceLabel = (src: string) => src === "voz" ? "VOZ" : "REDDIT";

    return (
        <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Content Hunter</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Cào bài viết real-time từ Voz Forum & Reddit
                    </p>
                </div>
                <Dialog open={crawlDialogOpen} onOpenChange={setCrawlDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg hover:shadow-orange-500/25 transition-all">
                            <Play className="w-4 h-4 mr-2" /> Cào ngay
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>🕷️ Cào nội dung real-time</DialogTitle>
                            <DialogDescription>
                                Chọn nguồn cào. Reddit sẽ cào từ r/vozforums, r/VietNam, r/funny, r/memes, r/AskReddit.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            {sources.map((src) => (
                                <div key={src.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-orange-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg ${src.logoClass} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                            {src.logo}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-800">{src.name}</span>
                                            <span className="text-xs text-gray-400 block">
                                                {src.total > 0 ? `${src.total} bài đã cào` : "Chưa cào"}
                                            </span>
                                        </div>
                                    </div>
                                    <Button size="sm" variant={src.status === "crawling" ? "secondary" : "outline"} className="text-xs h-8" disabled={src.status === "crawling"} onClick={() => crawlSource(src.key)}>
                                        {src.status === "crawling" ? (
                                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang cào...</>
                                        ) : (
                                            <><RefreshCw className="w-3 h-3 mr-1" /> Cào</>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <DialogFooter>
                            <Button onClick={() => { crawlAll(); setCrawlDialogOpen(false); }} className="bg-gradient-to-r from-orange-500 to-orange-600 w-full">
                                <Play className="w-4 h-4 mr-2" /> Cào tất cả nguồn
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Source Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 stagger-children">
                {sources.map((src) => (
                    <Card key={src.key} className="card-premium border-0 shadow-sm overflow-hidden">
                        {src.status === "crawling" && <div className="h-0.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 animate-shimmer" />}
                        {src.status === "done" && <div className="h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />}
                        {src.status === "error" && <div className="h-0.5 bg-gradient-to-r from-red-400 to-red-500" />}
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-11 h-11 rounded-xl ${src.logoClass} flex items-center justify-center text-white font-extrabold text-lg shadow-sm`}>{src.logo}</div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-gray-800">{src.name}</h4>
                                    <span className={`text-[11px] font-semibold flex items-center gap-1 ${src.status === "crawling" ? "text-orange-500" :
                                        src.status === "done" ? "text-green-500" :
                                            src.status === "error" ? "text-red-500" : "text-gray-400"
                                        }`}>
                                        {src.status === "crawling" ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Đang cào...</> :
                                            src.status === "done" ? <><CheckCircle className="w-2.5 h-2.5" /> Cào xong!</> :
                                                src.status === "error" ? <><AlertTriangle className="w-2.5 h-2.5" /> {src.error || "Lỗi"}</> :
                                                    <><span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Chờ lệnh</>}
                                    </span>
                                </div>
                                <Button size="sm" variant="ghost" className="h-8 w-8 hover:bg-orange-50 hover:text-orange-600" onClick={() => crawlSource(src.key)} disabled={src.status === "crawling"}>
                                    <RefreshCw className={`w-3.5 h-3.5 ${src.status === "crawling" ? "animate-spin" : ""}`} />
                                </Button>
                            </div>
                            {src.status === "crawling" && (
                                <div className="mb-3">
                                    <Progress value={src.progress} className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-orange-600" />
                                    <span className="text-[10px] text-orange-500 font-medium mt-1 block">{Math.round(src.progress)}%</span>
                                </div>
                            )}
                            <div className="flex gap-6">
                                <div>
                                    <span className="text-xl font-bold text-gray-900 tabular-nums block">{src.total}</span>
                                    <span className="text-[11px] text-gray-400">Tổng bài</span>
                                </div>
                                <div>
                                    <span className="text-xl font-bold text-gray-900 tabular-nums block">{src.today}</span>
                                    <span className="text-[11px] text-gray-400">Hôm nay</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Crawled Threads Real-time List */}
            <Card className="card-premium border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">
                            Nội dung đã cào ({filtered.length})
                        </CardTitle>
                        {threads.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                LIVE
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2 items-center w-full md:w-auto mt-2 md:mt-0">
                        {/* Source filters */}
                        <div className="flex gap-1.5 mr-2">
                            {filterOptions.map((f) => (
                                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${filter === f
                                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm"
                                    : "border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600"
                                    }`}>
                                    {f}
                                </button>
                            ))}
                        </div>

                        {/* Date filters */}
                        <select
                            value={dateFilter}
                            onChange={(e) => handleDateFilterChange(e.target.value)}
                            className="text-[11px] px-2 py-1.5 rounded-full border border-gray-200 text-gray-600 focus:outline-none focus:border-orange-400 bg-transparent pr-7 appearance-none cursor-pointer"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: '12px' }}
                        >
                            <option value="today">Hôm nay</option>
                            <option value="yesterday">Hôm qua</option>
                            <option value="3_days">3 ngày gần đây</option>
                            <option value="all">Tất cả thời gian</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="text-4xl mb-3">🕷️</div>
                            <p className="text-sm text-gray-500 font-medium">Chưa có dữ liệu</p>
                            <p className="text-xs text-gray-400 mt-1">Nhấn &quot;Cào ngay&quot; để bắt đầu thu thập bài viết</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {filtered.map((thread) => {
                                const isSentToAI = (thread as any).sent_to_ai;
                                return (
                                    <div
                                        key={`${thread.source}-${thread.id}`}
                                        className={`flex items-start gap-3.5 py-4 first:pt-0 last:pb-0 group -mx-6 px-6 transition-colors cursor-pointer ${isSentToAI ? 'bg-gray-50 opacity-75' : 'hover:bg-orange-50/30'}`}
                                        onClick={() => viewDetail(thread)}
                                    >
                                        {/* Source badge */}
                                        <Badge className={`${sourceColor(thread.source)} text-white text-[9px] font-bold shrink-0 rounded-lg shadow-sm mt-0.5`}>
                                            {sourceLabel(thread.source)}
                                        </Badge>

                                        {/* Content preview */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[13px] font-medium text-gray-700 leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
                                                {thread.prefix && (
                                                    <Badge variant="secondary" className="text-[9px] rounded mr-1.5 bg-gray-100 text-gray-500 font-normal">
                                                        {thread.prefix}
                                                    </Badge>
                                                )}
                                                {thread.title}
                                            </h4>
                                            {/* Content preview line */}
                                            {thread.content && (
                                                <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                                                    {thread.content.slice(0, 120)}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                                <span className="font-medium text-gray-500">@{thread.author}</span>
                                                <span className="flex items-center gap-0.5">
                                                    <MessageCircle className="w-3 h-3" /> {thread.replies}
                                                </span>
                                                <span className="flex items-center gap-0.5">
                                                    {thread.source === "reddit" ? <ThumbsUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    {thread.views}
                                                </span>
                                                <span className="flex items-center gap-0.5">
                                                    <Clock className="w-3 h-3" /> {thread.time}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions (stop propagation to prevent opening detail) */}
                                        <div className={`flex gap-1 shrink-0 transition-opacity ${isSentToAI || sendingAI[thread.id] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className={`w-8 h-8 transition-all ${isSentToAI ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700' : 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300'}`}
                                                onClick={() => sendToAI(thread)}
                                                title={isSentToAI ? "Đã gửi AI" : "Gửi sang AI Writer"}
                                                disabled={sendingAI[thread.id] || isSentToAI}
                                            >
                                                {sendingAI[thread.id] ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : isSentToAI ? (
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Wand2 className="w-3.5 h-3.5" />
                                                )}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => window.open(thread.url, "_blank")} title="Mở bài gốc">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-red-50 hover:text-red-500">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Xóa bài viết?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Xóa &quot;{thread.title.slice(0, 50)}...&quot;?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => deleteThread(thread.id)}>Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Load more button */}
                            {hasMore && filtered.length > 0 && (
                                <div className="py-4 flex justify-center border-t border-gray-50">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => p + 1)}
                                        className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                        disabled={initialLoading}
                                    >
                                        {initialLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Tải thêm bài cũ hơn"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Detail Modal ─── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh]">
                    {selectedThread && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge className={`${sourceColor(selectedThread.source)} text-white text-[9px]`}>
                                        {sourceLabel(selectedThread.source)}
                                    </Badge>
                                    {selectedThread.prefix && (
                                        <Badge variant="secondary" className="text-[9px]">{selectedThread.prefix}</Badge>
                                    )}
                                </div>
                                <DialogTitle className="text-base leading-snug pr-6">
                                    {selectedThread.title}
                                </DialogTitle>
                                <DialogDescription asChild>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                        <span className="font-medium text-gray-500">@{selectedThread.author}</span>
                                        <span className="flex items-center gap-0.5">
                                            <MessageCircle className="w-3 h-3" /> {selectedThread.replies} comments
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            {selectedThread.source === "reddit" ? <ThumbsUp className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            {selectedThread.views}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <Clock className="w-3 h-3" /> {selectedThread.time}
                                        </span>
                                    </div>
                                </DialogDescription>
                            </DialogHeader>

                            <ScrollArea className="max-h-[50vh] pr-4">
                                {detailLoading ? (
                                    <div className="py-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                                        <p className="text-xs text-gray-400">Đang tải nội dung...</p>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {detailContent || selectedThread.content || "Nhấn mở bài gốc để xem nội dung đầy đủ."}
                                    </div>
                                )}
                            </ScrollArea>

                            <DialogFooter className="flex-row gap-2 sm:justify-between">
                                <Button variant="outline" size="sm" onClick={() => window.open(selectedThread.url, "_blank")}>
                                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Mở bài gốc
                                </Button>
                                <div className="flex gap-2">
                                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600" onClick={() => { sendToAI(selectedThread); setDetailOpen(false); }}>
                                        <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Gửi sang AI
                                    </Button>
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
