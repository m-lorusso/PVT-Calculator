# Reproducibility

## Local Setup

Install JavaScript test dependencies:

```text
npm install
```

Install Python backend dependencies in a virtual environment if needed:

```text
cd pvt-tmy-api
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

## Repeatable Offline Validation

From the repository root:

```text
npm test
```

This runs the offline validation suite against locked fixtures and mocked backend data.

## Browser Smoke

Install Chromium once:

```text
npx playwright install chromium
```

Run:

```text
npm run test:browser
```

## Live Site Industry Matrix

Run the deployed-site validation with:

```text
npm run test:live-industries
```

By default this checks `https://coolsheet-pvt.github.io/`, uses the live Render backend, covers Sydney and Melbourne, and writes an ignored artifact to:

```text
validation/reports/live-results/live-industry-matrix.json
```

Useful overrides:

```powershell
$env:LIVE_BASE_URL="https://coolsheet-pvt.github.io/"
$env:LIVE_MATRIX_CITIES="sydney,melbourne"
$env:LIVE_MATRIX_SKIP_LOCAL="1"
npm run test:live-industries
```

After the Render backend is redeployed, run strict backend-contract validation:

```powershell
$env:LIVE_MATRIX_STRICT_SOLARHOUR="1"
npm run test:live-industries
```

Strict mode should pass only when the live backend returns 8,760 TMY records and 8,760 records with `solarHour`.

## Locked Weather Fixtures

Locked fixtures live in:

```text
validation/fixtures/weather/
```

They cover:

- Sydney
- Melbourne
- Brisbane
- Perth
- Adelaide
- Darwin
- Hobart

Refresh only when intentionally updating the golden weather baseline:

```text
npm run fixtures:weather
npm run test:weather-fixtures
```

Because fixture refresh uses live PVGIS through pvlib, review generated diffs before accepting them.

## Share-Link Reproducibility

Share links encode:

- schema version
- all input values
- location metadata when loaded
- weather metadata when loaded
- compact annual result summary when calculated
- reproducibility warning

They do not embed the full 8,760-hour weather dataset. To reproduce a thesis figure exactly, use the locked fixture and app commit hash rather than a live share-link re-run.

## Hosted Backend Deployment

Local `pvt-tmy-api/server.py` emits `solarHour`. If the hosted Render API does not, redeploy the backend service.

Manual Render steps:

1. Commit and push the repository changes.
2. Open the Render dashboard.
3. Select the `pvt-tmy-api` service.
4. Trigger `Manual Deploy` / `Deploy latest commit`.
5. Wait for the deploy to finish and for `/health` to return OK.

Verification commands from PowerShell:

```powershell
Invoke-RestMethod -Uri "https://pvt-tmy-api.onrender.com/health" -TimeoutSec 30
```

```powershell
$r = Invoke-RestMethod -Uri "https://pvt-tmy-api.onrender.com/tmy?lat=-33.869844&lon=151.208285" -TimeoutSec 90
"records=$($r.records.Count); solarHour=$(( $r.records | Where-Object { $_.PSObject.Properties.Name -contains 'solarHour' } ).Count)"
$r.records[0] | Select-Object dayN,hourN,solarHour,dni,dhi,ghi,ta,vwind
```

Expected result:

```text
records=8760; solarHour=8760
```

If `solarHour=0`, the hosted service is still running old backend code.

## Public Frontend Deployment

GitHub Pages should continue serving the existing public paths:

```text
index.html
js/app.js
css/styles.css
assets/
pages/
```

After pushing frontend changes, verify:

```powershell
Invoke-WebRequest -Uri "https://coolsheet-pvt.github.io/" -UseBasicParsing -TimeoutSec 30
```

Then open the page in a browser, select `Commercial Laundry`, and confirm the laundry inputs appear.
