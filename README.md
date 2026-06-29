# PVT Calculator

Web-based tool for estimating annual energy output and payback of 
photovoltaic-thermal (PVT) solar systems for Australian commercial sites.

## What it does

- Fetches live TMY weather data via PVGIS
- Simulates 8,760 hourly timesteps (full year)
- Models thermal demand for dairy, brewery, hotel, aquatic centre and commercial laundry industries
- Uses BC-Aus, a regionally refitted mains water temperature model
  calibrated to AS/NZS 4234 Australian climate zones

## Files

| File | Purpose |
|---|---|
| `index.html` | Main calculator |
| `cer_comparison.html` | BC-Aus model validation tool |
| `bc_aus_zone_constants.js` | Regional BC-Aus constants (5 climate zones) |
| `fit_bc_aus_by_zone.py` | Script that generates the zone constants |
| `pvt-tmy-api/` | Local FastAPI server for PVGIS weather fetching |

## Running locally

1. Start the TMY API server (a virtual environment keeps dependencies tidy):

```
cd pvt-tmy-api
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt   # on Python 3.9, install unpinned: pvlib timezonefinder tzdata pandas requests fastapi uvicorn
./.venv/bin/python server.py                  # serves http://localhost:8000
```

2. Serve the frontend from the repo root and open it:

```
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

If the local API is not running, the frontend automatically falls back to the
hosted API at pvt-tmy-api.onrender.com (first request may take ~1 minute while
it wakes up).

## Validation commands

The repeatable local validation commands are defined in `package.json`.

```
npm install
npm test
npm run test:geometry
npm run test:industry
npm run test:economics
npm run test:solar-e2e
npm run test:golden-reference
npm run test:pvt-models
npm run test:weather-fixtures
npm run test:backend-solarhour
npm run test:no-nan
npm run test:export-share
npm run test:browser
npm run test:links
```

`npm test` runs the offline core checks. `npm run test:links` performs live URL
checks and needs network access. `npm run test:browser` requires Playwright's
Chromium binary once:

```
npx playwright install chromium
```

Locked weather fixtures can be intentionally refreshed with:

```
npm run fixtures:weather
```

Fixture refresh uses live PVGIS data and should be reviewed before acceptance.

### Email reports

The report email button sends through the FastAPI backend. For local testing,
copy the SMTP template and fill in your email provider's SMTP details:

```
cd pvt-tmy-api
cp .env.example .env
# edit .env with SMTP_HOST, SMTP_FROM, and any required login details
./.venv/bin/python server.py
```

Required variables are `SMTP_HOST` and `SMTP_FROM`. Most providers also require
`SMTP_USER` and `SMTP_PASSWORD`. Use `SMTP_PORT=587` with `SMTP_TLS=true` for
standard STARTTLS SMTP, or `SMTP_PORT=465` with `SMTP_SSL=true` if your provider
requires implicit SSL. The real `.env` file is ignored by git.

## Built with

- Vanilla HTML / JavaScript
- Chart.js
- Python / FastAPI
