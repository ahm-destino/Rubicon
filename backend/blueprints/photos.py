"""Photos: gallery listing, detail, view counter, real upload+ingest, job polling."""
from flask import Blueprint, jsonify, request

from auth_utils import admin_required
from extensions import db
from models import Event, IngestionJob, Photo
from services.ids import new_id
from services.ingest import ingest_photo
from services.storage import delete_image

bp = Blueprint("photos", __name__, url_prefix="/api")


@bp.get("/events/<event_id>/photos")
def list_photos(event_id):
    session = request.args.get("session")
    photographer_id = request.args.get("photographerId")
    q = (request.args.get("q") or "").strip().lower()
    sort = request.args.get("sort", "newest")
    page = max(1, int(request.args.get("page", 1)))
    page_size = min(200, int(request.args.get("pageSize", 60)))

    query = Photo.query.filter_by(event_id=event_id)
    if session and session != "All Sessions":
        query = query.filter(Photo.session_tag == session)
    if photographer_id:
        query = query.filter(Photo.photographer_id == photographer_id)

    if sort == "popular":
        query = query.order_by(Photo.view_count.desc())
    elif sort == "downloads":
        query = query.order_by(Photo.download_count.desc())
    else:
        query = query.order_by(Photo.uploaded_at.desc())

    rows = query.all()
    if q:  # text search across filename / session / photographer / detected names
        def match(p):
            hay = " ".join([
                p.filename or "", p.session_tag or "",
                p.photographer.name if p.photographer else "",
                " ".join(f.participant.name for f in p.faces if f.participant),
            ]).lower()
            return q in hay
        rows = [p for p in rows if match(p)]

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    return jsonify({"items": [p.to_dict() for p in page_rows], "total": total})


@bp.get("/photos/<pid>")
def get_photo(pid):
    p = db.session.get(Photo, pid)
    return (jsonify(p.to_dict()), 200) if p else (jsonify({"error": "not found"}), 404)


@bp.delete("/photos/<pid>")
@admin_required
def delete_photo(pid):
    p = db.session.get(Photo, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    # Remove the stored derivatives (local disk or the photo's Drive account),
    # then the row (face rows cascade).
    delete_image(p)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"ok": True})


@bp.post("/photos/<pid>/view")
def bump_view(pid):
    p = db.session.get(Photo, pid)
    if not p:
        return jsonify({"error": "not found"}), 404
    p.view_count += 1
    db.session.commit()
    return jsonify({"viewCount": p.view_count})


@bp.post("/events/<event_id>/photos")
@admin_required
def upload_photos(event_id):
    """multipart/form-data: files[] + photographerId + sessionTag. Runs the real
    detect+embed pipeline per file (synchronous) and returns the resulting jobs."""
    if not db.session.get(Event, event_id):
        return jsonify({"error": "event not found"}), 404
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "no files uploaded"}), 400
    photographer_id = request.form.get("photographerId")
    session_tag = request.form.get("sessionTag", "General")
    camera_info = request.form.get("cameraInfo", "")

    jobs = []
    for f in files:
        job = IngestionJob(
            id=new_id("job"), filename=f.filename, photographer_id=photographer_id,
            event_id=event_id, session_tag=session_tag, stage="uploading_storage", progress=0,
        )
        db.session.add(job)
        db.session.commit()
        try:
            ingest_photo(event_id, photographer_id, session_tag, f.filename,
                         f.read(), camera_info=camera_info, job=job)
        except Exception as exc:  # keep the batch going; surface per-file failure
            job.stage = "error"
            job.error = str(exc)
            db.session.commit()
        jobs.append(job.to_dict())

    return jsonify({"jobs": jobs}), 201


@bp.get("/ingestion-jobs/<jid>")
def get_job(jid):
    job = db.session.get(IngestionJob, jid)
    return (jsonify(job.to_dict()), 200) if job else (jsonify({"error": "not found"}), 404)
