# CoolSheet — Supply-Side Formula Validation Record

Living record of the validation of CoolSheet's **supply-side** physics (solar geometry,
irradiance transposition, PV conversion) against `pvlib` 0.15 (the reference solar
library) using identical PVGIS-ERA5 weather data. Resume here for full context.

> **Scope note:** The PVT *thermal* models (Model A simple-linear, Model B ISO 9806)
> are **another student's work and are intentionally NOT modified or re-derived here.**
> This record covers only the irradiance/PV supply side that feeds them.

Last updated: 2026-06-18.

---

## 1. Verdict

The supply-side formulas are **correct and validated**. After the solar-time fix
(section 4), annual plane-of-array yield agrees with pvlib's isotropic model to
**within 0.1%** for Sydney, Melbourne and Perth. Solar geometry matches almanac
values exactly. All 17 unit tests pass.

The remaining differences vs PVWatts/PVGIS-online are **documented modelling choices,
not errors**:
- Isotropic vs Perez sky-diffuse model (~4%, CoolSheet is conservative).
- Database: PVGIS-ERA5 (CoolSheet) vs NSRDB (PVWatts).
- PVWatts applies cell-temperature derating; CoolSheet uses constant η (justified for a
  *cooled* PVT collector — see section 5, item F).

---

## 2. Method & tooling

- **Reference:** `pvlib` 0.15 (`get_pvgis_tmy`, `solarposition`, `irradiance.get_total_irradiance`).
- **Test geometry:** Sydney (−33.8698, 151.2083), Melbourne (−37.8136, 144.9631),
  Perth (−31.9505, 115.8605). Tilt 30°, north-facing, albedo 0.2, η 0.20, A 20 m².
- The app's `TiltedSurfaceRadiation` class is copied **verbatim** into the Node harnesses
  (not paraphrased) so we test the real code path.
- Python 3.14 + `pvlib`/`pandas`/`timezonefinder`; Node v22.

---

## 3. What was checked (and results)

| Check | Result | Notes |
|---|---|---|
| Declination (Cooper eq.) | max err **1.39°** vs pvlib Spencer | Known Cooper limitation; minor |
| Solar-noon zenith | **exact** = \|lat−δ\| | Sydney Dec 10.42°, Jun 57.32° |
| Zenith vs pvlib (BEFORE fix) | RMS 3.2–9.5°, **max 18.8°** | Driven by clock-vs-solar time |
| Zenith vs pvlib (AFTER fix) | RMS **~0.4°**, max ~1.2° | solarHour fix, section 4 |
| Azimuth convention | N/S annual ratio **1.98**, E=W | Correct after az = 0°→N fix |
| GHI closure (true zenith) | 0.02–0.07% | Data internally consistent |
| Annual POA vs pvlib (AFTER) | **≤0.1%** all cities | Melbourne +1.40% → +0.01% |
| Edge cases (equator→poles) | no NaN/negatives | 17/17 unit tests pass |

PV-only annual kWh (20 m², η 0.20, 30° tilt, north), after fix vs pvlib isotropic:

| City | App (after) | pvlib | Δ |
|---|---|---|---|
| Sydney | 7,286.9 | 7,288.6 | −0.02% |
| Melbourne | 7,356.9 | 7,356.3 | +0.01% |
| Perth | 8,499.9 | 8,506.8 | −0.08% |

---

## 4. Issues FOUND and FIXED

### A. Azimuth convention (FIXED — earlier session)
The Duffie–Beckman incidence formula uses γ=0 ⇒ south. For Australia the UI now takes
**0° = north** and the class maps it internally (`surfaceAzimuth − 180`). Defaults:
tilt 30°, azimuth 0° (north). Verified: north-facing beats south ~2:1 annually.

### B. Clock-vs-solar time (FIXED — this session) ⭐ main finding
`server.py` labelled each hour by **local clock time** (incl. daylight saving), but the
hour-angle formula `15·(h−12)` assumes **solar time**. This caused instantaneous zenith
errors up to **18.8°** (worst in Melbourne: big meridian offset + DST; best in Perth: no
DST). Annual totals were only off ≤1.4% (errors roughly cancel about noon), but the
**hourly profile** — which drives demand matching — was shifted up to ~1 h in summer.

**Fix (backward-compatible):**
- `pvt-tmy-api/server.py` now emits `solarHour` per record = true solar time from the
  **UTC** instant + longitude + equation of time (DST-free, meridian-correct).
- `app.js` `normalizeWeatherRecords` parses `solarHour`; the hourly loop feeds it to the
  solar-geometry calc, **falling back to clock `hourN`** when absent (older backend).
- Demand-side scheduling still uses clock `hourN` (loads happen at clock hours).

Proven: zenith RMS 9.5°→0.43° (Melbourne); annual POA error 1.40%→0.01%.
**Requires backend redeploy** to take effect on the hosted API (onrender). Until then the
front-end falls back to the previous behaviour automatically — nothing breaks.

---

## 5. Known limitations (documented, NOT bugs)

- **C. Isotropic sky-diffuse model.** ~4% lower than Perez (used by PVGIS/PVWatts).
  Conservative; kept partly because the thermal Model A/B coefficients were calibrated on
  this irradiance basis — changing it would desync them.
- **D. Cooper declination** (±1.39°). Could be replaced by Spencer for a further
  ~0.3° zenith improvement (variant C in `scripts/prove_fix.py`) — marginal, not applied.
