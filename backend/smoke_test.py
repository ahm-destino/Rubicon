"""End-to-end proof against the running Flask server on :5000.

Exercises the real pipeline: login -> upload (detect+embed+store) -> selfie
vector search -> participant linking + name search -> storage stats -> single
and ZIP downloads. Prints PASS/FAIL per step and exits non-zero on any failure.
"""
import os
import sys

import insightface
import requests

BASE = "http://localhost:5000"
EVENT = "evt-abia-2026"
PHOTOG = "photo-david-k"
IMG = os.path.join(os.path.dirname(insightface.__file__), "data", "images", "t1.jpg")

fails = []


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("  " + detail if detail else ""))
    if not cond:
        fails.append(name)


# 1) login -------------------------------------------------------------------
r = requests.post(f"{BASE}/api/auth/login",
                  json={"email": "admin@rubicon.io", "password": "rubicon123"})
check("login 200", r.status_code == 200, f"status={r.status_code}")
token = r.json().get("token")
check("login returns token", bool(token))
auth = {"Authorization": f"Bearer {token}"}

# 2) upload t1.jpg (6 faces) -------------------------------------------------
with open(IMG, "rb") as fh:
    r = requests.post(
        f"{BASE}/api/events/{EVENT}/photos",
        headers=auth,
        files={"files": ("t1.jpg", fh, "image/jpeg")},
        data={"photographerId": PHOTOG, "sessionTag": "Keynote", "cameraInfo": "Canon R5"},
    )
check("upload 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
jobs = r.json().get("jobs", [])
job = jobs[0] if jobs else {}
check("upload produced a job", bool(job))
check("job stage published", job.get("stage") == "published", f"stage={job.get('stage')}")
check("job detected 6 faces", job.get("detectedFacesCount") == 6,
      f"count={job.get('detectedFacesCount')}")
photo_id = job.get("photoId")
check("job has photoId", bool(photo_id))

# 3) selfie search with the same image --------------------------------------
with open(IMG, "rb") as fh:
    r = requests.post(f"{BASE}/api/events/{EVENT}/search/selfie",
                      files={"selfie": ("t1.jpg", fh, "image/jpeg")})
check("selfie search 200", r.status_code == 200, f"status={r.status_code}")
results = r.json() if r.status_code == 200 else []
check("selfie search found the photo", len(results) >= 1, f"results={len(results)}")
if results:
    top = results[0]
    check("match is the uploaded photo", top["photo"]["id"] == photo_id)
    check("similarity high (self-match)", top["similarity"] > 0.9,
          f"sim={top.get('similarity')}")
    check("match carries a face box", "box" in top.get("matchedFace", {}))

# 4) no-face selfie -> 422 ---------------------------------------------------
r = requests.post(f"{BASE}/api/events/{EVENT}/search/selfie",
                  json={"selfieBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"})
check("no-face selfie -> 422", r.status_code == 422, f"status={r.status_code}")

# 5) participant linking + name search --------------------------------------
parts = requests.get(f"{BASE}/api/events/{EVENT}/participants").json()
parts = parts if isinstance(parts, list) else parts.get("items", parts)
first = parts[0]
with open(IMG, "rb") as fh:
    requests.post(f"{BASE}/api/events/{EVENT}/search/selfie", headers=auth,
                  files={"selfie": ("t1.jpg", fh, "image/jpeg")},
                  data={"participantId": first["id"]})
r = requests.post(f"{BASE}/api/events/{EVENT}/search/participant",
                  json={"query": first["name"]})
check("participant search 200", r.status_code == 200, f"status={r.status_code}")
body = r.json()
check("participant name search returns photos", len(body.get("results", [])) >= 1,
      f"results={len(body.get('results', []))}")

# 6) storage stats -----------------------------------------------------------
r = requests.get(f"{BASE}/api/events/{EVENT}/storage")
check("storage 200", r.status_code == 200)
vi = r.json().get("vectorIndex", {})
check("vectorIndex dim 512", vi.get("dim") == 512, f"dim={vi.get('dim')}")
check("vectorIndex metric cosine", vi.get("metric") == "cosine")
check("vectorIndex threshold 0.35", abs((vi.get("similarityThreshold") or 0) - 0.35) < 1e-6)
check("vectorIndex indexedFaces == 6", vi.get("indexedFaces") == 6,
      f"indexedFaces={vi.get('indexedFaces')}")

# 7) single download ---------------------------------------------------------
r = requests.get(f"{BASE}/api/photos/{photo_id}/download", allow_redirects=True)
check("single download 200", r.status_code == 200, f"status={r.status_code}")
check("single download is an image", r.headers.get("Content-Type", "").startswith("image/"),
      f"ct={r.headers.get('Content-Type')}")

# 8) ZIP download ------------------------------------------------------------
r = requests.post(f"{BASE}/api/events/{EVENT}/download/zip",
                  json={"photoIds": [photo_id], "filename": "e2e.zip"})
check("zip download 200", r.status_code == 200, f"status={r.status_code}")
check("zip is application/zip", r.headers.get("Content-Type") == "application/zip",
      f"ct={r.headers.get('Content-Type')}")
check("zip has bytes", len(r.content) > 0, f"bytes={len(r.content)}")

print("\nE2E_RESULT=" + ("ALL_PASS" if not fails else "FAILED: " + ", ".join(fails)))
sys.exit(1 if fails else 0)
