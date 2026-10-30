#!/usr/bin/env python3
"""Read-only LIVE Jynlo venue coverage and detail-route smoke test.

This script never authenticates, writes, geocodes, publishes, or changes records.
It reports only aggregate counts and existing venue identifiers.
"""
import collections
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = os.environ.get("VENUES_API_URL", "https://api.d24sports.com").rstrip("/")
DISTRICTS = (
    "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco", "Coimbra",
    "Évora", "Faro", "Guarda", "Leiria", "Lisboa", "Portalegre",
    "Porto", "Santarém", "Setúbal", "Viana do Castelo", "Vila Real", "Viseu"
)


def fetch(path):
    request = Request(BASE + path, headers={
        "Accept": "application/json",
        "User-Agent": "Jynlo-venue-catalogue-read-only-healthcheck/1.0"
    })
    with urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"{path}: unexpected HTTP {response.status}")
        return json.load(response)


def main():
    page = fetch("/api/venues/suggest?page=0")
    assert isinstance(page, dict) and isinstance(page.get("venues"), list), (
        "Unusable venue suggestions response"
    )
    print(f"First-page venue suggestions: {len(page['venues'])}")
    print(f"More pages available: {bool(page.get('hasMore'))}")

    # The existing public endpoint returns the approved venue catalogue.
    # One read can expose total and district coverage without DB credentials.
    data = fetch("/api/venues")
    if not isinstance(data, list):
        raise RuntimeError("Unexpected venue catalogue response shape")
    by_district = collections.Counter(
        str(item.get("district") or "(sem distrito)") for item in data
    )
    without_sports = sum(not str(x.get("sports") or "").strip() for x in data)
    without_coordinates = sum(
        x.get("latitude") is None or x.get("longitude") is None for x in data
    )
    print(f"Total catalogue venues: {len(data)}")
    print(f"Without listed sports: {without_sports}")
    print(f"Without coordinates: {without_coordinates}")
    print("District coverage:")
    for name in DISTRICTS:
        print(f"  {name}: {by_district.get(name, 0)}")
    if by_district.get("(sem distrito)"):
        print(f"  (sem distrito): {by_district['(sem distrito)']}")
    other = {k:v for k,v in by_district.items()
             if k not in DISTRICTS and k != "(sem distrito)"}
    if other:
        print(f"Other district labels (review): {other}")

    # Check a real detail request from the exact catalogue, without trying to
    # test or guess IDs that may not exist anymore.
    if not data:
        raise RuntimeError("Venue catalogue unexpectedly empty")
    existing = next((v for v in data if isinstance(v.get("id"), int)), None)
    if existing is None:
        raise RuntimeError("No numeric ID in venue catalogue")
    record = fetch(f"/api/venues/{existing['id']}")
    if not isinstance(record, dict) or record.get("id") != existing["id"]:
        raise RuntimeError("GET venue detail does not match catalogue ID")
    print(f"Venue detail API: OK (existing ID {existing['id']})")
    if len(page["venues"]) > 40:
        raise RuntimeError("Public suggestions endpoint exceeded 40-result page")
    print("SUCCESS: LIVE venue endpoints respond with consistent data.")


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError, ValueError, OSError, RuntimeError, AssertionError) as exc:
        print(f"VENUE_SMOKE_FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