- **E. Measured GHI is reconstructed** (`DNI·cosθz + DHI`) rather than read from the data.
  Only feeds the small ground-reflected term; annual impact negligible (<0.2%).
- **F. Constant PV efficiency** (no temperature derating). If these were *uncooled*
  panels, temperature would cut output 2.5% (Sydney/Melbourne) to 4.1% (Perth). A PVT
  collector actively cools the cells, recovering most of that — so constant η is a
  reasonable, slightly optimistic choice. The electrical *boost* from cooling is not
  modelled (conservative).

---

## 6. Files & how to re-run

All scripts are run from the repo root. Python re-fetches PVGIS (~30 s, cached 24 h).

| File | Purpose | Run |
|---|---|---|
| `scripts/verify_formulas.py` | Fetch TMY, pvlib isotropic+Perez reference, export `fixtures/tmy/tmy_*.json` and `reference/reference_summary.json` | `python validation/scripts/verify_formulas.py` |
| `scripts/verify_js.mjs` | App class vs pvlib + solar-time isolation | `node validation/scripts/verify_js.mjs` |
| `scripts/deep_validation.py` | Declination/zenith/GHI-closure/components/peak-timing/PV-temp | `python validation/scripts/deep_validation.py` |
| `scripts/prove_fix.py` | Proves solarHour collapses zenith error (variants A/B/C) | `python validation/scripts/prove_fix.py` |
| `backend/backend_e2e.py` | Calls the REAL `server.tmy()`, exports `fixtures/backend/backend_*.json` | `python validation/backend/backend_e2e.py` |
| `scripts/verify_js_e2e.mjs` | Real backend output → real front-end logic, before/after | `node validation/scripts/verify_js_e2e.mjs` |
| `unit/test_geometry.mjs` | 17 assertion unit tests (known values + edge cases) | `node validation/unit/test_geometry.mjs` |
| `scripts/spot_check.mjs`, `scripts/az_check.mjs` | Quick geometry / azimuth sanity prints | `node validation/scripts/<file>` |

Generated data: `fixtures/tmy/tmy_*.json`, `fixtures/backend/backend_*.json`, `reference/reference_summary.json`, `reference/deep_results.json`.

Demand-side / industry & economics scripts (added later):
| File | Purpose | Run |
|---|---|---|
| `unit/test_industry.mjs` | Extracts REAL dairy/brewery/aquatic/hotel functions from app.js; checks benchmarks + Q=mcΔT + aquatic physics + hotel per-room-night and weather-shaped hotel electricity | `node validation/unit/test_industry.mjs` |
| `unit/test_economics.mjs` | CRF, NPV annuity, LCOE split, heat-saving conversion, payback | `node validation/unit/test_economics.mjs` |
| `scripts/check_links.mjs` | Verifies every cited URL in app.js resolves | `node validation/scripts/check_links.mjs` |

---

## 6b. Demand-side models — validation & Australian references

The four industry demand models were tested (real code, via `unit/test_industry.mjs`) and their
sources reviewed/strengthened against Australian data. **Model A/B thermal still untouched.**

| Model | Benchmark / basis | Australian references | Tests |
|---|---|---|---|
| Dairy | 1.37 L/L milk → 35 °C; 51.7 kWh/kL | RACE for 2030, NADH, Eco-efficiency, EnergySmart (all AU; primary justification PDF unpublished) | ✅ |
| Brewery | 1.85 L/L beer → 40–45 °C; 11.50 kWh/hL | AU beer-production seasonal; process intensities international | ✅ |
| **Aquatic** | Physics heat-loss (evap + makeup + sensible) | **Added:** ASHRAE/Shah evaporation, EnergyPlus, Sydney Water best-practice, Deakin (Victoria) benchmark, NSW Govt guide — `buildAquaticModelBasisHtml()` | ✅ (evap dominant; ~1092 kWh/m² pool) |
| **Hotel** | kWh per occupied room-night | **Added:** NABERS for Hotels, SA Water factsheet — `buildHotelModelBasisHtml()`. **DHW tuned 5.5 → 4.5 kWh/room-night** to match ~3 kWh/guest-night AU benchmark | ✅ |

Reference-link check: 27 OK · 1 review (ScienceDirect bot-block, fine) · **0 broken**.
Economics: 12/12 finance formulas correct & self-consistent.
Functional smoke: dairy + brewery run geocode→calculate→charts with **0 console errors**; all
4 model-basis panels render. (Hotel/aquatic UI need their own inputs; demand math unit-tested.)

Note: the BC-Aus mains-water model already has its own validation pages (`validation.html`,
`validation2.html`) vs CER, so it was not re-tested here.

---

## 7. Open / possible next steps

- [ ] Redeploy `pvt-tmy-api` so the hosted API emits `solarHour` (then live results match
      the validated numbers above; until then the front-end uses the safe fallback).
- [ ] (Optional) Replace Cooper declination with Spencer for ~0.3° more zenith accuracy.
- [ ] (Optional) Offer a Perez transposition toggle if matching PVGIS/PVWatts exactly is
      desired — but re-check Model A/B coefficient calibration first.
- [ ] Extend unit tests with a small fixed TMY fixture so `unit/test_geometry.mjs` can assert
      an annual-POA number offline (no network).
