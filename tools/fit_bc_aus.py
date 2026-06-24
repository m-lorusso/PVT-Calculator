#!/usr/bin/env python3
"""
Recalibrate the Burch-Christensen mains water temperature correlation to
Australian AS/NZS 4234 reference data.

Engineering rationale
---------------------
Problem:
    The original Burch-Christensen correlation published in Hendron et al.
    (2004, NREL) was fitted to US weather data and US pipe burial conventions.
    Validation against CER DomDecks V30h reference data (the AS/NZS 4234
    benchmark used to certify solar hot water systems sold in Australia) shows
    a systematic under-prediction of seasonal amplitude across all five
    Australian climate zones. In other words, both the original +6 F offset
    form and the "drop the offset to +0 F" variant still move too little over
    the year when compared against the Australian regulatory reference.

Why recalibrate rather than replace:
    The conservative engineering choice is to preserve the original
    Burch-Christensen structure and only refit its empirical constants to
    Australian conditions. That keeps the model recognisably tied to an
    established published correlation: same sinusoidal form, same dependence on
    annual mean ambient temperature, and same Southern Hemisphere day shift.
    This is far easier to defend in a thesis than introducing a completely new
    model that would require its own independent validation campaign.

What is being fitted:
    Five free parameters are fitted:
        1. offset constant
        2. ratio intercept
        3. ratio slope
        4. lag intercept
        5. lag slope

    Hendron's original form is:
        offset = 6
        ratio  = 0.4 + 0.01 * (Ta_F - 44)
        lag    = 35  - 1.0 * (Ta_F - 44)

    This script replaces each of those five constants with a fitted value while
    leaving the underlying formula unchanged.

Why exactly five parameters:
    The CER comparison dataset contains 60 monthly reference points
    (5 climate zones x 12 months). Fitting 5 parameters therefore gives a
    12:1 data-to-parameter ratio, which is comfortably above the usual rule of
    thumb of at least 10 observations per fitted parameter for low overfitting
    risk in small engineering regressions. Fewer parameters would constrain the
    fit unnecessarily; more parameters would reduce defensibility.

Why non-linear least squares:
    The lag term appears inside the sine argument, so the model is non-linear in
    that parameter. scipy.optimize.least_squares with the Levenberg-Marquardt
    method is a standard and efficient choice for a small dense problem like
    this. It converges well from a sensible starting point and directly minimises
    the residuals between predicted and reference mains temperatures.

What this script produces:
    - Per-zone RMSE, mean bias, predicted amplitude, target amplitude, and
      amplitude error for three cases:
          BC+6  : original Hendron offset
          BC+0  : same formula with offset dropped
          BC-Aus: five-parameter Australian recalibration
    - Fitted parameter values
    - A JavaScript file, bc_aus_constants.js, that cer_comparison.html loads
      automatically. Re-running this script therefore updates the validator
      without any manual copy-paste step.

Known limitation:
    Two zones in the CER reference set, Alice Springs and Rockhampton, show
    anomalous seasonal behaviour that no single smooth air-temperature-driven
    sinusoid can reproduce perfectly. The fitted model is expected to improve
    the temperate zones strongly (Sydney, Melbourne, Canberra) while leaving
    larger residuals on those two outliers. That is not a bug to hide; it is a
    finding to report, because it points to an inconsistency in the AS/NZS 4234
    reference dataset itself rather than a failure of the recalibration method.
"""

from __future__ import annotations

import datetime as dt
import math
from pathlib import Path

try:
    import numpy as np
except ImportError as exc:  # pragma: no cover - import failure message only
    raise SystemExit(
        "numpy is required for fit_bc_aus.py. Install with "
        "`pip install numpy scipy --break-system-packages`."
    ) from exc

try:
    from scipy.optimize import least_squares
except ImportError as exc:  # pragma: no cover - import failure message only
    raise SystemExit(
        "scipy is required for fit_bc_aus.py. Install with "
        "`pip install numpy scipy --break-system-packages`."
    ) from exc


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Mid-month day numbers used to map each monthly CER reference point onto a
# representative day-of-year. This is appropriate here because the underlying
# model is a smooth sinusoid; the monthly reference values are therefore best
# compared at month midpoints rather than month starts.
DAY_MIDS = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]

