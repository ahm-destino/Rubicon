"""Events CRUD + derived stats (replaces AdminPanel client-side math)."""
from flask import Blueprint, jsonify, request

from auth_utils import admin_required
from extensions import db
from models import Event, Participant, Photo
from services.ids import new_id

bp = Blueprint("events", __name__, url_prefix="/api/events")


@bp.get("")
def list_events():
    return jsonify([e.to_dict() for e in Event.query.order_by(Event.name).all()])


@bp.get("/<event_id>")
def get_event(event_id):
    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "not found"}), 404
    return jsonify(event.to_dict())


@bp.post("")
@admin_required
def create_event():
    d = request.get_json(silent=True) or {}
    if not d.get("name") or not d.get("slug"):
        return jsonify({"error": "name and slug are required"}), 400
    sessions = d.get("sessions") or ["All Sessions"]
    if "All Sessions" not in sessions:
        sessions = ["All Sessions"] + sessions
    event = Event(
        id=d.get("id") or new_id("evt"),
        name=d["name"],
        cohort=d.get("cohort", ""),
        slug=d["slug"],
        location=d.get("location", ""),
        date=d.get("date", ""),
        cover_image=d.get("coverImage", ""),
        storage_provider=d.get("storageProvider", "cloud_storage"),
        google_album_id=d.get("googleAlbumId", ""),
        sessions=sessions,
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@bp.patch("/<event_id>")
@admin_required
def update_event(event_id):
    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "not found"}), 404
    d = request.get_json(silent=True) or {}
    field_map = {
        "name": "name", "cohort": "cohort", "slug": "slug", "location": "location",
        "date": "date", "coverImage": "cover_image", "storageProvider": "storage_provider",
        "googleAlbumId": "google_album_id", "sessions": "sessions",
    }
    for js, col in field_map.items():
        if js in d:
            setattr(event, col, d[js])
    db.session.commit()
    return jsonify(event.to_dict())


@bp.delete("/<event_id>")
@admin_required
def delete_event(event_id):
    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "not found"}), 404
    db.session.delete(event)
    db.session.commit()
    return jsonify({"ok": True})


@bp.get("/<event_id>/stats")
def event_stats(event_id):
    event = db.session.get(Event, event_id)
    if not event:
        return jsonify({"error": "not found"}), 404
    photos = event.photos
    participants = event.participants
    covered = sum(1 for p in participants if p.has_found_photos)
    return jsonify({
        "totalPhotos": len(photos),
        "publishedPhotos": sum(1 for p in photos if p.status == "published"),
        "coverageRate": round(covered / len(participants), 3) if participants else 0,
        "coveredCount": covered,
        "missingCount": len(participants) - covered,
        "totalViews": sum(p.view_count for p in photos),
        "totalDownloads": sum(p.download_count for p in photos),
        "photographerCount": len(event.photographers),
    })
