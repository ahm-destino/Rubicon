"""Downloads: single (redirect + count) and server-built ZIP of selected photos."""
import io
import os
import zipfile

from flask import Blueprint, jsonify, redirect, request, send_file

from extensions import db
from models import Photo
from services.storage import local_path

bp = Blueprint("downloads", __name__, url_prefix="/api")


@bp.get("/photos/<pid>/download")
def download_single(pid):
    p = db.session.get(Photo, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    p.download_count += 1
    db.session.commit()
    return redirect(p.high_res_url or p.url)


@bp.post("/events/<event_id>/download/zip")
def download_zip(event_id):
    data = request.get_json(silent=True) or {}
    photo_ids = data.get("photoIds") or []
    filename = data.get("filename", "rubicon-photos.zip")
    if not photo_ids:
        return jsonify({"error": "photoIds required"}), 400

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for pid in photo_ids:
            p = db.session.get(Photo, pid)
            if not p or p.event_id != event_id:
                continue
            disk = local_path(event_id, f"{p.google_media_id}.jpg")
            if os.path.exists(disk):
                zf.write(disk, arcname=p.filename or f"{p.google_media_id}.jpg")
                p.download_count += 1
    db.session.commit()
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name=filename)
