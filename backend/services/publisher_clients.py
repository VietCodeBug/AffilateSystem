"""
Official API clients for Facebook Pages and Threads.
"""

from __future__ import annotations

import json
import time
from typing import Any

import requests

from config import FACEBOOK_GRAPH_BASE, THREADS_GRAPH_BASE


class PublisherError(RuntimeError):
    pass


def _raise_for_api(resp: requests.Response, context: str):
    if resp.ok:
        return
    try:
        payload = resp.json()
    except Exception:
        payload = {"text": resp.text}
    raise PublisherError(f"{context} failed: {json.dumps(payload, ensure_ascii=False)}")


def post_facebook_feed(page_id: str, access_token: str, message: str) -> dict[str, Any]:
    resp = requests.post(
        f"{FACEBOOK_GRAPH_BASE}/{page_id}/feed",
        data={"message": message, "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(resp, "facebook_feed_post")
    return resp.json()


def post_facebook_comment(post_id: str, access_token: str, message: str) -> dict[str, Any]:
    resp = requests.post(
        f"{FACEBOOK_GRAPH_BASE}/{post_id}/comments",
        data={"message": message, "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(resp, "facebook_comment_post")
    return resp.json()


def fetch_facebook_metrics(post_id: str, access_token: str) -> dict[str, int]:
    metrics = "post_impressions,post_reactions_by_type_total,post_comments,post_shares,post_clicks"
    resp = requests.get(
        f"{FACEBOOK_GRAPH_BASE}/{post_id}/insights",
        params={"metric": metrics, "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(resp, "facebook_metrics")
    payload = resp.json()
    values = {m.get("name"): (m.get("values") or [{}])[0].get("value") for m in payload.get("data", [])}

    reactions_obj = values.get("post_reactions_by_type_total") or {}
    shares_obj = values.get("post_shares") or {}
    clicks_obj = values.get("post_clicks") or {}

    return {
        "impressions": int(values.get("post_impressions") or 0),
        "reactions": int(sum(reactions_obj.values()) if isinstance(reactions_obj, dict) else 0),
        "comments": int(values.get("post_comments") or 0),
        "shares": int(shares_obj.get("count", 0) if isinstance(shares_obj, dict) else 0),
        "clicks": int(clicks_obj.get("count", 0) if isinstance(clicks_obj, dict) else 0),
    }


def post_threads_text(user_id: str, access_token: str, text: str) -> dict[str, Any]:
    create_resp = requests.post(
        f"{THREADS_GRAPH_BASE}/{user_id}/threads",
        data={"media_type": "TEXT", "text": text, "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(create_resp, "threads_create")
    creation_id = create_resp.json().get("id")
    if not creation_id:
        raise PublisherError("threads_create failed: missing creation_id")

    # Threads API can require slight delay before publish.
    time.sleep(1.2)

    publish_resp = requests.post(
        f"{THREADS_GRAPH_BASE}/{user_id}/threads_publish",
        data={"creation_id": creation_id, "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(publish_resp, "threads_publish")
    publish_data = publish_resp.json()
    publish_data["creation_id"] = creation_id
    return publish_data


def fetch_threads_metrics(media_id: str, access_token: str) -> dict[str, int]:
    resp = requests.get(
        f"{THREADS_GRAPH_BASE}/{media_id}/insights",
        params={"metric": "views,likes,replies,reposts,quotes", "access_token": access_token},
        timeout=30,
    )
    _raise_for_api(resp, "threads_metrics")
    payload = resp.json()

    lookup: dict[str, int] = {}
    for metric in payload.get("data", []):
        name = metric.get("name")
        value = metric.get("values", [{}])[0].get("value", 0)
        lookup[name] = int(value or 0)

    return {
        "impressions": lookup.get("views", 0),
        "reactions": lookup.get("likes", 0),
        "comments": lookup.get("replies", 0),
        "shares": lookup.get("reposts", 0) + lookup.get("quotes", 0),
        "clicks": 0,
    }

