#!/usr/bin/env python3
"""
Generate zone-specific monthly correction vectors for the CER DomDecks validator.

Engineering rationale
---------------------
The current BC-Aus fit is the best single shared Burch-Christensen-style
formula we have for Australia, but it is still one smooth sinusoid trying to
represent five quite different AS/NZS 4234 reference climates. That means it
cannot match all five CER reference curves perfectly at once.

For the CER comparison tool, the most accurate possible result at the five
standard climate zones is therefore:

    exact_zone_fit = BC-Aus + zone_specific_monthly_correction

where each monthly correction is simply:

    correction[month] = CER_reference[month] - BC_Aus_CER_TMY[month]

This script makes that correction layer reproducible. It reads the current
BC-Aus constants from bc_aus_constants.js, computes the correction vectors from
the verified CER datasets, and writes bc_zone_corrections.js for the browser to
load.

Important limitation:
    These corrections are exact only for the five AS/NZS 4234 reference zones.
    They are not a new universal mains-water formula. They are a zone-matched
    correction layer built on top of BC-Aus.
"""

from __future__ import annotations

import datetime as dt
import math
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BC_CONSTANTS_PATH = ROOT / "bc_aus_constants.js"
OUTPUT_PATH = ROOT / "bc_zone_corrections.js"

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def c_to_f(value_c: float) -> float:
    return value_c * 9.0 / 5.0 + 32.0


def f_to_c(value_f: float) -> float:
    return (value_f - 32.0) * 5.0 / 9.0


def mean(values) -> float:
    return sum(values) / len(values)


ZONES = {
    "zone1": {
        "name": "Zone 1 - Alice Springs",
        "lat": -23.4,
        "ta": [27.91, 26.49, 23.55, 20.61, 16.39, 13.07, 9.65, 13.13, 16.65, 23.95, 24.80, 27.88],
        "cer": [28.0, 28.0, 27.0, 25.0, 23.0, 20.0, 20.0, 21.0, 24.0, 26.0, 28.0, 28.0],
    },
    "zone2": {
        "name": "Zone 2 - Rockhampton",
        "lat": -23.5,
        "ta": [26.74, 25.48, 25.83, 23.07, 19.73, 16.56, 16.14, 18.02, 19.01, 21.56, 23.79, 25.88],
        "cer": [29.0, 27.0, 24.0, 20.0, 14.0, 11.0, 9.0, 12.0, 18.0, 23.0, 26.0, 28.0],
    },
    "zone3": {
        "name": "Zone 3 - Sydney",
        "lat": -33.4,
        "ta": [23.11, 22.27, 22.37, 18.98, 14.57, 12.59, 11.31, 13.63, 16.66, 16.79, 19.94, 22.27],
        "cer": [23.0, 23.0, 21.0, 18.0, 15.0, 12.0, 11.0, 12.0, 15.0, 19.0, 21.0, 22.0],
    },
    "zone4": {
        "name": "Zone 4 - Melbourne",
        "lat": -37.8,
        "ta": [18.12, 21.89, 17.76, 16.63, 12.81, 10.58, 9.65, 11.63, 12.72, 14.10, 16.12, 17.45],
        "cer": [20.0, 20.0, 18.0, 15.0, 11.0, 9.0, 8.0, 10.0, 12.0, 15.0, 17.0, 19.0],
    },
    "zone5": {
        "name": "Zone 5 - Canberra",
        "lat": -35.3,
        "ta": [17.78, 18.91, 14.73, 12.47, 9.05, 5.46, 5.29, 6.95, 8.39, 11.95, 16.22, 17.57],
        "cer": [18.0, 18.0, 19.0, 15.0, 13.0, 9.0, 5.0, 5.0, 7.0, 8.0, 12.0, 16.0],
    },
}


def load_bc_aus_constants(path: Path) -> dict[str, float]:
    """
    Read the current BC-Aus constants directly from bc_aus_constants.js.

    We deliberately read the generated JS file rather than hard-coding the
    constants here so this script stays in sync with the latest fitted BC-Aus
    model. The correction vectors therefore always correspond to the version of
    BC-Aus the validator is currently plotting.
    """
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(r"const\s+(BC_AUS_[A-Z0-9_]+)\s*=\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)")
    values = {name: float(value) for name, value in pattern.findall(text)}
    required = {
        "BC_AUS_OFFSET_F",
        "BC_AUS_RATIO_C0",
        "BC_AUS_RATIO_C1",
        "BC_AUS_LAG_C0",
        "BC_AUS_LAG_C1",
    }
    missing = required - values.keys()
    if missing:
        raise SystemExit(
            f"Could not read all BC-Aus constants from {path.name}. Missing: {', '.join(sorted(missing))}"
        )
    return values


