"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Languages, Play, Download, RefreshCw, Loader2, CheckCircle2,
    AlertCircle, Video, Subtitles, Volume2, Wand2, ArrowRight,
    Clock, FileVideo, ExternalLink, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Types ─── */
interface SubtitleEntry {
    start: number;
    end: number;
    text?: string;
    text_cn?: string;
    text_vn?: string;
}

interface TranslationJob {
    id: string;
    url: string;
    status: "downloading" | "ocr" | "translating" | "tts" | "composing" | "done" | "error";
    progress: number;
    message: string;
    title: string;
    created_at: string;
    output_path?: string;
    output_filename?: string;
    subtitles_cn?: SubtitleEntry[];
    subtitles_vn?: SubtitleEntry[];
    error?: string;
}

interface OutputFile {
    filename: string;
    path: string;
    size: number;
    created_at: string;
}

const BACKEND_URL = "http://localhost:8000";

const STEPS = [
    { key: "downloading", icon: Download, label: "Tải video", color: "text-blue-500" },
    { key: "ocr", icon: Subtitles, label: "Đọc phụ đề", color: "text-purple-500" },
    { key: "translating", icon: Languages, label: "Dịch tiếng Việt", color: "text-orange-500" },
    { key: "tts", icon: Volume2, label: "Tạo giọng nói", color: "text-green-500" },
    { key: "composing", icon: Wand2, label: "Ghép video", color: "text-pink-500" },
    { key: "done", icon: CheckCircle2, label: "Hoàn tất", color: "text-emerald-500" },
];

const VOICE_OPTIONS = [
    { value: "vi-VN-HoaiMyNeural", label: "🎙️ Hoài My (Nữ)" },
    { value: "vi-VN-NamMinhNeural", label: "🎤 Nam Minh (Nam)" },
];