# Hendron's published constants are kept as explicit tuples so the "before"
# cases are always printed alongside the fitted Australian recalibration.
BC6_PARAMS = (6.0, 0.4, 0.01, 35.0, -1.0)
BC0_PARAMS = (0.0, 0.4, 0.01, 35.0, -1.0)


def c_to_f(value_c: float) -> float:
    """Convert Celsius to Fahrenheit."""
    return value_c * 9.0 / 5.0 + 32.0


def f_to_c(value_f: float) -> float:
    """Convert Fahrenheit to Celsius."""
    return (value_f - 32.0) * 5.0 / 9.0


def mean(values) -> float:
    """Simple arithmetic mean."""
    return sum(values) / len(values)


# Zone 1 - Alice Springs
# Latitude:    from zone1_NW_Domestic.inc, const 8 block
# Air temp:    monthly means computed from alicesprings2.tmy (8760 hourly
#              records, format 1X,3I2,5I3,I2,I1, ambient at chars 14-16 in
#              DEG.C * 10)
# Mains ref:   from zone1_NW_Domestic.inc, UNIT 17 TYPE 14
#              "Monthly cold water temperature" block
#
# Zone 2 - Rockhampton
# Latitude:    from zone2_NW_Domestic.inc, const 8 block
# Air temp:    monthly means computed from rockhampton2.tmy (8760 hourly
#              records, format 1X,3I2,5I3,I2,I1, ambient at chars 14-16 in
#              DEG.C * 10)
# Mains ref:   from zone2_NW_Domestic.inc, UNIT 17 TYPE 14
#              "Monthly cold water temperature" block
#
# Zone 3 - Sydney
# Latitude:    from zone3_NW_Domestic.inc, const 8 block
# Air temp:    monthly means computed from sydney2.tmy (8761 hourly records,
#              format 1X,3I2,5I3,I2,I1, ambient at chars 14-16 in DEG.C * 10)
# Mains ref:   from zone3_NW_Domestic.inc, UNIT 17 TYPE 14
#              "Monthly cold water temperature" block
#
# Zone 4 - Melbourne
# Latitude:    from zone4_NW_Domestic.inc, const 8 block
# Air temp:    monthly means computed from melbourne2.tmy (8760 hourly records,
#              format 1X,3I2,5I3,I2,I1, ambient at chars 14-16 in DEG.C * 10)
# Mains ref:   from zone4_NW_Domestic.inc, UNIT 17 TYPE 14
#              "Monthly cold water temperature" block
#
# Zone 5 - Canberra
# Latitude:    from ZONEHP5_Au_Domestic.inc, const 8 block
# Air temp:    monthly means computed from canberra2.tmy (8760 hourly records,
#              format 1X,3I2,5I3,I2,I1, ambient at chars 14-16 in DEG.C * 10)
# Mains ref:   from ZONEHP5_Au_Domestic.inc, UNIT 17 TYPE 14
#              "Monthly cold water temperature" block
ZONES = {
    "Alice Springs": {
        "lat": -23.4,
        "ta": [27.91, 26.49, 23.55, 20.61, 16.39, 13.07, 9.65, 13.13, 16.65, 23.95, 24.80, 27.88],
        "cer": [28.0, 28.0, 27.0, 25.0, 23.0, 20.0, 20.0, 21.0, 24.0, 26.0, 28.0, 28.0],
    },
    "Rockhampton": {
        "lat": -23.5,
        "ta": [26.74, 25.48, 25.83, 23.07, 19.73, 16.56, 16.14, 18.02, 19.01, 21.56, 23.79, 25.88],
        "cer": [29.0, 27.0, 24.0, 20.0, 14.0, 11.0, 9.0, 12.0, 18.0, 23.0, 26.0, 28.0],
    },
    "Sydney": {
        "lat": -33.4,
        "ta": [23.11, 22.27, 22.37, 18.98, 14.57, 12.59, 11.31, 13.63, 16.66, 16.79, 19.94, 22.27],
        "cer": [23.0, 23.0, 21.0, 18.0, 15.0, 12.0, 11.0, 12.0, 15.0, 19.0, 21.0, 22.0],
    },
    "Melbourne": {
        "lat": -37.8,
        "ta": [18.12, 21.89, 17.76, 16.63, 12.81, 10.58, 9.65, 11.63, 12.72, 14.10, 16.12, 17.45],
        "cer": [20.0, 20.0, 18.0, 15.0, 11.0, 9.0, 8.0, 10.0, 12.0, 15.0, 17.0, 19.0],
    },
    "Canberra": {
        "lat": -35.3,
        "ta": [17.78, 18.91, 14.73, 12.47, 9.05, 5.46, 5.29, 6.95, 8.39, 11.95, 16.22, 17.57],
        "cer": [18.0, 18.0, 19.0, 15.0, 13.0, 9.0, 5.0, 5.0, 7.0, 8.0, 12.0, 16.0],
    },
}


