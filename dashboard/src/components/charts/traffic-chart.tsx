"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useState, useEffect } from "react";

const baseData = [
    { name: "Facebook", value: 65 },
    { name: "Threads", value: 28 },
    { name: "Khác", value: 7 },
];

const COLORS = ["#F97316", "#FDBA74", "#D1D5DB"];

export function TrafficChart() {
    const [data, setData] = useState(baseData);

    // Simulate real-time fluctuations
    useEffect(() => {
        const interval = setInterval(() => {
            const fb = 60 + Math.floor(Math.random() * 10);
            const threads = 25 + Math.floor(Math.random() * 8);
            const other = 100 - fb - threads;
            setData([
                { name: "Facebook", value: fb },
                { name: "Threads", value: threads },
                { name: "Khác", value: Math.max(2, other) },
            ]);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            animationDuration={800}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#1F2937",
                                border: "none",
                                borderRadius: 8,
                                color: "#fff",
                                fontSize: 12,
                            }}
                            formatter={(value: number) => [`${value}%`, ""]}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
                {data.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs text-gray-600">
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: COLORS[index] }}
                        />
                        {entry.name} ({entry.value}%)
                    </div>
                ))}
            </div>
        </div>
    );
}
