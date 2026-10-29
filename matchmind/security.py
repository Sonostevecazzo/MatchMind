"""Small authentication helpers for private MatchMind deployments."""
from __future__ import annotations

import base64
import binascii
import hmac


def basic_credentials_valid(header: str, expected_username: str, expected_password: str) -> bool:
    """Validate an HTTP Basic Authorization header without timing-sensitive equality."""
    if not header or not expected_username or not expected_password:
        return False
    scheme, separator, token = header.partition(" ")
    if not separator or scheme.lower() != "basic" or not token.strip():
        return False
    try:
        decoded = base64.b64decode(token.strip(), validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return False
    username, separator, password = decoded.partition(":")
    if not separator:
        return False
    username_ok = hmac.compare_digest(username.encode("utf-8"), expected_username.encode("utf-8"))
    password_ok = hmac.compare_digest(password.encode("utf-8"), expected_password.encode("utf-8"))
    return username_ok and password_ok
