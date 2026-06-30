# Test Matrix

## Offline Core Suite

Run:

```text
npm test
```

| Script | Command | Scope | Offline | Current result |
|---|---|---|---:|---|
| Geometry | `npm run test:geometry` | Cooper declination, zenith, incidence, isotropic POA edge cases | Yes | Pass 17/17 |
| Industry | `npm run test:industry` | Dairy, brewery, aquatic, hotel, commercial laundry demand formulas | Yes | Pass 27/27 |
| Economics | `npm run test:economics` | CRF, NPV, LCOE split, heat savings, payback | Yes | Pass 12/12 |
| Solar E2E | `npm run test:solar-e2e` | Existing pvlib comparison table for Sydney/Melbourne/Perth | Yes | Pass, table emitted |
| Golden Reference | `npm run test:golden-reference` | pvlib golden PV-only/isotropic POA outputs | Yes | Pass 9/9 |
| PVT Models | `npm run test:pvt-models` | Model A/B equation source locks and numeric cases | Yes | Pass 9/9 |
| Weather Fixtures | `npm run test:weather-fixtures` | Seven locked TMY fixtures, metadata, checksums, solarHour | Yes | Pass 119/119 |
| Backend solarHour | `npm run test:backend-solarhour` | Mocked backend `/tmy` contract | Yes | Pass 2/2 |
| No-NaN | `npm run test:no-nan` | Locked JSON outputs/fixtures contain no NaN/Infinity | Yes | Pass 13/13 |
| Export/Share | `npm run test:export-share` | Summary/report/share state contracts | Yes | Pass 7/7 |

## Browser

Run:

```text
npm run test:browser
```

| Script | Scope | Requirement | Current result |
|---|---|---|---|
| Playwright smoke | App loads without console errors; commercial-laundry controls show correctly; state-based export/share path beats stale DOM text | `npm install` plus `npx playwright install chromium` | Pass 3/3 |

## Live Network

Run:

```text
npm run test:links
npm run test:live-industries
```

| Script | Scope | Requirement | Current local result |
|---|---|---|---|
| Link checker | Public links in `js/app.js` | Internet access | 26 OK, 4 review/403, 0 broken |
| Live industry matrix | Deployed GitHub Pages frontend plus live Render backend across dairy, brewery, aquatic centre, hotel, and commercial laundry for Sydney and Melbourne | Internet access, Playwright Chromium | Pass: 15 scenarios, 0 hard failures, 15 known backend `solarHour` failures |

`npm run test:live-industries` writes an ignored JSON artifact to `validation/reports/live-results/live-industry-matrix.json`. The command validates app load, industry controls, finite outputs, chart/table rendering, industry-specific physical checks, live/local Sydney output comparison, hourly CSV content, summary CSV content, share payloads, share reloads, and generated report HTML.

The current live backend result is still:

```text
records=8760
solarHourRecords=0
```

After the Render backend is redeployed, rerun strict live validation with `LIVE_MATRIX_STRICT_SOLARHOUR=1`; strict mode expects `solarHourRecords=8760`.

## Fixture Refresh

Run only when deliberately refreshing locked weather baselines:

```text
npm run fixtures:weather
```

This uses live PVGIS through `pvt-tmy-api/server.py` and rewrites `validation/fixtures/weather/*.json`.

## CI

The GitHub Actions workflow runs:

- `npm install`
- `npm test`
- `npx playwright install chromium`
- `npm run test:browser`

Live link checks are left as a separate/manual command because external sites can return transient 403 or rate-limit responses.
