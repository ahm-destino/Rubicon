"""
Vector search over stored face embeddings using NumPy cosine similarity.

This is the real "Instant Vector Search" the ArchitectureModal advertises and
the direct replacement for the hardcoded match list in src/utils/faceMatcher.ts.
Embeddings are stored as native float arrays; at event scale a brute-force
cosine scan in NumPy is fast enough and needs no database extension.
"""
import numpy as np

from config import Config
from extensions import db
from models import FaceDetection, Photo


def search_by_embedding(event_id: str, embedding: np.ndarray, limit: int = 60,
                        threshold: float = None):
    """
    Return [(FaceDetection, similarity)] whose faces are the nearest neighbours of
    `embedding` within an event, filtered by cosine-similarity threshold and sorted
    best-first. similarity = 1 - cosine_distance.
    """
    if threshold is None:
        threshold = Config.FACE_MATCH_THRESHOLD

    query_vec = np.asarray(embedding, dtype=np.float32).ravel()
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return []
    query_vec = query_vec / query_norm

    rows = (
        db.session.query(FaceDetection)
        .join(Photo, FaceDetection.photo_id == Photo.id)
        .filter(Photo.event_id == event_id)
        .filter(FaceDetection.embedding.isnot(None))
        .all()
    )

    # Cosine similarity in NumPy. Embeddings are L2-normalized at ingest, but we
    # renormalize defensively so the cosine score is exact regardless of source.
    scored = []
    for face in rows:
        vec = np.asarray(face.embedding, dtype=np.float32).ravel()
        norm = np.linalg.norm(vec)
        if norm == 0:
            continue
        similarity = float(np.dot(query_vec, vec / norm))
        scored.append((face, similarity))

    # Nearest-first, take top-k, then apply the similarity threshold — same
    # ordering/limit semantics as the previous SQL (ORDER BY distance LIMIT k).
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [(face, sim) for face, sim in scored[:limit] if sim >= threshold]
