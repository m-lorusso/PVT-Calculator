#!/usr/bin/env python3
"""
Deep validation of CoolSheet's supply-side formulas against pvlib 0.15.

Challenges, per city (Sydney/Melbourne/Perth), using identical PVGIS-ERA5 data:
  1. Declination (Cooper eq.) vs pvlib, across all 365 days  -> max error
  2. Solar zenith: app formula (clock-hour) vs pvlib true     -> RMS / max error
  3. GHI closure: measured GHI vs reconstructed (true z vs app z)
  4. POA per-component (beam / diffuse / ground) vs pvlib isotropic
  5. Hourly peak-timing shift caused by clock-vs-solar time
  6. PV: constant-eta vs temperature-corrected (pvwatts) annual delta

Outputs validation/reference/deep_results.json and prints a readable report.
Re-run: python validation/scripts/deep_validation.py   (re-fetches PVGIS; ~30s)
"""
import json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd
import pvlib
from zoneinfo import ZoneInfo
from timezonefinder import TimezoneFinder

CITIES = {"Sydney": (-33.8698, 151.2083),
          "Melbourne": (-37.8136, 144.9631),
          "Perth": (-31.9505, 115.8605)}
TILT, ALBEDO, ETA, AREA = 30.0, 0.2, 0.20, 20.0
_tf = TimezoneFinder()
D2R = math.pi / 180.0
ROOT = Path(__file__).resolve().parents[2]
REFERENCE_OUT_DIR = ROOT / "validation" / "reference"


# ----- app.js formulas, re-implemented exactly (clock hour as solar time) -----
def app_declination(n):
    return 23.45 * math.sin(D2R * (360.0 / 365.0) * (n + 284))

def app_zenith(n, h, lat):
    d = D2R * app_declination(n); w = D2R * 15 * (h - 12); L = D2R * lat
    c = math.sin(d)*math.sin(L) + math.cos(d)*math.cos(L)*math.cos(w)
    return math.degrees(math.acos(min(1, max(-1, c))))

def app_incidence(n, h, lat, tilt, surf_az):
    d = D2R*app_declination(n); w = D2R*15*(h-12); L = D2R*lat
    s = D2R*tilt; g = D2R*(surf_az - 180)
    c = (math.sin(d)*math.sin(L)*math.cos(s)
         - math.sin(d)*math.cos(L)*math.sin(s)*math.cos(g)
         + math.cos(d)*math.cos(L)*math.cos(s)*math.cos(w)
         + math.cos(d)*math.sin(L)*math.sin(s)*math.cos(g)*math.cos(w)
         + math.cos(d)*math.sin(s)*math.sin(g)*math.sin(w))
    return math.degrees(math.acos(min(1, max(-1, c))))


def fetch(lat, lon):
    res = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    df = res[0]
    if df.index.tz is None:
        df = df.tz_localize("UTC")
    tz = _tf.timezone_at(lng=lon, lat=lat) or "UTC"
    return df.tz_convert(ZoneInfo(tz)), tz


