"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Link, Plus, Copy, Trash2, ExternalLink, ShoppingCart,
    MousePointerClick, Package, DollarSign, RefreshCw, Loader2,
    Shuffle, LinkIcon, Bot, Zap, LogIn, LogOut, Search, MessageSquare, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */
interface AffLink {
    id: string;
    name: string;
    original_url: string;
    shortened_url: string;
    shortener: string;
    collection_name: string;
    clicks: number;
    orders: number;
    commission: number;
    created_at: string;
}

const collectionOptions = [
    "📱 Công nghệ",
    "🍜 Đồ ăn vặt",
    "😂 Đồ bựa",
    "👗 Thời trang",
    "🏠 Gia dụng",
    "💄 Mỹ phẩm",
];

const collectionFilters = ["Tất cả", ...collectionOptions];

const collectionEmoji = (col: string) => {
    const match = col.match(/^([\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}])/u);
    return match ? match[0] : "📦";
};

export function AffiliateLinksPage() {
    const [links, setLinks] = useState<AffLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AffLink | null>(null);
    const [filter, setFilter] = useState("Tất cả");

    // Add form
    const [addName, setAddName] = useState("");
    const [addUrl, setAddUrl] = useState("");
    const [addCollection, setAddCollection] = useState(collectionOptions[0]);

    // Shopee Bot state
    const [shopeeLoggedIn, setShopeeLoggedIn] = useState(false);
    const [shopeeUsername, setShopeeUsername] = useState("");
    const [shopeeAvatar, setShopeeAvatar] = useState("");
    const [shopeeLoggingIn, setShopeeLoggingIn] = useState(false);
    const [showLoginDialog, setShowLoginDialog] = useState(false);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [showAutoDialog, setShowAutoDialog] = useState(false);
    const [autoUrl, setAutoUrl] = useState("");
    const [autoGenerating, setAutoGenerating] = useState(false);
    const [autoCrawling, setAutoCrawling] = useState(false);
    const [crawledProducts, setCrawledProducts] = useState<{ name: string; url: string; image: string; commission: string }[]>([]);

    // Telegram Bot state
    const [telegramRunning, setTelegramRunning] = useState(false);
    const [telegramUsername, setTelegramUsername] = useState("");
    const [telegramLinksReceived, setTelegramLinksReceived] = useState(0);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    /* ─── Load links ─── */
    const loadLinks = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/links?page=${p}&page_size=${PAGE_SIZE}`);
            const data = await res.json();
            setLinks(data.links || []);
            setTotalPages(data.total_pages || 1);
            setTotalCount(data.total || 0);
        } catch {
            console.error("Failed to load links");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadLinks(page);
        // Check Shopee login status via Next.js proxy (no CORS)
        fetch(`/api/shopee/status`)
            .then(r => r.json())
            .then(d => {
                setShopeeLoggedIn(d.logged_in || false);
                setShopeeUsername(d.username || "");
                setShopeeAvatar(d.avatar || "");
            })
            .catch(() => { });
        // Check Telegram Bot status
        fetch(`/api/telegram/status`)
            .then(r => r.json())
            .then(d => {
                setTelegramRunning(d.running || false);
                setTelegramUsername(d.bot_username || "");
                setTelegramLinksReceived(d.links_received || 0);
            })
            .catch(() => { });
    }, [page, loadLinks]);

    /* ─── Shopee Bot Login ─── */
    const handleShopeeLogin = async () => {
        setShopeeLoggingIn(true);
        toast.loading("🔐 Đang mở trình duyệt Shopee... (hãy login trên trình duyệt vừa mở)", { id: "shopee-login", duration: 300000 });
        try {
            // Use Next.js proxy route to avoid CORS
            const res = await fetch(`/api/shopee/login`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setShopeeLoggedIn(true);
                if (data.user_info?.username) {
                    setShopeeUsername(data.user_info.username);
                    setShopeeAvatar(data.user_info.avatar || "");
                }
                toast.success(`✅ Đã đăng nhập Shopee thành công!${data.user_info?.username ? ` (${data.user_info.username})` : ''}`, { id: "shopee-login" });
            } else {
                toast.error(data.error || "Lỗi đăng nhập", { id: "shopee-login" });
            }
        } catch {
            toast.error("Lỗi kết nối server", { id: "shopee-login" });
        } finally {
            setShopeeLoggingIn(false);
        }
    };

    /* ─── Shopee Credential Login ─── */
    const handleCredentialLogin = async () => {
        if (!loginEmail.trim() || !loginPassword.trim()) {
            toast.error("Vui lòng nhập email và mật khẩu");
            return;
        }
        setShopeeLoggingIn(true);
        setShowLoginDialog(false);
        toast.loading("🔐 Đang mở trình duyệt và tự điền thông tin... Nếu có Captcha hãy xử lý trên cửa sổ popup", { id: "shopee-login", duration: 300000 });
        try {
            const res = await fetch(`/api/shopee/credential-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, password: loginPassword })
            });
            const data = await res.json();
            if (data.success) {
                setShopeeLoggedIn(true);
                if (data.user_info?.username) {
                    setShopeeUsername(data.user_info.username);
                    setShopeeAvatar(data.user_info.avatar || "");
                }
                toast.success(`✅ ${data.message}`, { id: "shopee-login" });
                setLoginEmail("");
                setLoginPassword("");
                loadLinks();
            } else {
                toast.error(data.error || "Đăng nhập thất bại", { id: "shopee-login" });
            }
        } catch {
            toast.error("Lỗi kết nối server", { id: "shopee-login" });
        } finally {
            setShopeeLoggingIn(false);
        }
    };

    /* ─── Shopee Logout ─── */
    const handleShopeeLogout = async () => {
        try {
            const res = await fetch(`/api/shopee/logout`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setShopeeLoggedIn(false);
                setShopeeUsername("");
                setShopeeAvatar("");
                toast.success("🚨 Đã đăng xuất Shopee");
            }
        } catch {
            toast.error("Lỗi kết nối server");
        }
    };

    /* ─── Shopee Bot Auto Generate ─── */
    const handleAutoGenerate = async () => {
        if (!autoUrl.trim()) {
            toast.error("Nhập link sản phẩm Shopee");
            return;
        }
        setAutoGenerating(true);
        toast.loading("🤖 Bot đang tạo link affiliate...", { id: "auto-gen" });
        try {
            const res = await fetch(`/api/shopee/generate-link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_url: autoUrl }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`✅ Tạo link thành công!`, {
                    id: "auto-gen",
                    description: data.affiliate_link?.substring(0, 50) + "..."
                });
                setShowAutoDialog(false);
                setAutoUrl("");
                loadLinks();
            } else {
                toast.error(data.error || "Lỗi tạo link", { id: "auto-gen" });
            }
        } catch {
            toast.error("Lỗi kết nối server", { id: "auto-gen" });
        } finally {
            setAutoGenerating(false);
        }
    };

    /* ─── Add link ─── */
    const handleAdd = async () => {
        if (!addName.trim() || !addUrl.trim()) {
            toast.error("Nhập tên và link sản phẩm");
            return;
        }
        setAdding(true);
        toast.loading("🔗 Đang rút gọn link...", { id: "add-link" });
        try {
            const res = await fetch(`${API}/api/links`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: addName,
                    original_url: addUrl,
                    collection: addCollection,
                }),
            });
            const data = await res.json();
            if (data.link) {
                toast.success(`✅ Đã thêm & rút gọn qua ${data.link.shortener}`, { id: "add-link" });
                setShowAddDialog(false);
                setAddName("");
                setAddUrl("");
                loadLinks();
            } else {
                toast.error("Lỗi khi thêm link", { id: "add-link" });
            }
        } catch {
            toast.error("Lỗi kết nối server", { id: "add-link" });
        } finally {
            setAdding(false);
        }
    };

    /* ─── Delete link ─── */
    const handleDelete = async (id: string) => {
        try {
            await fetch(`${API}/api/links/${id}`, { method: "DELETE" });
            setLinks((prev) => prev.filter((l) => l.id !== id));
            setDeleteTarget(null);
            toast.success("Đã xóa link");
        } catch {
            toast.error("Lỗi khi xóa");
        }
    };

    /* ─── Copy ─── */
    const copyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success("Đã copy link!", { description: url.substring(0, 50) + "..." });
    };

    /* ─── Filter ─── */
    const filtered = filter === "Tất cả"
        ? links
        : links.filter((l) => l.collection_name === filter);

    const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const totalOrders = links.reduce((sum, l) => sum + (l.orders || 0), 0);
    const totalCommission = links.reduce((sum, l) => sum + (l.commission || 0), 0);

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">🔗 Affiliate Links</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Quản lý kho link Shopee — tự động rút gọn & xoay vòng domain
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => loadLinks()}
                        className="gap-2 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                    >
                        <RefreshCw className="w-4 h-4" /> Làm mới
                    </Button>
                    <Button
                        onClick={() => setShowAddDialog(true)}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg hover:shadow-orange-500/25 transition-all gap-2"
                    >
                        <Plus className="w-4 h-4" /> Thêm link
                    </Button>
                </div>
            </div>

            {/* Shopee Bot Card */}
            <Card className="border-0 shadow-sm mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    Shopee Bot
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${shopeeLoggedIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${shopeeLoggedIn ? "bg-green-500" : "bg-red-500"}`} />
                                        {shopeeLoggedIn ? "Đã kết nối" : "Chưa login"}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {shopeeLoggedIn && shopeeUsername ? (
                                        <span className="flex items-center gap-1.5">
                                            {shopeeAvatar && (
                                                <img src={shopeeAvatar} alt="" className="w-4 h-4 rounded-full" />
                                            )}
                                            Tài khoản: <strong className="text-gray-700">{shopeeUsername}</strong>
                                        </span>
                                    ) : shopeeLoggedIn ? (
                                        <>Đã kết nối Shopee Affiliate — sẵn sàng tạo link</>
                                    ) : (
                                        <>Đăng nhập để tự động tạo link affiliate bằng Playwright</>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {shopeeLoggedIn && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleShopeeLogout}
                                    className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                                >
                                    <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                                </Button>
                            )}
                            {!shopeeLoggedIn && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowLoginDialog(true)}
                                    disabled={shopeeLoggingIn}
                                    className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100"
                                >
                                    {shopeeLoggingIn ? (
                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xử lý...</>
                                    ) : (
                                        <><LogIn className="w-3.5 h-3.5" /> Đăng nhập Shopee</>
                                    )}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                disabled={!shopeeLoggedIn}
                                onClick={() => setShowAutoDialog(true)}
                                className="gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm hover:shadow-lg hover:shadow-orange-500/25"
                            >
                                <Zap className="w-3.5 h-3.5" /> Tạo link tự động
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Telegram Bot Card */}
            <Card className="border-0 shadow-sm mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Send className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    Telegram Bot
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${telegramRunning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${telegramRunning ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                                        {telegramRunning ? "Đang chạy" : "Tắt"}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {telegramRunning && telegramUsername ? (
                                        <span className="flex items-center gap-1.5">
                                            <MessageSquare className="w-3 h-3" />
                                            Bot: <strong className="text-blue-600">@{telegramUsername}</strong>
                                            {telegramLinksReceived > 0 && (
                                                <span className="text-gray-400">• {telegramLinksReceived} link nhận</span>
                                            )}
                                        </span>
                                    ) : (
                                        <>Gửi link Shopee từ điện thoại qua Telegram → tự lưu vào Dashboard</>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {telegramRunning && telegramUsername && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100"
                                    onClick={() => {
                                        window.open(`https://t.me/${telegramUsername}`, "_blank");
                                    }}
                                >
                                    <Send className="w-3.5 h-3.5" /> Mở Telegram Bot
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger-children">
                {[
                    { label: "Tổng link", value: links.length, icon: LinkIcon, color: "text-gray-900" },
                    { label: "Lượt click", value: totalClicks, icon: MousePointerClick, color: "text-orange-600" },
                    { label: "Đơn hàng", value: totalOrders, icon: Package, color: "text-green-600" },
                    { label: "Hoa hồng", value: `${totalCommission.toLocaleString('vi-VN')}đ`, icon: DollarSign, color: "text-yellow-600" },
                ].map((s) => (
                    <Card key={s.label} className="border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                <s.icon className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <span className={`text-lg font-bold ${s.color} tabular-nums block`}>{s.value}</span>
                                <span className="text-[10px] text-gray-400">{s.label}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {collectionFilters.map((f) => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        className={`text-xs h-8 rounded-full ${filter === f
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm"
                            : "hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                            }`}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </Button>
                ))}
            </div>

            {/* Links List */}
            <Card className="card-premium border-0 shadow-sm">
                <CardContent className="divide-y divide-gray-50 p-0">
                    {loading ? (
                        <div className="p-6 space-y-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="w-10 h-10 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-64" />
                                    </div>
                                    <Skeleton className="h-8 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                                <LinkIcon className="w-8 h-8 text-orange-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Chưa có link nào</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Thêm link Shopee affiliate để hệ thống tự động rút gọn
                            </p>
                            <Button
                                onClick={() => setShowAddDialog(true)}
                                className="bg-gradient-to-r from-orange-500 to-orange-600 gap-2"
                            >
                                <Plus className="w-4 h-4" /> Thêm link đầu tiên
                            </Button>
                        </div>
                    ) : (
                        filtered.map((link) => (
                            <div
                                key={link.id}
                                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg shrink-0">
                                    {collectionEmoji(link.collection_name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-800 truncate">{link.name}</span>
                                        <Badge variant="secondary" className="text-[9px] rounded-full shrink-0">
                                            {link.collection_name}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[11px] text-gray-400 truncate max-w-[200px]">
                                            {link.shortened_url || link.original_url}
                                        </span>
                                        {link.shortener && link.shortener !== "none" && (
                                            <Badge variant="outline" className="text-[9px] rounded-full text-green-600 border-green-200">
                                                {link.shortener}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden md:flex gap-6 text-center shrink-0">
                                    <div>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums block">{link.clicks}</span>
                                        <span className="text-[9px] text-gray-400">Clicks</span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums block">{link.orders}</span>
                                        <span className="text-[9px] text-gray-400">Đơn</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-orange-600"
                                        onClick={() => copyLink(link.shortened_url || link.original_url)}
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-orange-600"
                                        onClick={() => window.open(link.original_url, "_blank")}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                                        onClick={() => setDeleteTarget(link)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-[11px] text-gray-400">
                        Trang {page}/{totalPages} · Tổng {totalCount} link
                    </span>
                    <div className="flex gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="text-xs h-7"
                        >
                            ← Trước
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="text-xs h-7"
                        >
                            Sau →
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ Add Link Dialog ═══ */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>🔗 Thêm Link Affiliate</DialogTitle>
                        <DialogDescription>
                            Hệ thống sẽ tự động rút gọn link qua TinyURL / is.gd / clck.ru (xoay vòng domain)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tên sản phẩm <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="VD: Chuột Gaming Logitech G102"
                                value={addName}
                                onChange={(e) => setAddName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Link Shopee gốc <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="https://shopee.vn/..."
                                value={addUrl}
                                onChange={(e) => setAddUrl(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bộ sưu tập</Label>
                            <Select value={addCollection} onValueChange={setAddCollection}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {collectionOptions.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Hủy</Button>
                        <Button
                            className="bg-gradient-to-r from-orange-500 to-orange-600 gap-2"
                            onClick={handleAdd}
                            disabled={adding}
                        >
                            {adding ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                            ) : (
                                <><Plus className="w-4 h-4" /> Thêm & Rút gọn</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Delete Confirmation ═══ */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>🗑️ Xóa link affiliate?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Link <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ═══ Shopee Bot Auto-Generate Dialog ═══ */}
            <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-orange-500" />
                            Tạo Link Affiliate Tự Động
                        </DialogTitle>
                        <DialogDescription>
                            Dán link sản phẩm Shopee vào đây hoặc bấm “Tự động quét” để bot nhặt link từ Shopee Affiliate Portal.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Manual URL input */}
                        <div className="space-y-2">
                            <Label>Link sản phẩm Shopee</Label>
                            <Input
                                placeholder="https://shopee.vn/product-name-i.12345.67890"
                                value={autoUrl}
                                onChange={(e) => setAutoUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAutoGenerate(); }}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 gap-2 text-white"
                                onClick={handleAutoGenerate}
                                disabled={autoGenerating || !autoUrl.trim()}
                            >
                                {autoGenerating ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</>
                                ) : (
                                    <><Bot className="w-4 h-4" /> Tạo link</>
                                )}
                            </Button>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">hoặc</span></div>
                        </div>

                        {/* Auto crawl section */}
                        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                            <p className="text-xs text-blue-700 mb-2 flex items-start gap-2">
                                <Search className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                Bot sẽ tự động vào Shopee Affiliate Portal, quét danh sách sản phẩm có sẵn và lấy link giúp bạn.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                                onClick={async () => {
                                    setAutoCrawling(true);
                                    toast.loading("🛒 Bot đang quét sản phẩm từ Shopee...", { id: "auto-crawl" });
                                    try {
                                        const res = await fetch(`/api/shopee/auto-crawl`, { method: "POST" });
                                        const data = await res.json();
                                        if (data.success && data.products?.length > 0) {
                                            setCrawledProducts(data.products);
                                            toast.success(`✅ Tìm thấy ${data.products.length} sản phẩm!`, { id: "auto-crawl" });
                                        } else if (data.error) {
                                            toast.error(data.error, { id: "auto-crawl" });
                                        } else {
                                            toast.info("Không tìm thấy sản phẩm nào", { id: "auto-crawl" });
                                        }
                                    } catch {
                                        toast.error("Lỗi kết nối server", { id: "auto-crawl" });
                                    } finally {
                                        setAutoCrawling(false);
                                    }
                                }}
                                disabled={autoCrawling}
                            >
                                {autoCrawling ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang quét...</>
                                ) : (
                                    <><Search className="w-3.5 h-3.5" /> Tự động quét sản phẩm</>
                                )}
                            </Button>
                        </div>

                        {/* Crawled products list */}
                        {crawledProducts.length > 0 && (
                            <div className="max-h-60 overflow-y-auto border rounded-lg">
                                <div className="text-[11px] text-gray-500 px-3 py-1.5 bg-gray-50 border-b font-medium">
                                    {crawledProducts.length} sản phẩm tìm thấy
                                </div>
                                {crawledProducts.map((prod, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-orange-50/50">
                                        {prod.image && (
                                            <img src={prod.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-700 line-clamp-1">{prod.name}</p>
                                            {prod.commission && (
                                                <span className="text-[10px] text-green-600">{prod.commission}</span>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[10px] px-2 shrink-0"
                                            onClick={async () => {
                                                // Directly generate link for this product
                                                setCrawledProducts([]);
                                                setAutoGenerating(true);
                                                toast.loading("🤖 Bot đang tạo link affiliate...", { id: "auto-gen" });
                                                try {
                                                    const res = await fetch(`/api/shopee/generate-link`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ product_url: prod.url }),
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        toast.success(`✅ Tạo link thành công!`, {
                                                            id: "auto-gen",
                                                            description: data.affiliate_link?.substring(0, 50) + "..."
                                                        });
                                                        setShowAutoDialog(false);
                                                        setAutoUrl("");
                                                        loadLinks(); // Refresh to show new link in list
                                                    } else {
                                                        toast.error(data.error || "Lỗi tạo link", { id: "auto-gen" });
                                                    }
                                                } catch {
                                                    toast.error("Lỗi kết nối server", { id: "auto-gen" });
                                                } finally {
                                                    setAutoGenerating(false);
                                                }
                                            }}
                                            disabled={autoGenerating}
                                        >
                                            Chọn
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowAutoDialog(false); setCrawledProducts([]); }}>
                            Đóng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Credential Login Dialog ═══ */}
            <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LogIn className="w-5 h-5 text-orange-500" />
                            Đăng nhập Shopee Affiliate
                        </DialogTitle>
                        <DialogDescription>
                            Nhập email và mật khẩu Shopee. Hệ thống sẽ mở trình duyệt, tự điền thông tin đăng nhập. Nếu có Captcha/OTP bạn xử lý trên cửa sổ popup.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label className="text-xs font-medium text-gray-600 mb-1 block">Email / Số điện thoại</Label>
                            <Input
                                type="text"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="email@gmail.com"
                                autoFocus
                                className="text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-medium text-gray-600 mb-1 block">Mật khẩu</Label>
                            <Input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCredentialLogin(); }}
                                className="text-sm"
                            />
                        </div>
                        <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1.5 rounded-md leading-tight">
                            ⚠️ Thông tin chỉ dùng để tự động điền vào trang login Shopee, <strong>không</strong> lưu trữ trên server.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={handleCredentialLogin}
                            disabled={!loginEmail.trim() || !loginPassword.trim() || shopeeLoggingIn}
                            className="bg-gradient-to-r from-orange-500 to-orange-600 w-full gap-2"
                        >
                            {shopeeLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                            Đăng nhập tự động
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
