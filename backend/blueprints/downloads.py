"""Downloads: single (attachment download + count) and server-built ZIP of selected photos."""
import io
import os
import zipfile

from flask import Blueprint, Response, jsonify, redirect, request, send_file, stream_with_context

from extensions import db
from models import Photo, StorageAccount
from services import gdrive
from services.storage import local_path

bp = Blueprint("downloads", __name__, url_prefix="/api")


def _get_photo_bytes_and_name(photo: Photo):
    """Retrieve raw file bytes and a sanitized filename for a Photo row."""
    filename = photo.filename or f"{photo.google_media_id or photo.id}.jpg"
    if not any(filename.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
        filename += ".jpg"

    # 1. Try local disk
    disk = local_path(photo.event_id, f"{photo.google_media_id}.jpg")
    if os.path.exists(disk):
        try:
            with open(disk, "rb") as fh:
                return fh.read(), filename
        except Exception:
            pass

    # 2. Try Google Drive
    if photo.storage_account_id and photo.storage_meta:
        file_id = photo.storage_meta.get("orig") or photo.storage_meta.get("web")
        account = db.session.get(StorageAccount, photo.storage_account_id)
        if file_id and account and account.refresh_token:
            try:
                token = gdrive.access_token_for(account.refresh_token)
                resp = gdrive.download_stream(token, file_id)
                return resp.content, filename
            except Exception:
                pass

    return None, filename


@bp.get("/photos/<pid>/download")
def download_single(pid):
    p = db.session.get(Photo, pid)
    if not p:
        return jsonify({"error": "not found"}), 404

    p.download_count += 1
    db.session.commit()

    download_filename = p.filename or f"{p.google_media_id or p.id}.jpg"
    if not any(download_filename.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
        download_filename += ".jpg"

    # Serve local file directly as attachment
    disk = local_path(p.event_id, f"{p.google_media_id}.jpg")
    if os.path.exists(disk):
        return send_file(
            disk,
            mimetype="image/jpeg",
            as_attachment=True,
            download_name=download_filename,
        )

    # Stream Google Drive file as attachment
    if p.storage_account_id and p.storage_meta:
        file_id = p.storage_meta.get("orig") or p.storage_meta.get("web")
        account = db.session.get(StorageAccount, p.storage_account_id)
        if file_id and account and account.refresh_token:
            try:
                token = gdrive.access_token_for(account.refresh_token)
                upstream = gdrive.download_stream(token, file_id)
                resp = Response(
                    stream_with_context(upstream.iter_content(chunk_size=65536)),
                    content_type="application/octet-stream",
                )
                resp.headers["Content-Disposition"] = f'attachment; filename="{download_filename}"'
                return resp
            except Exception:
                pass

    # Fallback to redirecting
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
            raw_data, name = _get_photo_bytes_and_name(p)
            if raw_data:
                zf.writestr(name, raw_data)
                p.download_count += 1
    db.session.commit()
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name=filename)

