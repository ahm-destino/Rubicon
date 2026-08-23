"""Central configuration, loaded from environment (.env)."""
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class Config:
    # Flask
    ENV = os.getenv("FLASK_ENV", "production")
    DEBUG = ENV == "development"
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET = os.getenv("JWT_SECRET", SECRET_KEY)
    JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", "72"))

    # Auth cookie (httpOnly JWT). No Domain attribute -> host-only, so it works
    # through the Vite dev proxy (browser sees localhost:3000). Set COOKIE_SECURE=1
    # in production (HTTPS). SameSite=Lax blocks cross-site POST/fetch.
    COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "rubicon_token")
    COOKIE_SECURE = _bool("COOKIE_SECURE")
    COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")

    # Login rate limit (Flask-Limiter syntax).
    LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10 per minute;50 per hour")
    CORS_ORIGINS = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ]

    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://rubicon:rubicon@localhost:5432/rubicon"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Uploads
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "200")) * 1024 * 1024

    # Storage abstraction
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_LOCAL_DIR = os.getenv("STORAGE_LOCAL_DIR", "./storage")
    MEDIA_BASE_URL = os.getenv("MEDIA_BASE_URL", "http://localhost:5000/media").rstrip("/")
    S3_BUCKET = os.getenv("S3_BUCKET", "")
    S3_REGION = os.getenv("S3_REGION", "")
    GCS_BUCKET = os.getenv("GCS_BUCKET", "")

    # Face recognition
    FACE_MODEL = os.getenv("FACE_MODEL", "buffalo_l")
    FACE_EMBED_DIM = int(os.getenv("FACE_EMBED_DIM", "512"))
    FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.35"))
    FACE_USE_GPU = _bool("FACE_USE_GPU")

    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_OAUTH_REDIRECT_URI = os.getenv(
        "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:5000/api/auth/google/callback"
    )
    GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
    GOOGLE_PICKER_ENABLED = _bool("GOOGLE_PICKER_ENABLED")

    # Google Drive per-event storage. Separate OAuth client (offline access +
    # drive.file scope) so an event admin can connect/switch that event's own
    # Drive account from the UI. Least-privilege: Rubicon only sees files it creates.
    #
    # The redirect URI must be the ORIGIN THE BROWSER USES (the SPA/Vite dev origin,
    # :3000), not the Flask port — Authlib's OAuth state + our stashed event_id live
    # in the Flask session cookie, which is scoped to that browser origin. Sending
    # the callback straight to Flask would arrive without that cookie and fail state
    # validation. In dev, /api is proxied :3000 -> backend, so :3000 reaches Flask.
    GOOGLE_DRIVE_REDIRECT_URI = os.getenv(
        "GOOGLE_DRIVE_REDIRECT_URI", "http://localhost:3000/api/auth/google/drive/callback"
    )
    GOOGLE_DRIVE_SCOPE = "openid email https://www.googleapis.com/auth/drive.file"

    # Optional Gemini enrichment
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
