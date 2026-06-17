#!/usr/bin/env python3
"""
Fit separate Burch-Christensen parameter sets for each AS/NZS 4234 climate zone.

Why this exists
---------------
The shared national BC-Aus fit in fit_bc_aus.py is the right "one formula for
Australia" benchmark, but it still has to compromise across five very different
CER DomDecks reference climates. The user asked whether we should generate
different parameters per region instead. The answer is yes, and the stronger
regional version is to fit all five Burch-Christensen constants separately for
each zone, not just the offset.

Why not fit only a different offset per zone
--------------------------------------------
Offset-only changes move the curve up or down, but they do not fix amplitude or
timing. The CER mismatch is not purely vertical. Alice Springs and Rockhampton
need stronger seasonal swing corrections, while Sydney / Melbourne / Canberra
also need phase and amplitude adjustment. A full five-parameter zone fit is
therefore the cleaner regional approach.

What this script does
---------------------
For each CER climate zone it fits:
    offset_F, ratio_c0, ratio_c1, lag_c0, lag_c1

to the verified CER monthly mains reference using the same daily-bucketed
monthly Burch-Christensen implementation used in cer_comparison.html. That
means the generated JavaScript file matches what the browser plots, rather than
fitting against a slightly different monthly midpoint approximation.

Outputs
-------
1. Per-zone fitted constants and RMSE printed to stdout.
2. bc_aus_zone_constants.js written next to this script.
3. cer_comparison.html can load that JS file and plot a regional BC-Aus line
   for each zone.

Required packages
-----------------
numpy, scipy

Install if needed:
    pip install numpy scipy --break-system-packages

Run from the project root:
    python3 fit_bc_aus_by_zone.py
"""

from __future__ import annotations

import datetime as dt
import math
import re
from pathlib import Path

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "numpy is required for fit_bc_aus_by_zone.py. Install with "
        "`pip install numpy scipy --break-system-packages`."
    ) from exc

try:
    from scipy.optimize import least_squares
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "scipy is required for fit_bc_aus_by_zone.py. Install with "
        "`pip install numpy scipy --break-system-packages`."
    ) from exc


ROOT = Path(__file__).resolve().parent
NATIONAL_CONSTANTS_PATH = ROOT / "bc_aus_constants.js"
OUTPUT_PATH = ROOT / "bc_aus_zone_constants.js"

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Verified CER DomDecks reference dataset.
ZONES = {
    "zone1": {
        "name": "Zone 1 — Alice Springs",
        "city": "Alice Springs",
        "lat": -23.4,
        "ta": [27.91, 26.49, 23.55, 20.61, 16.39, 13.07, 9.65, 13.13, 16.65, 23.95, 24.80, 27.88],
        "cer": [28.0, 28.0, 27.0, 25.0, 23.0, 20.0, 20.0, 21.0, 24.0, 26.0, 28.0, 28.0],
    },
    "zone2": {
        "name": "Zone 2 — Rockhampton",
        "city": "Rockhampton",
        "lat": -23.5,
        "ta": [26.74, 25.48, 25.83, 23.07, 19.73, 16.56, 16.14, 18.02, 19.01, 21.56, 23.79, 25.88],
        "cer": [29.0, 27.0, 24.0, 20.0, 14.0, 11.0, 9.0, 12.0, 18.0, 23.0, 26.0, 28.0],
    },
    "zone3": {
        "name": "Zone 3 — Sydney",
        "city": "Sydney",
        "lat": -33.4,
        "ta": [23.11, 22.27, 22.37, 18.98, 14.57, 12.59, 11.31, 13.63, 16.66, 16.79, 19.94, 22.27],
        "cer": [23.0, 23.0, 21.0, 18.0, 15.0, 12.0, 11.0, 12.0, 15.0, 19.0, 21.0, 22.0],
    },
    "zone4": {
        "name": "Zone 4 — Melbourne",
        "city": "Melbourne",
        "lat": -37.8,
        "ta": [18.12, 21.89, 17.76, 16.63, 12.81, 10.58, 9.65, 11.63, 12.72, 14.10, 16.12, 17.45],
        "cer": [20.0, 20.0, 18.0, 15.0, 11.0, 9.0, 8.0, 10.0, 12.0, 15.0, 17.0, 19.0],
    },
    "zone5": {
        "name": "Zone 5 — Canberra",
        "city": "Canberra",
        "lat": -35.3,
        "ta": [17.78, 18.91, 14.73, 12.47, 9.05, 5.46, 5.29, 6.95, 8.39, 11.95, 16.22, 17.57],
        "cer": [18.0, 18.0, 19.0, 15.0, 13.0, 9.0, 5.0, 5.0, 7.0, 8.0, 12.0, 16.0],
    },
}