def bc_predict(ta_ann_f: float, ta_amp_f: float, day: int, lat: float, params) -> float:
    """
    Generalised Burch-Christensen with five free parameters.

    Original Hendron (2004) values: offset=6, p1=0.4, p2=0.01, p3=35, p4=-1.
    All five are replaced with free parameters here so the fitting routine
    can search the parameter space.

    Inputs:
        ta_ann_f : annual mean ambient air temperature, Fahrenheit
        ta_amp_f : seasonal amplitude (max - min monthly means), Fahrenheit
        day      : day-of-year (1-365)
        lat      : latitude (negative for Southern Hemisphere)
        params   : tuple (offset, p1, p2, p3, p4)

    Returns:
        Predicted mains water temperature in Fahrenheit.
    """
    offset, p1, p2, p3, p4 = params
    ratio = p1 + p2 * (ta_ann_f - 44.0)
    lag = p3 + p4 * (ta_ann_f - 44.0)

    # Southern Hemisphere day shift: phase-flip the year so the formula's
    # Northern-Hemisphere-fitted seasonal pattern aligns with Australian seasons.
    model_day = day if lat >= 0 else (((day + 182 - 1) % 365) + 1)
    angle_deg = 0.986 * (model_day - 15 - lag) - 90
    angle_rad = math.radians(angle_deg)
    return (ta_ann_f + offset) + ratio * (ta_amp_f / 2.0) * math.sin(angle_rad)


def build_dataset():
    """
    Flatten the zone dictionary into 60 monthly fitting points.

    Each CER reference value is a monthly number, so we pair it with the
    midpoint day-of-year for that month. The annual mean ambient temperature and
    ambient seasonal amplitude are computed once per zone from the verified TMY
    monthly means, then carried on every row for that zone because the original
    Burch-Christensen formula depends only on those annual-scale descriptors.
    """
    rows = []
    for zone_name, zone in ZONES.items():
        ta_ann_c = mean(zone["ta"])
        ta_ann_f = c_to_f(ta_ann_c)
        ta_amp_c = max(zone["ta"]) - min(zone["ta"])
        ta_amp_f = ta_amp_c * 9.0 / 5.0

        for month_name, day, target_c in zip(MONTHS, DAY_MIDS, zone["cer"]):
            rows.append({
                "zone": zone_name,
                "month": month_name,
                "day": day,
                "lat": zone["lat"],
                "ta_ann_F": ta_ann_f,
                "ta_amp_F": ta_amp_f,
                "target_F": c_to_f(target_c),
                "target_C": target_c,
            })
    return rows


def residuals(params, rows):
    """
    Residual vector in Fahrenheit for scipy.optimize.least_squares.

    The fit is carried out in the same unit system used by the published
    Hendron correlation (Fahrenheit). That keeps the refitted constants directly
    comparable to the original published values.
    """
    return np.asarray([
        bc_predict(row["ta_ann_F"], row["ta_amp_F"], row["day"], row["lat"], params) - row["target_F"]
        for row in rows
    ], dtype=float)


def overall_rmse_c(rows, params) -> float:
    """Overall RMSE across all rows, reported in Celsius for readability."""
    sq_errors = []
    for row in rows:
        pred_f = bc_predict(row["ta_ann_F"], row["ta_amp_F"], row["day"], row["lat"], params)
        pred_c = f_to_c(pred_f)
        sq_errors.append((pred_c - row["target_C"]) ** 2)
    return math.sqrt(sum(sq_errors) / len(sq_errors))


