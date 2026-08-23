"""Stable, URL-safe id generation. Avoids Math.random-style collisions."""
import secrets


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(6)}"
