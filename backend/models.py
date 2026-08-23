"""
SQLAlchemy models for Rubicon.

These mirror src/types.ts one-to-one. Every model exposes to_dict() returning
the exact camelCase JSON shape the React frontend already consumes, so the UI
can drop its mock data and read these responses unchanged.

Face embeddings are stored one row per detected face as a native float array,
enabling real cosine top-k search in NumPy (replacing the hardcoded index list
in src/utils/faceMatcher.ts).
"""
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import ARRAY

from extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat() if dt else None


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class User(db.Model):
    """Admin / photographer login. Participants are unauthenticated."""
    __tablename__ = "users"

    id = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False, index=True)
    name = db.Column(db.String, nullable=False)
    password_hash = db.Column(db.String, nullable=True)  # null when Google-only
    role = db.Column(db.String, nullable=False, default="admin")  # admin | photographer
    google_sub = db.Column(db.String, unique=True, nullable=True)  # Google account id
    avatar = db.Column(db.String, nullable=True)
    photographer_id = db.Column(db.String, db.ForeignKey("photographers.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "avatar": self.avatar,
            "photographerId": self.photographer_id,
        }


# --------------------------------------------------------------------------- #
# Storage config (singleton-ish, keyed by provider)
# --------------------------------------------------------------------------- #
class StorageConfig(db.Model):
    __tablename__ = "storage_config"

    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String, nullable=False, default="cloud_storage")
    provider_name = db.Column(db.String, nullable=False, default="Local Vault")
    connected = db.Column(db.Boolean, default=True)
    account_email = db.Column(db.String, default="")
    storage_used_gb = db.Column(db.Float, default=0.0)
    storage_total_gb = db.Column(db.Float, default=2000.0)
    last_synced_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    auto_sync = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "provider": self.provider,
            "providerName": self.provider_name,
            "connected": self.connected,
            "accountEmail": self.account_email,
            "storageUsedGb": round(self.storage_used_gb, 2),
            "storageTotalGb": round(self.storage_total_gb, 2),
            "lastSyncedAt": iso(self.last_synced_at),
            "autoSync": self.auto_sync,
        }