def c_to_f(value_c: float) -> float:
    return value_c * 9.0 / 5.0 + 32.0


def f_to_c(value_f: float) -> float:
    return (value_f - 32.0) * 5.0 / 9.0


def mean(values) -> float:
    return sum(values) / len(values)


def load_national_constants(path: Path) -> tuple[float, float, float, float, float]:
    """
    Read the current shared national BC-Aus constants.

    These make a sensible starting point for the zone-by-zone fit because they
    are already adapted to Australian conditions and generally converge faster
    than starting from the original US Hendron constants alone.
    """
    if not path.exists():
        return (0.0, 0.4, 0.01, 35.0, -1.0)

    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"const\s+(BC_AUS_[A-Z0-9_]+)\s*=\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)")
    values = {name: float(value) for name, value in pattern.findall(text)}
    required = [
        "BC_AUS_OFFSET_F",
        "BC_AUS_RATIO_C0",
        "BC_AUS_RATIO_C1",
        "BC_AUS_LAG_C0",
        "BC_AUS_LAG_C1",
    ]
    if not all(key in values for key in required):
        return (0.0, 0.4, 0.01, 35.0, -1.0)

    return (
        values["BC_AUS_OFFSET_F"],
        values["BC_AUS_RATIO_C0"],
        values["BC_AUS_RATIO_C1"],
        values["BC_AUS_LAG_C0"],
        values["BC_AUS_LAG_C1"],
    )


def compute_bc_monthly(ta_monthly, lat: float, params) -> list[float]:
    """
    Same daily-bucketed monthly Burch-Christensen implementation as the browser.
    """
    offset_f, ratio_c0, ratio_c1, lag_c0, lag_c1 = params
    annual_avg_f = c_to_f(mean(ta_monthly))
    delta_month_f = (max(ta_monthly) - min(ta_monthly)) * 9.0 / 5.0
    ratio = ratio_c0 + ratio_c1 * (annual_avg_f - 44.0)
    lag = lag_c0 + lag_c1 * (annual_avg_f - 44.0)

    month_buckets = [[] for _ in range(12)]
    for day in range(1, 366):
        model_day = day if lat >= 0 else (((day + 182 - 1) % 365) + 1)
        angle_deg = 0.986 * (model_day - 15.0 - lag) - 90.0
        angle_rad = math.radians(angle_deg)
        mains_f = (annual_avg_f + offset_f) + ratio * (delta_month_f / 2.0) * math.sin(angle_rad)
        month_idx = min(11, math.floor((day - 1) / 30.44))
        month_buckets[month_idx].append(f_to_c(mains_f))

    return [mean(bucket) for bucket in month_buckets]


def residuals_zone(params, zone) -> np.ndarray:
    pred = compute_bc_monthly(zone["ta"], zone["lat"], params)
    return np.asarray([pred_i - targ_i for pred_i, targ_i in zip(pred, zone["cer"])], dtype=float)


def rmse(values_a, values_b) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(values_a, values_b)) / len(values_a))


def fit_zone(zone, initial_guesses):
    """
    Fit one zone from a small set of sensible starting guesses.

    Multiple starts are used because the lag term makes the problem non-linear
    and mildly non-convex. The best converged solution by RMSE is retained.
    """
    best = None
    for guess in initial_guesses:
        result = least_squares(
            residuals_zone,
            guess,
            args=(zone,),
            method="lm",
            max_nfev=10000,
        )
        pred = compute_bc_monthly(zone["ta"], zone["lat"], result.x)
        fit = {
            "params": tuple(float(v) for v in result.x),
            "rmseC": rmse(pred, zone["cer"]),
            "pred": pred,
            "cost": float(result.cost),
            "success": bool(result.success),
        }
        if best is None or fit["rmseC"] < best["rmseC"]:
            best = fit
    return best


