#!/usr/bin/env python3
"""Refresh locked Australian PVGIS TMY weather fixtures.

This script intentionally performs live PVGIS access through the local backend
implementation. Do not run it in normal offline validation; run it only when
fixtures are deliberately being refreshed and reviewed.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "pvt-tmy-api"
OUT_DIR = ROOT / "validation" / "fixtures" / "weather"
sys.path.insert(0, str(API_DIR))

import server  # noqa: E402


CITIES = [
    {"slug": "sydney", "city": "Sydney", "state": "NSW", "lat": -33.869844, "lon": 151.208285},
    {"slug": "melbourne", "city": "Melbourne", "state": "VIC", "lat": -37.813629, "lon": 144.963058},
    {"slug": "brisbane", "city": "Brisbane", "state": "QLD", "lat": -27.470125, "lon": 153.021072},
    {"slug": "perth", "city": "Perth", "state": "WA", "lat": -31.952313, "lon": 115.861309},
    {"slug": "adelaide", "city": "Adelaide", "state": "SA", "lat": -34.928499, "lon": 138.600746},
    {"slug": "darwin", "city": "Darwin", "state": "NT", "lat": -12.463440, "lon": 130.845642},
    {"slug": "hobart", "city": "Hobart", "state": "TAS", "lat": -42.882137, "lon": 147.327194},
]


def annual_sum(records: list[dict], key: str) -> float:
    return sum(float(rec.get(key, 0.0) or 0.0) for rec in records) / 1000.0


def build_fixture(city: dict) -> dict:
    server._TMY_CACHE.clear()
    data = server.tmy(city["lat"], city["lon"])
    records = data.get("records") or []
    if len(records) != 8760:
        raise RuntimeError(f"{city['slug']} returned {len(records)} records, expected 8760")
    if any("solarHour" not in rec for rec in records):
        raise RuntimeError(f"{city['slug']} records are missing solarHour")
    return {
        "schemaVersion": 1,
        "lockedAt": date.today().isoformat(),
        "source": "PVGIS TMY via pvlib.iotools.get_pvgis_tmy, served through pvt-tmy-api/server.py",
        "city": city["city"],
        "state": city["state"],
        "slug": city["slug"],
        "lat": city["lat"],
        "lon": city["lon"],
        "tz": data.get("tz"),
        "recordCount": len(records),
        "annualDniKWhM2": round(annual_sum(records, "dni"), 6),
        "annualDhiKWhM2": round(annual_sum(records, "dhi"), 6),
        "annualGhiKWhM2": round(annual_sum(records, "ghi"), 6),
        "annualAmbientAvgC": round(sum(float(rec.get("ta", 0.0) or 0.0) for rec in records) / len(records), 6),
        "records": records,
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for city in CITIES:
        fixture = build_fixture(city)
        path = OUT_DIR / f"{city['slug']}.json"
        path.write_text(json.dumps(fixture, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {path} ({fixture['recordCount']} records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
