"""API-Football v3 client with pagination and sanitized provider errors.

The adapter never fabricates data and never includes API credentials in errors.
"""
from __future__ import annotations

import os
from typing import Any, Mapping

import httpx

DEFAULT_BASE_URL = "https://v3.football.api-sports.io"
SOURCE_ROOT = "https://www.api-football.com/documentation-v3"


class ProviderError(RuntimeError):
    """Base error for provider integration failures."""


class ProviderConfigurationError(ProviderError):
    """Raised if required credentials are not configured."""


class ProviderAPIError(ProviderError):
    """A sanitized remote API, quota, or response error."""


class ApiFootballClient:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 20.0,
        http_client: httpx.Client | None = None,
        max_pages: int = 50,
    ) -> None:
        self.api_key = (api_key if api_key is not None else os.getenv("API_FOOTBALL_KEY", "")).strip()
        self.base_url = base_url.rstrip("/")
        self.max_pages = max(1, int(max_pages))
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(timeout=timeout)

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> "ApiFootballClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _request_page(self, endpoint: str, params: Mapping[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ProviderConfigurationError(
                "API-Football is not configured. Set API_FOOTBALL_KEY in the local environment or a secrets manager."
            )
        clean_endpoint = endpoint.strip("/")
        try:
            response = self._http.get(
                f"{self.base_url}/{clean_endpoint}",
                params=dict(params),
                headers={"x-apisports-key": self.api_key, "Accept": "application/json"},
            )
        except httpx.TimeoutException as exc:
            raise ProviderAPIError("API-Football request timed out; retry later.") from exc
        except httpx.RequestError as exc:
            raise ProviderAPIError("API-Football could not be reached; check connectivity.") from exc

        if response.status_code == 401:
            raise ProviderAPIError("API-Football rejected authentication (HTTP 401); verify the API key.")
        if response.status_code == 403:
            raise ProviderAPIError("API-Football denied access (HTTP 403); verify subscription and endpoint coverage.")
        if response.status_code == 429:
            raise ProviderAPIError("API-Football request quota/rate limit reached (HTTP 429); retry after the provider reset.")
        if response.status_code >= 400:
            raise ProviderAPIError(f"API-Football returned HTTP {response.status_code}.")
        try:
            body = response.json()
        except ValueError as exc:
            raise ProviderAPIError("API-Football returned invalid JSON.") from exc
        if not isinstance(body, dict):
            raise ProviderAPIError("API-Football returned an unexpected response shape.")
        errors = body.get("errors")
        if errors:
            if isinstance(errors, dict):
                # API errors do not include request headers; never echo the configured key.
                detail = "; ".join(f"{k}: {v}" for k, v in errors.items())
            elif isinstance(errors, list):
                detail = "; ".join(str(v) for v in errors)
            else:
                detail = str(errors)
            if self.api_key:
                detail = detail.replace(self.api_key, "[REDACTED]")
            raise ProviderAPIError(f"API-Football reported an API error: {detail[:500]}")
        return body

    def get_all(self, endpoint: str, params: Mapping[str, Any]) -> list[dict[str, Any]]:
        """Read all pages for an endpoint, with a defensive maximum page count."""
        results: list[dict[str, Any]] = []
        query = dict(params)
        current_page = 1
        total_pages = 1
        while current_page <= min(total_pages, self.max_pages):
            body = self._request_page(endpoint, {**query, "page": current_page})
            rows = body.get("response", [])
            if not isinstance(rows, list):
                raise ProviderAPIError(f"API-Football endpoint {endpoint!r} returned a non-list response.")
            if not all(isinstance(row, dict) for row in rows):
                raise ProviderAPIError(f"API-Football endpoint {endpoint!r} returned malformed records.")
            results.extend(rows)
            paging = body.get("paging") or {}
            if isinstance(paging, dict):
                try:
                    total_pages = max(1, int(paging.get("total", 1)))
                except (TypeError, ValueError):
                    total_pages = 1
            if current_page >= total_pages:
                break
            current_page += 1
        if total_pages > self.max_pages:
            raise ProviderAPIError(
                f"API-Football response exceeds the safety limit of {self.max_pages} pages; narrow the query."
            )
        return results

    @staticmethod
    def _validate_league_season(league: int, season: int) -> dict[str, int]:
        if int(league) <= 0:
            raise ValueError("league must be a positive API-Football league ID")
        if int(season) < 2000 or int(season) > 2100:
            raise ValueError("season must be a four-digit year between 2000 and 2100")
        return {"league": int(league), "season": int(season)}

    def fixtures(
        self,
        league: int,
        season: int,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        timezone: str = "UTC",
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = self._validate_league_season(league, season)
        if date_from:
            params["from"] = date_from
        if date_to:
            params["to"] = date_to
        if date_from and date_to and date_from > date_to:
            raise ValueError("date_from must be on or before date_to")
        params["timezone"] = timezone
        return self.get_all("fixtures", params)

    def injuries(
        self,
        league: int,
        season: int,
        *,
        date: str | None = None,
        fixture: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = self._validate_league_season(league, season)
        if date:
            params["date"] = date
        if fixture is not None:
            if int(fixture) <= 0:
                raise ValueError("fixture must be a positive fixture ID")
            params["fixture"] = int(fixture)
        return self.get_all("injuries", params)

    def odds(
        self,
        league: int,
        season: int,
        *,
        date: str | None = None,
        bookmaker: int | None = None,
        timezone: str = "UTC",
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = self._validate_league_season(league, season)
        if date:
            params["date"] = date
        if bookmaker is not None:
            if int(bookmaker) <= 0:
                raise ValueError("bookmaker must be a positive bookmaker ID")
            params["bookmaker"] = int(bookmaker)
        params["timezone"] = timezone
        return self.get_all("odds", params)

    def team_statistics(self, league: int, season: int, team: int) -> dict[str, Any]:
        params = self._validate_league_season(league, season)
        if int(team) <= 0:
            raise ValueError("team must be a positive team ID")
        body = self._request_page("teams/statistics", {**params, "team": int(team)})
        payload = body.get("response")
        if not isinstance(payload, dict):
            raise ProviderAPIError("API-Football team statistics response is malformed.")
        return payload

    def league_coverage(self, league: int, season: int) -> dict[str, Any]:
        params = self._validate_league_season(league, season)
        rows = self.get_all("leagues", params)
        for row in rows:
            for season_row in row.get("seasons") or []:
                if int(season_row.get("year", -1)) == int(season):
                    return {"league": row.get("league"), "country": row.get("country"), "season": season_row}
        raise ProviderAPIError("API-Football did not return coverage metadata for this league and season.")

    def player_statistics(self, league: int, season: int, team: int) -> list[dict[str, Any]]:
        params = self._validate_league_season(league, season)
        if int(team) <= 0:
            raise ValueError("team must be a positive team ID")
        params["team"] = int(team)
        return self.get_all("players", params)