/* ─── Component ─── */
export function VideoTranslatorPage() {
    const [url, setUrl] = useState("");
    const [voice, setVoice] = useState("vi-VN-HoaiMyNeural");
    const [loading, setLoading] = useState(false);
    const [currentJob, setCurrentJob] = useState<TranslationJob | null>(null);
    const [history, setHistory] = useState<TranslationJob[]>([]);
    const [outputFiles, setOutputFiles] = useState<OutputFile[]>([]);
    const [showSubtitles, setShowSubtitles] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString("vi-VN", {
            day: "2-digit", month: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    };

    /* ─── Fetch history ─── */
    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch("/api/video/translate");
            const data = await res.json();
            setHistory(data.jobs || []);
            setOutputFiles(data.output_files || []);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    /* ─── Start translation ─── */
    const startTranslation = async () => {
        if (!url.trim()) {
            toast.error("Vui lòng nhập URL video");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/video/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url.trim(), voice }),
            });
            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
                return;
            }

            toast.success("Bắt đầu dịch video!");
            setCurrentJob({
                id: data.job_id,
                url: url.trim(),
                status: "downloading",
                progress: 0,
                message: "Đang bắt đầu...",
                title: "",
                created_at: new Date().toISOString(),
            });

            // Start polling
            startPolling(data.job_id);
        } catch {
            toast.error("Không thể kết nối backend");
        } finally {
            setLoading(false);
        }
    };

    /* ─── Poll job status ─── */
    const startPolling = (jobId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/video/translate/${jobId}`);
                const data = await res.json();

                if (data.error && data.error === "Job not found") return;

                setCurrentJob(data);

                if (data.status === "done" || data.status === "error") {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    fetchHistory();

                    if (data.status === "done") {
                        toast.success("🎉 Video đã dịch xong!");
                    } else {
                        toast.error(`Lỗi: ${data.message}`);
                    }
                }
            } catch {
                /* ignore polling errors */
            }
        }, 2000);
    };

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    /* ─── Get current step index ─── */
    const currentStepIndex = currentJob
        ? STEPS.findIndex(s => s.key === currentJob.status)
        : -1;

    return (
        <div className="space-y-6">
            {/* ─── Hero/Input Section ─── */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Languages className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Video Translator</h2>
                            <p className="text-white/70 text-xs">Douyin / Bilibili → Tiếng Việt</p>
                        </div>
                    </div>
                    <p className="text-sm text-white/60 mt-1">
                        Dán link video → AI đọc phụ đề Trung → Dịch tiếng Việt → Thêm giọng nói VN → Xuất video
                    </p>
                </div>

                <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Dán link video Douyin / Bilibili / TikTok..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && startTranslation()}
                                className="h-11 bg-gray-50 border-gray-200 focus:bg-white text-sm"
                                disabled={loading || (currentJob?.status !== undefined && currentJob.status !== "done" && currentJob.status !== "error")}
                            />
                        </div>

                        {/* Voice selector */}
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            className="h-11 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            {VOICE_OPTIONS.map(v => (
                                <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                        </select>

                        <Button
                            onClick={startTranslation}
                            disabled={loading || !url.trim() || (currentJob?.status !== undefined && currentJob.status !== "done" && currentJob.status !== "error")}
                            className="h-11 px-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-medium"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Wand2 className="w-4 h-4 mr-2" />
                            )}
                            Dịch Video
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                            <Video className="w-3.5 h-3.5" />
                            Hỗ trợ: Douyin, Bilibili, TikTok
                        </span>
                        <span className="flex items-center gap-1">
                            <Subtitles className="w-3.5 h-3.5" />
                            OCR phụ đề bằng Gemini Vision AI
                        </span>
                        <span className="flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" />
                            Giọng nói: edge-tts Neural
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Progress Section ─── */}
            {currentJob && currentJob.status !== "done" && currentJob.status !== "error" && (
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">
                                    {currentJob.title || "Đang xử lý..."}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">{currentJob.message}</p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                {currentJob.progress}%
                            </Badge>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${currentJob.progress}%` }}
                            />
                        </div>

                        {/* Step indicators */}
                        <div className="flex items-center justify-between">
                            {STEPS.slice(0, -1).map((step, idx) => {
                                const isActive = idx === currentStepIndex;
                                const isDone = idx < currentStepIndex;
                                const StepIcon = step.icon;

                                return (
                                    <div key={step.key} className="flex items-center flex-1">
                                        <div className={`flex flex-col items-center gap-1.5 ${isActive ? "scale-110" : ""} transition-transform`}>
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isDone
                                                    ? "bg-emerald-100 text-emerald-600"
                                                    : isActive
                                                        ? "bg-purple-100 text-purple-600 animate-pulse"
                                                        : "bg-gray-100 text-gray-400"
                                                }`}>
                                                {isDone ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : isActive ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <StepIcon className="w-4 h-4" />
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-medium ${isActive ? "text-purple-700" : isDone ? "text-emerald-600" : "text-gray-400"}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < STEPS.length - 2 && (
                                            <div className={`flex-1 h-0.5 mx-2 rounded ${idx < currentStepIndex ? "bg-emerald-300" : "bg-gray-200"}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Result Section ─── */}
            {currentJob?.status === "done" && (
                <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        {currentJob.title || "Video đã dịch xong!"}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {currentJob.subtitles_vn?.length || 0} đoạn phụ đề đã dịch
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {currentJob.output_filename && (
                                    <a href={`${BACKEND_URL}/api/video/output/${currentJob.output_filename}`} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                            <Download className="w-3.5 h-3.5 mr-1" /> Tải video
                                        </Button>
                                    </a>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowSubtitles(!showSubtitles)}
                                >
                                    {showSubtitles ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                                    Phụ đề
                                </Button>
                            </div>
                        </div>

                        {/* Subtitle comparison */}
                        {showSubtitles && currentJob.subtitles_vn && currentJob.subtitles_vn.length > 0 && (
                            <div className="mt-4 border rounded-xl overflow-hidden">
                                <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="col-span-1">⏱</div>
                                    <div className="col-span-5">Tiếng Trung (gốc)</div>
                                    <div className="col-span-1 text-center">→</div>
                                    <div className="col-span-5">Tiếng Việt (dịch)</div>
                                </div>
                                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                                    {currentJob.subtitles_vn.map((sub, i) => (
                                        <div key={i} className="grid grid-cols-12 px-4 py-2.5 text-xs hover:bg-purple-50/30">
                                            <div className="col-span-1 text-gray-400 font-mono">
                                                {formatTime(sub.start)}
                                            </div>
                                            <div className="col-span-5 text-gray-600">
                                                {sub.text_cn || sub.text}
                                            </div>
                                            <div className="col-span-1 text-center text-gray-300">
                                                <ArrowRight className="w-3 h-3 mx-auto" />
                                            </div>
                                            <div className="col-span-5 text-purple-700 font-medium">
                                                {sub.text_vn}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Error Section ─── */}
            {currentJob?.status === "error" && (
                <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-red-700">Lỗi dịch video</h3>
                                <p className="text-xs text-red-500 mt-0.5">{currentJob.message}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── How it works ─── */}
            {!currentJob && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 stagger-children">
                    {STEPS.slice(0, -1).map((step, idx) => {
                        const StepIcon = step.icon;
                        return (
                            <Card key={step.key} className="card-premium border-0 shadow-sm">
                                <CardContent className="p-4 text-center">
                                    <div className={`w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center ${step.color.replace("text-", "bg-").replace("500", "100")}`}>
                                        <StepIcon className={`w-5 h-5 ${step.color}`} />
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-500 mb-0.5">Bước {idx + 1}</div>
                                    <div className="text-sm font-semibold text-gray-800">{step.label}</div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ─── Output Files ─── */}
            {outputFiles.length > 0 && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileVideo className="w-4 h-4 text-purple-500" />
                            Video đã dịch ({outputFiles.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="divide-y divide-gray-100">
                            {outputFiles.map((file) => (
                                <div key={file.filename} className="flex items-center justify-between py-3 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                                            <Video className="w-4 h-4 text-purple-500" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-800 group-hover:text-purple-600 transition-colors">
                                                {file.filename}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                                <span>{formatSize(file.size)}</span>
                                                <span>{formatDate(file.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <a href={`${BACKEND_URL}/api/video/output/${file.filename}`} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Download className="w-3.5 h-3.5 mr-1" /> Tải về
                                        </Button>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
