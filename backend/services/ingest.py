"""
Ingestion pipeline: bytes -> storage -> face detection/embeddings -> DB rows.

Runs the real stages the UI used to fake with setTimeout in AdminPanel.handleBatchUpload
and GooglePhotosAlbumSync.handleSyncAlbum. When an IngestionJob is passed, its stage /
progress are advanced as real work completes so the frontend can poll actual state.

Duplicate detection
-------------------
Before doing any work, we compute a SHA-256 hash of the raw bytes and check:
  1. Hash match  — for any photo uploaded after this feature was added.
  2. Filename match — fallback for photos uploaded before hashes were stored
     (catches the "already uploaded 30" case after a partial batch failure).
If a duplicate is found the job is marked `skipped` and we return the existing
photo immediately — no storage write, no face detection, no double row.
"""
import hashlib
from datetime import datetime, timezone

from extensions import db
from models import FaceDetection, Photo
from services import faces as face_svc
from services import storage as storage_svc
from services.ids import new_id


def _advance(job, stage, progress):
    if not job:
        return
    job.stage = stage
    job.progress = progress
    db.session.commit()


def _find_duplicate(event_id, content_hash, filename):
    """Return an existing Photo row if this image is already in the event, else None.

    Checks by SHA-256 hash first (reliable, rename-safe). Falls back to an
    exact filename match so photos that were uploaded before hashes were stored
    (e.g. the 30 that already made it through a partial batch) are also caught.
    """
    # 1. Hash-based check (primary — works for all photos uploaded after this feature)
    if content_hash:
        existing = Photo.query.filter_by(
            event_id=event_id, content_hash=content_hash
        ).first()
        if existing:
            return existing

    # 2. Filename-based fallback (catches pre-existing photos that have no hash yet)
    if filename:
        existing = Photo.query.filter_by(
            event_id=event_id, filename=filename
        ).first()
        if existing:
            # Backfill the hash so the next re-upload uses the faster hash path
            if content_hash and not existing.content_hash:
                existing.content_hash = content_hash
                db.session.commit()
            return existing

    return None


def ingest_photo(event_id, photographer_id, session_tag, filename, raw, camera_info="", job=None):
    """Store one image, detect+embed its faces, persist Photo + FaceDetection rows.

    Returns the Photo row — either a newly created one or the existing duplicate
    that was found and skipped.
    """
    # ------------------------------------------------------------------ #
    # Duplicate detection — runs before any I/O so skipped files are fast #
    # ------------------------------------------------------------------ #
    content_hash = hashlib.sha256(raw).hexdigest()
    duplicate = _find_duplicate(event_id, content_hash, filename)

    if duplicate:
        # Mark the ingestion job as skipped (not an error) and return immediately
        if job:
            job.stage = "skipped"
            job.progress = 100
            job.photo_id = duplicate.id
            job.skipped_duplicate_of = duplicate.id
            job.preview_url = duplicate.thumbnail_url or ""
            db.session.commit()
        return duplicate

    # ------------------------------------------------------------------ #
    # New image — full pipeline                                            #
    # ------------------------------------------------------------------ #
    _advance(job, "uploading_storage", 20)
    stored = storage_svc.save_image(raw, event_id, filename)
    if job:
        job.google_media_id = stored.key
        job.preview_url = stored.thumbnail_url
        db.session.commit()

    _advance(job, "detecting_faces", 50)
    detected = face_svc.detect_faces(raw)

    _advance(job, "generating_embeddings", 75)
    photo = Photo(
        id=new_id("photo"),
        google_media_id=stored.key,
        storage_account_id=stored.storage_account_id,
        storage_meta=stored.storage_meta,
        event_id=event_id,
        photographer_id=photographer_id,
        filename=filename,
        content_hash=content_hash,
        url=stored.url,
        high_res_url=stored.high_res_url,
        thumbnail_url=stored.thumbnail_url,
        uploaded_at=datetime.now(timezone.utc),
        session_tag=session_tag,
        camera_info=camera_info,
        width=stored.width,
        height=stored.height,
        exif=stored.exif,
        status="published",
        view_count=0,
        download_count=0,
    )
    db.session.add(photo)

    for f in detected:
        db.session.add(
            FaceDetection(
                id=new_id("face"),
                photo_id=photo.id,
                participant_id=None,  # linked later by search / manual tagging
                confidence=f.confidence,
                box_x=f.box["x"],
                box_y=f.box["y"],
                box_w=f.box["width"],
                box_h=f.box["height"],
                embedding=f.embedding.tolist(),
            )
        )

    _advance(job, "indexing_db", 90)
    db.session.commit()

    if job:
        job.detected_faces_count = len(detected)
        job.photo_id = photo.id
        _advance(job, "published", 100)

    return photo
