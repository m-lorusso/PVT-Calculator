#!/usr/bin/env python3
"""
Validation harness: fetch real PVGIS TMY data, compute reference solar position
and POA irradiance with pvlib (validated models), and export the hourly records
+ reference results to JSON so the JS formulas can be compared apples-to-apples.

Reference = pvlib (true solar position from real timestamps + isotropic transposition).
This mirrors exactly what server.py feeds the front-end (dayN, local-clock hourN).
"""
import json
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pvlib
from zoneinfo import ZoneInfo
from timezonefinder import TimezoneFinder

ROOT = Path(__file__).resolve().parents[2]
TMY_OUT_DIR = ROOT / "validation" / "fixtures" / "tmy"
REFERENCE_OUT_DIR = ROOT / "validation" / "reference"

CITIES = {
    "Sydney":    (-33.8698, 151.2083),
    "Melbourne": (-37.8136, 144.9631),
    "Perth":     (-31.9505, 115.8605),
}
TILT = 30.0
ALBEDO = 0.2
ETA = 0.20
AREA = 20.0  # m^2

_tf = TimezoneFinder()


def fetch_tmy(lat, lon):
    res = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    # pvlib returns (data, meta) in 0.15; older returns 4-tuple. Handle both.
    df = res[0]
    if df.index.tz is None:
        df = df.tz_localize("UTC")
    tz_name = _tf.timezone_at(lng=lon, lat=lat) or "UTC"
    df = df.tz_convert(ZoneInfo(tz_name))
    return df, tz_name


def main():
    summary = {}
    for city, (lat, lon) in CITIES.items():
        print(f"Fetching PVGIS TMY for {city} ({lat},{lon}) ...", file=sys.stderr)
        df, tz_name = fetch_tmy(lat, lon)

        dni = df["dni"].to_numpy(dtype=float)
        dhi = df["dhi"].to_numpy(dtype=float)
        ghi = df["ghi"].to_numpy(dtype=float)
        ta  = df.get("temp_air", df.get("t2m")).to_numpy(dtype=float)

        # --- REFERENCE: pvlib true solar position from real localized timestamps ---
        # North-facing in S hemisphere => surface_azimuth = 0 (compass, 0=N)
        solpos = pvlib.solarposition.get_solarposition(df.index, lat, lon)
        poa = pvlib.irradiance.get_total_irradiance(
            surface_tilt=TILT,
            surface_azimuth=0.0,
            solar_zenith=solpos["apparent_zenith"],
            solar_azimuth=solpos["azimuth"],
            dni=dni, ghi=ghi, dhi=dhi,
            albedo=ALBEDO, model="isotropic",
        )
        poa_global = poa["poa_global"].to_numpy(dtype=float)
        poa_global = np.nan_to_num(poa_global, nan=0.0)
        ref_annual_poa = float(poa_global.sum()) / 1000.0  # kWh/m^2/yr
        ref_annual_kwh = ref_annual_poa * ETA * AREA

        # Also Perez (PVGIS-like sky-diffuse model) for context
        poa_perez = pvlib.irradiance.get_total_irradiance(
            surface_tilt=TILT, surface_azimuth=0.0,
            solar_zenith=solpos["apparent_zenith"], solar_azimuth=solpos["azimuth"],
            dni=dni, ghi=ghi, dhi=dhi, albedo=ALBEDO, model="perez",
            dni_extra=pvlib.irradiance.get_extra_radiation(df.index),
        )
        ref_perez_poa = float(np.nan_to_num(poa_perez["poa_global"].to_numpy(dtype=float)).sum())/1000.0

        # --- Export records exactly as server.py produces them ---
        records = []
        for ts, d, h, g, t in zip(df.index, dni, dhi, ghi, ta):
            records.append({
                "dayN": int(ts.dayofyear),
                "hourN": int(ts.hour) + 1,   # local clock hour, 1..24 (incl DST)
                "dni": float(d), "dhi": float(h), "ghi": float(g), "ta": float(t),
            })

        summary[city] = {
            "lat": lat, "lon": lon, "tz": tz_name,
            "ref_annual_poa_kwh_m2": round(ref_annual_poa, 1),
            "ref_isotropic_annual_kwh": round(ref_annual_kwh, 1),
            "ref_perez_poa_kwh_m2": round(ref_perez_poa, 1),
            "ref_perez_annual_kwh": round(ref_perez_poa * ETA * AREA, 1),
            "n_records": len(records),
            "annual_ghi_kwh_m2": round(float(ghi.sum())/1000.0, 1),
        }
        TMY_OUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(TMY_OUT_DIR / f"tmy_{city.lower()}.json", "w", encoding="utf-8") as fh:
            json.dump({"city": city, "lat": lat, "lon": lon, "tz": tz_name,
                       "tilt": TILT, "albedo": ALBEDO, "eta": ETA, "area": AREA,
                       "records": records}, fh)

    print(json.dumps(summary, indent=2))
    REFERENCE_OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(REFERENCE_OUT_DIR / "reference_summary.json", "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)


if __name__ == "__main__":
    main()
