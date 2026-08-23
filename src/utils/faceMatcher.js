// Real face search — replaces the old hardcoded index list.
// Both calls hit the Flask backend, which embeds faces (InsightFace) and runs a
// NumPy cosine top-k search. Results already arrive in the
// { photo, matchedFace, similarity } shape the UI renders.
import { api } from '../api';

// Name / registration-ID lookup (server-side). Returns { participant, results }.
// `results` is [{ photo, matchedFace, similarity }], newest linkage first.
export async function searchPhotosByParticipant(eventId, query) {
  const data = await api.searchParticipant(eventId, query);
  return { participant: data.participant || null, results: data.results || [] };
}

// Selfie search: uploads the selfie, embeds it, and returns cosine-matched photos.
// Throws on failure; err.status === 422 means no face was found in the selfie.
export async function matchSelfieToPhotos(eventId, selfieBase64, participantId) {
  return api.searchSelfieBase64(eventId, selfieBase64, participantId || undefined);
}
