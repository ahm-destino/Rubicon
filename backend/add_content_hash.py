"""
Migration: add content_hash to photos and skipped_duplicate_of to ingestion_jobs.

Run once with:  python add_content_hash.py

Safe to run multiple times — uses IF NOT EXISTS so it won't fail if the
columns are already there. Existing rows are left with NULL content_hash;
the ingest pipeline will backfill them on the next upload attempt via the
filename-fallback path.
"""
import sys
import os

# Allow running from the backend/ directory directly
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from extensions import db

app = create_app()

MIGRATIONS = [
    # photos: content hash (SHA-256 hex, 64 chars)
    """
    ALTER TABLE photos
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
    """,
    # Create an index for fast duplicate lookups
    """
    CREATE INDEX IF NOT EXISTS ix_photos_content_hash
    ON photos (content_hash);
    """,
    # ingestion_jobs: which existing photo caused this job to be skipped
    """
    ALTER TABLE ingestion_jobs
    ADD COLUMN IF NOT EXISTS skipped_duplicate_of VARCHAR
    REFERENCES photos(id) ON DELETE SET NULL;
    """,
]

with app.app_context():
    conn = db.engine.connect()
    for sql in MIGRATIONS:
        try:
            conn.execute(db.text(sql.strip()))
            conn.commit()
            print(f"OK: {sql.strip()[:60]}...")
        except Exception as e:
            print(f"WARN (skipping): {e}")
    conn.close()
    print("\nMigration complete.")
