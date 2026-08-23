"""
Google Drive v3 REST helper (per-event storage backend).

Talks to Drive directly over HTTPS with `requests` — no google-api-python-client
dependency. Authenticates as the connecting user via a stored OAuth refresh token
(never a service account, which has no usable Drive quota). Only the `drive.file`
scope is used, so Rubicon can only see the folder + files it creates.

Access tokens are short-lived; we cache them in-process keyed by refresh token and
refresh on demand.
"""
import json
import time
import uuid

import requests

from config import Config

TOKEN_URL = "https://oauth2.googleapis.com/token"
FILES_URL = "https://www.googleapis.com/drive/v3/files"
UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
ABOUT_URL = "https://www.googleapis.com/drive/v3/about"
FOLDER_MIME = "application/vnd.google-apps.folder"

_TIMEOUT = 60
# refresh_token -> (access_token, expires_at_epoch). Process-local cache.
_token_cache: dict[str, tuple[str, float]] = {}


class DriveError(RuntimeError):
    """Raised when a Drive API call fails."""


def _check(resp, action):
    if not resp.ok:
        raise DriveError(f"Drive {action} failed ({resp.status_code}): {resp.text[:300]}")
    return resp


def access_token_for(refresh_token: str) -> str:
    """Return a valid access token for this refresh token, refreshing if needed."""
    if not refresh_token:
        raise DriveError("no refresh token for this storage account")
    cached = _token_cache.get(refresh_token)
    if cached and cached[1] - 30 > time.time():
        return cached[0]

    resp = requests.post(TOKEN_URL, data={
        "client_id": Config.GOOGLE_CLIENT_ID,
        "client_secret": Config.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=_TIMEOUT)
    _check(resp, "token refresh")
    data = resp.json()
    token = data["access_token"]
    _token_cache[refresh_token] = (token, time.time() + int(data.get("expires_in", 3600)))
    return token


def create_folder(access_token: str, name: str, parent_id: str | None = None) -> str:
    """Create a folder and return its id."""
    body = {"name": name, "mimeType": FOLDER_MIME}
    if parent_id:
        body["parents"] = [parent_id]
    resp = requests.post(
        FILES_URL, params={"fields": "id"},
        headers={"Authorization": f"Bearer {access_token}"},
        json=body, timeout=_TIMEOUT,
    )
    _check(resp, "create folder")
    return resp.json()["id"]


def upload_file(access_token: str, folder_id: str, filename: str,
                data: bytes, mime: str = "image/jpeg") -> str:
    """Multipart-upload bytes into folder_id and return the new file id."""
    boundary = f"rubicon_{uuid.uuid4().hex}"
    metadata = {"name": filename, "parents": [folder_id]}
    body = (
        f"--{boundary}\r\n"
        "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()

    resp = requests.post(
        UPLOAD_URL, params={"uploadType": "multipart", "fields": "id"},
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
        },
        data=body, timeout=_TIMEOUT,
    )
    _check(resp, "upload")
    return resp.json()["id"]


def download_stream(access_token: str, file_id: str) -> requests.Response:
    """Return a streamed response for a file's bytes (caller iterates content)."""
    resp = requests.get(
        f"{FILES_URL}/{file_id}", params={"alt": "media"},
        headers={"Authorization": f"Bearer {access_token}"},
        stream=True, timeout=_TIMEOUT,
    )
    return _check(resp, "download")


def delete_file(access_token: str, file_id: str) -> None:
    """Delete a file. Missing files (404) are treated as already-gone."""
    resp = requests.delete(
        f"{FILES_URL}/{file_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=_TIMEOUT,
    )
    if resp.status_code not in (204, 200, 404):
        _check(resp, "delete")


def get_quota(access_token: str) -> tuple[float, float]:
    """Return (used_gb, total_gb) from the account's Drive quota. total_gb is 0
    when the account has no fixed limit (e.g. unlimited/pooled)."""
    resp = requests.get(
        ABOUT_URL, params={"fields": "storageQuota"},
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=_TIMEOUT,
    )
    _check(resp, "about")
    q = resp.json().get("storageQuota", {})
    gb = 1024 ** 3
    used = int(q.get("usage", 0)) / gb
    total = int(q["limit"]) / gb if q.get("limit") else 0.0
    return round(used, 2), round(total, 2)
