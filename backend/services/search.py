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

    # Vectorized cosine similarity using 2D NumPy matrix dot product.
    valid_faces = []
    matrix_list = []
    for face in rows:
        if face.embedding and len(face.embedding) > 0:
            valid_faces.append(face)
            matrix_list.append(face.embedding)

    if not matrix_list:
        return []

    # Convert to 2D numpy array shape (N, dim)
    matrix = np.array(matrix_list, dtype=np.float32)

    # Normalize matrix rows defensively
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    norm_matrix = matrix / norms

    # Matrix-vector dot product (C/BLAS accelerated) -> shape (N,)
    similarities = np.dot(norm_matrix, query_vec)

    # Filter by threshold and take top-k
    valid_mask = similarities >= threshold
    if not np.any(valid_mask):
        return []

    matching_indices = np.where(valid_mask)[0]
    sorted_indices = matching_indices[np.argsort(-similarities[matching_indices])[:limit]]

    return [(valid_faces[idx], float(similarities[idx])) for idx in sorted_indices]
