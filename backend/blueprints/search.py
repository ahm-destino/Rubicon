"""
Face search — the real replacement for src/utils/faceMatcher.ts.

/search/selfie   : embed an uploaded selfie -> NumPy cosine top-k -> matches.
/search/participant : look up a participant, return photos whose faces are linked
                      to them (linkage is created when a selfie search identifies
                      a participant, so name search improves as the event is used).
"""
import base64
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from extensions import db
from models import FaceDetection, Participant, Photo
from services.faces import embed_selfie
from services.search import search_by_embedding

bp = Blueprint("search", __name__, url_prefix="/api")


def _best_per_photo(pairs):
    """Collapse [(face, similarity)] to one best match per photo, sorted desc."""
    best = {}
    for face, sim in pairs:
        cur = best.get(face.photo_id)
        if cur is None or sim > cur[1]:
            best[face.photo_id] = (face, sim)
    out = []
    for face, sim in best.values():
        photo = db.session.get(Photo, face.photo_id)
        if photo:
            out.append({"photo": photo.to_dict(), "matchedFace": face.to_dict(),
                        "similarity": round(sim, 4)})
    out.sort(key=lambda r: r["similarity"], reverse=True)
    return out


@bp.post("/events/<event_id>/search/selfie")
def search_selfie(event_id):
    raw = None
    if "selfie" in request.files:
        raw = request.files["selfie"].read()
    else:
        data = request.get_json(silent=True) or {}
        b64 = data.get("selfieBase64")
        if b64:
            raw = base64.b64decode(b64.split(",", 1)[-1])
    if not raw:
        return jsonify({"error": "no selfie provided"}), 400

    embedding = embed_selfie(raw)
    if embedding is None:
        return jsonify({"error": "no face detected in selfie", "results": []}), 422

    pairs = search_by_embedding(event_id, embedding)
    results = _best_per_photo(pairs)

    # Optionally attribute + link matches to a named participant so name search works later.
    participant_id = (request.form.get("participantId")
                      or (request.get_json(silent=True) or {}).get("participantId"))
    if participant_id:
        participant = db.session.get(Participant, participant_id)
        if participant:
            for face, _ in pairs:
                if face.participant_id is None:
                    face.participant_id = participant_id
            participant.has_found_photos = bool(results)
            participant.last_searched_at = datetime.now(timezone.utc)
            db.session.commit()

    return jsonify(results)


@bp.post("/events/<event_id>/search/participant")
def search_participant(event_id):
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip().lower()
    if not query:
        return jsonify({"error": "query required"}), 400

    participant = next(
        (p for p in Participant.query.filter_by(event_id=event_id).all()
         if query == p.name.lower() or query == (p.reg_id or "").lower()
         or query in p.name.lower()),
        None,
    )
    if not participant:
        return jsonify({"participant": None, "results": []})

    linked = (FaceDetection.query
              .filter_by(participant_id=participant.id)
              .join(Photo, FaceDetection.photo_id == Photo.id)
              .filter(Photo.event_id == event_id).all())
    results = _best_per_photo([(f, f.confidence) for f in linked])

    participant.last_searched_at = datetime.now(timezone.utc)
    participant.has_found_photos = bool(results)
    db.session.commit()
    return jsonify({"participant": participant.to_dict(), "results": results})