# --------------------------------------------------------------------------- #
# Storage account (per-event Google Drive; one active + N archived per event)
# --------------------------------------------------------------------------- #
class StorageAccount(db.Model):
    """A cloud storage account connected to a single event. Switching accounts
    archives the current active row (its refresh token is kept so old photos in
    that account keep loading) and inserts a new active row for new uploads."""
    __tablename__ = "storage_account"

    id = db.Column(db.String, primary_key=True)
    event_id = db.Column(db.String, db.ForeignKey("events.id"), nullable=False, index=True)
    provider = db.Column(db.String, nullable=False, default="gdrive")  # gdrive | local
    account_email = db.Column(db.String, default="")
    refresh_token = db.Column(db.Text, nullable=True)   # server-side only, never serialized
    root_folder_id = db.Column(db.String, default="")   # the "Rubicon" folder in that Drive
    status = db.Column(db.String, nullable=False, default="active")  # active | archived
    connected = db.Column(db.Boolean, default=True)
    storage_used_gb = db.Column(db.Float, default=0.0)
    storage_total_gb = db.Column(db.Float, default=0.0)
    connected_by_user_id = db.Column(db.String, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    last_synced_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_provider_dict(self):
        """Map to the exact `provider` JSON shape the admin storage card consumes
        (see StorageConfig.to_dict). Never includes the refresh token."""
        return {
            "provider": self.provider,
            "providerName": "Google Drive" if self.provider == "gdrive" else "Local Vault",
            "connected": self.connected,
            "accountEmail": self.account_email,
            "storageUsedGb": round(self.storage_used_gb or 0.0, 2),
            "storageTotalGb": round(self.storage_total_gb or 0.0, 2),
            "lastSyncedAt": iso(self.last_synced_at),
            "autoSync": False,
            "storageAccountId": self.id,
        }

            
# --------------------------------------------------------------------------- #
# Event
# --------------------------------------------------------------------------- #
class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    cohort = db.Column(db.String, default="")
    slug = db.Column(db.String, unique=True, nullable=False, index=True)
    location = db.Column(db.String, default="")
    date = db.Column(db.String, default="")  # free-form display range
    cover_image = db.Column(db.String, default="")
    storage_provider = db.Column(db.String, default="cloud_storage")
    google_album_id = db.Column(db.String, default="")
    sessions = db.Column(db.JSON, default=list)  # ["All Sessions", ...]

    photographers = db.relationship("Photographer", backref="event", cascade="all, delete-orphan")
    participants = db.relationship("Participant", backref="event", cascade="all, delete-orphan")
    photos = db.relationship("Photo", backref="event", cascade="all, delete-orphan")

    def to_dict(self):
        photos = self.photos
        return {
            "id": self.id,
            "name": self.name,
            "cohort": self.cohort,
            "slug": self.slug,
            "location": self.location,
            "date": self.date,
            "coverImage": self.cover_image,
            "totalPhotos": len(photos),
            "publishedPhotos": sum(1 for p in photos if p.status == "published"),
            "photographerCount": len(self.photographers),
            "participantCount": len(self.participants),
            "retrievedParticipantCount": sum(1 for p in self.participants if p.has_found_photos),
            "storageProvider": self.storage_provider,
            "googleAlbumId": self.google_album_id,
            "sessions": self.sessions or ["All Sessions"],
        }


# --------------------------------------------------------------------------- #
# Photographer
# --------------------------------------------------------------------------- #
class Photographer(db.Model):
    __tablename__ = "photographers"

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    avatar = db.Column(db.String, default="")
    email = db.Column(db.String, default="")
    badge = db.Column(db.String, default="Photographer")
    gear = db.Column(db.String, default="")
    event_id = db.Column(db.String, db.ForeignKey("events.id"), nullable=False, index=True)
    storage_used_mb = db.Column(db.Integer, default=0)
    is_online = db.Column(db.Boolean, default=False)

    photos = db.relationship("Photo", backref="photographer")

    def to_dict(self):
        photos = self.photos
        return {
            "id": self.id,
            "name": self.name,
            "avatar": self.avatar,
            "email": self.email,
            "badge": self.badge,
            "gear": self.gear,
            "eventId": self.event_id,
            "uploadedCount": len(photos),
            "publishedCount": sum(1 for p in photos if p.status == "published"),
            "storageUsedMb": self.storage_used_mb,
            "totalViews": sum(p.view_count for p in photos),
            "totalDownloads": sum(p.download_count for p in photos),
            "isOnline": self.is_online,
        }


# --------------------------------------------------------------------------- #
# Participant
# --------------------------------------------------------------------------- #
class Participant(db.Model):
    __tablename__ = "participants"

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    reg_id = db.Column(db.String, default="", index=True)
    email = db.Column(db.String, default="")
    phone = db.Column(db.String, default="")
    avatar = db.Column(db.String, default="")
    selfie_url = db.Column(db.String, nullable=True)
    event_id = db.Column(db.String, db.ForeignKey("events.id"), nullable=False, index=True)
    last_searched_at = db.Column(db.DateTime(timezone=True), nullable=True)
    has_found_photos = db.Column(db.Boolean, default=False)

    faces = db.relationship("FaceDetection", backref="participant")

    @property
    def matched_count(self):
        return len({f.photo_id for f in self.faces})

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "regId": self.reg_id,
            "email": self.email,
            "phone": self.phone,
            "avatar": self.avatar,
            "selfieUrl": self.selfie_url,
            "eventId": self.event_id,
            "matchedCount": self.matched_count,
            "lastSearchedAt": iso(self.last_searched_at),
            "hasFoundPhotos": self.has_found_photos,
        }


