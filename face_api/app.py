"""Private HTTP service for InsightFace inference.

This service deliberately has no database or application code. It accepts an
image from the Rubicon backend and returns only face detections and normalized
embeddings compatible with the existing ``buffalo_sc`` index.
"""
import hmac
import io
import os
import threading

# Set before NumPy / ONNX imports so the 500 MB service does not create a pool
# of worker threads and their stacks for each inference.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image, ImageOps, UnidentifiedImageError

app = Flask(__name__)
# The application downsizes images before inference, so do not reject a valid
# camera photo merely because its original file or pixel dimensions are large.
# Disable Pillow's decompression-bomb ceiling for the same reason.
Image.MAX_IMAGE_PIXELS = 60_000_000
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

MODEL_NAME = os.getenv("FACE_MODEL", "buffalo_sc")
USE_GPU = os.getenv("FACE_USE_GPU", "0").lower() in {"1", "true", "yes", "on"}
DET_SIZE = int(os.getenv("FACE_DET_SIZE", "640" if USE_GPU else "224"))
TOKEN = os.getenv("FACE_API_TOKEN", "")

_model = None
_model_lock = threading.Lock()
_inference_lock = threading.Lock()


def _authorized() -> bool:
    supplied = request.headers.get("X-Face-Api-Token", "")
    return bool(TOKEN) and hmac.compare_digest(supplied, TOKEN)


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from insightface.app import FaceAnalysis

                providers = (["CUDAExecutionProvider", "CPUExecutionProvider"]
                             if USE_GPU else ["CPUExecutionProvider"])
                model = FaceAnalysis(
                    name=MODEL_NAME,
                    allowed_modules=["detection", "recognition"],
                    providers=providers,
                )
                model.prepare(ctx_id=0 if USE_GPU else -1, det_size=(DET_SIZE, DET_SIZE))
                _model = model
    return _model


def _to_bgr(raw: bytes) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError as exc:
        raise ValueError("image is not a supported image file") from exc

    image = ImageOps.exif_transpose(image).convert("RGB")
    if max(image.width, image.height) > 640:
        image.thumbnail((640, 640), Image.Resampling.LANCZOS)
    return np.array(image)[:, :, ::-1].copy()


def _health_response():
    return jsonify({"status": "ok", "model": MODEL_NAME, "loaded": _model is not None})


@app.get("/")
@app.get("/health")
def health():
    """Health endpoint for Render and private-service probes."""
    return _health_response()


@app.post("/detect")
def detect():
    if not _authorized():
        return jsonify({"error": "unauthorized"}), 401
    image = request.files.get("image")
    if image is None:
        return jsonify({"error": "image multipart field is required"}), 400

    try:
        raw = image.read()
        if not raw:
            raise ValueError("image is empty")
        # One inference at a time prevents concurrent ONNX/Pillow allocations
        # from exhausting this small, dedicated service.
        with _inference_lock:
            bgr = _to_bgr(raw)
            height, width = bgr.shape[:2]
            results = []
            for face in _get_model().get(bgr):
                x1, y1, x2, y2 = face.bbox
                results.append({
                    "embedding": np.asarray(face.normed_embedding, dtype=np.float32).tolist(),
                    "box": {
                        "x": max(0.0, float(x1) / width * 100.0),
                        "y": max(0.0, float(y1) / height * 100.0),
                        "width": float(x2 - x1) / width * 100.0,
                        "height": float(y2 - y1) / height * 100.0,
                    },
                    "confidence": float(face.det_score),
                })
        return jsonify({"faces": results})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Face inference failed")
        return jsonify({"error": "face inference failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
