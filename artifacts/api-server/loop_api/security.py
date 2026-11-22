import os

from cryptography.fernet import Fernet
from fastapi import HTTPException


def get_cipher() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise HTTPException(503, "ENCRYPTION_KEY is missing. Configure a Fernet encryption key in Secrets before saving connections.")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeError):
        raise HTTPException(503, "ENCRYPTION_KEY is invalid. It must be a URL-safe base64-encoded 32-byte Fernet key.") from None


def encrypt_api_key(value: str) -> str:
    return get_cipher().encrypt(value.encode()).decode()
