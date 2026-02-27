"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Line,
    ComposedChart,
} from "recharts";
import { useState, useEffect } from "react";

const baseData = [
    { day: "T2", posts: 32, clicks: 120 },
    { day: "T3", posts: 45, clicks: 180 },
    { day: "T4", posts: 38, clicks: 160 },
    { day: "T5", posts: 52, clicks: 220 },
    { day: "T6", posts: 48, clicks: 200 },
    { day: "T7", posts: 60, clicks: 280 },
    { day: "CN", posts: 55, clicks: 250 },
];

export function PerformanceChart() {
    const [data, setData] = useState(baseData);

    // Simulate real-time data fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            setData((prev) =>
                prev.map((item) => ({
                    ...item,
                    posts: Math.max(20, item.posts + Math.floor(Math.random() * 7 - 3)),
                    clicks: Math.max(80, item.clicks + Math.floor(Math.random() * 20 - 10)),
                }))
            );
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F97316" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#1F2937",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 12,
                        }}
                        itemStyle={{ color: "#fff" }}
                        labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="posts"
                        name="Bài đăng"
                        stroke="#F97316"
                        strokeWidth={2.5}
                        fill="url(#orangeGradient)"
                        dot={{ fill: "#F97316", stroke: "#fff", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                    />
                    <Line
                        type="monotone"
                        dataKey="clicks"
                        name="Clicks"
                        stroke="#FB923C"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: "#FB923C", stroke: "#fff", strokeWidth: 2, r: 3 }}
                        animationDuration={800}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
