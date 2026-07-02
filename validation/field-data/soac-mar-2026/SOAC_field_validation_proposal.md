# Proposal — "SOAC March 2026 Field Validation" (report / page)

A proposed case-study report for the CoolSheet website. It is written so it can
ship as a Markdown page or be adapted into an HTML validation page under
`pages/`, matching the existing validation pages. It is intentionally
conservative: it presents a **real-world reality check and a derating factor**,
not a claim that the calculator is "validated."

---

## 1. Framing (put this at the top of the page)

> This case study compares one operating PVT array (Sydney Olympic Aquatic
> Centre, 19 days of autumn 2026 monitoring) against the collector physics used
> by CoolSheet. It is a **single-site, short-period field check**, not a
> validation of CoolSheet's annual estimates. Certified laboratory efficiency is
> an optimistic envelope; real arrays deliver less. The value of this study is
> the **measured derating**, and a clear statement of what would be needed for a
> fully fair comparison.

## 2. Comparison table (defensible rows only)

"Model estimate" = the ISO 9806 first-order curve
η = η₀ − a₁·(Tₘ − Tₐ)/G evaluated with the **SOAC certified coefficients**
(η₀ = 0.4112, a₁ = 10.358 / wind 12.106) at the field's **own measured**
conditions. This is the physics CoolSheet's Model B implements — it is *not* the
public calculator's default-coefficient or TMY output.

| # | Quantity | Field measured | Model estimate (ISO, SOAC coeffs) | Difference | Defensible? |
|---|---|---|---|---|---|
| 1 | Thermal efficiency, bright sun (G ≥ 700 W/m²), matched Tₘ−Tₐ | **0.202** (median) | 0.321 (cert) / 0.305 (wind) | field = **0.63×** model; model over-predicts **+59 %** rel. | ✅ Yes — matched conditions, steady-ish points |
| 2 | Thermal efficiency, all generating medians | 0.196 | 0.302 (cert) / 0.284 (wind) | field = 0.65× model | ✅ Yes, with wider spread |
| 3 | Real-world derating factor (field ÷ certified ISO) | — | — | **≈ 0.60–0.65** | ✅ Yes — the headline number |
| 4 | 19-day total thermal energy | 5,888 kWh (processed) | *not run* | — | ⚠️ Only if model driven by field weather + SOAC coeffs + steady mask |
| 5 | Annual energy | n/a (19-day campaign) | website annual TMY estimate | — | ❌ **Not comparable** (period, weather, season, aggregation all differ) |

Rows 1–3 are the defensible content. Row 4 becomes defensible only after the
model is driven with field weather (see the analysis report's "what would be
needed"). Row 5 must be shown as **explicitly not comparable**.

## 3. Supporting field figures (measured, for context — not "vs model")

| Metric | Value |
|---|---|
| Period | 2026-03-02 → 2026-03-20 (19 days, 5-min data) |
| Total thermal energy (processed) | 5,888.4 kWh |
| Best day | 2026-03-11, 685.7 kWh |
| Daily range (operating days) | 10.4 – 685.7 kWh |
| Peak power (reported / de-spiked) | 209 kW |
| Median power (generating) | ~54–62 kW |
| Median efficiency | 0.196 |
| Generating time | ~110 h (~5.8 h/day) |
| Non-steady samples flagged | 220 restarts + 1,496 transients (~27 % of samples) |

---

## 4. Recommended website improvements (from this field data)

### 4.1 Better default efficiency assumptions
The field array delivers ~**0.6–0.65×** the certified steady-state efficiency in
bright conditions. Recommend **surfacing a real-world derating** (e.g. an
optional "field derating ≈ 0.6" toggle or a stated assumption) so users are not
led to expect laboratory-certified efficiency in operation. Do **not** silently
bake it into the core model — expose it as a labelled, editable assumption.

### 4.2 Better wind-correction explanation
The dataset re-derives a₁ from 10.358 → **12.106 W/m²K** for 2 m/s site wind, and
this is directionally correct (windier → lower efficiency). CoolSheet should
**explain the wind sensitivity of a₁ for uncovered collectors** and note that,
while important, wind correction alone closes only a small part of the
field-vs-certified gap — start-up, part-load, and plumbing/optical losses
dominate.

### 4.3 Add a validation / case-study page
Publish this SOAC study as a **case-study page** (linked from the Validation &
references menu) that states plainly: certified curves are an envelope, real
arrays derate, and a fully fair comparison requires field-weather-driven runs.
This strengthens the thesis by showing the model's limits honestly.

### 4.4 Confidence bands / error ranges
CoolSheet currently reports point estimates. Recommend adding **error/confidence
bands** to headline outputs (efficiency, energy, savings) — e.g. a plausible
range driven by a derating factor of ~0.6–0.9 — so results read as estimates with
uncertainty rather than exact predictions.

### 4.5 Warning: TMY annual ≠ short-period field
Add an explicit note wherever annual results appear: **"Annual TMY estimates are
long-run typical-year figures and will not match any specific short monitoring
period or year."** This is the single most important honesty guardrail this
dataset motivates.

---

## 5. Honesty statement (recommended for the page footer)

> This study does **not** validate CoolSheet. It compares one collector's field
> data against the ISO steady-state curve using that collector's own certified
> coefficients, and reports the real-world derating (~0.6×). CoolSheet's annual
> TMY estimates were **not** compared against this 19-day campaign because such a
> comparison would be technically unfair. Raw measurements, processed dashboard
> values, and modelled estimates are kept distinct throughout.
