"use client";

import { Bell, Menu, Search, Check, Wand2, ShoppingCart, Zap, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface TopbarProps {
    title: string;
    onMenuToggle: () => void;
}

const notifications = [
    { icon: Check, iconBg: "bg-green-100 text-green-500", title: "Đã đăng bài thành công", desc: 'Page "Meme Văn Phòng" — 2 phút trước', read: false },
    { icon: Wand2, iconBg: "bg-orange-100 text-orange-500", title: "5 bài AI mới chờ duyệt", desc: "Nguồn: Voz Forum — 10 phút trước", read: false },
    { icon: ShoppingCart, iconBg: "bg-yellow-100 text-yellow-600", title: "Đơn hàng mới!", desc: "Chuột Gaming Logitech — 45,000đ hoa hồng", read: false },
    { icon: Zap, iconBg: "bg-blue-100 text-blue-500", title: "Đã cào 12 bài mới", desc: "Reddit r/voz — 30 phút trước", read: true },
];

export function Topbar({ title, onMenuToggle }: TopbarProps) {
    const [searchFocused, setSearchFocused] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifs, setNotifs] = useState(notifications);

    const unreadCount = notifs.filter((n) => !n.read).length;

    const markAllRead = () => {
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    return (
        <header className="h-16 glass border-b border-gray-200/60 flex items-center justify-between px-6 sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                    onClick={onMenuToggle}
                >
                    <Menu className="w-5 h-5" />
                </Button>
                <div>
                    <span className="text-base font-semibold text-gray-800">{title}</span>
                    <span className="hidden sm:inline text-xs text-gray-400 ml-3">Affiliate Shoppe</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Search */}
                <div className={`hidden sm:flex items-center gap-2 rounded-full px-3.5 py-1.5 transition-all duration-300 border ${searchFocused
                        ? "bg-white border-orange-300 ring-2 ring-orange-100 w-56"
                        : "bg-gray-100/80 border-transparent w-44"
                    }`}>
                    <Search className={`w-3.5 h-3.5 transition-colors ${searchFocused ? "text-orange-500" : "text-gray-400"}`} />
                    <Input
                        placeholder="Tìm kiếm..."
                        className="border-0 bg-transparent shadow-none h-7 text-xs p-0 focus-visible:ring-0"
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                </div>

                {/* Notification Popover */}
                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all">
                            <Bell className="w-[18px] h-[18px]" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-lg animate-pulse-glow">
                                    {unreadCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-xl shadow-xl border-gray-200" align="end">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                            <span className="text-sm font-semibold text-gray-800">Thông báo</span>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="text-[11px] text-orange-500 hover:text-orange-700 font-medium cursor-pointer">
                                    Đánh dấu đã đọc
                                </button>
                            )}
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {notifs.map((notif, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${!notif.read ? "bg-orange-50/30" : ""
                                        }`}
                                    onClick={() => {
                                        setNotifs((prev) =>
                                            prev.map((n, idx) => (idx === i ? { ...n, read: true } : n))
                                        );
                                    }}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notif.iconBg}`}>
                                        <notif.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-gray-700">{notif.title}</p>
                                        <span className="text-[11px] text-gray-400">{notif.desc}</span>
                                    </div>
                                    {!notif.read && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />}
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-2.5 border-t border-gray-100">
                            <button className="text-xs text-orange-500 hover:text-orange-700 font-medium w-full text-center cursor-pointer">
                                Xem tất cả thông báo →
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* User */}
                <div className="flex items-center gap-2.5 pl-3 ml-1 border-l border-gray-200/60 cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md group-hover:shadow-orange-500/20 transition-all">
                        IP
                    </div>
                    <div className="hidden sm:flex flex-col">
                        <span className="text-xs font-semibold text-gray-800">Ian Pham</span>
                        <span className="text-[10px] text-gray-400">Admin</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
