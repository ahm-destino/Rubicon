"""Shared Flask extension singletons, imported by the app factory and models."""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from authlib.integrations.flask_client import OAuth

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
oauth = OAuth()
# In-memory rate limiting is fine for the dev server / single process.
# For a multi-process production deploy, point storage_uri at Redis.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
