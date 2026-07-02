# Field vs Website — PVT energy comparison (method & numbers)

Records exactly how the numbers in `SOAC_field_vs_website_energy.docx` were
produced, so they are reproducible and traceable for the thesis.

## What was compared

A **matched 19-day window** (2026-03-02 → 03-20, day-of-year 61–79) so the
website and the field cover the same calendar span. Annual website figures are
**not** compared to the 19-day field (they measure different things).

## Field (measured)

From `soac_daily_energy.csv` / `soac_meta.json`:

- PVT thermal, 19-day total: **5,888.4 kWh**
- PVT electricity: **not measured** — the field dataset has no PV-electricity
  sensor (timeseries columns are thermal only: flow, temperatures, `P_kW = flow·cₚ·ΔT`).
- Context: the array generated for only ~110.8 h over the 19 days; median field
  thermal efficiency 0.196 vs certified η₀ 0.4112 (≈0.63× realised).

## Website (CoolSheet, run locally on the preview server)

Common inputs: address "Sydney Olympic Park NSW", collector area
**534.733164 m²**, industry preset **Aquatic Centres**, TMY weather via the
hosted PVGIS backend. Per-hour `th_kWh` and `pvt_pv_kWh` were summed over
day-of-year 61–79 from the hourly-details CSV the calculator generates.

| Config | March 2–20 thermal | March 2–20 electricity | Annual thermal | Annual electricity |
|---|---|---|---|---|
| **Default** (Model A, generic collector coefficients) | 15,995.6 kWh | 9,981.8 kWh | 307,725 kWh | 212,757 kWh |
| **SOAC collector** (Model B, ISO η₀=0.4112, a₁=10.358, a₂=0) | 22,915.1 kWh | 10,168.7 kWh | 450,786 kWh | 216,874 kWh |

Model B input coefficients were entered through the existing UI fields
(`isoEta0`, `isoA1`, `isoA2`) — the thermal models themselves were not modified.

## Result

| Same 19-day window | Field | Website default | Website SOAC coeffs |
|---|---|---|---|
| PVT thermal | 5,888 kWh | 15,996 kWh (**2.7×**) | 22,915 kWh (**3.9×**) |
| PVT electricity | not measured | 9,982 kWh | 10,169 kWh |

## Interpretation (conservative)

The website estimates **modelled supply potential** (typical weather, steady-state
efficiency, collector harvesting whenever the sun is up); the field is **actual
delivered heat** from an intermittently-operated array in one specific autumn.
They measure different things, so the ~2.7–3.9× gap is expected and is driven by
operating time, real-world derating (~0.63×), and TMY-vs-actual weather — **not**
by a website error, and **not** resolved by using the collector's own
coefficients (which actually raise the estimate, because pool inlet water sits
near ambient so the loss term stays small). This is a *modelled-potential vs
delivered-reality* comparison, not a validation of the website.