def compute_bc_aus_monthly(ta_monthly, lat: float, params: dict[str, float]) -> list[float]:
    """
    Compute monthly BC-Aus mains temperatures using the same daily-bucketed
    Burch-Christensen implementation used in the HTML validator.
    """
    annual_avg_f = c_to_f(mean(ta_monthly))
    delta_month_f = (max(ta_monthly) - min(ta_monthly)) * 9.0 / 5.0
    ratio = params["BC_AUS_RATIO_C0"] + params["BC_AUS_RATIO_C1"] * (annual_avg_f - 44.0)
    lag = params["BC_AUS_LAG_C0"] + params["BC_AUS_LAG_C1"] * (annual_avg_f - 44.0)

    month_buckets = [[] for _ in range(12)]
    for day in range(1, 366):
        model_day = day if lat >= 0 else (((day + 182 - 1) % 365) + 1)
        angle_deg = 0.986 * (model_day - 15.0 - lag) - 90.0
        angle_rad = math.radians(angle_deg)
        mains_f = (annual_avg_f + params["BC_AUS_OFFSET_F"]) + ratio * (delta_month_f / 2.0) * math.sin(angle_rad)
        month_idx = min(11, math.floor((day - 1) / 30.44))
        month_buckets[month_idx].append(f_to_c(mains_f))

    return [mean(bucket) for bucket in month_buckets]


def compute_rmse(values_a, values_b) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(values_a, values_b)) / len(values_a))


def build_zone_corrections(params: dict[str, float]) -> dict[str, list[float]]:
    corrections: dict[str, list[float]] = {}
    for zone_key, zone in ZONES.items():
        bc_aus = compute_bc_aus_monthly(zone["ta"], zone["lat"], params)
        corrections[zone_key] = [
            round(target - model, 6)
            for target, model in zip(zone["cer"], bc_aus)
        ]
    return corrections


def write_js_file(params: dict[str, float], corrections: dict[str, list[float]]) -> None:
    timestamp = dt.datetime.now().isoformat(timespec="seconds")

    lines = [
        "// Auto-generated by fit_bc_zone_corrections.py - DO NOT EDIT BY HAND.",
        "// Re-run `python3 fit_bc_zone_corrections.py` to regenerate.",
        "//",
        "// Zone corrections are computed as:",
        "//   correction[month] = CER_reference[month] - BC_Aus_CER_TMY[month]",
        "//",
        f"// Generated: {timestamp}",
        "// Source BC-Aus constants:",
        f"//   offset_F = {params['BC_AUS_OFFSET_F']:.4f}",
        f"//   ratio_c0 = {params['BC_AUS_RATIO_C0']:.4f}",
        f"//   ratio_c1 = {params['BC_AUS_RATIO_C1']:.5f}",
        f"//   lag_c0   = {params['BC_AUS_LAG_C0']:.4f}",
        f"//   lag_c1   = {params['BC_AUS_LAG_C1']:.5f}",
        "const BC_ZONE_CORRECTIONS = {",
    ]

    for zone_key, correction in corrections.items():
        values = ", ".join(f"{value:.6f}" for value in correction)
        lines.append(f"  {zone_key}: [{values}],")

    lines.append("};")
    lines.append("")
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    params = load_bc_aus_constants(BC_CONSTANTS_PATH)
    corrections = build_zone_corrections(params)

    print(f"Loaded BC-Aus constants from {BC_CONSTANTS_PATH.name}")
    print("")
    print("Per-zone correction summary")
    print("---------------------------")

    for zone_key, zone in ZONES.items():
        bc_aus = compute_bc_aus_monthly(zone["ta"], zone["lat"], params)
        correction = corrections[zone_key]
        corrected = [model + delta for model, delta in zip(bc_aus, correction)]
        rmse_before = compute_rmse(bc_aus, zone["cer"])
        rmse_after = compute_rmse(corrected, zone["cer"])
        print(f"{zone['name']}")
        print(f"  BC-Aus RMSE before correction: {rmse_before:.3f} degC")
        print(f"  Exact-fit RMSE after correction: {rmse_after:.3f} degC")
        print(f"  Monthly correction vector ({', '.join(MONTHS)}):")
        print(f"    {correction}")
        print("")

    write_js_file(params, corrections)
    print(f"Wrote {OUTPUT_PATH.name}")
    print("Refresh cer_comparison.html to load the updated zone corrections.")


if __name__ == "__main__":
    main()


# HOW TO RE-RUN
# -------------
# 1. Make sure bc_aus_constants.js exists and is up to date.
# 2. Run:
#       python3 fit_bc_zone_corrections.py
# 3. The script will write bc_zone_corrections.js next to itself.
# 4. Refresh cer_comparison.html in the browser.
#
# Re-run this whenever:
# - BC-Aus constants are re-fitted
# - CER zone reference values are updated
# - CER TMY monthly air temperatures are updated
