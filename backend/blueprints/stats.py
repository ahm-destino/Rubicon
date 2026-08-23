"""Storage + vector-index stats (replaces the hardcoded Storage tab values)."""
from flask import Blueprint, jsonify

from config import Config
from extensions import db
from models import Event, FaceDetection, Photo, StorageConfig
from services.storage import active_account

bp = Blueprint("stats", __name__, url_prefix="/api")


@bp.get("/events/<event_id>/storage")
def storage_stats(event_id):
    if not db.session.get(Event, event_id):
        return jsonify({"error": "event not found"}), 404
    # Per-event Drive account takes precedence; else the global local-vault default.
    account = active_account(event_id)
    if account:
        provider = account.to_provider_dict()
    else:
        cfg = StorageConfig.query.first()
        provider = cfg.to_dict() if cfg else None
    indexed_faces = (db.session.query(FaceDetection)
                     .join(Photo, FaceDetection.photo_id == Photo.id)
                     .filter(Photo.event_id == event_id)
                     .filter(FaceDetection.embedding.isnot(None)).count())
    return jsonify({
        "provider": provider,
        "vectorIndex": {
            "dim": Config.FACE_EMBED_DIM,
            "metric": "cosine",
            "similarityThreshold": Config.FACE_MATCH_THRESHOLD,
            "model": Config.FACE_MODEL,
            "indexedFaces": indexed_faces,
        },
    })
