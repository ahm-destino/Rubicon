"""
Face detection + embedding with InsightFace, locally or through the Face API.

detect_faces() / embed_selfie() are the public interface used by
services/ingest.py and blueprints/search.py. Embeddings are 512-d and
L2-normalized, so cosine similarity == dot product (services/search.py).

The model is lazy-loaded (heavy import on first call) so the Flask app and
`flask db` migrations boot without touching ML.
"""
import io
import os
import threading

# Limit OpenMP/BLAS thread allocation for ONNXRuntime on low-memory containers (Railway 512MB RAM)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import numpy as np
import requests
from PIL import Image, ImageOps

from config import Config


class DetectedFace:
    def __init__(self, embedding, box_pct, det_score):
        self.embedding = embedding      # np.ndarray (dim,), L2-normalized
        self.box = box_pct              # dict x,y,width,height as percentages 0..100
        self.confidence = det_score     # detector confidence 0..1


_APP = None
_LOCK = threading.Lock()


class FaceServiceError(RuntimeError):
    """The remote face service could not process an image."""


def _get_app():
    global _APP
    if _APP is None:
        with _LOCK:
            if _APP is None:
                from insightface.app import FaceAnalysis  # lazy, heavy

                providers = (
                    ["CUDAExecutionProvider", "CPUExecutionProvider"]
                    if Config.FACE_USE_GPU
                    else ["CPUExecutionProvider"]
                )
                det_dim = int(os.getenv("FACE_DET_SIZE", "224" if not Config.FACE_USE_GPU else "640"))
                # Load only detection + recognition modules (cuts RAM usage to ~150MB)
                app = FaceAnalysis(
                    name=Config.FACE_MODEL,
                    allowed_modules=["detection", "recognition"],
                    providers=providers
                )
                app.prepare(ctx_id=0 if Config.FACE_USE_GPU else -1, det_size=(det_dim, det_dim))
                _APP = app
    return _APP


def warm_up():
    """Asynchronously or synchronously pre-warm the model."""
    # With a remote service configured, the web process must never import the
    # model as that defeats the purpose of splitting inference out.
    if Config.FACE_API_URL:
        return
    try:
        _get_app()
    except Exception as e:
        print(f"[faces] Warm-up warning: {e}")


def _to_bgr(raw: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img).convert("RGB")
    # Downscale image to max 640px on CPU containers to keep ONNX tensor memory tiny
    max_dim = 640 if not Config.FACE_USE_GPU else 1280
    if max(img.width, img.height) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    arr = np.array(img)  # RGB
    return arr[:, :, ::-1].copy()  # -> BGR for insightface


def detect_faces(raw: bytes):
    """Return a list[DetectedFace] for every face in the image bytes."""
    if Config.FACE_API_URL:
        return _detect_remote(raw)

    app = _get_app()
    bgr = _to_bgr(raw)
    h, w = bgr.shape[:2]
    out = []
    for f in app.get(bgr):
        emb = np.asarray(f.normed_embedding, dtype=np.float32)
        x1, y1, x2, y2 = f.bbox
        box = {
            "x": max(0.0, float(x1) / w * 100.0),
            "y": max(0.0, float(y1) / h * 100.0),
            "width": float(x2 - x1) / w * 100.0,
            "height": float(y2 - y1) / h * 100.0,
        }
        out.append(DetectedFace(emb, box, float(f.det_score)))
    return out


def _detect_remote(raw: bytes):
    """Use the isolated Face API while preserving the local result contract."""
    if not Config.FACE_API_TOKEN:
        raise FaceServiceError("FACE_API_TOKEN must be set when FACE_API_URL is configured")

    try:
        response = requests.post(
            f"{Config.FACE_API_URL}/detect",
            files={"image": ("image.jpg", raw, "application/octet-stream")},
            headers={"X-Face-Api-Token": Config.FACE_API_TOKEN},
            timeout=Config.FACE_API_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise FaceServiceError("Face API is unavailable") from exc

    if not response.ok:
        try:
            message = response.json().get("error", response.text)
        except ValueError:
            message = response.text
        raise FaceServiceError(f"Face API rejected the image: {message}")

    try:
        payload = response.json()
        return [
            DetectedFace(
                np.asarray(face["embedding"], dtype=np.float32),
                face["box"],
                float(face["confidence"]),
            )
            for face in payload["faces"]
        ]
    except (KeyError, TypeError, ValueError) as exc:
        raise FaceServiceError("Face API returned an invalid response") from exc


def embed_selfie(raw: bytes):
    """Embed the single most prominent face in a selfie; None if no face found."""
    faces = detect_faces(raw)
    if not faces:
        return None
    # Largest box == closest / most prominent face.
    faces.sort(key=lambda f: f.box["width"] * f.box["height"], reverse=True)
    return faces[0].embedding

