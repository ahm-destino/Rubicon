"""
Rubicon Flask application factory.

Run:
    cp .env.example .env         # fill in DATABASE_URL etc.
    pip install -r requirements.txt
    flask --app app init-db      # create tables
    flask --app app seed         # demo event/admin/roster
    flask --app app run -p 5001  # dev server  (or: gunicorn "app:app")
"""
import os

import click
from flask import Flask, jsonify, send_from_directory

from config import Config
from extensions import cors, db, limiter, migrate, oauth


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
                  supports_credentials=True)
    oauth.init_app(app)
    limiter.init_app(app)

    # Google OpenID Connect (identity sign-in). Photos scopes are added separately.
    oauth.register(
        name="google",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url=Config.GOOGLE_DISCOVERY_URL,
        client_kwargs={"scope": "openid email profile"},
    )

    # Google Drive per-event storage (separate client: offline access + drive.file
    # scope) so an event admin can connect/switch that event's own Drive account.
    oauth.register(
        name="google_drive",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url=Config.GOOGLE_DISCOVERY_URL,
        client_kwargs={"scope": Config.GOOGLE_DRIVE_SCOPE},
    )

    # Import models so migrations/create_all see them.
    from models import (  # noqa: F401
        Event, FaceDetection, IngestionJob, Participant, Photo,
        Photographer, StorageAccount, StorageConfig, User,
    )

    # Blueprints
    from blueprints import (auth, downloads, events, participants,
                            photographers, photos, search, stats, storage, users)
    for module in (auth, users, events, photographers, participants, photos,
                   search, downloads, stats, storage):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "app": "Rubicon backend",
            "storageBackend": Config.STORAGE_BACKEND,
            "faceModel": Config.FACE_MODEL,
            "embedDim": Config.FACE_EMBED_DIM,
            "googleOAuth": bool(Config.GOOGLE_CLIENT_ID),
        })

    @app.get("/media/<event_id>/<path:name>")
    def media(event_id, name):
        base = os.path.abspath(os.path.join(Config.STORAGE_LOCAL_DIR, event_id))
        return send_from_directory(base, name)

    @app.get("/media/img/<key>/<variant>")
    def media_drive(key, variant):
        """Stream a Drive-backed photo derivative. Public, like the local /media
        route (participants are unauthenticated). `key` is the photo's storage key
        (google_media_id); `variant` is orig | web | thumb."""
        from flask import Response, abort, stream_with_context

        from models import Photo, StorageAccount
        from services import gdrive

        if variant not in ("orig", "web", "thumb"):
            abort(404)
        photo = Photo.query.filter_by(google_media_id=key).first()
        if not photo or not photo.storage_account_id or not photo.storage_meta:
            abort(404)
        file_id = photo.storage_meta.get(variant)
        account = db.session.get(StorageAccount, photo.storage_account_id)
        if not file_id or not account or not account.refresh_token:
            abort(404)
        try:
            token = gdrive.access_token_for(account.refresh_token)
            upstream = gdrive.download_stream(token, file_id)
        except gdrive.DriveError:
            abort(502)
        resp = Response(
            stream_with_context(upstream.iter_content(chunk_size=65536)),
            content_type=upstream.headers.get("Content-Type", "image/jpeg"),
        )
        resp.headers["Cache-Control"] = "public, max-age=3600"
        return resp

    @app.cli.command("init-db")
    def init_db():
        """Create all tables. Face vectors are stored as native float arrays
        and searched in NumPy, so no pgvector extension is required."""
        db.create_all()
        click.echo("Tables created.")

    @app.cli.command("upgrade-storage")
    def upgrade_storage():
        """Non-destructive upgrade for per-event Drive storage: create the
        storage_account table and add the two nullable columns to `photos`.
        Existing local photos/events are preserved (new columns default to NULL,
        which the code treats as legacy local storage)."""
        from sqlalchemy import text
        db.create_all()  # creates storage_account (and any other missing tables)
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE photos ADD COLUMN IF NOT EXISTS storage_account_id VARCHAR"))
            conn.execute(text("ALTER TABLE photos ADD COLUMN IF NOT EXISTS storage_meta JSON"))
        click.echo("Storage schema upgraded: storage_account table + photos.storage_account_id/storage_meta.")

    @app.cli.command("seed")
    def seed_cmd():
        """Load demo admin, event, photographers and participants."""
        from seed import run_seed
        run_seed()
        click.echo("Seed complete. Login: admin@rubicon.io / rubicon123")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=Config.DEBUG)
