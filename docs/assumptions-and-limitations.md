# Assumptions And Limitations

## Scientific Model Locks

- PVT Thermal Model A equations and coefficients are locked to the approved prior-thesis/professor-provided model.
- PVT Thermal Model B equations and coefficients are locked to the approved ISO 9806 implementation.
- Any future change to Model A/B equations or coefficients requires explicit supervisor/user approval.
- Isotropic diffuse transposition remains the core irradiance model.
- Perez may be used only as a benchmark or sensitivity comparison unless explicitly approved.

## Weather And Reproducibility

Live calculations fetch PVGIS TMY data through the local or hosted backend. PVGIS, pvlib, timezone libraries, or backend deployment versions can change over time. For thesis reproducibility:

- use locked fixtures in `validation/fixtures/weather/`
- record app commit hash and backend deployment version
- record whether local or hosted API supplied the weather
- check that live backend records include `solarHour`

Share links reproduce inputs and include metadata, but they do not embed the full 8,760-hour weather dataset. Re-running a shared live scenario can change if the live weather/API/backend changes.

## Commercial Laundry Scope

The commercial-laundry model represents hot-water washing demand only. It includes:

- laundry mass processed
- operating days per week
- wash target temperature
- local mains-water temperature
- total water use per kg laundry
- hot-water fraction
- optional warm-rinse fraction and temperature
- optional user-entered hot-water system loss fraction

It excludes by default:

- tumble drying
- ironing and finishing
- steam finishing
- motors
- ventilation
- compressed air
- whole-site electricity

Australian appliance water/energy labelling is available through WELS and Energy Rating. Public Australian commercial-laundry process-energy benchmarks are limited, so default water-use and hot-water fractions are transparent engineering assumptions and should be replaced by metered machine/site data when available.

## Industry Demand

Industry demand models are planning/validation models, not final design calculations. Existing limitations include:

- hourly matching is direct-use unless an explicit storage model is implemented for that industry
- dairy and brewery process assumptions are simplified low-temperature preheat duties
- hotel process energy is benchmark-based by occupied room-night
- aquatic-centre heat loss is an engineering model and depends strongly on pool area, cover use, wind, humidity, and operating hours

## Economics

Economic outputs are sensitive to editable assumptions:

- electricity price
- feed-in tariff
- gas price
- boiler efficiency
- CAPEX
- OPEX
- system life
- discount rate

Supply-side annual value assumes full utilisation of both PV and heat streams and is therefore an upper-bound supply value. Industry results use hourly demand matching for demand-covered savings.

## Exports And Reports

Summary CSV and PDF/report metrics now use calculation state where available. Remaining limitations:

- hourly-detail CSV is intentionally rounded for readability
- share links do not contain the full weather fixture
- old DOM fallback remains for compatibility if no calculation state is present

## Browser And Hosting

GitHub Pages hosting relies on existing public paths:

- `index.html`
- `js/app.js`
- `css/styles.css`
- `assets/*`
- `pages/*`

The file tree additions under `docs/`, `validation/fixtures/`, and `.github/` do not change public app routes.
