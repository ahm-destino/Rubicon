"""User (admin/photographer login) management. All routes are admin-only."""
from flask import Blueprint, g, jsonify, request
from werkzeug.security import generate_password_hash

from auth_utils import admin_required
from extensions import db
from models import User
from services.ids import new_id

bp = Blueprint("users", __name__, url_prefix="/api")

ROLES = {"admin", "photographer"}


@bp.get("/users")
@admin_required
def list_users():
    rows = User.query.order_by(User.created_at).all()
    return jsonify([u.to_dict() for u in rows])


@bp.post("/users")
@admin_required
def create_user():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    name = (d.get("name") or "").strip()
    password = d.get("password") or ""
    role = d.get("role") or "admin"

    if not email or not name:
        return jsonify({"error": "name and email are required"}), 400
    if role not in ROLES:
        return jsonify({"error": "role must be admin or photographer"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "a user with that email already exists"}), 409

    user = User(
        id=new_id("user"),
        email=email,
        name=name,
        password_hash=generate_password_hash(password),
        role=role,
        photographer_id=d.get("photographerId"),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@bp.patch("/users/<uid>")
@admin_required
def update_user(uid):
    user = db.session.get(User, uid)
    if not user:
        return jsonify({"error": "not found"}), 404
    d = request.get_json(silent=True) or {}

    if "name" in d:
        user.name = (d["name"] or "").strip() or user.name
    if "email" in d:
        email = (d["email"] or "").strip().lower()
        if email and email != user.email:
            if User.query.filter_by(email=email).first():
                return jsonify({"error": "a user with that email already exists"}), 409
            user.email = email
    if "role" in d:
        role = d["role"]
        if role not in ROLES:
            return jsonify({"error": "role must be admin or photographer"}), 400
        # Don't let the last admin demote themselves out of existence.
        if user.role == "admin" and role != "admin" and _admin_count() <= 1:
            return jsonify({"error": "cannot demote the last remaining admin"}), 409
        user.role = role
    if "photographerId" in d:
        user.photographer_id = d["photographerId"]
    if d.get("password"):
        if len(d["password"]) < 8:
            return jsonify({"error": "password must be at least 8 characters"}), 400
        user.password_hash = generate_password_hash(d["password"])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.delete("/users/<uid>")
@admin_required
def delete_user(uid):
    user = db.session.get(User, uid)
    if not user:
        return jsonify({"error": "not found"}), 404
    if user.id == g.user.id:
        return jsonify({"error": "you cannot delete your own account"}), 409
    if user.role == "admin" and _admin_count() <= 1:
        return jsonify({"error": "cannot delete the last remaining admin"}), 409
    db.session.delete(user)
    db.session.commit()
    return jsonify({"ok": True})


def _admin_count():
    return User.query.filter_by(role="admin").count()
