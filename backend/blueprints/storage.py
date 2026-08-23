"""
Per-event Google Drive storage: connect / switch / disconnect an event's own
Drive account from the admin UI.

Connecting runs a full OAuth round-trip as the admin (offline access + drive.file
scope) to obtain a refresh token, creates a "Rubicon" folder in that Drive, and
records it as the event's *active* StorageAccount. Any previously active account is
*archived* (its refresh token is kept, so photos already uploaded there keep
loading) — new uploads go to the new active account.
"""
from flask import Blueprint, g, jsonify, redirect, request, session

from auth_utils import admin_required
from config import Config
from extensions import db, oauth
from models import Event, StorageAccount
from services import gdrive
from services.ids import new_id

bp = Blueprint("storage", __name__, url_prefix="/api")


def _frontend_origin():
    return Config.CORS_ORIGINS[0] if Config.CORS_ORIGINS else "http://localhost:3000"


def _archive_active(event_id):
    """Archive the event's active account(s). Refresh token is intentionally kept
    so old photos in that account keep serving through the proxy."""
    for acc in StorageAccount.query.filter_by(event_id=event_id, status="active").all():
        acc.status = "archived"
        acc.connected = False


@bp.get("/events/<event_id>/storage/connect")
@admin_required
def storage_connect(event_id):
    if not Config.GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID/SECRET."}), 501
    if not db.session.get(Event, event_id):
        return jsonify({"error": "event not found"}), 404
    # Remember which event/admin this connect is for; read back in the callback.
    session["drive_connect_event_id"] = event_id
    session["drive_connect_user_id"] = g.user.id
    # offline + consent → Google returns a refresh token we can store server-side.
    return oauth.google_drive.authorize_redirect(
        Config.GOOGLE_DRIVE_REDIRECT_URI, access_type="offline", prompt="consent"
    )


@bp.get("/auth/google/drive/callback")
def storage_callback():
    frontend = _frontend_origin()
    event_id = session.pop("drive_connect_event_id", None)
    user_id = session.pop("drive_connect_user_id", None)

    try:
        token = oauth.google_drive.authorize_access_token()
    except Exception:
        return redirect(f"{frontend}/?storage=error")

    event = db.session.get(Event, event_id) if event_id else None
    refresh_token = token.get("refresh_token")
    if not event or not refresh_token:
        # No event context, or Google withheld a refresh token (already-granted
        # without revoke). Nothing safe to persist.
        return redirect(f"{frontend}/?storage=error")

    access_token = token.get("access_token")
    email = ((token.get("userinfo") or {}).get("email") or "").lower()

    try:
        folder_id = gdrive.create_folder(access_token, "Rubicon Event Photos")
    except gdrive.DriveError:
        return redirect(f"{frontend}/?storage=error")

    try:
        used_gb, total_gb = gdrive.get_quota(access_token)
    except gdrive.DriveError:
        used_gb, total_gb = 0.0, 0.0

    _archive_active(event.id)
    db.session.add(StorageAccount(
        id=new_id("stg"), event_id=event.id, provider="gdrive", account_email=email,
        refresh_token=refresh_token, root_folder_id=folder_id, status="active",
        connected=True, storage_used_gb=used_gb, storage_total_gb=total_gb,
        connected_by_user_id=user_id,
    ))
    event.storage_provider = "gdrive"
    db.session.commit()

    return redirect(f"{frontend}/?event={event.slug}&storage=connected")


@bp.post("/events/<event_id>/storage/disconnect")
@admin_required
def storage_disconnect(event_id):
    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "event not found"}), 404
    _archive_active(event_id)
    event.storage_provider = "cloud_storage"
    db.session.commit()
    return jsonify({"ok": True})
