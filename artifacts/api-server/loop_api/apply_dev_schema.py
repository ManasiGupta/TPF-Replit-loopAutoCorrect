"""Explicit development-only schema setup. Never run from app startup or production."""
import os

from .database import get_engine
from .migrations import apply_schema

if os.environ.get("REPLIT_DEPLOYMENT") == "1" or os.environ.get("NODE_ENV") == "production":
    raise SystemExit("Schema setup is development-only. Apply the reviewed ownership migration explicitly before a production rollout.")

apply_schema(get_engine())
print("Loop development schema and private ownership are ready.")