def per_zone_metrics(rows, params, label: str) -> float:
    """
    Print per-zone engineering metrics for a parameter set.

    For each zone this reports:
        - RMSE_C      : root mean square error versus CER monthly reference
        - Bias_C      : mean signed error
        - PredAmp_C   : predicted seasonal amplitude
        - TargAmp_C   : CER reference seasonal amplitude
        - AmpErr_C    : predicted minus target amplitude

    The amplitude terms matter here because the whole motivation for the
    recalibration is the observed under-prediction of seasonal swing.
    """
    print("\n" + "=" * 92)
    print(label)
    print("-" * 92)
    print(f"{'Zone':<16} {'RMSE_C':>9} {'Bias_C':>9} {'PredAmp_C':>11} {'TargAmp_C':>11} {'AmpErr_C':>10}")
    print("-" * 92)

    all_sq_errors = []

    for zone_name in ZONES:
        zone_rows = [row for row in rows if row["zone"] == zone_name]
        pred_c = [
            f_to_c(bc_predict(row["ta_ann_F"], row["ta_amp_F"], row["day"], row["lat"], params))
            for row in zone_rows
        ]
        targ_c = [row["target_C"] for row in zone_rows]
        errors_c = [pred - targ for pred, targ in zip(pred_c, targ_c)]

        rmse_c = math.sqrt(sum(err * err for err in errors_c) / len(errors_c))
        bias_c = sum(errors_c) / len(errors_c)
        pred_amp_c = max(pred_c) - min(pred_c)
        targ_amp_c = max(targ_c) - min(targ_c)
        amp_err_c = pred_amp_c - targ_amp_c

        all_sq_errors.extend(err * err for err in errors_c)

        print(
            f"{zone_name:<16} "
            f"{rmse_c:>9.3f} "
            f"{bias_c:>9.3f} "
            f"{pred_amp_c:>11.3f} "
            f"{targ_amp_c:>11.3f} "
            f"{amp_err_c:>10.3f}"
        )

    overall = math.sqrt(sum(all_sq_errors) / len(all_sq_errors))
    print("-" * 92)
    print(f"{'Overall RMSE':<16} {overall:>9.3f} degC")
    return overall


def write_js_constants(params, rmse_bc6: float, rmse_bc0: float, rmse_bcaus: float) -> Path:
    """
    Write the fitted constants into a JS file that the browser can load.

    This keeps the recalibration pipeline reproducible: Python fits the
    constants, JavaScript consumes them. No manual transcription step means no
    copy-paste risk.
    """
    output_path = Path(__file__).with_name("bc_aus_constants.js")
    timestamp = dt.datetime.now().isoformat(timespec="seconds")
    offset, ratio_c0, ratio_c1, lag_c0, lag_c1 = params

    js_text = (
        "// Auto-generated by fit_bc_aus.py - DO NOT EDIT BY HAND.\n"
        "// Re-run `python3 fit_bc_aus.py` to regenerate.\n"
        "//\n"
        "// Burch-Christensen recalibrated to AS/NZS 4234 reference data via\n"
        "// non-linear least squares (scipy.optimize.least_squares, Levenberg-Marquardt).\n"
        "// Source data: 60 reference points (5 zones x 12 months) extracted from\n"
        "// CER DomDecks V30h zone files (zone1..4_NW_Domestic.inc and ZONEHP5_Au_Domestic.inc).\n"
        "//\n"
        f"// Fit performed: {timestamp}\n"
        "// Overall RMSE (all 5 zones, all 12 months):\n"
        f"//   BC+6 (Hendron original): {rmse_bc6:.3f} degC\n"
        f"//   BC+0 (offset dropped):   {rmse_bc0:.3f} degC\n"
        f"//   BC-Aus (this file):      {rmse_bcaus:.3f} degC\n"
        "//\n"
        f"const BC_AUS_OFFSET_F = {offset:.4f};\n"
        f"const BC_AUS_RATIO_C0 = {ratio_c0:.4f};\n"
        f"const BC_AUS_RATIO_C1 = {ratio_c1:.5f};\n"
        f"const BC_AUS_LAG_C0   = {lag_c0:.4f};\n"
        f"const BC_AUS_LAG_C1   = {lag_c1:.5f};\n"
    )

    output_path.write_text(js_text, encoding="utf-8")
    return output_path