def write_js_file(zone_results: dict[str, dict], overall_rmse_c: float) -> None:
    timestamp = dt.datetime.now().isoformat(timespec="seconds")
    lines = [
        "// Auto-generated by fit_bc_aus_by_zone.py - DO NOT EDIT BY HAND.",
        "// Re-run `python3 fit_bc_aus_by_zone.py` to regenerate.",
        "//",
        "// Separate five-parameter Burch-Christensen fits for each AS/NZS 4234",
        "// climate zone. This is the regional version of BC-Aus.",
        f"// Generated: {timestamp}",
        f"// Overall RMSE across all 5 zones: {overall_rmse_c:.3f} degC",
        "const BC_AUS_ZONE_CONSTANTS = {",
    ]

    for zone_key, result in zone_results.items():
        zone = ZONES[zone_key]
        offset_f, ratio_c0, ratio_c1, lag_c0, lag_c1 = result["params"]
        lines.extend([
            f"  {zone_key}: {{",
            f"    name: {zone['name']!r},",
            f"    city: {zone['city']!r},",
            f"    offsetF: {offset_f:.8f},",
            f"    ratioC0: {ratio_c0:.8f},",
            f"    ratioC1: {ratio_c1:.8f},",
            f"    lagC0: {lag_c0:.8f},",
            f"    lagC1: {lag_c1:.8f},",
            f"    rmseC: {result['rmseC']:.6f},",
            "  },",
        ])

    lines.append("};")
    lines.append(f"const BC_AUS_ZONE_OVERALL_RMSE_C = {overall_rmse_c:.6f};")
    lines.append("")
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    national_guess = load_national_constants(NATIONAL_CONSTANTS_PATH)
    initial_guesses = [
        national_guess,
        (0.0, 0.4, 0.01, 35.0, -1.0),
        (6.0, 0.4, 0.01, 35.0, -1.0),
    ]

    print("Fitting separate BC-Aus constants for each AS/NZS 4234 climate zone")
    print("-------------------------------------------------------------------")

    zone_results: dict[str, dict] = {}
    all_sq_errors = []

    for zone_key, zone in ZONES.items():
        result = fit_zone(zone, initial_guesses)
        zone_results[zone_key] = result
        all_sq_errors.extend((pred - targ) ** 2 for pred, targ in zip(result["pred"], zone["cer"]))

        offset_f, ratio_c0, ratio_c1, lag_c0, lag_c1 = result["params"]
        print(f"\n{zone['name']}")
        print(f"  RMSE:     {result['rmseC']:.3f} degC")
        print(f"  offset_F: {offset_f:.8f}")
        print(f"  ratio_c0: {ratio_c0:.8f}")
        print(f"  ratio_c1: {ratio_c1:.8f}")
        print(f"  lag_c0:   {lag_c0:.8f}")
        print(f"  lag_c1:   {lag_c1:.8f}")

    overall_rmse_c = math.sqrt(sum(all_sq_errors) / len(all_sq_errors))

    print("\nOverall regional-fit RMSE")
    print("-------------------------")
    print(f"{overall_rmse_c:.3f} degC")

    write_js_file(zone_results, overall_rmse_c)
    print(f"\nWrote {OUTPUT_PATH.name}")
    print("Refresh cer_comparison.html to load the regional BC-Aus constants.")


if __name__ == "__main__":
    main()


# HOW TO RE-RUN
# -------------
# 1. Make sure numpy and scipy are installed:
#       pip install numpy scipy --break-system-packages
# 2. From the project root, run:
#       python3 fit_bc_aus_by_zone.py
# 3. The script will write bc_aus_zone_constants.js next to itself.
# 4. Refresh cer_comparison.html in your browser.
#
# Re-run this whenever:
# - any CER mains reference values are updated
# - any CER TMY monthly air temperatures are updated
# - you want to compare a new shared national BC-Aus fit against a fresh
#   set of zone-specific fits
