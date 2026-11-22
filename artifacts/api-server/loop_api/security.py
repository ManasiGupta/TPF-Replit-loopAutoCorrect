import os
import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import HTTPException


def get_cipher() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        # A distinct encryption subkey, not the session signing key itself.
        # The existing stable app secret means end users only supply ElevenLabs.
        root = os.environ.get("SESSION_SECRET", "")
        if len(root.encode()) < 32:
            raise HTTPException(503, "Secure key storage is not configured. The app owner must configure ENCRYPTION_KEY or a stable SESSION_SECRET of at least 32 bytes.")
        derived = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"loop:elevenlabs-key-storage:v1").derive(root.encode())
        key = base64.urlsafe_b64encode(derived).decode("ascii")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeError):
        raise HTTPException(503, "ENCRYPTION_KEY is invalid. It must be a URL-safe base64-encoded 32-byte Fernet key.") from None


def encrypt_api_key(value: str) -> str:
    return get_cipher().encrypt(value.encode()).decode()


def decrypt_api_key(value: str) -> str:
    """Backend use only. Never return decrypted credentials through an API."""
    try:
        return get_cipher().decrypt(value.encode()).decode()
    except (InvalidToken, UnicodeError, ValueError):
        raise HTTPException(503, "The saved credential cannot be decrypted. Restore the original encryption configuration.") from None
