#!/usr/bin/env python3
"""
eBay OAuth token-refresh helper.

Implements the Client Credentials grant (app-level access, no per-user
consent) for read-only public-data scopes — what the Browse API needs
for search + item lookup. Tokens are short-lived (~2 hours); we cache
the active token in /tmp/ so multiple scraper invocations within the
same CI run don't each request a fresh one. When credentials are
missing this module returns None — callers (search/tracked scrapers)
treat that as a no-op so the pipeline doesn't break for environments
without eBay configured.

Production endpoints only. Sandbox is a separate hostname pair we
don't need (and Mark's keyset is Production-scoped).

Env:
  EBAY_CLIENT_ID     — App ID from developer.ebay.com keyset (Production)
  EBAY_CLIENT_SECRET — Cert ID from the same keyset

Run as a script for a quick smoke test:
  python3 ebay_oauth.py
"""
import base64
import json
import os
import sys
import time
from pathlib import Path

import requests

OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
# Public-data scope. The Browse API search + item endpoints are
# covered by this single scope; expand later if/when we add user-
# specific surfaces (selling, watchlist mirroring, etc).
SCOPE = "https://api.ebay.com/oauth/api_scope"

# Token cache: tiny JSON file in /tmp with `{token, expires_at}`. Lives
# only for the lifetime of the GitHub Actions runner — fine, since
# tokens are short-lived anyway and refreshing is cheap.
CACHE_PATH = Path("/tmp/ebay_oauth_token.json")
# Refresh slightly before the token actually expires so a long-running
# scrape doesn't get caught at the boundary.
REFRESH_MARGIN_SECONDS = 120


def _credentials():
    cid = os.environ.get("EBAY_CLIENT_ID", "").strip()
    sec = os.environ.get("EBAY_CLIENT_SECRET", "").strip()
    if not cid or not sec:
        return None, None
    return cid, sec


def _read_cache():
    if not CACHE_PATH.exists():
        return None
    try:
        with CACHE_PATH.open() as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if data.get("expires_at", 0) <= time.time() + REFRESH_MARGIN_SECONDS:
        return None
    return data.get("token") or None


def _write_cache(token, ttl_seconds):
    payload = {"token": token, "expires_at": time.time() + ttl_seconds}
    try:
        CACHE_PATH.write_text(json.dumps(payload))
    except OSError:
        # Cache is best-effort; if we can't write, callers will just
        # request a fresh token next call.
        pass


def get_app_token(force_refresh=False):
    """Return a Bearer token for the Browse API, or None if eBay
    credentials aren't configured. Caches across calls within the same
    process / runner. Pass `force_refresh=True` to bypass the cache
    after a 401 from the API."""
    cid, sec = _credentials()
    if not cid or not sec:
        return None

    if not force_refresh:
        cached = _read_cache()
        if cached:
            return cached

    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    r = requests.post(
        OAUTH_URL,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials", "scope": SCOPE},
        timeout=20,
    )
    r.raise_for_status()
    body = r.json()
    token = body.get("access_token")
    ttl = int(body.get("expires_in", 7200))
    if not token:
        raise RuntimeError(f"eBay OAuth response missing access_token: {body}")
    _write_cache(token, ttl)
    return token


def auth_headers(force_refresh=False):
    """Convenience: return ready-to-use request headers for Browse API
    calls, or None if credentials aren't configured."""
    tok = get_app_token(force_refresh=force_refresh)
    if not tok:
        return None
    return {
        "Authorization": f"Bearer {tok}",
        "Accept": "application/json",
        # eBay marketplace context. EBAY_US is the catch-all default
        # — search itemLocationCountry filter narrows to specific
        # geographies regardless of marketplace ID.
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
    }


def main():
    cid, sec = _credentials()
    if not cid or not sec:
        print("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set in env.")
        print("Set them in GitHub Actions secrets (or local shell for testing) and retry.")
        sys.exit(1)
    tok = get_app_token(force_refresh=True)
    if not tok:
        print("OAuth call returned no token (unexpected).")
        sys.exit(2)
    print("OK — got an app token.")
    print(f"  token preview: {tok[:24]}…")
    cached = _read_cache()
    if cached:
        print("  (cached for next run)")


if __name__ == "__main__":
    main()
