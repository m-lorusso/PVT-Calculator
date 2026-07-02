# PV-Only Benchmark Comparison for Coolsheet PVT Calculator

Date: 2026-07-02 · Coolsheet version 13.11 · Prepared as a basic validation note / thesis appendix.

## 1. Purpose

This document checks whether the Coolsheet calculator's **PV-only electrical output**
(the "PV-only baseline" figure) is broadly consistent with external PV-only
calculators when the inputs are matched as closely as each external tool allows.
It covers electrical output only — Coolsheet's PVT thermal output is **not**
compared against PV-only tools.

## 2. Method

- Coolsheet was run locally (v13.11) in **PV-only comparison mode**: the
  "PV-only baseline" output, which models an uncooled PV array (NOCT cell-temperature
  model, temperature coefficient applied) with **no inverter, wiring, soiling or
  availability losses**.
- Coolsheet specifies PV area and efficiency. System size was converted with
  **kW = Area (m²) × 1000 W/m² × efficiency ÷ 1000**, so 25 m² × 0.20 = **5.0 kW**
  was used for every case.
- External calculators were configured with the same coordinates (taken from
  Coolsheet's geocoder), 5 kW capacity, 30° tilt and north-facing azimuth, with
  system losses set to zero where the tool allows it. Where an input could not
  be controlled, this is recorded as "not adjustable".
- No attempt was made to force agreement; differences are reported as found.

### External tools considered

| Tool | Used? | Reason |
|---|---|---|
| [PVGIS 5.3 PVcalc](https://re.jrc.ec.europa.eu/pvg_tools/en/) (EU JRC) | **Yes — primary** | Free API, covers Australia, all key inputs adjustable (kWp, tilt, azimuth, loss). Caveat: uses the PVGIS-ERA5 weather family, which is also Coolsheet's weather source — so this comparison isolates the **PV conversion model**, not the weather data. |
| [Renewables.ninja](https://www.renewables.ninja/) (Imperial College/ETH, GSEE model) | **Yes — independent weather** | Free API, all key inputs adjustable. Uses NASA MERRA-2 reanalysis for a single actual year (2019 used here) — fully independent of ERA5, but its simulations are bias-corrected only for Europe, and MERRA-2 irradiance is known to run low in parts of Australia. |
| [Global Solar Atlas](https://globalsolaratlas.info/) (World Bank / Solargis) | **Yes — context only** | Free API, satellite-derived Solargis data (independent). But tilt is fixed at the tool's optimum (31°/31°/28° here, close to 30°) and it applies a fixed, non-adjustable set of real-system losses — so it is a "realistic system" reference, not a matched-physics one. |
| [SunSPOT](https://www.sunspot.org.au/) (APVI/UNSW) | No | Preferred Australian tool, but it derives tilt/azimuth from real roof geometry drawn on a map, has no API, and does not accept free tilt/azimuth/loss inputs — matched-input comparison is not possible. Recommended as a manual follow-up. |
| [NREL PVWatts v8](https://pvwatts.nrel.gov/) | No | Intended as a reference, but nrel.gov was unreachable from the test machine at the time of writing (DNS failure; PVGIS and the others resolved normally). Recorded honestly rather than substituted with assumed numbers. |
| SolarQuotes and similar retail estimators | No | Fixed marketing assumptions; tilt/azimuth/losses not controllable. |
| Solcast | No | Requires a commercial account/API key. |

## 3. Input Matching Table

Common technical inputs for all cases: 5.0 kW (= 25 m² × 20%), tilt 30°, north-facing,
no shading, ground albedo 0.2, temperature coefficient −0.40 %/°C, NOCT 45 °C.

| Test case | Location (lat, lon) | PV size / area | Tilt | Azimuth | PV efficiency | Loss / derating assumption | Weather source / tool | Notes on input matching |
|---|---|---|---|---|---|---|---|---|
| 1 | Sydney NSW (−33.8644, 151.2022) | 5.0 kW / 25 m² | 30° | North (Coolsheet 0°; PVGIS aspect 180; ninja azim 0) | 20% | Coolsheet: none beyond temperature. PVGIS: loss = 0%. Ninja: system_loss = 0. GSA: fixed losses, **not adjustable** | Coolsheet: PVGIS-ERA5 TMY · PVGIS: ERA5 · Ninja: MERRA-2 (2019) · GSA: Solargis | GSA tilt = OPTA 31°, **not adjustable**; ninja is one actual year, not a TMY |
| 2 | Melbourne VIC (−37.8243, 145.0583) | same | 30° | North | 20% | same | same | Geocoder resolved to Camberwell, inner-east Melbourne; GSA OPTA 31° |
| 3 | Brisbane QLD (−27.4809, 153.0337) | same | 30° | North | 20% | same | same | GSA OPTA 28° |

Albedo, temperature coefficient and NOCT are **assumed by each reference tool**
(not user-settable in PVGIS/ninja/GSA); their internal temperature models differ
from Coolsheet's NOCT approach by design.

## 4. Results Comparison Table

Difference (%) = (Coolsheet − External) ÷ External × 100.
Assessment: Good ≤ ±5% · Reasonable ≤ ±10% · Needs investigation > ±10%.

### 4a. Primary — PVGIS 5.3 (matched physics: 5 kWp, 30°, north, loss 0%)

| Test case | Coolsheet PV-only (kWh/yr) | External tool | External (kWh/yr) | Diff (kWh/yr) | Diff (%) | Assessment |
|---|---|---|---|---|---|---|
| Sydney | 8,612.9 | PVGIS 5.3 PVcalc | 9,002.7 | −389.8 | **−4.3%** | Good agreement |
| Melbourne | 8,464.5 | PVGIS 5.3 PVcalc | 8,448.7 | +15.8 | **+0.2%** | Good agreement |
| Brisbane | 8,939.1 | PVGIS 5.3 PVcalc | 8,922.0 | +17.1 | **+0.2%** | Good agreement |

(For context, PVGIS with its default 14% system loss gives 7,742 / 7,266 / 7,673 kWh —
what a user of the public PVGIS site would see by default.)

### 4b. Independent weather — Renewables.ninja (5 kW, 30°, north, loss 0, MERRA-2, year 2019)

| Test case | Coolsheet (kWh/yr) | External (kWh/yr) | Diff (kWh/yr) | Diff (%) | Assessment |
|---|---|---|---|---|---|
| Sydney | 8,612.9 | 6,273.8 | +2,339.1 | +37.3% | Needs investigation — see §5 |
| Melbourne | 8,464.5 | 6,137.2 | +2,327.3 | +37.9% | Needs investigation — see §5 |
| Brisbane | 8,939.1 | 7,258.8 | +1,680.3 | +23.1% | Needs investigation — see §5 |

### 4c. Context — Global Solar Atlas (PVOUT_csi × 5 kWp; OPTA tilt; fixed real-system losses)

| Test case | Coolsheet (kWh/yr) | External (kWh/yr) | Diff (%) | Note |
|---|---|---|---|---|
| Sydney | 8,612.9 | 7,628.1 | +12.9% | GSA includes ~10% fixed system losses Coolsheet does not model |
| Melbourne | 8,464.5 | 7,007.3 | +20.8% | As above, plus ERA5 Melbourne appears optimistic (see §5) |
| Brisbane | 8,939.1 | 8,075.7 | +10.7% | As above |

## 5. Short Discussion

- **Against PVGIS under matched inputs the agreement is within ±5% in all three
  cities** (−4.3% to +0.2%). Because both tools draw on the ERA5 weather family,
  this specifically indicates the Coolsheet PV conversion chain (transposition,
  temperature correction, efficiency handling) behaves consistently with an
  established reference; it does not independently confirm the weather data.
  The small Sydney residual is consistent with PVGIS using its own transposition
  and temperature/low-irradiance models rather than Coolsheet's isotropic + NOCT
  approach.
- **The Renewables.ninja gap (+23% to +38%) is dominated by the reference's
  weather, not necessarily by Coolsheet.** Ninja simulates one actual year (2019)
  from coarse MERRA-2 reanalysis and applies bias correction only in Europe; its
  Sydney figure of 1,255 kWh/kWp at zero losses is well below typical measured
  Australian yields (real systems with ~10–15% losses commonly achieve
  ~1,400–1,500 kWh/kWp in Sydney), which supports the view that this reference
  reads low in Australia. It is retained for transparency as the only fully
  weather-independent parameterised reference available.
- **Global Solar Atlas lands where expected once losses are accounted for.**
  GSA models a realistic system with fixed (non-adjustable) losses of roughly
  10%; Coolsheet's zero-loss PV-only figure sitting ~11–13% above GSA in Sydney
  and Brisbane is consistent with exactly that assumption gap.
- **Melbourne is the visible outlier pattern.** Coolsheet (ERA5) puts Melbourne
  only ~1.7% below Sydney, whereas the satellite-based GSA puts it ~8% below.
  This suggests the ERA5 Melbourne TMY irradiance runs somewhat high relative to
  satellite-derived data — a weather-dataset effect worth noting when quoting
  Melbourne results, not a PV-model error (PVGIS-ERA5 shows the same pattern).
- **Coolsheet models no inverter, wiring, soiling or availability losses** in the
  PV-only figure. Users comparing against retail calculators or real bills should
  expect those tools/systems to read ~10–15% lower for that reason alone.

## 6. Conclusion

Under matched inputs, the Coolsheet PV-only electrical model agrees with the
PVGIS 5.3 reference to within ±5% across Sydney, Melbourne and Brisbane, and its
offset above the Global Solar Atlas "realistic system" reference (~11–13% in two
of three cities) is consistent with Coolsheet's stated zero-balance-of-system-loss
assumption. The large gap against Renewables.ninja is attributable primarily to
that reference's uncorrected MERRA-2 weather and single-year basis rather than to
the Coolsheet model. On this evidence the Coolsheet PV-only model appears
**reasonable**, with two caveats worth stating in the thesis: results are
gross-of-system-losses, and ERA5-based Melbourne irradiance appears optimistic
relative to satellite-derived references.

## Appendix — Reproduction record

Coolsheet: local build v13.11, inputs as in §3, industry preset "None"; the
"PV-only baseline" metric was read from the annual results
(internally `E_pv_standalone_kWh`, uncooled NOCT model).

Raw API responses are archived in `validation/reference/pv-benchmark/`
(fetched 2026-07-02):

```
PVGIS   https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=<LAT>&lon=<LON>&peakpower=5&loss=0&angle=30&aspect=180&outputformat=json
Ninja   https://www.renewables.ninja/api/data/pv?lat=<LAT>&lon=<LON>&date_from=2019-01-01&date_to=2019-12-31&dataset=merra2&capacity=5&system_loss=0&tracking=0&tilt=30&azim=0&format=json
GSA     https://api.globalsolaratlas.info/data/lta?loc=<LAT>,<LON>
```

Azimuth conventions differ per tool and were converted: Coolsheet 0° = north;
PVGIS aspect 180° = north; Renewables.ninja azim 0° = north. PVWatts was not
reachable at the time of writing (DNS failure to nrel.gov); no PVWatts numbers
are quoted.
