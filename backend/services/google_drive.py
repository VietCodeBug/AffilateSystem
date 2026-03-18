"""
Google Drive Integration — Media Library
Kết nối với Google Drive folder để lưu trữ và quản lý video/media.
Sử dụng Google Drive API v3 với API Key.
"""

from __future__ import annotations

import io
import mimetypes
from typing import Any
from datetime import datetime

import requests

from config import GOOGLE_DRIVE_API_KEY, GOOGLE_DRIVE_FOLDER_ID

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


def _api_params(**extra) -> dict:
    """Base params with API key."""
    return {"key": GOOGLE_DRIVE_API_KEY, **extra}


def list_files(
    folder_id: str | None = None,
    page_size: int = 50,
    page_token: str | None = None,
    mime_filter: str | None = None,
    search_query: str | None = None,
) -> dict[str, Any]:
    """
    List files in a Google Drive folder.
    Returns files with metadata (name, size, thumbnail, etc.)
    """
    target_folder = folder_id or GOOGLE_DRIVE_FOLDER_ID
    if not target_folder:
        return {"error": "No folder ID configured", "files": []}

    # Build query
    q_parts = [f"'{target_folder}' in parents", "trashed = false"]
    if mime_filter:
        q_parts.append(f"mimeType contains '{mime_filter}'")
    if search_query:
        q_parts.append(f"name contains '{search_query}'")

    q = " and ".join(q_parts)

    params = _api_params(
        q=q,
        pageSize=page_size,
        orderBy="createdTime desc",
        fields="nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webViewLink, webContentLink, iconLink, videoMediaMetadata, imageMediaMetadata, description)",
    )
    if page_token:
        params["pageToken"] = page_token

    try:
        resp = requests.get(f"{DRIVE_API_BASE}/files", params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        files = []
        for f in data.get("files", []):
            file_info = {
                "id": f.get("id"),
                "name": f.get("name"),
                "mimeType": f.get("mimeType", ""),
                "size": int(f.get("size", 0)),
                "createdTime": f.get("createdTime"),
                "modifiedTime": f.get("modifiedTime"),
                "thumbnailLink": f.get("thumbnailLink"),
                "webViewLink": f.get("webViewLink"),
                "webContentLink": f.get("webContentLink"),
                "iconLink": f.get("iconLink"),
                "description": f.get("description", ""),
            }

            # Check if it's a folder
            if f.get("mimeType") == "application/vnd.google-apps.folder":
                file_info["isFolder"] = True
            else:
                file_info["isFolder"] = False

            # Video metadata
            if f.get("videoMediaMetadata"):
                vm = f["videoMediaMetadata"]
                file_info["videoMetadata"] = {
                    "width": vm.get("width"),
                    "height": vm.get("height"),
                    "durationMillis": vm.get("durationMillis"),
                }

            # Image metadata
            if f.get("imageMediaMetadata"):
                im = f["imageMediaMetadata"]
                file_info["imageMetadata"] = {
                    "width": im.get("width"),
                    "height": im.get("height"),
                }

            # Determine file category
            mime = f.get("mimeType", "")
            if "video" in mime:
                file_info["category"] = "video"
            elif "image" in mime:
                file_info["category"] = "image"
            elif "audio" in mime:
                file_info["category"] = "audio"
            elif f.get("mimeType") == "application/vnd.google-apps.folder":
                file_info["category"] = "folder"
            else:
                file_info["category"] = "other"

            files.append(file_info)

        return {
            "files": files,
            "nextPageToken": data.get("nextPageToken"),
            "total": len(files),
            "folder_id": target_folder,
        }

    except requests.exceptions.HTTPError as e:
        error_detail = ""
        try:
            error_detail = e.response.json().get("error", {}).get("message", str(e))
        except Exception:
            error_detail = str(e)
        return {"error": f"Google Drive API error: {error_detail}", "files": []}
    except Exception as e:
        return {"error": f"Connection error: {str(e)}", "files": []}


def get_file_detail(file_id: str) -> dict[str, Any]:
    """Get detailed info about a specific file."""
    params = _api_params(
        fields="id, name, mimeType, size, createdTime, modifiedTime, thumbnailLink, webViewLink, webContentLink, iconLink, videoMediaMetadata, imageMediaMetadata, description, parents"
    )
    try:
        resp = requests.get(f"{DRIVE_API_BASE}/files/{file_id}", params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def get_folder_stats(folder_id: str | None = None) -> dict[str, Any]:
    """Get statistics about the Drive folder."""
    target_folder = folder_id or GOOGLE_DRIVE_FOLDER_ID
    if not target_folder:
        return {"error": "No folder ID configured"}

    stats = {
        "total_files": 0,
        "total_size": 0,
        "videos": 0,
        "images": 0,
        "others": 0,
        "folders": 0,
    }

    page_token = None
    while True:
        params = _api_params(
            q=f"'{target_folder}' in parents and trashed = false",
            pageSize=100,
            fields="nextPageToken, files(mimeType, size)",
        )
        if page_token:
            params["pageToken"] = page_token

        try:
            resp = requests.get(f"{DRIVE_API_BASE}/files", params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            for f in data.get("files", []):
                stats["total_files"] += 1
                stats["total_size"] += int(f.get("size", 0))
                mime = f.get("mimeType", "")
                if "video" in mime:
                    stats["videos"] += 1
                elif "image" in mime:
                    stats["images"] += 1
                elif mime == "application/vnd.google-apps.folder":
                    stats["folders"] += 1
                else:
                    stats["others"] += 1

            page_token = data.get("nextPageToken")
            if not page_token:
                break
        except Exception as e:
            return {"error": str(e), **stats}

    # Format size
    size_bytes = stats["total_size"]
    if size_bytes >= 1_073_741_824:
        stats["total_size_formatted"] = f"{size_bytes / 1_073_741_824:.1f} GB"
    elif size_bytes >= 1_048_576:
        stats["total_size_formatted"] = f"{size_bytes / 1_048_576:.1f} MB"
    elif size_bytes >= 1024:
        stats["total_size_formatted"] = f"{size_bytes / 1024:.1f} KB"
    else:
        stats["total_size_formatted"] = f"{size_bytes} B"

    stats["folder_id"] = target_folder
    return stats


def create_subfolder(folder_name: str, parent_id: str | None = None) -> dict[str, Any]:
    """
    Create a subfolder in the Drive folder.
    Note: This requires OAuth2, not just API key. Returns instruction if API key only.
    """
    return {
        "info": "Tạo folder cần OAuth2 authentication. Hiện tại bạn có thể tạo folder trực tiếp trên Google Drive.",
        "drive_link": f"https://drive.google.com/drive/folders/{parent_id or GOOGLE_DRIVE_FOLDER_ID}",
    }


def get_embed_url(file_id: str, mime_type: str = "") -> str:
    """Get embeddable URL for a file."""
    if "video" in mime_type:
        return f"https://drive.google.com/file/d/{file_id}/preview"
    elif "image" in mime_type:
        return f"https://drive.google.com/thumbnail?id={file_id}&sz=w1000"
    else:
        return f"https://drive.google.com/file/d/{file_id}/preview"


def get_download_url(file_id: str) -> str:
    """Get direct download URL for a file."""
    return f"https://drive.google.com/uc?export=download&id={file_id}"
