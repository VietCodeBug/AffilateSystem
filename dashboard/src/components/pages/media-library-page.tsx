"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    FolderOpen, Video, Image as ImageIcon, FileText, Search,
    ExternalLink, Download, Play, Eye, HardDrive, Film,
    RefreshCw, ChevronRight, ArrowLeft, X, Grid3X3, List,
    CloudOff, FolderUp,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

/* ─── Types ─── */
interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdTime: string;
    modifiedTime: string;
    thumbnailLink?: string;
    webViewLink?: string;
    webContentLink?: string;
    iconLink?: string;
    description?: string;
    isFolder: boolean;
    category: "video" | "image" | "audio" | "folder" | "other";
    videoMetadata?: { width: number; height: number; durationMillis: number };
    imageMetadata?: { width: number; height: number };
}

interface DriveStats {
    total_files: number;
    total_size: number;
    total_size_formatted: string;
    videos: number;
    images: number;
    others: number;
    folders: number;
    error?: string;
}

interface FolderBreadcrumb {
    id: string;
    name: string;
}

const DRIVE_FOLDER_LINK = "https://drive.google.com/drive/folders/10qnR-aXBGXCa3Q62JJ2anM2IC4qcDsXS";
const ROOT_FOLDER_ID = "10qnR-aXBGXCa3Q62JJ2anM2IC4qcDsXS";

