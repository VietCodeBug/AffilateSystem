/**
 * Firestore Service — CRUD for all collections
 * Collections: campaigns, affiliate_links, threads
 */

import { db } from "./firebase";
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit as fsLimit,
    onSnapshot,
    Timestamp,
    type Unsubscribe,
} from "firebase/firestore";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface Campaign {
    id: string;
    bait_content: string;
    hook_comment: string;
    product_name: string;
    product_link: string;
    shortened_link: string;
    page_persona: string;
    source_thread_id: string;
    status: "draft" | "approved" | "posted" | "failed";
    post_id: string;
    suggested_image: string;
    created_at: string;
    posted_at: string;
    error_msg: string;
}

export interface AffLink {
    id: string;
    name: string;
    original_url: string;
    shortened_url: string;
    shortener: string;
    collection_name: string;
    clicks: number;
    orders: number;
    commission: number;
    created_at: string;
}

export interface CrawledThread {
    id: string;
    source: string;
    title: string;
    url: string;
    author: string;
    replies: number;
    views: string;
    time_text: string;
    prefix: string;
    content: string;
    thumbnail: string;
    score: number;
    crawled_at: string;
    sent_to_ai: boolean;
    deleted: boolean;
}

// ═══════════════════════════════════════════
// Campaigns
// ═══════════════════════════════════════════

const campaignsRef = collection(db, "campaigns");

export async function createCampaign(data: Omit<Campaign, "id">): Promise<Campaign> {
    const docRef = await addDoc(campaignsRef, {
        ...data,
        created_at: data.created_at || new Date().toISOString(),
    });
    return { ...data, id: docRef.id };
}

export async function getCampaigns(status?: string): Promise<Campaign[]> {
    let q;
    if (status) {
        q = query(campaignsRef, where("status", "==", status), orderBy("created_at", "desc"));
    } else {
        q = query(campaignsRef, orderBy("created_at", "desc"));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
}

export function onCampaignsSnapshot(
    callback: (campaigns: Campaign[]) => void,
    status?: string
): Unsubscribe {
    let q;
    if (status) {
        q = query(campaignsRef, where("status", "==", status), orderBy("created_at", "desc"));
    } else {
        q = query(campaignsRef, orderBy("created_at", "desc"));
    }
    return onSnapshot(q, (snapshot) => {
        const campaigns = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
        callback(campaigns);
    });
}

export async function updateCampaignStatus(id: string, status: string): Promise<void> {
    const docRef = doc(db, "campaigns", id);
    await updateDoc(docRef, { status });
}

export async function deleteCampaign(id: string): Promise<void> {
    await deleteDoc(doc(db, "campaigns", id));
}

// ═══════════════════════════════════════════
// Affiliate Links
// ═══════════════════════════════════════════

const linksRef = collection(db, "affiliate_links");

export async function createAffLink(data: Omit<AffLink, "id">): Promise<AffLink> {
    const docRef = await addDoc(linksRef, {
        ...data,
        created_at: data.created_at || new Date().toISOString(),
    });
    return { ...data, id: docRef.id };
}

export async function getAffLinks(): Promise<AffLink[]> {
    const q = query(linksRef, orderBy("created_at", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AffLink));
}

export function onAffLinksSnapshot(callback: (links: AffLink[]) => void): Unsubscribe {
    const q = query(linksRef, orderBy("created_at", "desc"));
    return onSnapshot(q, (snapshot) => {
        const links = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AffLink));
        callback(links);
    });
}

export async function deleteAffLink(id: string): Promise<void> {
    await deleteDoc(doc(db, "affiliate_links", id));
}

export async function getRandomAffLink(): Promise<AffLink | null> {
    const links = await getAffLinks();
    if (links.length === 0) return null;
    return links[Math.floor(Math.random() * links.length)];
}

// ═══════════════════════════════════════════
// Threads (crawled content)
// ═══════════════════════════════════════════

const threadsRef = collection(db, "threads");

export async function saveThreads(threads: Omit<CrawledThread, "sent_to_ai" | "deleted">[]): Promise<number> {
    let saved = 0;
    for (const t of threads) {
        try {
            const docRef = doc(db, "threads", t.id);
            const existing = await getDoc(docRef);
            if (!existing.exists()) {
                await setDoc(docRef, {
                    ...t,
                    sent_to_ai: false,
                    deleted: false,
                    crawled_at: t.crawled_at || new Date().toISOString(),
                });
                saved++;
            }
        } catch (e) {
            console.error("Error saving thread:", t.id, e);
        }
    }
    return saved;
}

export async function getThreads(source?: string, max: number = 50): Promise<CrawledThread[]> {
    let q;
    if (source) {
        q = query(
            threadsRef,
            where("source", "==", source),
            where("deleted", "==", false),
            orderBy("crawled_at", "desc"),
            fsLimit(max)
        );
    } else {
        q = query(
            threadsRef,
            where("deleted", "==", false),
            orderBy("crawled_at", "desc"),
            fsLimit(max)
        );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CrawledThread));
}

export function onThreadsSnapshot(
    callback: (threads: CrawledThread[]) => void,
    source?: string,
    max: number = 50
): Unsubscribe {
    let q;
    if (source) {
        q = query(
            threadsRef,
            where("source", "==", source),
            where("deleted", "==", false),
            orderBy("crawled_at", "desc"),
            fsLimit(max)
        );
    } else {
        q = query(
            threadsRef,
            where("deleted", "==", false),
            orderBy("crawled_at", "desc"),
            fsLimit(max)
        );
    }
    return onSnapshot(q, (snapshot) => {
        const threads = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CrawledThread));
        callback(threads);
    });
}

export async function getThreadById(id: string): Promise<CrawledThread | null> {
    const docRef = doc(db, "threads", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CrawledThread;
}

export async function deleteThread(id: string): Promise<void> {
    const docRef = doc(db, "threads", id);
    await updateDoc(docRef, { deleted: true });
}

export async function markThreadSentToAI(id: string): Promise<void> {
    const docRef = doc(db, "threads", id);
    await updateDoc(docRef, { sent_to_ai: true });
}

export async function updateThreadContent(id: string, content: string): Promise<void> {
    const docRef = doc(db, "threads", id);
    await updateDoc(docRef, { content });
}

// ═══════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════

export async function getStats() {
    const [campaigns, links, threads] = await Promise.all([
        getCampaigns(),
        getAffLinks(),
        getThreads(undefined, 1000),
    ]);

    const vozThreads = threads.filter((t) => t.source === "voz");
    const redditThreads = threads.filter((t) => t.source === "reddit");

    return {
        total_threads: threads.length,
        voz: vozThreads.length,
        reddit: redditThreads.length,
        campaigns: {
            total: campaigns.length,
            draft: campaigns.filter((c) => c.status === "draft").length,
            approved: campaigns.filter((c) => c.status === "approved").length,
            posted: campaigns.filter((c) => c.status === "posted").length,
        },
        links: links.length,
    };
}
