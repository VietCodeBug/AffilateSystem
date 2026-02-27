"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    FileText,
    MousePointerClick,
    Eye,
    DollarSign,
    ArrowUp,
    Check,
    Wand2,
    Download,
    Coins,
    TrendingUp,
    ArrowRight,
} from "lucide-react";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { TrafficChart } from "@/components/charts/traffic-chart";
import { useAnimatedCounter, formatNumber, useLoadingState, useRealtimeValue } from "@/lib/hooks";

const activities = [
    {
        icon: Check,
        iconClass: "bg-green-100 text-green-500",
        title: <><strong>Đã đăng bài</strong> lên Page &quot;Meme Văn Phòng&quot;</>,
        desc: "Kèm link: Chuột Gaming Logitech",
        time: "2 phút trước",
    },
    {
        icon: Wand2,
        iconClass: "bg-orange-100 text-orange-500",
        title: <><strong>AI đã viết xong</strong> 5 bài mới — Đang chờ duyệt</>,
        desc: "Nguồn: Voz - Chuyện trò linh tinh",
        time: "12 phút trước",
    },
    {
        icon: Download,
        iconClass: "bg-blue-100 text-blue-500",
        title: <><strong>Đã cào 12 bài mới</strong> từ Reddit r/voz</>,
        desc: "Đã lọc rác, còn lại 8 bài chất lượng",
        time: "30 phút trước",
    },
    {
        icon: Coins,
        iconClass: "bg-yellow-100 text-yellow-500",
        title: <><strong>Đơn hàng mới!</strong> Máy cạo râu Xiaomi — 45,000đ</>,
        desc: "Từ link trong bài ID #1234",
        time: "1 giờ trước",
    },
];

function StatCard({ label, rawValue, suffix, trend, icon: Icon, color, bg, delay }: {
    label: string; rawValue: number; suffix?: string; trend: string;
    icon: React.ElementType; color: string; bg: string; delay: number;
}) {
    const value = useRealtimeValue(rawValue, 3);
    const animated = useAnimatedCounter(value);

    return (
        <Card className="card-premium relative overflow-hidden group border-0 shadow-sm" style={{ animationDelay: `${delay}ms` }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
            <CardContent className="flex items-center gap-4 p-5">
                <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-2xl font-extrabold text-gray-900 block leading-tight tabular-nums">
                        {formatNumber(animated)}{suffix}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                </div>
                <Badge variant="secondary" className="bg-green-50 text-green-600 border-0 gap-1 text-[10px] font-semibold shrink-0 rounded-full px-2">
                    <ArrowUp className="w-2.5 h-2.5" />
                    {trend}
                </Badge>
            </CardContent>
        </Card>
    );
}

function SkeletonCard() {
    return (
        <Card className="animate-pulse">
            <CardContent className="flex items-center gap-4 p-5">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardPage() {
    const loading = useLoadingState(600);

    const stats = [
        { label: "Bài đã đăng", rawValue: 1247, trend: "+12.5%", icon: FileText, color: "text-orange-500", bg: "bg-orange-50" },
        { label: "Clicks hôm nay", rawValue: 34892, trend: "+8.3%", icon: MousePointerClick, color: "text-green-500", bg: "bg-green-50" },
        { label: "Tổng Reach", rawValue: 892000, suffix: "", trend: "+23.1%", icon: Eye, color: "text-blue-500", bg: "bg-blue-50" },
        { label: "Doanh thu tháng", rawValue: 4580000, suffix: "đ", trend: "+15.7%", icon: DollarSign, color: "text-orange-600", bg: "bg-orange-50" },
    ];

    return (
        <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 stagger-children">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                    : stats.map((stat, i) => <StatCard key={stat.label} {...stat} delay={i * 60} />)
                }
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-4 mb-6">
                <Card className="card-premium border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                            <CardTitle className="text-sm font-semibold">Hiệu suất 7 ngày qua</CardTitle>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm">Tuần</button>
                            <button className="px-3 py-1 rounded-full text-[11px] font-medium border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all">Tháng</button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[250px] w-full rounded-xl" /> : <PerformanceChart />}
                    </CardContent>
                </Card>

                <Card className="card-premium border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Nguồn Traffic</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[250px] w-full rounded-xl" /> : <TrafficChart />}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="card-premium border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-semibold">Hoạt động gần đây</CardTitle>
                    <button className="text-[11px] text-orange-500 hover:text-orange-700 font-semibold flex items-center gap-1 group cursor-pointer">
                        Xem tất cả <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </CardHeader>
                <CardContent className="divide-y divide-gray-50">
                    {activities.map((act, i) => (
                        <div key={i} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0 hover:bg-gray-50/50 -mx-6 px-6 transition-colors cursor-pointer group">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${act.iconClass} group-hover:scale-105 transition-transform`}>
                                <act.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-gray-700 leading-snug">{act.title}</p>
                                <span className="text-[11px] text-gray-400">{act.desc}</span>
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium shrink-0">{act.time}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </>
    );
}
