"use client";

import { useState, useEffect, useRef } from "react";

/** Animated counter that smoothly counts up to target */
export function useAnimatedCounter(target: number, duration = 1200) {
    const [value, setValue] = useState(0);
    const prevTarget = useRef(target);

    useEffect(() => {
        const start = prevTarget.current !== target ? value : 0;
        prevTarget.current = target;
        const startTime = performance.now();

        function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setValue(Math.floor(start + (target - start) * eased));
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }, [target, duration]);

    return value;
}

/** Format number with Vietnamese locale */
export function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
    return n.toLocaleString("vi-VN");
}

/** Simulate real-time value fluctuation */
export function useRealtimeValue(base: number, range = 5, intervalMs = 4000) {
    const [value, setValue] = useState(base);

    useEffect(() => {
        const timer = setInterval(() => {
            setValue((v) => Math.max(0, v + Math.floor(Math.random() * range * 2 - range)));
        }, intervalMs);
        return () => clearInterval(timer);
    }, [range, intervalMs]);

    return value;
}

/** Simulate loading state */
export function useLoadingState(delayMs = 800) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);

    return loading;
}
