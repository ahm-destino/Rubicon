# Rubicon Backend (Flask + PostgreSQL)

Real backend that replaces the faked in-browser logic. It does genuine photo
storage, **real face detection + 512-d embeddings** (InsightFace / ArcFace), and
**real cosine vector search** over PostgreSQL — the actual thing the UI
used to fake with a hardcoded index list.

## Requirements

- **Python 3.11 or 3.12** ⚠️ (InsightFace / onnxruntime / numpy 1.26 do **not**
  ship wheels for 3.13/3.14 yet — a newer Python will fail at `pip install`).
- **PostgreSQL 14+** (no extensions required — embeddings are stored as native
  `float8[]` arrays and searched with NumPy cosine similarity).

## Setup

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt

cp .env.example .env          # then edit DATABASE_URL, secrets, etc.

# Create DB + role (example)
#   psql -U postgres -c "CREATE ROLE rubicon LOGIN PASSWORD 'rubicon';"
#   psql -U postgres -c "CREATE DATABASE rubicon OWNER rubicon;"

flask --app app init-db       # creates tables
flask --app app seed          # demo event, admin user, roster
flask --app app run -p 5000   # dev server
```

First face request downloads the InsightFace model pack (~300 MB) once.

Demo login: **admin@rubicon.io / rubicon123**

## What's real now

| Capability | Implementation |
|---|---|
| Photo storage | `services/storage.py` — writes original/web/thumb; swappable to S3/GCS |
| Face detection + embeddings | `services/faces.py` — InsightFace ArcFace, 512-d, L2-normalized |
| Selfie → photo search | `services/search.py` — NumPy cosine top-k (`FACE_MATCH_THRESHOLD`) |
| Upload pipeline | `services/ingest.py` — real stage progression via `IngestionJob` |
| Auth | `auth_utils.py` — JWT + Google OpenID sign-in (`blueprints/auth.py`) |
| Persistence | PostgreSQL via SQLAlchemy models in `models.py` |

## Known limitation: Google Photos

Google removed programmatic access to a user's **existing** Photos library on
**2025-03-31**. Auto-importing a photographer's albums is no longer possible for
third-party apps. Options:
- **Direct upload** (implemented): `POST /api/events/<id>/photos`.
- **Photos Picker API** (user hand-picks items): scaffolded behind
  `GOOGLE_PICKER_ENABLED`; `POST /api/google/picker/session` returns `501` with an
  explanation until wired.

## API surface

Auth `/api/auth/{login,me,logout,google/login,google/callback}` ·
Events `/api/events[/<id>[/stats]]` · Photographers
`/api/events/<id>/photographers`, `/api/photographers/<id>` · Participants
`/api/events/<id>/participants`, `/api/participants/<id>` · Photos
`/api/events/<id>/photos` (GET list, POST upload), `/api/photos/<id>`,
`/api/photos/<id>/view`, `/api/ingestion-jobs/<id>` · Search
`/api/events/<id>/search/{selfie,participant}` · Google
`/api/events/<id>/{google-accounts,albums}`, `/api/google/accounts/<id>` ·
Downloads `/api/photos/<id>/download`, `/api/events/<id>/download/zip` · Stats
`/api/events/<id>/storage` · Media `/media/<event>/<file>` · Health `/api/health`
