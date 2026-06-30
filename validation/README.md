# Validation Directory

This directory contains validation code and locked evidence files for the PVT calculator.

## Layout

| Folder | Purpose |
|---|---|
| `unit/` | Offline Node validation tests for geometry, industry demand, economics, PVT model locks, fixture integrity, no-NaN checks, and export/share contracts. |
| `browser/` | Playwright browser tests for local smoke testing and live deployed-site validation. |
| `backend/` | Python backend contract tests and backend fixture generation harnesses. |
| `fixtures/weather/` | Locked 8,760-hour weather fixtures for Australian cities. |
| `fixtures/backend/` | Locked backend output fixtures used by solar/PV reference tests. |
| `fixtures/tmy/` | Locked TMY fixtures used by historical solar-hour comparison scripts. |
| `fixtures/cer/` | CER/TRNSYS deck excerpts used by the mains-water validation pages. |
| `fixtures/energyplus/` | EnergyPlus/OneBuilding TMYx `.stat` files used by ground-temperature validation pages. |
| `reference/` | pvlib/reference summaries and deep-validation JSON outputs. |
| `scripts/` | Manual or supporting validation scripts, including fixture refresh and link checks. |
| `reports/` | Generated validation reports. Live reports are ignored by git. |

## Common Commands

Run the offline suite from the repository root:

```text
npm test
```

Run browser validation:

```text
npm run test:browser
```

Run live deployed-site validation:

```text
npm run test:live-industries
```

Refresh locked weather fixtures only when deliberately updating the baseline:

```text
npm run fixtures:weather
```

The frontend (`index.html`, `css/`, `js/`, `assets/`, `pages/`) and backend (`pvt-tmy-api/`) deployment paths are intentionally outside this validation-only restructure.
