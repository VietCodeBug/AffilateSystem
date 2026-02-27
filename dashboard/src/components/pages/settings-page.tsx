"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Key, Send, Clock, Shield, Eye, CheckCircle, AlertTriangle, Save, Loader2, TestTube } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Config {
    geminiKey: string;
    fbToken: string;
    fbPageId: string;
    botToken: string;
    chatId: string;
    telegramNotify: boolean;
    domainRotation: boolean;
    spintax: boolean;
    semiAuto: boolean;
    schedules: { period: string; emoji: string; time: string; freq: string }[];
}

export function SettingsPage() {
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showBotToken, setShowBotToken] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testDialog, setTestDialog] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");

    const [config, setConfig] = useState<Config>({
        geminiKey: "AIzaSyAssh5FENxAUjO",
        fbToken: "",
        fbPageId: "",
        botToken: "8586020347:AAF76R",
        chatId: "5011704710",
        telegramNotify: true,
        domainRotation: true,
        spintax: true,
        semiAuto: false,
        schedules: [
            { period: "Giờ hành chính", emoji: "🌅", time: "8:00 — 17:00", freq: "30" },
            { period: "Nghỉ trưa", emoji: "☀️", time: "12:00 — 13:00", freq: "15" },
            { period: "Đêm khuya", emoji: "🌙", time: "22:00 — 01:00", freq: "60" },
        ],
    });

    const handleSave = async () => {
        setSaving(true);
        await new Promise((r) => setTimeout(r, 1200));
        setSaving(false);
        toast.success("Đã lưu cài đặt!", { description: "Tất cả thay đổi đã được áp dụng" });
    };

    const testConnection = (type: string) => {
        setTestDialog(type);
        setTestResult("testing");
        setTimeout(() => {
            setTestResult(Math.random() > 0.3 ? "success" : "error");
        }, 2000);
    };

    return (
        <>
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Cài đặt</h2>
                <p className="text-sm text-gray-500 mt-1">Cấu hình API keys, tần suất đăng bài và Telegram Bot</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* API Keys */}
                <Card className="card-premium border-0 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-gray-100">
                            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                                <Key className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-gray-800">API Keys</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Gemini API Key</Label>
                                <div className="relative">
                                    <Input
                                        type={showGeminiKey ? "text" : "password"}
                                        value={config.geminiKey}
                                        onChange={(e) => setConfig({ ...config, geminiKey: e.target.value })}
                                        className="pr-20 bg-gray-50 focus:bg-white"
                                    />
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setShowGeminiKey(!showGeminiKey)}>
                                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => testConnection("Gemini")}>
                                            <TestTube className="w-3.5 h-3.5 text-gray-400" />
                                        </Button>
                                    </div>
                                </div>
                                <span className="text-[11px] text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Đang hoạt động
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Facebook Page Token</Label>
                                <Input
                                    type="password"
                                    placeholder="Nhập Page Access Token..."
                                    value={config.fbToken}
                                    onChange={(e) => setConfig({ ...config, fbToken: e.target.value })}
                                    className="bg-gray-50 focus:bg-white"
                                />
                                <span className="text-[11px] text-orange-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Chưa cấu hình
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Facebook Page ID</Label>
                                <Input
                                    placeholder="Nhập Page ID..."
                                    value={config.fbPageId}
                                    onChange={(e) => setConfig({ ...config, fbPageId: e.target.value })}
                                    className="bg-gray-50 focus:bg-white"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Telegram Bot */}
                <Card className="card-premium border-0 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-gray-100">
                            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                                <Send className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-gray-800">Telegram Bot</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Bot Token</Label>
                                <div className="relative">
                                    <Input
                                        type={showBotToken ? "text" : "password"}
                                        value={config.botToken}
                                        onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                                        className="pr-20 bg-gray-50 focus:bg-white"
                                    />
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setShowBotToken(!showBotToken)}>
                                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => testConnection("Telegram Bot")}>
                                            <TestTube className="w-3.5 h-3.5 text-gray-400" />
                                        </Button>
                                    </div>
                                </div>
                                <span className="text-[11px] text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Bot đang chạy
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-gray-600">Chat ID (Admin)</Label>
                                <Input
                                    value={config.chatId}
                                    onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                                    className="bg-gray-50 focus:bg-white"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-orange-50/50 transition-colors">
                                <Label className="text-[13px] font-medium text-gray-700 cursor-pointer">Gửi thông báo qua Telegram</Label>
                                <Switch
                                    checked={config.telegramNotify}
                                    onCheckedChange={(v) => {
                                        setConfig({ ...config, telegramNotify: v });
                                        toast(v ? "Đã bật thông báo Telegram" : "Đã tắt thông báo Telegram");
                                    }}
                                    className="data-[state=checked]:bg-orange-500"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Schedule Config */}
                <Card className="lg:col-span-2 card-premium border-0 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-gray-100">
                            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-gray-800">Lịch đăng bài</h3>
                        </div>
                        <div className="space-y-3">
                            {config.schedules.map((period, i) => (
                                <div key={period.period} className="flex items-center justify-between bg-gray-50 hover:bg-orange-50/30 rounded-xl p-4 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl group-hover:scale-110 transition-transform">{period.emoji}</span>
                                        <div>
                                            <strong className="text-sm text-gray-800 block">{period.period}</strong>
                                            <span className="text-[11px] text-gray-400">{period.time}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[11px] text-gray-400">Tần suất</Label>
                                        <Select
                                            value={period.freq}
                                            onValueChange={(v) => {
                                                const newSchedules = [...config.schedules];
                                                newSchedules[i] = { ...newSchedules[i], freq: v };
                                                setConfig({ ...config, schedules: newSchedules });
                                                toast.success(`Đã đổi tần suất "${period.period}" → ${v} phút/bài`);
                                            }}
                                        >
                                            <SelectTrigger className="w-[140px] h-9 text-[13px] bg-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15">15 phút / bài</SelectItem>
                                                <SelectItem value="30">30 phút / bài</SelectItem>
                                                <SelectItem value="45">45 phút / bài</SelectItem>
                                                <SelectItem value="60">1 giờ / bài</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Anti-Ban */}
                <Card className="lg:col-span-2 card-premium border-0 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-gray-100">
                            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                                <Shield className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <h3 className="text-[15px] font-semibold text-gray-800">Anti-Ban & Spam Safe</h3>
                        </div>
                        <div className="space-y-3">
                            {[
                                { key: "domainRotation" as const, label: "Domain Rotation (Xoay vòng rút gọn link)", desc: "Sử dụng luân phiên: bit.ly, tinyurl, bio.link" },
                                { key: "spintax" as const, label: "Spintax Comment (Đa dạng nội dung comment)", desc: "Random câu dẫn comment để tránh bị đánh spam" },
                                { key: "semiAuto" as const, label: "Chế độ Semi-Auto (Duyệt tay trước khi đăng)", desc: "Bật lên khi mới bắt đầu để train AI dần" },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-orange-50/30 transition-colors">
                                    <div>
                                        <Label className="text-[13px] font-medium text-gray-700 block cursor-pointer">{item.label}</Label>
                                        <span className="text-[11px] text-gray-400">{item.desc}</span>
                                    </div>
                                    <Switch
                                        checked={config[item.key]}
                                        onCheckedChange={(v) => {
                                            setConfig({ ...config, [item.key]: v });
                                            toast(v ? `Đã bật ${item.label.split("(")[0].trim()}` : `Đã tắt ${item.label.split("(")[0].trim()}`);
                                        }}
                                        className="data-[state=checked]:bg-orange-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end mt-6">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg hover:shadow-orange-500/25 transition-all gap-2 min-w-[140px]"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Đang lưu..." : "Lưu cài đặt"}
                </Button>
            </div>

            {/* Test Connection Dialog */}
            <Dialog open={!!testDialog} onOpenChange={() => { setTestDialog(null); setTestResult("idle"); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>🔌 Test kết nối {testDialog}</DialogTitle>
                        <DialogDescription>Kiểm tra API key có hoạt động không</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 flex flex-col items-center gap-3">
                        {testResult === "testing" && (
                            <>
                                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                <span className="text-sm text-gray-500">Đang kiểm tra kết nối...</span>
                            </>
                        )}
                        {testResult === "success" && (
                            <>
                                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center animate-fade-in-scale">
                                    <CheckCircle className="w-7 h-7 text-green-500" />
                                </div>
                                <span className="text-sm font-medium text-green-600">Kết nối thành công!</span>
                            </>
                        )}
                        {testResult === "error" && (
                            <>
                                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center animate-fade-in-scale">
                                    <AlertTriangle className="w-7 h-7 text-red-500" />
                                </div>
                                <span className="text-sm font-medium text-red-500">Kết nối thất bại — Kiểm tra lại key</span>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setTestDialog(null); setTestResult("idle"); }}>Đóng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
