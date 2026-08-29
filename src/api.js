
// Central API client for the Rubicon Flask backend.
// In dev, Vite proxies /api and /media to the Flask server (see vite.config.js),
// so relative URLs work. Override with VITE_API_BASE for a separate host.
//
// Auth is a httpOnly cookie set by the backend (not readable by JS), so every
// request just sends credentials; there is no token to store or attach.

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive the rubicon_token httpOnly cookie
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = { error: res.statusText }; }
    const err = new Error(detail.error || detail.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res;
}

export const api = {
  base: BASE,

  // --- auth ---
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  changePassword: (body) => request('/api/auth/change-password', { method: 'POST', body }),
  // Full-page redirect to the server's Google OAuth start. The callback sets the
  // auth cookie and redirects back to the SPA (no token in the URL).
  googleLoginUrl: (params) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return `${BASE}/api/auth/google/login${qs}`;
  },

  // --- users (admin account management) ---
  listUsers: () => request('/api/users'),
  createUser: (body) => request('/api/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),

  // --- events ---
  listEvents: () => request('/api/events'),
  getEvent: (id) => request(`/api/events/${id}`),
  eventStats: (id) => request(`/api/events/${id}/stats`),
  createEvent: (data) => request('/api/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/api/events/${id}`, { method: 'PATCH', body: data }),
  deleteEvent: (id) => request(`/api/events/${id}`, { method: 'DELETE' }),

  // --- photographers ---
  listPhotographers: (eventId) => request(`/api/events/${eventId}/photographers`),
  createPhotographer: (eventId, data) =>
    request(`/api/events/${eventId}/photographers`, { method: 'POST', body: data }),
  updatePhotographer: (id, data) => request(`/api/photographers/${id}`, { method: 'PATCH', body: data }),
  deletePhotographer: (id) => request(`/api/photographers/${id}`, { method: 'DELETE' }),

  // --- participants ---
  listParticipants: (eventId, { filter = 'all', q = '' } = {}) =>
    request(`/api/events/${eventId}/participants?filter=${filter}&q=${encodeURIComponent(q)}`),
  createParticipants: (eventId, data) =>
    request(`/api/events/${eventId}/participants`, { method: 'POST', body: data }),
  updateParticipant: (id, data) => request(`/api/participants/${id}`, { method: 'PATCH', body: data }),
  deleteParticipant: (id) => request(`/api/participants/${id}`, { method: 'DELETE' }),
  // Read-only: photos this attendee's face has been linked to.
  participantPhotos: (id) => request(`/api/participants/${id}/photos`),

  // --- photos ---
  listPhotos: (eventId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/events/${eventId}/photos${qs ? `?${qs}` : ''}`);
  },
  getPhoto: (id) => request(`/api/photos/${id}`),
  bumpView: (id) => request(`/api/photos/${id}/view`, { method: 'POST' }),
  uploadPhotos: (eventId, formData) =>
    request(`/api/events/${eventId}/photos`, { method: 'POST', body: formData, isForm: true }),
  deletePhoto: (id) => request(`/api/photos/${id}`, { method: 'DELETE' }),
  getJob: (id) => request(`/api/ingestion-jobs/${id}`),

  // --- search (real vector face match) ---
  searchSelfie: (eventId, formData) =>
    request(`/api/events/${eventId}/search/selfie`, { method: 'POST', body: formData, isForm: true }),
  searchSelfieBase64: (eventId, selfieBase64, participantId) =>
    request(`/api/events/${eventId}/search/selfie`, {
      method: 'POST', body: { selfieBase64, participantId },
    }),
  searchParticipant: (eventId, query) =>
    request(`/api/events/${eventId}/search/participant`, { method: 'POST', body: { query } }),

  // --- downloads ---
  photoDownloadUrl: (id) => `${BASE}/api/photos/${id}/download`,
  downloadZip: (eventId, photoIds, filename) =>
    request(`/api/events/${eventId}/download/zip`, {
      method: 'POST', body: { photoIds, filename },
    }),

  // --- stats ---
  storageStats: (eventId) => request(`/api/events/${eventId}/storage`),
  // Full-page redirect that starts the per-event Google Drive OAuth connect
  // (server round-trip; the callback redirects back to the SPA). Same pattern as
  // googleLoginUrl — a URL string, not a fetch.
  driveConnectUrl: (eventId) => `${BASE}/api/events/${eventId}/storage/connect`,
  disconnectStorage: (eventId) =>
    request(`/api/events/${eventId}/storage/disconnect`, { method: 'POST' }),
  health: () => request('/api/health'),

  // --- google photos picker ---
  createPickerSession: (accessToken) =>
    request('/api/auth/google/picker/session', { method: 'POST', body: { access_token: accessToken } }),
  pollPickerSession: (sessionId) =>
    request(`/api/auth/google/picker/session/${sessionId}`),
  ingestFromPicker: (eventId, body) =>
    request(`/api/events/${eventId}/photos/from-picker`, { method: 'POST', body }),
};


export default api;
