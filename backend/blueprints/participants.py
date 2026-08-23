"""Participants / attendees CRUD + roster import."""
from flask import Blueprint, jsonify, request

from auth_utils import admin_required
from extensions import db
from models import Event, FaceDetection, Participant, Photo
from services.ids import new_id

bp = Blueprint("participants", __name__, url_prefix="/api")


@bp.get("/events/<event_id>/participants")
def list_participants(event_id):
    q = (request.args.get("q") or "").strip().lower()
    filt = request.args.get("filter", "all")
    query = Participant.query.filter_by(event_id=event_id)
    rows = query.order_by(Participant.name).all()

    def keep(p):
        if filt == "covered" and not p.has_found_photos:
            return False
        if filt == "missing" and p.has_found_photos:
            return False
        if q and q not in p.name.lower() and q not in (p.reg_id or "").lower():
            return False
        return True

    return jsonify([p.to_dict() for p in rows if keep(p)])


@bp.post("/events/<event_id>/participants")
@admin_required
def create_participants(event_id):
    if not db.session.get(Event, event_id):
        return jsonify({"error": "event not found"}), 404
    payload = request.get_json(silent=True) or {}
    items = payload if isinstance(payload, list) else [payload]
    created = []
    for d in items:
        if not d.get("name"):
            continue
        p = Participant(
            id=d.get("id") or new_id("part"),
            name=d["name"],
            reg_id=d.get("regId", ""),
            email=d.get("email", ""),
            phone=d.get("phone", ""),
            avatar=d.get("avatar", ""),
            selfie_url=d.get("selfieUrl"),
            event_id=event_id,
        )
        db.session.add(p)
        created.append(p)
    db.session.commit()
    result = [p.to_dict() for p in created]
    return jsonify(result if isinstance(payload, list) else (result[0] if result else {})), 201


@bp.get("/participants/<pid>")
def get_participant(pid):
    p = db.session.get(Participant, pid)
    return (jsonify(p.to_dict()), 200) if p else (jsonify({"error": "not found"}), 404)


@bp.get("/participants/<pid>/photos")
def participant_photos(pid):
    """Read-only: photos this attendee's face has been linked to (best face per
    photo, most confident first). Powers the admin 'View photos' panel."""
    p = db.session.get(Participant, pid)
    if not p:
        return jsonify({"error": "not found"}), 404

    linked = (FaceDetection.query
              .filter_by(participant_id=pid)
              .join(Photo, FaceDetection.photo_id == Photo.id).all())
    best = {}
    for f in linked:
        cur = best.get(f.photo_id)
        if cur is None or f.confidence > cur.confidence:
            best[f.photo_id] = f

    results = []
    for f in best.values():
        photo = db.session.get(Photo, f.photo_id)
        if photo:
            results.append({"photo": photo.to_dict(), "matchedFace": f.to_dict(),
                            "similarity": round(f.confidence, 4)})
    results.sort(key=lambda r: r["similarity"], reverse=True)
    return jsonify(results)


@bp.patch("/participants/<pid>")
@admin_required
def update_participant(pid):
    p = db.session.get(Participant, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    d = request.get_json(silent=True) or {}
    for js, col in {"name": "name", "regId": "reg_id", "email": "email", "phone": "phone",
                    "avatar": "avatar", "selfieUrl": "selfie_url"}.items():
        if js in d:
            setattr(p, col, d[js])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete("/participants/<pid>")
@admin_required
def delete_participant(pid):
    p = db.session.get(Participant, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    # Unlink any matched faces first (participant_id is a FK); keep the faces/photos.
    FaceDetection.query.filter_by(participant_id=pid).update(
        {FaceDetection.participant_id: None}, synchronize_session=False)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"ok": True})