/* ─── Component ─── */
export function MediaLibraryPage() {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [stats, setStats] = useState<DriveStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);

    /* ─── Fetch files ─── */
    const fetchFiles = useCallback(async (folderId?: string | null, search?: string, mimeFilter?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (folderId) params.set("folder_id", folderId);
            if (search) params.set("search", search);
            if (mimeFilter && mimeFilter !== "all") params.set("mime_filter", mimeFilter);
            params.set("page_size", "50");

            const res = await fetch(`/api/drive/files?${params}`);
            const data = await res.json();

            if (data.error) {
                toast.error(data.error);
                setFiles([]);
            } else {
                setFiles(data.files || []);
                setNextPageToken(data.nextPageToken || null);
            }
        } catch {
            toast.error("Không thể kết nối backend");
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    /* ─── Fetch stats ─── */
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await fetch("/api/drive/stats");
            const data = await res.json();
            setStats(data);
        } catch {
            setStats(null);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFiles();
        fetchStats();
    }, [fetchFiles, fetchStats]);

    /* ─── Navigate into folder ─── */
    const navigateToFolder = (folder: DriveFile) => {
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
        fetchFiles(folder.id, searchQuery, filterType);
    };

    /* ─── Navigate back ─── */
    const navigateBack = (targetIndex?: number) => {
        if (targetIndex !== undefined) {
            const newBreadcrumbs = breadcrumbs.slice(0, targetIndex + 1);
            setBreadcrumbs(newBreadcrumbs);
            const folderId = newBreadcrumbs[newBreadcrumbs.length - 1]?.id || null;
            setCurrentFolderId(folderId);
            fetchFiles(folderId, searchQuery, filterType);
        } else {
            // Go to root
            setBreadcrumbs([]);
            setCurrentFolderId(null);
            fetchFiles(null, searchQuery, filterType);
        }
    };

    /* ─── Search ─── */
    const handleSearch = () => {
        fetchFiles(currentFolderId, searchQuery, filterType);
    };

    /* ─── Filter ─── */
    const handleFilter = (type: string) => {
        setFilterType(type);
        fetchFiles(currentFolderId, searchQuery, type);
    };

    /* ─── Preview ─── */
    const openPreview = (file: DriveFile) => {
        setPreviewFile(file);
    };

    /* ─── Helpers ─── */
    const formatSize = (bytes: number) => {
        if (!bytes) return "—";
        if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
        if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return "";
        const secs = Math.floor(ms / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const formatDate = (iso?: string) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    };

    const categoryIcon = (cat: string) => {
        switch (cat) {
            case "video": return <Film className="w-5 h-5" />;
            case "image": return <ImageIcon className="w-5 h-5" />;
            case "folder": return <FolderOpen className="w-5 h-5" />;
            default: return <FileText className="w-5 h-5" />;
        }
    };

    const categoryColor = (cat: string) => {
        switch (cat) {
            case "video": return "bg-purple-100 text-purple-600";
            case "image": return "bg-blue-100 text-blue-600";
            case "folder": return "bg-amber-100 text-amber-600";
            case "audio": return "bg-green-100 text-green-600";
            default: return "bg-gray-100 text-gray-600";
        }
    };

    const categoryBadge = (cat: string) => {
        switch (cat) {
            case "video": return "bg-purple-500/10 text-purple-600 border-purple-200";
            case "image": return "bg-blue-500/10 text-blue-600 border-blue-200";
            case "folder": return "bg-amber-500/10 text-amber-600 border-amber-200";
            default: return "bg-gray-500/10 text-gray-600 border-gray-200";
        }
    };

    const filterButtons = [
        { key: "all", label: "Tất cả", icon: Grid3X3 },
        { key: "video", label: "Video", icon: Film },
        { key: "image", label: "Ảnh", icon: ImageIcon },
    ];

    return (
        <div className="space-y-6">
            {/* ─── Stats Cards ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
                {statsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="card-premium">
                            <CardContent className="p-5">
                                <Skeleton className="h-4 w-16 mb-3" />
                                <Skeleton className="h-8 w-20 mb-1" />
                                <Skeleton className="h-3 w-24" />
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <>
                        <Card className="card-premium border-0 shadow-sm bg-gradient-to-br from-white to-purple-50/30">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <HardDrive className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tổng file</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.total_files || 0}</div>
                                <div className="text-xs text-gray-400 mt-1">{stats?.total_size_formatted || "0 B"}</div>
                            </CardContent>
                        </Card>

                        <Card className="card-premium border-0 shadow-sm bg-gradient-to-br from-white to-orange-50/30">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <Film className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Video</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.videos || 0}</div>
                                <div className="text-xs text-gray-400 mt-1">file video</div>
                            </CardContent>
                        </Card>

                        <Card className="card-premium border-0 shadow-sm bg-gradient-to-br from-white to-blue-50/30">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <ImageIcon className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ảnh</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.images || 0}</div>
                                <div className="text-xs text-gray-400 mt-1">file ảnh</div>
                            </CardContent>
                        </Card>

                        <Card className="card-premium border-0 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <FolderOpen className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Folder</span>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{stats?.folders || 0}</div>
                                <div className="text-xs text-gray-400 mt-1">thư mục con</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* ─── Toolbar ─── */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Tìm kiếm file..."
                                    className="pl-9 bg-gray-50 border-gray-200 focus:bg-white"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                />
                            </div>
                            <Button size="sm" variant="outline" onClick={handleSearch}>
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Filters & Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {filterButtons.map(fb => (
                                <Button
                                    key={fb.key}
                                    size="sm"
                                    variant={filterType === fb.key ? "default" : "outline"}
                                    className={filterType === fb.key ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                                    onClick={() => handleFilter(fb.key)}
                                >
                                    <fb.icon className="w-3.5 h-3.5 mr-1" />
                                    {fb.label}
                                </Button>
                            ))}

                            <div className="w-px h-6 bg-gray-200 mx-1" />

                            <Button
                                size="sm" variant="outline"
                                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                                title={viewMode === "grid" ? "Chế độ danh sách" : "Chế độ lưới"}
                            >
                                {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                            </Button>

                            <Button
                                size="sm" variant="outline"
                                onClick={() => { fetchFiles(currentFolderId, searchQuery, filterType); fetchStats(); }}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>

                            <a href={DRIVE_FOLDER_LINK} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700">
                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                    Mở Drive
                                </Button>
                            </a>
                        </div>
                    </div>

                    {/* Breadcrumbs */}
                    {breadcrumbs.length > 0 && (
                        <div className="flex items-center gap-1 mt-3 text-sm">
                            <button
                                onClick={() => navigateBack()}
                                className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium"
                            >
                                <FolderUp className="w-3.5 h-3.5" />
                                Gốc
                            </button>
                            {breadcrumbs.map((bc, i) => (
                                <div key={bc.id} className="flex items-center gap-1">
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                                    <button
                                        onClick={() => navigateBack(i)}
                                        className={`hover:text-orange-600 transition-colors ${i === breadcrumbs.length - 1 ? "font-semibold text-gray-900" : "text-gray-500"}`}
                                    >
                                        {bc.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Files Grid/List ─── */}
            {loading ? (
                <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="card-premium border-0 shadow-sm">
                            <CardContent className="p-4">
                                <Skeleton className="aspect-video w-full rounded-lg mb-3" />
                                <Skeleton className="h-4 w-3/4 mb-2" />
                                <Skeleton className="h-3 w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : files.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <CardContent className="py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <CloudOff className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Chưa có file nào</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Upload video/ảnh vào Google Drive folder để hiển thị ở đây
                        </p>
                        <a href={DRIVE_FOLDER_LINK} target="_blank" rel="noopener noreferrer">
                            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                                <ExternalLink className="w-4 h-4 mr-2" /> Mở Google Drive
                            </Button>
                        </a>
                    </CardContent>
                </Card>
            ) : viewMode === "grid" ? (
                /* ─── Grid View ─── */
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children">
                    {files.map((file) => (
                        <Card
                            key={file.id}
                            className="card-premium border-0 shadow-sm cursor-pointer group overflow-hidden"
                            onClick={() => file.isFolder ? navigateToFolder(file) : openPreview(file)}
                        >
                            <CardContent className="p-0">
                                {/* Thumbnail */}
                                <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                                    {file.thumbnailLink ? (
                                        <img
                                            src={file.thumbnailLink}
                                            alt={file.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className={`w-12 h-12 rounded-xl ${categoryColor(file.category)} flex items-center justify-center`}>
                                                {categoryIcon(file.category)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {file.isFolder ? (
                                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                                    <ChevronRight className="w-5 h-5 text-gray-700" />
                                                </div>
                                            ) : file.category === "video" ? (
                                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                                    <Play className="w-6 h-6 text-orange-600 ml-0.5" />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                                    <Eye className="w-5 h-5 text-gray-700" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Duration badge for videos */}
                                    {file.videoMetadata?.durationMillis && (
                                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                                            {formatDuration(file.videoMetadata.durationMillis)}
                                        </div>
                                    )}

                                    {/* Category badge */}
                                    <div className="absolute top-2 left-2">
                                        <Badge variant="outline" className={`text-[10px] ${categoryBadge(file.category)} backdrop-blur-sm bg-white/80`}>
                                            {file.category === "video" ? "Video" : file.category === "image" ? "Ảnh" : file.isFolder ? "Folder" : "File"}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="text-sm font-semibold text-gray-800 truncate" title={file.name}>
                                        {file.name}
                                    </h3>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <span className="text-[11px] text-gray-400">{formatSize(file.size)}</span>
                                        <span className="text-[11px] text-gray-400">{formatDate(file.createdTime)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                /* ─── List View ─── */
                <Card className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-100">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-orange-50/30 transition-colors cursor-pointer group"
                                    onClick={() => file.isFolder ? navigateToFolder(file) : openPreview(file)}
                                >
                                    {/* Icon / Thumbnail */}
                                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden ${!file.thumbnailLink ? categoryColor(file.category) + " flex items-center justify-center" : ""}`}>
                                        {file.thumbnailLink ? (
                                            <img src={file.thumbnailLink} alt="" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            categoryIcon(file.category)
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 truncate group-hover:text-orange-600 transition-colors">
                                            {file.name}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {formatDate(file.createdTime)}
                                            {file.videoMetadata?.durationMillis && (
                                                <span className="ml-2">⏱ {formatDuration(file.videoMetadata.durationMillis)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category badge */}
                                    <Badge variant="outline" className={`text-[10px] ${categoryBadge(file.category)} hidden sm:inline-flex`}>
                                        {file.category}
                                    </Badge>

                                    {/* Size */}
                                    <span className="text-xs text-gray-400 w-20 text-right hidden md:block">{formatSize(file.size)}</span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {file.webViewLink && (
                                            <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Button>
                                            </a>
                                        )}
                                        {file.webContentLink && (
                                            <a href={file.webContentLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                    <Download className="w-3.5 h-3.5" />
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Load More ─── */}
            {nextPageToken && !loading && (
                <div className="text-center">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            try {
                                const params = new URLSearchParams();
                                if (currentFolderId) params.set("folder_id", currentFolderId);
                                if (searchQuery) params.set("search", searchQuery);
                                if (filterType !== "all") params.set("mime_filter", filterType);
                                params.set("page_token", nextPageToken);

                                const res = await fetch(`/api/drive/files?${params}`);
                                const data = await res.json();
                                setFiles(prev => [...prev, ...(data.files || [])]);
                                setNextPageToken(data.nextPageToken || null);
                            } catch {
                                toast.error("Lỗi tải thêm");
                            }
                        }}
                    >
                        Tải thêm...
                    </Button>
                </div>
            )}

            {/* ─── Preview Modal ─── */}
            {previewFile && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setPreviewFile(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fade-in-scale"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-lg ${categoryColor(previewFile.category)} flex items-center justify-center flex-shrink-0`}>
                                    {categoryIcon(previewFile.category)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-800 truncate">{previewFile.name}</h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                        <span>{formatSize(previewFile.size)}</span>
                                        <span>{formatDate(previewFile.createdTime)}</span>
                                        {previewFile.videoMetadata && (
                                            <span>{previewFile.videoMetadata.width}×{previewFile.videoMetadata.height}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {previewFile.webViewLink && (
                                    <a href={previewFile.webViewLink} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="outline">
                                            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Mở trong Drive
                                        </Button>
                                    </a>
                                )}
                                {previewFile.webContentLink && (
                                    <a href={previewFile.webContentLink} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                                            <Download className="w-3.5 h-3.5 mr-1" /> Tải về
                                        </Button>
                                    </a>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setPreviewFile(null)} className="h-8 w-8 p-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="bg-gray-950 flex items-center justify-center" style={{ minHeight: "400px", maxHeight: "70vh" }}>
                            {previewFile.category === "video" ? (
                                <iframe
                                    src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                                    className="w-full h-full"
                                    style={{ minHeight: "400px", maxHeight: "70vh" }}
                                    allow="autoplay; encrypted-media"
                                    allowFullScreen
                                />
                            ) : previewFile.category === "image" ? (
                                <img
                                    src={`https://drive.google.com/thumbnail?id=${previewFile.id}&sz=w1200`}
                                    alt={previewFile.name}
                                    className="max-w-full max-h-[70vh] object-contain"
                                />
                            ) : (
                                <iframe
                                    src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                                    className="w-full"
                                    style={{ minHeight: "400px", maxHeight: "70vh" }}
                                    allowFullScreen
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
