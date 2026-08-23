"""JWT issuing/verification + route guards for admin/photographer endpoints."""
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import g, jsonify, request

from config import Config
from extensions import db
from models import User


def issue_token(user: User) -> str:
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=Config.JWT_EXP_HOURS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def set_auth_cookie(resp, user: User):
    """Attach the JWT as an httpOnly cookie. No Domain attribute -> host-only, so
    the browser (which talks to the Vite proxy on :3000) keeps sending it back."""
    resp.set_cookie(
        Config.COOKIE_NAME,
        issue_token(user),
        max_age=Config.JWT_EXP_HOURS * 3600,
        httponly=True,
        secure=Config.COOKIE_SECURE,
        samesite=Config.COOKIE_SAMESITE,
        path="/",
    )
    return resp


def clear_auth_cookie(resp):
    resp.delete_cookie(Config.COOKIE_NAME, path="/")
    return resp


def _current_user():
    # Prefer the httpOnly cookie; fall back to Authorization: Bearer for API clients.
    token = request.cookies.get(Config.COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return db.session.get(User, payload.get("sub"))


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if not user:
            return jsonify({"error": "authentication required"}), 401
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if not user:
            return jsonify({"error": "authentication required"}), 401
        if user.role != "admin":
            return jsonify({"error": "admin access required"}), 403
        g.user = user
        return fn(*args, **kwargs)

    return wrapper
