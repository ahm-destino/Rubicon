"""
Face detection + embedding with InsightFace, running in-process.

detect_faces() / embed_selfie() are the public interface used by
services/ingest.py and blueprints/search.py. Embeddings are 512-d and
L2-normalized, so cosine similarity == dot product (services/search.py).

The model is lazy-loaded (heavy import on first call) so the Flask app and
`flask db` migrations boot without touching ML.
"""
import io

import numpy as np
from PIL import Image

from config import Config


class DetectedFace:
    def __init__(self, embedding, box_pct, det_score):
        self.embedding = embedding      # np.ndarray (dim,), L2-normalized
        self.box = box_pct              # dict x,y,width,height as percentages 0..100
        self.confidence = det_score     # detector confidence 0..1


_APP = None


def _get_app():
    global _APP
    if _APP is None:
        from insightface.app import FaceAnalysis  # lazy, heavy

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if Config.FACE_USE_GPU
            else ["CPUExecutionProvider"]
        )
        app = FaceAnalysis(name=Config.FACE_MODEL, providers=providers)
        app.prepare(ctx_id=0 if Config.FACE_USE_GPU else -1, det_size=(640, 640))
        _APP = app
    return _APP


def _to_bgr(raw: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)  # RGB
    return arr[:, :, ::-1].copy()  # -> BGR for insightface


def detect_faces(raw: bytes):
    """Return a list[DetectedFace] for every face in the image bytes."""
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
