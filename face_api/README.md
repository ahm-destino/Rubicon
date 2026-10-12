# Rubicon Face API

This is the isolated InsightFace service. It receives an image from the
Rubicon backend and returns normalized `buffalo_sc` embeddings plus face boxes.
It has no database and should not receive public traffic.

## Deploy on Railway

1. In the existing Railway project, create a new service from the same GitHub
   repository and name it `face-api`.
2. Set the service's **Root Directory** to `face_api`. Railway will use this
   folder's `requirements.txt` and `Procfile`.
3. Set these variables on the `face-api` service:

   ```env
   FACE_MODEL=buffalo_sc
   FACE_USE_GPU=0
   FACE_DET_SIZE=224
   FACE_API_TOKEN=<a-long-random-secret>
   ```

4. Do not generate a public domain for this service. It is called privately by
   the Rubicon backend. After deployment, `GET /health` is available inside the
   Railway project and reports whether the model is loaded.
5. On the existing Rubicon backend service, add:

   ```env
   FACE_API_URL=http://${{face-api.RAILWAY_PRIVATE_DOMAIN}}:${{face-api.PORT}}
   FACE_API_TOKEN=<the-exact-same-long-random-secret>
   FACE_API_TIMEOUT=90
   ```

   Replace `face-api` with the exact Railway service name if you choose a
   different name. Railway resolves this to the service's private domain, so
   the Face API is not exposed to browsers or the public internet.

6. Redeploy the backend. Its existing calls to `detect_faces()` and
   `embed_selfie()` will then call this service automatically. Existing saved
   vectors stay compatible because both systems use `buffalo_sc` with a
   detection size of 224.

## Local run

```powershell
cd face_api
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
$env:FACE_API_TOKEN = 'local-secret'
gunicorn -w 1 --threads 1 -b 0.0.0.0:8080 app:app
```

Set the backend's `FACE_API_URL=http://localhost:8080` and the matching
`FACE_API_TOKEN` to use the local service.
