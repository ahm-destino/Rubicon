"""Check if 'skipped' photos actually have live Drive files."""
import requests as http
from app import app
from models import Photo, StorageAccount
from services import gdrive

names = ["ALA02224.JPG", "ALA02225.JPG", "ALA02228.JPG", "ALA02223.JPG"]

with app.app_context():
    for name in names:
        p = Photo.query.filter_by(event_id="evt-abia-2026", filename=name).first()
        if not p:
            print(f"{name}: NOT IN DB AT ALL")
            continue

        acct = StorageAccount.query.get(p.storage_account_id) if p.storage_account_id else None
        print(f"\n{name}:")
        print(f"  photo_id        : {p.id}")
        print(f"  storage_acct    : {p.storage_account_id}")
        print(f"  acct status     : {acct.status if acct else 'N/A'} | connected: {acct.connected if acct else 'N/A'}")

        if not acct or not acct.refresh_token:
            print("  ❌ No refresh token — Drive file unreachable")
            continue

        try:
            token = gdrive.access_token_for(acct.refresh_token)
            fid = p.storage_meta.get("web")
            r = http.get(
                f"https://www.googleapis.com/drive/v3/files/{fid}",
                headers={"Authorization": f"Bearer {token}"},
                params={"fields": "id,name,trashed"},
                timeout=8,
            )
            if r.status_code == 200:
                data = r.json()
                trashed = data.get("trashed", False)
                print(f"  [OK]  Drive file exists | name={data.get('name')} | trashed={trashed}")
            elif r.status_code == 404:
                print(f"  [404] Drive file MISSING -- does not exist on Drive")
            else:
                print(f"  [ERR] Drive returned HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"  [FAIL] Drive check failed: {e}")
