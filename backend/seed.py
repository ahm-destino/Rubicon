"""
Demo seed: an admin user, one event, its photographers and participant roster,
and the storage-config singleton.

Photos + face embeddings are intentionally NOT seeded — they come from real
uploads through POST /api/events/<id>/photos so every embedding is genuine.
Run with:  flask --app app seed
"""
from werkzeug.security import generate_password_hash

from extensions import db
from models import Event, Participant, Photographer, StorageConfig, User
from services.ids import new_id


def run_seed():
    if not StorageConfig.query.first():
        db.session.add(StorageConfig(
            provider="cloud_storage", provider_name="Rubicon Local Vault",
            connected=True, account_email="vault@rubicon.io",
            storage_used_gb=0.0, storage_total_gb=2000.0, auto_sync=True,
        ))

    if not User.query.filter_by(email="admin@rubicon.io").first():
        db.session.add(User(
            id=new_id("user"), email="admin@rubicon.io", name="Rubicon Admin",
            password_hash=generate_password_hash("rubicon123"), role="admin",
        ))

    event = db.session.get(Event, "evt-abia-2026")
    if not event:
        event = Event(
            id="evt-abia-2026", name="Abia State Leadership Academy 2026", cohort="Cohort '26",
            slug="abia-2026", location="Umuahia, Abia State",
            date="August 10-14, 2026", cover_image="",
            storage_provider="cloud_storage", google_album_id="",
            sessions=["All Sessions", "Keynote", "Workshops", "Networking", "Awards Night"],
        )
        db.session.add(event)

        photographers = [
            ("photo-david-k", "David Kalu", "Lead Photographer", "Canon R5 + 24-70mm f/2.8"),
            ("photo-amara-o", "Amara Obi", "Event Photographer", "Sony A7 IV + 85mm f/1.4"),
            ("photo-tunde-a", "Tunde Ade", "Candid Specialist", "Nikon Z6 II + 35mm f/1.8"),
        ]
        for pid, name, badge, gear in photographers:
            db.session.add(Photographer(
                id=pid, name=name, email=f"{pid}@rubicon.io", badge=badge,
                gear=gear, event_id=event.id, is_online=False,
            ))

        participants = [
            ("Kingsley Nwosu", "ALA-2026-042"),
            ("Chioma Eze", "ALA-2026-018"),
            ("Emeka Okafor", "ALA-2026-091"),
            ("Ngozi Adaeze", "ALA-2026-007"),
            ("Ifeanyi Obi", "ALA-2026-133"),
        ]
        for name, reg in participants:
            db.session.add(Participant(
                id=new_id("part"), name=name, reg_id=reg,
                email=f"{reg.lower()}@example.com", phone="", avatar="",
                event_id=event.id, has_found_photos=False,
            ))

    db.session.commit()
