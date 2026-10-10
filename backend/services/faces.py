"""
Face detection + embedding with InsightFace, running in-process.

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
from PIL import Image, ImageOps

from config import Config


class DetectedFace:
    def __init__(self, embedding, box_pct, det_score):
        self.embedding = embedding      # np.ndarray (dim,), L2-normalized
        self.box = box_pct              # dict x,y,width,height as percentages 0..100
        self.confidence = det_score     # detector confidence 0..1


_APP = None
_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.BoundedSemaphore(Config.FACE_MAX_CONCURRENT)


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
    try:
        _get_app()
    except Exception as e:
        print(f"[faces] Warm-up warning: {e}")


def _to_bgr(raw: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(raw))
    if img.width * img.height > Config.MAX_IMAGE_PIXELS:
        raise ValueError(
            f"Image has too many pixels ({img.width}x{img.height}); "
            f"limit is {Config.MAX_IMAGE_PIXELS:,} pixels"
        )
    img = ImageOps.exif_transpose(img).convert("RGB")
    # Downscale image to max 640px on CPU containers to keep ONNX tensor memory tiny
    max_dim = 640 if not Config.FACE_USE_GPU else 1280
    if max(img.width, img.height) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    arr = np.array(img)  # RGB
    return arr[:, :, ::-1].copy()  # -> BGR for insightface


def detect_faces(raw: bytes):
    """Return a list[DetectedFace] for every face in the image bytes."""
    # ONNX and image conversion allocate sizeable temporary buffers. Serialize
    # them so concurrent requests do not push a 500 MB worker into OOM.
    with _INFERENCE_LOCK:
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


def embed_selfie(raw: bytes):
    """Embed the single most prominent face in a selfie; None if no face found."""
    faces = detect_faces(raw)
    if not faces:
        return None
    # Largest box == closest / most prominent face.
    faces.sort(key=lambda f: f.box["width"] * f.box["height"], reverse=True)
    return faces[0].embedding
