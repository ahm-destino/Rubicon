"""Google Photos Picker API — create/poll Picker sessions.

Flow:
  1. Frontend gets an OAuth2 access_token client-side via Google Identity Services
     (photospicker.mediaitems.readonly scope).
  2. POST /session  -> calls Picker API to create a session, stores token in-memory.
  3. Browser opens pickerUri returned by step 2.
  4. GET  /session/<id> -> polls whether the user has finished selecting.
  5. Frontend calls blueprints/photos.py  POST /from-picker  to ingest.

In-memory token store is safe for the single gunicorn worker Railway runs (-w 1).
Entries expire after PICKER_TTL seconds (<= Picker session lifetime of 60 min).
"""
import time

import requests as http
from flask import Blueprint, jsonify, request

from auth_utils import admin_required

bp = Blueprint("picker", __name__, url_prefix="/api/auth/google/picker")

PICKER_BASE = "https://photospicker.googleapis.com/v1"
PICKER_TTL = 3600  # 1 hour  (Picker sessions expire within ~60 min)

# { picker_session_id: { "access_token": str, "created_at": float } }
_SESSIONS: dict = {}


def _evict_expired():
    """Remove entries older than PICKER_TTL. Called on every mutating request."""
    cutoff = time.time() - PICKER_TTL
    stale = [k for k, v in _SESSIONS.items() if v["created_at"] < cutoff]
    for k in stale:
        del _SESSIONS[k]


def get_session_token(session_id: str) -> str | None:
    """Return the stored access token for a session, or None if missing/expired."""
    entry = _SESSIONS.get(session_id)
    if not entry:
        return None
    if time.time() - entry["created_at"] > PICKER_TTL:
        del _SESSIONS[session_id]
        return None
    return entry["access_token"]


@bp.post("/session")
@admin_required
def create_session():
    """Create a Picker session with Google.
    Body:    { access_token: <OAuth2 token with photospicker scope> }
    Returns: { sessionId, pickerUri }
    """
    data = request.get_json(silent=True) or {}
    access_token = (data.get("access_token") or "").strip()
    if not access_token:
        return jsonify({"error": "access_token is required"}), 400

    _evict_expired()

    try:
        resp = http.post(
            f"{PICKER_BASE}/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        resp.raise_for_status()
    except http.exceptions.HTTPError as exc:
        return jsonify({"error": f"Picker API error: {exc.response.text}"}), 502
    except Exception as exc:
        return jsonify({"error": f"Could not create Picker session: {exc}"}), 502

    payload = resp.json()
    session_id = payload.get("id")
    picker_uri = payload.get("pickerUri")

    if not session_id or not picker_uri:
        return jsonify({"error": "Unexpected Picker API response", "raw": payload}), 502

    _SESSIONS[session_id] = {
        "access_token": access_token,
        "created_at": time.time(),
    }

    return jsonify({"sessionId": session_id, "pickerUri": picker_uri})


@bp.get("/session/<session_id>")
@admin_required
def poll_session(session_id):
    """Poll whether the user has finished selecting photos.
    Returns: { done: bool }
    """
    token = get_session_token(session_id)
    if not token:
        return jsonify({"error": "Picker session not found or expired"}), 404

    try:
        resp = http.get(
            f"{PICKER_BASE}/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as exc:
        return jsonify({"error": f"Could not poll Picker session: {exc}"}), 502

    data = resp.json()
    return jsonify({"done": bool(data.get("mediaItemsSet"))})
