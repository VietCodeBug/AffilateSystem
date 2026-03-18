"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Wand2, Check, RotateCcw, Pencil, CheckCheck, ShoppingCart, Loader2,
    Sparkles, MessageCircle, Image, Trash2, Fish, Anchor, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Types ─── */
interface Campaign {
    id: string;
    bait: string;
    hook: string;
    product_name: string;
    product_link: string;
    shortened_link: string;
    page_persona: string;
    source_thread_id: string;
    status: "draft" | "approved" | "posted" | "failed";
    created_at: string;
    suggested_image?: string;
}

const personaOptions = [
    "Hội những người đi làm văn phòng",
    "Hội những con Rắn đi làm",
    "Meme Văn Phòng",
    "Hội FA không gấu",
    "Hội nghiện mì tôm",
    "Hội đam mê công nghệ",
];

export function AiWriterPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [showGenDialog, setShowGenDialog] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [editBait, setEditBait] = useState("");
    const [editHook, setEditHook] = useState("");
    const [confirmApprove, setConfirmApprove] = useState<Campaign | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    // Generate form
    const [genProductName, setGenProductName] = useState("");
    const [genProductLink, setGenProductLink] = useState("");
    const [genPersona, setGenPersona] = useState(personaOptions[0]);
    const [genSourceContent, setGenSourceContent] = useState("");

    /* ─── Load campaigns from API ─── */
    const loadCampaigns = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/campaigns?page=${p}&page_size=${PAGE_SIZE}`);
            const data = await res.json();
            setCampaigns(data.campaigns || []);
            setTotalPages(data.total_pages || 1);
            setTotalCount(data.total || 0);
        } catch {
            console.error("Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadCampaigns(page);
    }, [page, loadCampaigns]);

    /* ─── Generate new Bait & Hook ─── */
    const handleGenerate = async () => {
        if (!genProductName.trim()) {
            toast.error("Nhập tên sản phẩm");
            return;
        }
        setGenerating(true);
        toast.loading("🧠 AI Gemini đang sinh content kép...", { id: "gen" });
        try {
            const res = await fetch(`${API}/api/ai/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_name: genProductName,
                    product_link: genProductLink,
                    page_persona: genPersona,
                    source_content: genSourceContent,
                }),
            });
            const data = await res.json();
            if (data.error) {
                toast.error(`Lỗi: ${data.error}`, { id: "gen" });
                return;
            }
            toast.success("✨ AI đã tạo Bait & Hook thành công!", { id: "gen" });
            setShowGenDialog(false);
            setGenProductName("");
            setGenProductLink("");
            setGenSourceContent("");
            loadCampaigns();
        } catch (err) {
            toast.error("Lỗi kết nối server", { id: "gen" });
        } finally {
            setGenerating(false);
        }
    };

    /* ─── Approve campaign ─── */
    const approveCampaign = async (id: string) => {
        try {
            await fetch(`${API}/api/campaigns/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved" }),
            });
            setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "approved" } : c));
            setConfirmApprove(null);
            toast.success("✅ Đã duyệt chiến dịch!", { description: "Sẵn sàng để đăng" });
        } catch {
            toast.error("Lỗi khi duyệt");
        }
    };

    /* ─── Regenerate (delete old + create new) ─── */
    const regenerateCampaign = async (campaign: Campaign) => {
        toast.loading("🔄 AI đang viết lại...", { id: `regen-${campaign.id}` });
        try {
            // Delete old
            await fetch(`${API}/api/campaigns/${campaign.id}`, { method: "DELETE" });
            // Generate new
            const res = await fetch(`${API}/api/ai/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_name: campaign.product_name,
                    product_link: campaign.product_link,
                    page_persona: campaign.page_persona,
                }),
            });
            const data = await res.json();
            if (data.error) {
                toast.error(`Lỗi: ${data.error}`, { id: `regen-${campaign.id}` });
                return;
            }
            toast.success("✨ AI đã viết lại xong!", { id: `regen-${campaign.id}` });
            loadCampaigns();
        } catch {
            toast.error("Lỗi kết nối", { id: `regen-${campaign.id}` });
        }
    };

    /* ─── Delete campaign ─── */
    const deleteCampaign = async (id: string) => {
        try {
            await fetch(`${API}/api/campaigns/${id}`, { method: "DELETE" });
            setCampaigns((prev) => prev.filter((c) => c.id !== id));
            setConfirmDelete(null);
            toast.success("Đã xóa chiến dịch");
        } catch {
            toast.error("Lỗi khi xóa");
        }
    };

    /* ─── Save edit ─── */
    const saveEdit = () => {
        if (!editingCampaign) return;
        // Optimistic update locally (backend doesn't have edit content endpoint yet)
        setCampaigns((prev) =>
            prev.map((c) =>
                c.id === editingCampaign.id
                    ? { ...c, bait: editBait, hook: editHook }
                    : c
            )
        );
        setEditingCampaign(null);
        toast.success("Đã lưu chỉnh sửa");
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "draft":
                return <Badge variant="secondary" className="text-[11px] font-semibold rounded-full px-2.5 bg-orange-100 text-orange-600">Chờ duyệt</Badge>;
            case "approved":
                return <Badge variant="secondary" className="text-[11px] font-semibold rounded-full px-2.5 bg-green-100 text-green-600">Đã duyệt</Badge>;
            case "posted":
                return <Badge variant="secondary" className="text-[11px] font-semibold rounded-full px-2.5 bg-blue-100 text-blue-600">Đã đăng</Badge>;
            case "failed":
                return <Badge variant="secondary" className="text-[11px] font-semibold rounded-full px-2.5 bg-red-100 text-red-600">Lỗi</Badge>;
            default:
                return null;
        }
    };

    const formatTime = (iso: string) => {
        if (!iso) return "";
        try {
            const d = new Date(iso);
            return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} — ${d.getDate()}/${d.getMonth() + 1}`;
        } catch { return iso; }
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">🧠 AI Writer</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Sinh content kép <strong>Bait & Hook</strong> — Gemini 2.5 Flash
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => loadCampaigns()}
                        className="gap-2 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                    >
                        <RefreshCw className="w-4 h-4" /> Làm mới
                    </Button>
                    <Button
                        onClick={() => setShowGenDialog(true)}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg hover:shadow-orange-500/25 transition-all gap-2"
                    >
                        <Sparkles className="w-4 h-4" /> Viết bài mới
                    </Button>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger-children">
                {[
                    { label: "Tổng chiến dịch", value: campaigns.length, color: "text-gray-900" },
                    { label: "Chờ duyệt", value: campaigns.filter(c => c.status === "draft").length, color: "text-orange-600" },
                    { label: "Đã duyệt", value: campaigns.filter(c => c.status === "approved").length, color: "text-green-600" },
                    { label: "Đã đăng", value: campaigns.filter(c => c.status === "posted").length, color: "text-blue-600" },
                ].map((s) => (
                    <Card key={s.label} className="border-0 shadow-sm">
                        <CardContent className="p-4 text-center">
                            <span className={`text-2xl font-bold ${s.color} tabular-nums block`}>{s.value}</span>
                            <span className="text-[11px] text-gray-400">{s.label}</span>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Campaign Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="border-0 shadow-sm">
                            <CardContent className="p-5 space-y-3">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-20 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-8 w-20" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : campaigns.length === 0 ? (
                    <Card className="col-span-full border-0 shadow-sm">
                        <CardContent className="p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-orange-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Chưa có chiến dịch nào</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Nhấn &quot;Viết bài mới&quot; để AI tạo nội dung Bait & Hook đầu tiên
                            </p>
                            <Button
                                onClick={() => setShowGenDialog(true)}
                                className="bg-gradient-to-r from-orange-500 to-orange-600 gap-2"
                            >
                                <Sparkles className="w-4 h-4" /> Bắt đầu ngay
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    campaigns.map((camp) => (
                        <Card key={camp.id} className="card-premium border-0 shadow-sm flex flex-col overflow-hidden">
                            <CardContent className="p-5 flex flex-col gap-3.5 flex-1">
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    {statusBadge(camp.status)}
                                    <span className="text-[11px] text-gray-400">{formatTime(camp.created_at)}</span>
                                </div>

                                {/* Bait Section */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
                                        <Fish className="w-3.5 h-3.5" /> MỒI NHỬ (Bài đăng)
                                    </div>
                                    <p className="text-[13px] text-gray-700 leading-relaxed line-clamp-4 bg-violet-50/50 rounded-lg px-3 py-2 border border-violet-100/50">
                                        {camp.bait}
                                    </p>
                                </div>

                                {/* Hook Section */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                                        <Anchor className="w-3.5 h-3.5" /> LƯỠI CÂU (Comment)
                                    </div>
                                    <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-3 bg-amber-50/50 rounded-lg px-3 py-2 border border-amber-100/50">
                                        {camp.hook}
                                    </p>
                                </div>

                                {/* Product Tag */}
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs text-orange-700 border border-orange-100/50">
                                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                                    <span>Sản phẩm: <strong>{camp.product_name}</strong></span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 flex-wrap mt-auto">
                                    {camp.status === "draft" ? (
                                        <>
                                            <Button
                                                size="sm"
                                                className="bg-gradient-to-r from-orange-500 to-orange-600 text-xs h-8 shadow-sm hover:shadow-md hover:shadow-orange-500/20"
                                                onClick={() => setConfirmApprove(camp)}
                                            >
                                                <Check className="w-3.5 h-3.5 mr-1" /> Duyệt
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-8 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                                                onClick={() => regenerateCampaign(camp)}
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Viết lại
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs h-8 text-gray-500 hover:text-orange-600"
                                                onClick={() => {
                                                    setEditingCampaign(camp);
                                                    setEditBait(camp.bait);
                                                    setEditHook(camp.hook);
                                                }}
                                            >
                                                <Pencil className="w-3.5 h-3.5 mr-1" /> Sửa
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs h-8 text-gray-400 hover:text-red-500"
                                                onClick={() => setConfirmDelete(camp)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </>
                                    ) : camp.status === "approved" ? (
                                        <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                                            <CheckCheck className="w-4 h-4" /> Đã duyệt — Chờ đăng
                                        </span>
                                    ) : camp.status === "posted" ? (
                                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
                                            <CheckCheck className="w-4 h-4" /> Đã đăng lên Facebook
                                        </span>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-[11px] text-gray-400">
                        Trang {page}/{totalPages} · Tổng {totalCount} chiến dịch
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

            {/* ═══ Generate Dialog ═══ */}
            <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>🧠 Sinh Content Kép — Bait & Hook</DialogTitle>
                        <DialogDescription>
                            AI Gemini sẽ tạo bài đăng viral (Mồi nhử) + Comment bẻ lái chốt sale (Lưỡi câu)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tên sản phẩm <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="VD: Gối tựa lưng văn phòng cao su non"
                                value={genProductName}
                                onChange={(e) => setGenProductName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Link sản phẩm (Shopee)</Label>
                            <Input
                                placeholder="https://shopee.vn/..."
                                value={genProductLink}
                                onChange={(e) => setGenProductLink(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Persona của Page</Label>
                            <Select value={genPersona} onValueChange={setGenPersona}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {personaOptions.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Nguồn cảm hứng (tuỳ chọn)</Label>
                            <Textarea
                                placeholder="Copy nội dung từ bài đã cào hoặc để trống..."
                                value={genSourceContent}
                                onChange={(e) => setGenSourceContent(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowGenDialog(false)}>Hủy</Button>
                        <Button
                            className="bg-gradient-to-r from-orange-500 to-orange-600 gap-2"
                            onClick={handleGenerate}
                            disabled={generating}
                        >
                            {generating ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang sinh...</>
                            ) : (
                                <><Wand2 className="w-4 h-4" /> Sinh Bait & Hook</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Approve Confirmation ═══ */}
            <AlertDialog open={!!confirmApprove} onOpenChange={() => setConfirmApprove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>✅ Xác nhận duyệt chiến dịch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Chiến dịch sẽ sẵn sàng để đăng lên Facebook. Sản phẩm: <strong>{confirmApprove?.product_name}</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-gradient-to-r from-orange-500 to-orange-600"
                            onClick={() => confirmApprove && approveCampaign(confirmApprove.id)}
                        >
                            Duyệt ngay
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ═══ Delete Confirmation ═══ */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>🗑️ Xóa chiến dịch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này không thể hoàn tác. Chiến dịch cho <strong>{confirmDelete?.product_name}</strong> sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => confirmDelete && deleteCampaign(confirmDelete.id)}
                        >
                            Xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ═══ Edit Dialog ═══ */}
            <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>✏️ Chỉnh sửa chiến dịch</DialogTitle>
                        <DialogDescription>
                            Sửa nội dung Bait & Hook trước khi đăng
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-violet-600">
                                <Fish className="w-3.5 h-3.5" /> Bài đăng (Mồi nhử)
                            </Label>
                            <Textarea
                                value={editBait}
                                onChange={(e) => setEditBait(e.target.value)}
                                rows={4}
                                className="resize-none"
                            />
                            <div className="text-xs text-gray-400 text-right">{editBait.length} ký tự</div>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5 text-amber-600">
                                <Anchor className="w-3.5 h-3.5" /> Comment (Lưỡi câu)
                            </Label>
                            <Textarea
                                value={editHook}
                                onChange={(e) => setEditHook(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                            <div className="text-xs text-gray-400 text-right">{editHook.length} ký tự</div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCampaign(null)}>Hủy</Button>
                        <Button className="bg-gradient-to-r from-orange-500 to-orange-600" onClick={saveEdit}>
                            Lưu chỉnh sửa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
