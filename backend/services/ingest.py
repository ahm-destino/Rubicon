"""
Ingestion pipeline: bytes -> storage -> face detection/embeddings -> DB rows.

Runs the real stages the UI used to fake with setTimeout in AdminPanel.handleBatchUpload
and GooglePhotosAlbumSync.handleSyncAlbum. When an IngestionJob is passed, its stage /
progress are advanced as real work completes so the frontend can poll actual state.
"""
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


def ingest_photo(event_id, photographer_id, session_tag, filename, raw, camera_info="", job=None):
    """Store one image, detect+embed its faces, persist Photo + FaceDetection rows."""
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
