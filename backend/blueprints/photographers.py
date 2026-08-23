"""Photographers CRUD."""
from flask import Blueprint, jsonify, request

from auth_utils import admin_required
from extensions import db
from models import Event, Photographer
from services.ids import new_id

bp = Blueprint("photographers", __name__, url_prefix="/api")


@bp.get("/events/<event_id>/photographers")
def list_photographers(event_id):
    rows = Photographer.query.filter_by(event_id=event_id).order_by(Photographer.name).all()
    return jsonify([p.to_dict() for p in rows])


@bp.post("/events/<event_id>/photographers")
@admin_required
def create_photographer(event_id):
    if not db.session.get(Event, event_id):
        return jsonify({"error": "event not found"}), 404
    d = request.get_json(silent=True) or {}
    if not d.get("name"):
        return jsonify({"error": "name is required"}), 400
    p = Photographer(
        id=d.get("id") or new_id("photo"),
        name=d["name"],
        avatar=d.get("avatar", ""),
        email=d.get("email", ""),
        badge=d.get("badge", "Photographer"),
        gear=d.get("gear", ""),
        event_id=event_id,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.get("/photographers/<pid>")
def get_photographer(pid):
    p = db.session.get(Photographer, pid)
    return (jsonify(p.to_dict()), 200) if p else (jsonify({"error": "not found"}), 404)


@bp.patch("/photographers/<pid>")
@admin_required
def update_photographer(pid):
    p = db.session.get(Photographer, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    d = request.get_json(silent=True) or {}
    for js, col in {"name": "name", "avatar": "avatar", "email": "email",
                    "badge": "badge", "gear": "gear", "isOnline": "is_online"}.items():
        if js in d:
            setattr(p, col, d[js])
    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete("/photographers/<pid>")
@admin_required
def delete_photographer(pid):
    p = db.session.get(Photographer, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    if p.photos:
        return jsonify({
            "error": f"cannot remove {p.name}: {len(p.photos)} photo(s) are attributed "
                     "to them. Reassign or delete those photos first."
        }), 409
    db.session.delete(p)
    db.session.commit()
    return jsonify({"ok": True})
