import base64

from matchmind.security import basic_credentials_valid


def header(username: str, password: str) -> str:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def test_accepts_matching_basic_credentials():
    assert basic_credentials_valid(header("owner", "a-long-password"), "owner", "a-long-password")


def test_rejects_wrong_password_or_username():
    assert not basic_credentials_valid(header("owner", "wrong"), "owner", "a-long-password")
    assert not basic_credentials_valid(header("guest", "a-long-password"), "owner", "a-long-password")


def test_rejects_missing_malformed_and_non_basic_headers():
    assert not basic_credentials_valid("", "owner", "password")
    assert not basic_credentials_valid("Bearer token", "owner", "password")
    assert not basic_credentials_valid("Basic !!!", "owner", "password")
    assert not basic_credentials_valid(header("owner", "password"), "", "password")
