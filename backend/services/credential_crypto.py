"""
Token encryption helpers for platform credentials.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from config import GEMINI_KEY, PLATFORM_CREDENTIAL_SECRET


def _build_key() -> bytes:
    seed = PLATFORM_CREDENTIAL_SECRET or GEMINI_KEY or "affiliate-shoppe-default-secret"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


FERNET = Fernet(_build_key())


def encrypt_token(plain: str) -> str:
    return FERNET.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_token(cipher: str) -> str:
    return FERNET.decrypt(cipher.encode("utf-8")).decode("utf-8")