# --------------------------------------------------------------------------- #
# Photo
# --------------------------------------------------------------------------- #
class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.String, primary_key=True)
    google_media_id = db.Column(db.String, default="")   # storage object key
    storage_account_id = db.Column(
        db.String, db.ForeignKey("storage_account.id"), nullable=True, index=True
    )  # which account holds this photo; NULL = legacy local (/media/...)
    storage_meta = db.Column(db.JSON, nullable=True)  # gdrive file ids: {"orig":id,"web":id,"thumb":id}
    event_id = db.Column(db.String, db.ForeignKey("events.id"), nullable=False, index=True)
    photographer_id = db.Column(db.String, db.ForeignKey("photographers.id"), index=True)
    filename = db.Column(db.String, default="")
    url = db.Column(db.String, default="")
    high_res_url = db.Column(db.String, default="")
    thumbnail_url = db.Column(db.String, default="")
    uploaded_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    session_tag = db.Column(db.String, default="")
    camera_info = db.Column(db.String, default="")
    width = db.Column(db.Integer, default=0)
    height = db.Column(db.Integer, default=0)
    status = db.Column(db.String, default="processing")  # published | processing | queued
    view_count = db.Column(db.Integer, default=0)
    download_count = db.Column(db.Integer, default=0)
    exif = db.Column(db.JSON, nullable=True)  # {iso, shutter, aperture, focalLength, capturedAt}

    faces = db.relationship(
        "FaceDetection", backref="photo", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "googleMediaId": self.google_media_id,
            "eventId": self.event_id,
            "photographerId": self.photographer_id,
            "photographerName": self.photographer.name if self.photographer else "",
            "photographerAvatar": self.photographer.avatar if self.photographer else None,
            "filename": self.filename,
            "url": self.url,
            "highResUrl": self.high_res_url,
            "thumbnailUrl": self.thumbnail_url,
            "uploadedAt": iso(self.uploaded_at),
            "sessionTag": self.session_tag,
            "cameraInfo": self.camera_info,
            "dimensions": {"width": self.width, "height": self.height},
            "status": self.status,
            "viewCount": self.view_count,
            "downloadCount": self.download_count,
            "faces": [f.to_dict() for f in self.faces],
            "exif": self.exif,
        }


# --------------------------------------------------------------------------- #
# Face detection (one row per detected face; holds the embedding vector)
# --------------------------------------------------------------------------- #
class FaceDetection(db.Model):
    __tablename__ = "face_detections"

    id = db.Column(db.String, primary_key=True)
    photo_id = db.Column(db.String, db.ForeignKey("photos.id"), nullable=False, index=True)
    participant_id = db.Column(db.String, db.ForeignKey("participants.id"), nullable=True, index=True)
    confidence = db.Column(db.Float, default=0.0)
    # bounding box, percentages 0..100
    box_x = db.Column(db.Float, default=0.0)
    box_y = db.Column(db.Float, default=0.0)
    box_w = db.Column(db.Float, default=0.0)
    box_h = db.Column(db.Float, default=0.0)
    embedding = db.Column(ARRAY(db.Float), nullable=True)
    expression = db.Column(db.String, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "photoId": self.photo_id,
            "participantId": self.participant_id,
            "participantName": self.participant.name if self.participant else None,
            "confidence": round(self.confidence, 4),
            "box": {
                "x": self.box_x,
                "y": self.box_y,
                "width": self.box_w,
                "height": self.box_h,
            },
            "expression": self.expression,
        }


# --------------------------------------------------------------------------- #
# Ingestion job (real pipeline state; replaces the setTimeout theater)
# --------------------------------------------------------------------------- #
class IngestionJob(db.Model):
    __tablename__ = "ingestion_jobs"

    id = db.Column(db.String, primary_key=True)
    filename = db.Column(db.String, default="")
    photographer_id = db.Column(db.String, db.ForeignKey("photographers.id"))
    event_id = db.Column(db.String, db.ForeignKey("events.id"), index=True)
    session_tag = db.Column(db.String, default="")
    stage = db.Column(db.String, default="uploading_storage")
    progress = db.Column(db.Integer, default=0)
    google_media_id = db.Column(db.String, default="")
    detected_faces_count = db.Column(db.Integer, default=0)
    preview_url = db.Column(db.String, default="")
    photo_id = db.Column(db.String, nullable=True)
    error = db.Column(db.String, nullable=True)
    started_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "photographerId": self.photographer_id,
            "eventId": self.event_id,
            "sessionTag": self.session_tag,
            "stage": self.stage,
            "progress": self.progress,
            "googleMediaId": self.google_media_id,
            "detectedFacesCount": self.detected_faces_count,
            "previewUrl": self.preview_url,
            "photoId": self.photo_id,
            "error": self.error,
            "startedAt": int(self.started_at.timestamp() * 1000) if self.started_at else None,
        }
