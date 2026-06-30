#!/usr/bin/env python3
"""Offline backend tests for the TMY solarHour contract.

These tests mock pvlib's PVGIS call, so they do not need network access.
They verify the local FastAPI backend emits solarHour consistently with
local API expectations before deployment to Render or another host.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
API_DIR = ROOT / "pvt-tmy-api"
sys.path.insert(0, str(API_DIR))

import server  # noqa: E402


class FakeTimezoneFinder:
    def timezone_at(self, lng: float, lat: float) -> str:
        return "Australia/Sydney"


def fake_pvgis_tmy(_lat: float, _lon: float, map_variables: bool = True):
    idx = pd.date_range("2022-01-01 00:00", periods=48, freq="h", tz="UTC")
    df = pd.DataFrame(
        {
            "dni": [0.0] * 6 + [700.0] * 8 + [0.0] * 34,
            "dhi": [0.0] * 6 + [120.0] * 8 + [0.0] * 34,
            "ghi": [0.0] * 6 + [620.0] * 8 + [0.0] * 34,
            "t2m": [20.0 + (i % 24) * 0.1 for i in range(48)],
            "ws10m": [3.0] * 48,
        },
        index=idx,
    )
    return df, {"source": "mock-pvgis", "map_variables": map_variables}


class BackendSolarHourTests(unittest.TestCase):
    def setUp(self):
        server._TMY_CACHE.clear()

    def test_tmy_records_include_solar_hour(self):
        with mock.patch.object(server.pvlib.iotools, "get_pvgis_tmy", side_effect=fake_pvgis_tmy):
            with mock.patch.object(server, "_tf", FakeTimezoneFinder()):
                result = server.tmy(-33.869844, 151.208285)

        records = result["records"]
        self.assertEqual(len(records), 48)
        self.assertEqual(result["tz"], "Australia/Sydney")
        self.assertTrue(all("solarHour" in rec for rec in records))
        self.assertTrue(all(isinstance(rec["solarHour"], float) for rec in records))
        self.assertTrue(all(0.0 <= rec["solarHour"] < 24.0 for rec in records))

    def test_rotation_keeps_solar_hour_and_timestamp_hour(self):
        with mock.patch.object(server.pvlib.iotools, "get_pvgis_tmy", side_effect=fake_pvgis_tmy):
            with mock.patch.object(server, "_tf", FakeTimezoneFinder()):
                result = server.tmy(-33.869844, 151.208285, rotate_last_n_day1=3)

        records = result["records"]
        self.assertEqual(len(records), 48)
        self.assertTrue(all("solarHour" in rec for rec in records))
        self.assertTrue(all(1 <= rec["hourN"] <= 24 for rec in records))
        self.assertTrue(all(0.0 <= rec["solarHour"] < 24.0 for rec in records))


if __name__ == "__main__":
    unittest.main(verbosity=2)
