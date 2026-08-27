"""Auth: email/password login + real Google OAuth sign-in (Authlib)."""
from flask import Blueprint, g, jsonify, make_response, redirect, request
from werkzeug.security import check_password_hash, generate_password_hash

from auth_utils import (clear_auth_cookie, login_required, set_auth_cookie)
from config import Config
from extensions import db, limiter, oauth
from models import User
from services.ids import new_id

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
@limiter.limit(Config.LOGIN_RATE_LIMIT)
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401
    resp = make_response(jsonify({"user": user.to_dict()}))
    return set_auth_cookie(resp, user)


@bp.get("/me")
@login_required
def me():
    return jsonify(g.user.to_dict())


@bp.post("/logout")
def logout():
    resp = make_response(jsonify({"ok": True}))
    return clear_auth_cookie(resp)


@bp.post("/change-password")
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("currentPassword") or ""
    new = data.get("newPassword") or ""
    if len(new) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400
    user = g.user
    if not user.password_hash or not check_password_hash(user.password_hash, current):
        return jsonify({"error": "current password is incorrect"}), 403
    user.password_hash = generate_password_hash(new)
    db.session.commit()
    # Rotate the cookie so the session stays valid after the change.
    resp = make_response(jsonify({"ok": True}))
    return set_auth_cookie(resp, user)


@bp.get("/google/login")
def google_login():
    if not Config.GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID/SECRET."}), 501
    return oauth.google.authorize_redirect(Config.GOOGLE_OAUTH_REDIRECT_URI)


@bp.get("/google/callback")
def google_callback():
    if not Config.GOOGLE_CLIENT_ID:
        return jsonify({"error": "Google OAuth not configured."}), 501
    token = oauth.google.authorize_access_token()
    info = token.get("userinfo") or oauth.google.userinfo()
    sub = info.get("sub")
    email = (info.get("email") or "").lower()

    user = User.query.filter_by(google_sub=sub).first() or User.query.filter_by(email=email).first()
    if not user:
        user = User(id=new_id("user"), email=email, name=info.get("name", email), role="admin")
        db.session.add(user)
    user.google_sub = sub
    user.avatar = info.get("picture", user.avatar)
    db.session.commit()

    # Set the httpOnly cookie, then bounce back to the SPA (no token in the URL).
    frontend = Config.CORS_ORIGINS[0] if Config.CORS_ORIGINS else "https://rubiconn.vercel.app"
    resp = redirect(frontend + "/")
    return set_auth_cookie(resp, user)
