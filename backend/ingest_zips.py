"""
CLI tool to ingest photos directly from ZIP archives into Rubicon event database & Google Drive storage.

Reads images from .zip files directly in memory without needing to extract them to disk first.
Uses SHA-256 hash checking to automatically skip any photo that has already been ingested.

Usage:
    python ingest_zips.py [--dir DIR] [--event EVENT_ID] [--pattern PATTERN] [--photographer PHOTOGRAPHER_ID]
    flask --app app ingest-zips [--dir DIR] [--pattern PATTERN]
"""
import argparse
import glob
import hashlib
import os
import zipfile

from app import app
from extensions import db
from models import Event, Photo, Photographer
from services.ingest import ingest_photo


def batch_ingest_zips(
    downloads_dir: str = r"C:\Users\LENOVO\Downloads",
    event_id: str = "evt-abia-2026",
    pattern: str = "ASLA*.zip",
    photographer_id: str = "photo-david-k",
    session_tag: str = "General",
):
    with app.app_context():
        event = db.session.get(Event, event_id)
        if not event:
            print(f"Error: Event '{event_id}' not found in database.")
            return

        photographer = db.session.get(Photographer, photographer_id)
        if not photographer:
            photographer = Photographer.query.filter_by(event_id=event_id).first()
            if not photographer:
                print(f"Error: No photographer found for event '{event_id}'.")
                return
            photographer_id = photographer.id

        zip_paths = sorted(glob.glob(os.path.join(downloads_dir, pattern)))
        if not zip_paths:
            # Fallback to searching for all .zip files if pattern has no match
            zip_paths = sorted(glob.glob(os.path.join(downloads_dir, "*.zip")))

        if not zip_paths:
            print(f"No ZIP files found matching '{pattern}' in {downloads_dir}")
            return

        print(f"=== Starting Batch ZIP Photo Ingestion ===")
        print(f"Event: {event.name} ({event.id})")
        print(f"Photographer: {photographer.name} ({photographer.id})")
        print(f"ZIP Files Found: {len(zip_paths)}")
        print(f"Source Directory: {downloads_dir}")
        print("=" * 45)

        total_new = 0
        total_skipped = 0
        total_errors = 0
        grand_total_files = 0

        for z_idx, z_path in enumerate(zip_paths, 1):
            z_name = os.path.basename(z_path)
            print(f"\n[ZIP {z_idx}/{len(zip_paths)}] Opening {z_name}...")

            try:
                with zipfile.ZipFile(z_path, "r") as zf:
                    # Find all valid image entries (ignore __MACOSX system entries)
                    img_entries = [
                        name for name in zf.namelist()
                        if not name.startswith("__MACOSX")
                        and not os.path.basename(name).startswith("._")
                        and any(name.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp"))
                    ]

                    print(f"Found {len(img_entries)} photos in {z_name}")

                    for i_idx, name in enumerate(img_entries, 1):
                        grand_total_files += 1
                        fname = os.path.basename(name)

                        try:
                            raw_bytes = zf.read(name)
                            if not raw_bytes:
                                continue

                            # Pre-check: compute hash and query DB directly
                            # (mirrors _find_duplicate in services/ingest.py)
                            content_hash = hashlib.sha256(raw_bytes).hexdigest()
                            is_dup = Photo.query.filter_by(
                                event_id=event_id, content_hash=content_hash
                            ).first() is not None

                            if not is_dup:
                                # Fallback filename check for pre-hash photos
                                is_dup = Photo.query.filter_by(
                                    event_id=event_id, filename=fname
                                ).first() is not None

                            photo = ingest_photo(
                                event_id=event_id,
                                photographer_id=photographer_id,
                                session_tag=session_tag,
                                filename=fname,
                                raw=raw_bytes,
                                camera_info="Batch ZIP Ingestion",
                                job=None,
                            )

                            if is_dup:
                                total_skipped += 1
                                status_str = "SKIPPED (Duplicate)"
                            else:
                                total_new += 1
                                status_str = "NEW -> Saved & Indexed"

                            if i_idx % 10 == 0 or i_idx == len(img_entries):
                                print(f"  [{i_idx}/{len(img_entries)}] {fname} -> {status_str}")

                        except Exception as exc:
                            total_errors += 1
                            print(f"  [{i_idx}/{len(img_entries)}] ERROR on {fname}: {exc}")

            except Exception as z_exc:
                print(f"Failed to read ZIP file {z_name}: {z_exc}")

        print("\n" + "=" * 45)
        print("=== BATCH ZIP INGESTION COMPLETE ===")
        print(f"Total ZIP Archives Processed: {len(zip_paths)}")
        print(f"Total Images Evaluated: {grand_total_files}")
        print(f"  - Newly Ingested Photos: {total_new}")
        print(f"  - Skipped Duplicates: {total_skipped}")
        print(f"  - Failed / Errors: {total_errors}")
        print("=" * 45)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest photos directly from ZIP files.")
    parser.add_argument("--dir", default=r"C:\Users\LENOVO\Downloads", help="Directory containing ZIP files")
    parser.add_argument("--event", default="evt-abia-2026", help="Target Event ID")
    parser.add_argument("--pattern", default="ASLA*.zip", help="ZIP file glob pattern")
    parser.add_argument("--photographer", default="photo-david-k", help="Photographer ID")
    parser.add_argument("--session", default="General", help="Session tag")

    args = parser.parse_args()
    batch_ingest_zips(
        downloads_dir=args.dir,
        event_id=args.event,
        pattern=args.pattern,
        photographer_id=args.photographer,
        session_tag=args.session,
    )
