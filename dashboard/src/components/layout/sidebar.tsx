"use client";

import {
    Flame,
    LayoutDashboard,
    Crosshair,
    Bot,
    Link,
    Send,
    Settings,
    X,
    Zap,
    ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
    open: boolean;
    onClose: () => void;
}

const navSections = [
    {
        label: "TỔNG QUAN",
        items: [
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        ],
    },
    {
        label: "HỆ THỐNG",
        items: [
            { id: "content-hunter", icon: Crosshair, label: "Content Hunter", badge: 12 },
            { id: "ai-writer", icon: Bot, label: "AI Writer", badge: 5, pulse: true },
            { id: "affiliate-links", icon: Link, label: "Affiliate Links" },
            { id: "publisher", icon: Send, label: "Publisher" },
        ],
    },
    {
        label: "CÀI ĐẶT",
        items: [
            { id: "settings", icon: Settings, label: "Cài đặt" },
        ],
    },
];

export function Sidebar({ activePage, onNavigate, open, onClose }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-50 h-screen flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "bg-gradient-to-b from-[#1C1917] via-[#1C1917] to-[#292524]",
                collapsed ? "w-[72px]" : "w-[260px]",
                "lg:translate-x-0",
                open ? "translate-x-0" : "-translate-x-full"
            )}
        >
            {/* Header */}
            <div className={cn(
                "px-4 py-5 flex items-center border-b border-white/[0.06] transition-all",
                collapsed ? "justify-center" : "justify-between"
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-[0_4px_16px_rgba(249,115,22,0.35)] animate-float shrink-0">
                        <Flame className="w-5 h-5" />
                    </div>
                    {!collapsed && (
                        <div className="animate-fade-in-scale">
                            <h1 className="text-white font-bold text-base leading-none">Affiliate</h1>
                            <span className="text-orange-400 text-[10px] font-semibold tracking-[2.5px] uppercase">
                                Shoppe
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex gap-1">
                    {!collapsed && (
                        <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Collapse toggle (desktop) */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#292524] border border-white/10 text-gray-400 hover:text-white hover:bg-orange-500 hover:border-orange-500 items-center justify-center transition-all z-10 shadow-md"
            >
                <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
            </button>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
                {navSections.map((section) => (
                    <div key={section.label} className="mb-1">
                        {!collapsed && (
                            <span className="block text-[#57534E] text-[9px] font-bold tracking-[2px] uppercase px-3 py-2 select-none">
                                {section.label}
                            </span>
                        )}
                        {collapsed && <div className="h-2" />}
                        {section.items.map((item) => {
                            const isActive = activePage === item.id;
                            const btnContent = (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 relative cursor-pointer group",
                                        collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
                                        isActive
                                            ? "text-white bg-gradient-to-r from-orange-500/20 to-orange-600/10 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.15)]"
                                            : "text-[#A8A29E] hover:text-white hover:bg-white/[0.04]"
                                    )}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-orange-400 to-orange-600 rounded-r shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                    )}
                                    <item.icon className={cn("w-[18px] h-[18px] shrink-0 transition-transform", isActive && "scale-110")} />
                                    {!collapsed && <span className="truncate">{item.label}</span>}
                                    {item.badge && !collapsed && (
                                        <span
                                            className={cn(
                                                "ml-auto bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm",
                                                item.pulse && "animate-pulse-glow"
                                            )}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                    {item.badge && collapsed && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-[#1C1917] animate-pulse" />
                                    )}
                                </button>
                            );

                            return collapsed ? (
                                <Tooltip key={item.id} delayDuration={0}>
                                    <TooltipTrigger asChild>{btnContent}</TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs font-medium">
                                        {item.label}
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <div key={item.id}>{btnContent}</div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className={cn("py-4 border-t border-white/[0.06]", collapsed ? "px-2" : "px-4")}>
                <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "")}>
                    <div className="relative">
                        <Zap className="w-3.5 h-3.5 text-green-400" />
                        <div className="absolute inset-0 bg-green-400/30 rounded-full blur-sm" />
                    </div>
                    {!collapsed && (
                        <span className="text-[11px] text-[#78716C] font-medium">Hệ thống <span className="text-green-400">hoạt động</span></span>
                    )}
                </div>
            </div>
        </aside>
    );
}
