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
    Shuffle, LinkIcon,
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

    /* ─── Load links ─── */
    const loadLinks = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/links`);
            const data = await res.json();
            setLinks(data.links || []);
        } catch {
            console.error("Failed to load links");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLinks();
    }, [loadLinks]);

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
                        onClick={loadLinks}
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
        </>
    );
}
