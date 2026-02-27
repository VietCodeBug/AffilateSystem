/**
 * Realtime Database Service — Live data
 * Used for: Publisher status, live counters, notifications
 */

import { rtdb } from "./firebase";
import {
    ref,
    set,
    get,
    update,
    push,
    onValue,
    query as rtQuery,
    orderByChild,
    limitToLast,
    type Unsubscribe,
} from "firebase/database";

// ═══════════════════════════════════════════
// Publisher Status
// ═══════════════════════════════════════════

export interface PublisherStatus {
    auto_mode: boolean;
    next_post_at: number; // timestamp
    fb_posts_today: number;
    th_posts_today: number;
    last_updated: string;
}

const publisherRef = ref(rtdb, "publisher");

export async function getPublisherStatus(): Promise<PublisherStatus> {
    const snapshot = await get(publisherRef);
    if (snapshot.exists()) return snapshot.val();
    // Default
    return {
        auto_mode: true,
        next_post_at: Date.now() + 120000,
        fb_posts_today: 0,
        th_posts_today: 0,
        last_updated: new Date().toISOString(),
    };
}

export async function setPublisherStatus(data: Partial<PublisherStatus>): Promise<void> {
    await update(publisherRef, { ...data, last_updated: new Date().toISOString() });
}

export function onPublisherStatus(callback: (status: PublisherStatus) => void): Unsubscribe {
    return onValue(publisherRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({
                auto_mode: true,
                next_post_at: Date.now() + 120000,
                fb_posts_today: 0,
                th_posts_today: 0,
                last_updated: new Date().toISOString(),
            });
        }
    });
}

// ═══════════════════════════════════════════
// Post Log (Live Feed)
// ═══════════════════════════════════════════

export interface PostLogEntry {
    id?: string;
    time: string;
    platform: "FB" | "TH";
    text: string;
    result: "success" | "error";
    comment: string;
    campaign_id?: string;
    timestamp: number;
}

const postLogRef = ref(rtdb, "post_log");

export async function addPostLog(entry: Omit<PostLogEntry, "id">): Promise<void> {
    const newRef = push(postLogRef);
    await set(newRef, { ...entry, timestamp: Date.now() });
}

export function onPostLog(callback: (entries: PostLogEntry[]) => void, max: number = 20): Unsubscribe {
    const q = rtQuery(postLogRef, orderByChild("timestamp"), limitToLast(max));
    return onValue(q, (snapshot) => {
        const entries: PostLogEntry[] = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                entries.push({ id: child.key || "", ...child.val() });
            });
        }
        // Reverse to show newest first
        callback(entries.reverse());
    });
}

// ═══════════════════════════════════════════
// Live Counters (Dashboard Stats)
// ═══════════════════════════════════════════

export interface LiveCounters {
    total_clicks: number;
    total_orders: number;
    total_commission: number;
    total_posts: number;
    last_updated: string;
}

const countersRef = ref(rtdb, "counters");

export async function getCounters(): Promise<LiveCounters> {
    const snapshot = await get(countersRef);
    if (snapshot.exists()) return snapshot.val();
    return {
        total_clicks: 0,
        total_orders: 0,
        total_commission: 0,
        total_posts: 0,
        last_updated: new Date().toISOString(),
    };
}

export async function incrementCounter(field: keyof LiveCounters, amount: number = 1): Promise<void> {
    const current = await getCounters();
    const currentVal = typeof current[field] === "number" ? (current[field] as number) : 0;
    await update(countersRef, {
        [field]: currentVal + amount,
        last_updated: new Date().toISOString(),
    });
}

export function onCounters(callback: (counters: LiveCounters) => void): Unsubscribe {
    return onValue(countersRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({
                total_clicks: 0,
                total_orders: 0,
                total_commission: 0,
                total_posts: 0,
                last_updated: new Date().toISOString(),
            });
        }
    });
}
