"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Pause, Play, CalendarPlus, Clock, Facebook, AtSign, CheckCircle, XCircle,
    AlertTriangle, MessageCircle, Power, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

interface PostLogItem {
    id: number;
    time: string;
    platform: string;
    platformClass: string;
    text: string;
    result: "success" | "error";
    comment: string;
}

const initialPostLog: PostLogItem[] = [
    { id: 1, time: "14:23", platform: "FB", platformClass: "bg-blue-500", text: "Lương thì delay mà Deadline thì chạy ngay...", result: "success", comment: "Link đã comment" },
    { id: 2, time: "14:23", platform: "TH", platformClass: "bg-gray-700", text: "Lương thì delay mà Deadline thì chạy ngay...", result: "success", comment: "Link ở bài cuối" },
    { id: 3, time: "13:45", platform: "FB", platformClass: "bg-blue-500", text: 'Crush bảo thích trai "có chí hướng"...', result: "success", comment: "Link đã comment" },
    { id: 4, time: "13:08", platform: "FB", platformClass: "bg-blue-500", text: 'My boss told me I should be "more passionate"...', result: "error", comment: "Token hết hạn" },
];

export function PublisherPage() {
    const [autoMode, setAutoMode] = useState(true);
    const [postLog, setPostLog] = useState(initialPostLog);
    const [nextPostCountdown, setNextPostCountdown] = useState(120); // seconds
    const [fbPosts, setFbPosts] = useState(42);
    const [thPosts, setThPosts] = useState(38);

    // Countdown timer
    useEffect(() => {
        if (!autoMode) return;
        const timer = setInterval(() => {
            setNextPostCountdown((prev) => {
                if (prev <= 1) {
                    // Simulate auto post
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
                    const newPost: PostLogItem = {
                        id: Date.now(),
                        time: timeStr,
                        platform: Math.random() > 0.4 ? "FB" : "TH",
                        platformClass: Math.random() > 0.4 ? "bg-blue-500" : "bg-gray-700",
                        text: "AI tự động đăng bài mới — " + timeStr,
                        result: Math.random() > 0.15 ? "success" : "error",
                        comment: Math.random() > 0.15 ? "Link đã comment" : "Lỗi kết nối",
                    };
                    setPostLog((p) => [newPost, ...p.slice(0, 9)]);
                    if (newPost.platform === "FB") setFbPosts((p) => p + 1);
                    else setThPosts((p) => p + 1);
                    toast.success(`Đã đăng bài tự động lên ${newPost.platform === "FB" ? "Facebook" : "Threads"}!`, {
                        description: `Lúc ${timeStr}`,
                    });
                    return 120 + Math.floor(Math.random() * 60);
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [autoMode]);

    const toggleAutoMode = () => {
        setAutoMode(!autoMode);
        if (autoMode) {
            toast("⏸️ Đã tạm dừng hệ thống", { description: "Bài sẽ không tự động đăng" });
        } else {
            toast.success("▶️ Đã bật lại hệ thống!", { description: "Tự động đăng bài theo lịch" });
        }
    };

    const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const platforms = [
        {
            name: "Facebook Page",
            subname: "Meme Văn Phòng",
            icon: Facebook,
            iconClass: "bg-gradient-to-br from-blue-500 to-blue-600",
            postsToday: fbPosts,
            successRate: "98%",
        },
        {
            name: "Threads",
            subname: "@memevp_official",
            icon: AtSign,
            iconClass: "bg-gradient-to-br from-gray-700 to-gray-900",
            postsToday: thPosts,
            successRate: "95%",
        },
    ];

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Publisher</h2>
                    <p className="text-sm text-gray-500 mt-1">Quản lý lịch đăng bài tự động lên Facebook Page & Threads</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={toggleAutoMode}
                        className={`gap-2 transition-all ${autoMode ? "hover:bg-red-50 hover:text-red-600 hover:border-red-300" : "hover:bg-green-50 hover:text-green-600 hover:border-green-300"}`}
                    >
                        {autoMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {autoMode ? "Tạm dừng" : "Chạy lại"}
                    </Button>
                </div>
            </div>

            {/* Auto Mode Status */}
            <Card className={`mb-6 border-0 shadow-sm overflow-hidden ${autoMode ? "bg-gradient-to-r from-green-50 to-emerald-50" : "bg-gray-50"}`}>
                {autoMode && <div className="h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />}
                <CardContent className="flex items-center justify-between p-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${autoMode ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}>
                            <Power className="w-4 h-4" />
                        </div>
                        <div>
                            <span className={`font-semibold block text-sm ${autoMode ? "text-green-700" : "text-gray-500"}`}>
                                {autoMode ? "Auto Mode — Đang chạy" : "Auto Mode — Đã tạm dừng"}
                            </span>
                            {autoMode && (
                                <span className="text-xs text-green-600">
                                    Bài tiếp theo trong: <strong className="tabular-nums">{formatCountdown(nextPostCountdown)}</strong>
                                </span>
                            )}
                        </div>
                    </div>
                    {autoMode && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            Hành chính: <strong>30p</strong> · Trưa: <strong>15p</strong> · Đêm: <strong>1h</strong>
                        </div>
                    )}
                </CardContent>
                {autoMode && (
                    <div className="px-4 pb-3">
                        <Progress value={(1 - nextPostCountdown / 180) * 100} className="h-1 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-emerald-500" />
                    </div>
                )}
            </Card>

            {/* Platform Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 stagger-children">
                {platforms.map((p) => (
                    <Card key={p.name} className="card-premium border-0 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl ${p.iconClass} flex items-center justify-center text-white shadow-sm`}>
                                    <p.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-gray-800">{p.name}</h4>
                                    <span className="text-xs text-gray-400">{p.subname}</span>
                                </div>
                                <Badge variant="secondary" className="bg-green-50 text-green-600 text-[10px] font-semibold border-0 rounded-full">
                                    Kết nối ✓
                                </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 py-3 border-t border-gray-50">
                                <div>
                                    <span className="text-xl font-bold text-gray-900 tabular-nums block">{p.postsToday}</span>
                                    <span className="text-[10px] text-gray-400">Bài hôm nay</span>
                                </div>
                                <div>
                                    <span className="text-xl font-bold text-gray-900 tabular-nums block">{p.successRate}</span>
                                    <span className="text-[10px] text-gray-400">Thành công</span>
                                </div>
                                <div>
                                    <span className="text-xl font-bold text-orange-600 tabular-nums block">{autoMode ? "Đang chạy" : "Dừng"}</span>
                                    <span className="text-[10px] text-gray-400">Trạng thái</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Live Post Log */}
            <Card className="card-premium border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-semibold">Lịch sử đăng bài</CardTitle>
                        {autoMode && (
                            <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                LIVE
                            </span>
                        )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] rounded-full">{postLog.length} bài</Badge>
                </CardHeader>
                <CardContent className="divide-y divide-gray-50">
                    {postLog.map((post) => (
                        <div key={post.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-[13px] hover:bg-gray-50/50 -mx-6 px-6 transition-colors animate-slide-in-right">
                            <span className="text-xs text-gray-400 font-semibold tabular-nums min-w-[38px]">{post.time}</span>
                            <Badge className={`${post.platformClass} text-white text-[9px] font-bold rounded-lg shrink-0 shadow-sm`}>
                                {post.platform}
                            </Badge>
                            <span className="flex-1 text-gray-600 truncate min-w-0">{post.text}</span>
                            <span className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${post.result === "success" ? "text-green-600" : "text-red-500"}`}>
                                {post.result === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </span>
                            <span className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${post.result === "success" ? "text-green-600" : "text-red-500"}`}>
                                {post.result === "success" ? <MessageCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {post.comment}
                            </span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </>
    );
}