def main():
    out = {}
    for city, (lat, lon) in CITIES.items():
        print(f"[{city}] fetching PVGIS TMY ...", file=sys.stderr)
        df, tz = fetch(lat, lon)
        idx = df.index
        dni = df["dni"].to_numpy(float)
        dhi = df["dhi"].to_numpy(float)
        ghi_meas = df["ghi"].to_numpy(float)

        # --- 1. Declination across the year ---
        days = np.arange(1, 366)
        decl_app = np.array([app_declination(n) for n in days])
        # pvlib declination (Spencer) for comparison
        decl_pv = np.degrees(pvlib.solarposition.declination_spencer71(days))
        decl_max_err = float(np.max(np.abs(decl_app - decl_pv)))

        # --- 2. Zenith: app (clock hour) vs pvlib true ---
        solpos = pvlib.solarposition.get_solarposition(idx, lat, lon)
        z_true = solpos["zenith"].to_numpy(float)
        dayN = idx.dayofyear.to_numpy()
        hourC = idx.hour.to_numpy()  # 0..23 clock hour (== app hourN after -1)
        z_app = np.array([app_zenith(n, h, lat) for n, h in zip(dayN, hourC)])
        day_mask = z_true < 90  # sun up
        z_err = z_app[day_mask] - z_true[day_mask]
        z_rms = float(np.sqrt(np.mean(z_err**2)))
        z_maxabs = float(np.max(np.abs(z_err)))

        # --- 3. GHI closure ---
        cz_true = np.cos(np.radians(z_true)); cz_true[cz_true < 0] = 0
        cz_app = np.cos(np.radians(z_app));   cz_app[cz_app < 0] = 0
        ghi_recon_true = dni*cz_true + dhi
        ghi_recon_app  = dni*cz_app + dhi
        def rel(a, b):
            s = b.sum()
            return float((a.sum() - s)/s*100) if s else 0.0
        ghi_close_true = rel(ghi_recon_true, ghi_meas)
        ghi_close_app  = rel(ghi_recon_app, ghi_meas)

        # --- 4. POA per-component: app isotropic vs pvlib isotropic ---
        beta = TILT
        # app components (use measured GHI? no -- app reconstructs with app z)
        inc_app = np.array([app_incidence(n, h, lat, TILT, 0.0) for n, h in zip(dayN, hourC)])
        ci_app = np.cos(np.radians(inc_app)); ci_app[ci_app < 0] = 0
        beam_app = np.where(cz_app > 1e-6, dni*ci_app, 0.0)
        diff_app = dhi * (1 + math.cos(D2R*beta))/2
        grnd_app = ghi_recon_app * ALBEDO * (1 - math.cos(D2R*beta))/2
        # pvlib isotropic components (true geometry, measured ghi for ground)
        poa = pvlib.irradiance.get_total_irradiance(
            TILT, 0.0, solpos["apparent_zenith"], solpos["azimuth"],
            dni=dni, ghi=ghi_meas, dhi=dhi, albedo=ALBEDO, model="isotropic")
        comp = {
            "beam":   (float(beam_app.sum()/1000),  float(np.nan_to_num(poa["poa_direct"]).sum()/1000)),
            "diffuse":(float(diff_app.sum()/1000),  float(np.nan_to_num(poa["poa_sky_diffuse"]).sum()/1000)),
            "ground": (float(grnd_app.sum()/1000),  float(np.nan_to_num(poa["poa_ground_diffuse"]).sum()/1000)),
        }
        poa_app_total = float((beam_app + diff_app + grnd_app).sum()/1000)
        poa_pv_total  = float(np.nan_to_num(poa["poa_global"]).sum()/1000)

        # --- 5. Peak-timing shift (avg over clear-ish days) ---
        # group by day, find hour of max POA for app vs pvlib true
        poa_true_h = np.nan_to_num(poa["poa_global"].to_numpy(float))
        poa_app_h  = beam_app + diff_app + grnd_app
        shifts = []
        for d in range(1, 366):
            m = dayN == d
            if m.sum() < 20 or poa_true_h[m].max() < 300:
                continue
            ht = hourC[m][np.argmax(poa_true_h[m])]
            ha = hourC[m][np.argmax(poa_app_h[m])]
            shifts.append(ha - ht)
        peak_shift_mean = float(np.mean(shifts)) if shifts else 0.0

        # --- 6. PV constant-eta vs temperature-corrected (uncooled bound) ---
        ws = df.get("wind_speed", df.get("ws10m"))
        ws = ws.to_numpy(float) if ws is not None else np.full(len(df), 1.0)
        ta = df.get("temp_air", df.get("t2m")).to_numpy(float)
        tcell = pvlib.temperature.faiman(poa["poa_global"].fillna(0), ta, ws)
        e_const = poa_pv_total * ETA * AREA
        # pvwatts dc with gamma=-0.0035/C, ref eta baked into AREA*ETA scaling
        p_ratio = (1 + (-0.0035) * (tcell - 25))
        e_temp = float((np.nan_to_num(poa["poa_global"].to_numpy(float))/1000 * ETA * AREA * np.nan_to_num(p_ratio.to_numpy(float))).sum())

        out[city] = {
            "tz": tz,
            "decl_max_err_deg": round(decl_max_err, 3),
            "zenith_rms_deg": round(z_rms, 2),
            "zenith_max_err_deg": round(z_maxabs, 2),
            "ghi_closure_trueZ_pct": round(ghi_close_true, 2),
            "ghi_closure_appZ_pct": round(ghi_close_app, 2),
            "poa_app_total_kwh_m2": round(poa_app_total, 1),
            "poa_pvlib_total_kwh_m2": round(poa_pv_total, 1),
            "poa_components_kwh_m2": {k: [round(a,1), round(b,1)] for k,(a,b) in comp.items()},
            "peak_timing_shift_hours": round(peak_shift_mean, 2),
            "pv_const_eta_kwh": round(e_const, 1),
            "pv_tempcorr_uncooled_kwh": round(e_temp, 1),
            "pv_temp_loss_pct_if_uncooled": round((e_temp/e_const - 1)*100, 1),
        }

    print(json.dumps(out, indent=2))
    REFERENCE_OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(REFERENCE_OUT_DIR / "deep_results.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)


if __name__ == "__main__":
    main()