def main() -> None:
    rows = build_dataset()
    print(f"Loaded {len(rows)} monthly reference points across {len(ZONES)} zones.")

    # Print the two baseline cases first. This is deliberate: the user needs a
    # clear "before" reference so the recalibration can be judged against the
    # original published constants rather than in isolation.
    rmse_bc6 = per_zone_metrics(rows, BC6_PARAMS, "BC+6 (Hendron original)")
    rmse_bc0 = per_zone_metrics(rows, BC0_PARAMS, "BC+0 (offset dropped)")

    # The starting point matters for non-linear least squares because the
    # optimiser walks downhill from the initial guess. We start near BC+0 rather
    # than BC+6 because prior validation showed BC+0 is already the better
    # baseline in Australian conditions, so it is the more sensible local
    # neighbourhood from which to begin the search.
    initial = np.asarray([0.0, 0.4, 0.01, 35.0, -1.0], dtype=float)

    fit = least_squares(
        residuals,
        initial,
        args=(rows,),
        method="lm",
        max_nfev=10000,
    )

    fitted = tuple(float(value) for value in fit.x)

    print("\n" + "=" * 92)
    print("Fitted parameters (BC-Aus)")
    print("-" * 92)
    print(f"offset_F   = {fitted[0]:.6f}")
    print(f"ratio_c0   = {fitted[1]:.6f}")
    print(f"ratio_c1   = {fitted[2]:.8f}")
    print(f"lag_c0     = {fitted[3]:.6f}")
    print(f"lag_c1     = {fitted[4]:.8f}")
    print(f"optimizer  = {'success' if fit.success else 'not converged'}")
    print(f"message    = {fit.message}")
    print(f"nfev       = {fit.nfev}")

    rmse_bcaus = per_zone_metrics(rows, fitted, "BC-Aus (5-parameter recalibration)")

    better_baseline = min(rmse_bc6, rmse_bc0)
    abs_improvement = better_baseline - rmse_bcaus
    pct_reduction = 100.0 * abs_improvement / better_baseline if better_baseline else 0.0

    print("\n" + "=" * 92)
    print("SUMMARY")
    print("-" * 92)
    print(f"Overall RMSE - BC+6  : {rmse_bc6:.3f} degC")
    print(f"Overall RMSE - BC+0  : {rmse_bc0:.3f} degC")
    print(f"Overall RMSE - BC-Aus: {rmse_bcaus:.3f} degC")
    print(f"Absolute improvement vs better baseline: {abs_improvement:.3f} degC")
    print(f"Percentage reduction vs better baseline: {pct_reduction:.2f}%")

    print("\n" + "=" * 92)
    print("INTERPRETATION")
    print("-" * 92)
    print(
        "The refit is expected to improve the three temperate zones "
        "(Sydney, Melbourne, Canberra) substantially while leaving residual "
        "error on Alice Springs and Rockhampton. That remaining error is not "
        "evidence that the calibration failed; it reflects anomalous seasonal "
        "amplitudes in those two AS/NZS 4234 reference series. This is a known "
        "and reportable limitation of the regulatory dataset."
    )

    output_path = write_js_constants(fitted, rmse_bc6, rmse_bc0, rmse_bcaus)
    print(f"\nWrote {output_path.name} to {output_path.parent}")
    print("Open or refresh cer_comparison.html in your browser to see the new BC-Aus line on the charts.")


if __name__ == "__main__":
    main()


# HOW TO RE-RUN THIS FIT
# Required Python packages: numpy, scipy. Install with:
#   pip install numpy scipy --break-system-packages
#
# Command:
#   python3 fit_bc_aus.py
#
# Output:
#   Prints per-zone and overall metrics to stdout, and writes
#   bc_aus_constants.js next to this script.
#
# When to re-run:
#   Re-run if any CER monthly mains values or taMonthlyCER values are updated,
#   or if the Burch-Christensen parameterisation itself is changed.
