# Rubicon — AI Event Photo Intelligence

Attendees find their event photos by uploading a selfie; the system matches faces
against thousands of shots using real face embeddings and vector search.

Two parts:

- **`backend/`** — Flask API. PostgreSQL, real face detection &
  512-d embeddings via InsightFace, real cosine vector search, JWT + Google OAuth
  sign-in, and a storage abstraction (local disk now, swappable to S3/GCS).
- **`src/`** — React 19 + Vite frontend (JavaScript/JSX), talking to the backend
  through [`src/api.js`](src/api.js).

## Run locally

**1. Backend** (Python 3.11/3.12 + PostgreSQL) — see
[backend/README.md](backend/README.md):

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL, secrets
flask --app app init-db
flask --app app seed            # demo event + admin@rubicon.io / rubicon123
flask --app app run -p 5000
```

**2. Frontend** (Node or Bun):

```bash
bun install        # or: npm install
bun run dev        # or: npm run dev   -> http://localhost:3000
```

The Vite dev server (`:3000`) proxies `/api` and `/media` to Flask (`:5000`), so no
CORS setup is needed in development. Point elsewhere with `VITE_API_BASE`.

## Status of the migration

- ✅ Real Flask backend (was a Gemini shim with random fallbacks).
- ✅ Real storage, face embeddings, and cosine vector search (was a hardcoded match list).
- ✅ Frontend entry + data layer converted to JSX and wired to the API.
- ✅ All interactive components (`ParticipantFinder`, `AdminPanel`,
  `GooglePhotosAlbumSync`, `GoogleOAuthModal`) converted from `.tsx` to `.jsx` and
  wired to the API; the `.tsx` twins and mock data (`src/types.ts`,
  `src/data/mockData.ts`, `src/utils/faceMatcher.ts`) have been removed.
- ✅ Full stack verified end-to-end (store → detect → embed → search → download).

## Note on Google Photos

Google removed programmatic access to a user's **existing** Photos library
(2025-03-31), so auto-importing a photographer's albums is not possible. Rubicon
uses **direct upload** (implemented) and optionally the **Photos Picker API** for
manual selection. See [backend/README.md](backend/README.md).
