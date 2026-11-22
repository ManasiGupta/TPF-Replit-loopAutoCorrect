"""Explicit development-only schema setup. Never run from app startup or production."""
import os

from .database import Base, get_engine
from . import models  # noqa: F401

if os.environ.get("REPLIT_DEPLOYMENT") == "1" or os.environ.get("NODE_ENV") == "production":
    raise SystemExit("Schema setup is development-only. Production schema is applied through Publish.")

Base.metadata.create_all(get_engine())
print("Loop Phase 1 development schema is ready.")
