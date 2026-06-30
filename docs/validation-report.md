# Validation Report

Last local/offline validation run: 2026-06-29.
Last live deployed industry matrix run: 2026-06-30.

## Summary

All offline validation tests passed after the fixes and additions in this phase.

```text
npm test
PASS: geometry 17/17
PASS: industry 27/27
PASS: economics 12/12
PASS: golden/reference 9/9
PASS: PVT Model A/B locks 9/9
PASS: weather fixtures 119/119
PASS: backend solarHour 2/2
PASS: no-NaN scan 13/13
PASS: export/share contracts 7/7
```

Browser smoke:

```text
npm run test:browser
PASS: 3/3 Playwright tests
```

Live deployed industry matrix:

```text
npm run test:live-industries
PASS: 15/15 live/local scenarios checked
Hard failures: 0
Known backend solarHour failures: 15
```

## Live Deployed Industry Matrix

`validation/browser/live_industry_matrix.spec.mjs` checks the deployed GitHub Pages frontend at `https://coolsheet-pvt.github.io/` against the live Render backend. It runs every implemented industry for Sydney and Melbourne, and also compares Sydney live outputs against the local frontend using the same live weather source.

Industries covered:

| Industry | Validation classification |
|---|---|
| Dairy farm | Benchmarked plus hand-equation checked |
| Brewery | Benchmarked plus hand-equation checked |
| Aquatic centre | Engineering model with documented assumptions |
| Hotel | Benchmark-based demand model |
| Commercial laundry | Assumption-based hot-water washing model with hand-equation checks |

The live run verified:

- live app load, industry selection, required input visibility, chart/table rendering, and no console/page errors
- finite PV-only electricity, PVT electricity, PVT thermal, matched solar heat, industry demand, backup heat, coverage, savings, payback, NPV, LCOE, and LCOH outputs
- no `NaN`, `Infinity`, `undefined`, or visible `null` output text
- industry-specific monotonic checks, such as higher throughput/occupancy/area/kg increasing demand
- commercial laundry excludes drying/process electricity and covers hot-water washing demand only
- live/local Sydney comparisons matched exactly for all checked annual output fields
- hourly CSV, summary CSV, share payload, share-link reload, and generated report HTML content were verified from generated content/state

The known live backend mismatch remains:

```text
records=8760
solarHourRecords=0
```

This is recorded as a known failure in the live matrix so that all industry checks can continue. After Render is redeployed, strict mode should be run with `LIVE_MATRIX_STRICT_SOLARHOUR=1`, where the expected result is `solarHourRecords=8760`.

## Phase 2: Backend solarHour

Local backend code already emitted `solarHour`. The new offline backend test mocks PVGIS and verifies:

- every `/tmy` record includes `solarHour`
- `solarHour` is numeric and in `[0, 24)`
- timestamp-based `hourN` remains in `1..24`
- rotation does not remove `solarHour`

Live hosted check on 2026-06-29 showed the Render endpoint is still behind the local code:

```text
records=8760
solarHourRecords=0
```

The backend code is fixed locally and covered offline; the hosted service still requires a Render redeploy after these repository changes are pushed.

## Phase 3: Locked Weather Fixtures

Seven locked PVGIS/PVlib TMY fixtures were added under `validation/fixtures/weather/`:

- Sydney
- Melbourne
- Brisbane
- Perth
- Adelaide
- Darwin
- Hobart

Each fixture contains 8,760 hourly records and stored annual DNI/DHI/GHI/ambient-temperature checksums. `validation/unit/test_weather_fixtures.mjs` verifies metadata, source labelling, location/timezone fields, field presence, finite values, `solarHour`, hour range, and checksum stability.

## Phase 4: Hybrid Golden Reference

The golden/reference test uses `validation/reference/reference_summary.json`, which was generated from pvlib, to validate:

- isotropic POA annual yield
- PV-only annual kWh
- Perez remains benchmark-only and does not replace isotropic

Current pvlib-reference deltas:

| City | App PV-only | pvlib PV-only | Error |
|---|---:|---:|---:|
| Sydney | 7286.9 kWh | 7288.6 kWh | -0.02% |
| Melbourne | 7356.9 kWh | 7356.3 kWh | +0.01% |
| Perth | 8499.9 kWh | 8506.8 kWh | -0.08% |

## Phase 5: Commercial Laundry

The previous placeholder output was replaced by a hot-water washing demand model. The industry test verifies:

- annual kg = kg/day x days/week x 52
- wash heat equals `m cp DeltaT`
- warm-rinse heat equals `m cp DeltaT`
- system-loss default is zero
- optional system losses apply only to selected wash/rinse hot-water heat terms
- demand scales linearly with kg/day
- zero operating days or no selected process gives zero thermal demand
- higher mains temperature lowers heat demand
- electrical/drying demand is explicitly out of scope

Default hand-check at 18 degC mains:

| Term | Value |
|---|---:|
| Annual laundry mass | 468,000 kg/yr |
| Wash hot-water heat | 148,490.16 kWh/yr |
| Warm-rinse heat | 18,493.28 kWh/yr |
| Total default hot-water heat | 166,983.44 kWh/yr |

## Phases 6-7: Export And Share

Exports and reports now prefer `CURRENT_CALC_RESULT`, a structured calculation-state object populated after a successful calculation. The DOM-scrape path remains only as a fallback.

Share links now encode a versioned payload containing:

- input state
- location metadata
- weather metadata
- compact result summary when a calculation has run
- a reproducibility limitation note

Old flat input-only share links remain readable.

The browser smoke test also injects deliberately wrong rounded DOM text and confirms summary exports/share payloads use calculation state instead.

## Phase 8: PVT Equation Locks

`validation/unit/test_pvt_models.mjs` protects Model A/B by checking source markers and locked numeric cases. No Model A/B equation or coefficient was changed.

## Phase 9: Broader Tests

Added:

- no-NaN/no-Infinity JSON output scan
- export/share state contract test
- Playwright browser smoke test

Existing link checking remains live-network based via `npm run test:links`.

Latest live link result:

```text
Checked 30 cited URLs in js/app.js
26 OK, 4 review/403, 0 broken
```
