# SOAC March 2026 — Field-Data Analysis

Analysis of the Sydney Olympic Aquatic Centre PVT array over 2026-03-02 to
2026-03-20 (19 days, 5-minute data). All figures below are computed directly
from the extracted files; the extractor and stats are re-runnable. Where a
dashboard headline figure differs from a recomputed one, **both are shown** and
the difference is explained rather than hidden.

> **Scope note.** This is an *autumn, 19-day, single-site* campaign on one
> specific uncovered PVT collector. It is a useful reality check, not a
> general validation of the calculator's annual TMY estimates.

---

## 1. Thermal energy

| Metric | Value | Source |
|---|---|---|
| Total thermal energy (reported) | **5,888.4 kWh** | `meta.total_kWh` (= sum of `daily.E_kWh`) |
| Total by naive 5-min integration of `P_kW` | 6,425.8 kWh | recomputed from `soac_timeseries.csv` |
| Best day | **2026-03-11 → 685.7 kWh** | `meta.best_day` |
| Daily range (operating days, E > 1 kWh) | **10.4 kWh (03-13) … 685.7 kWh (03-11)** | `soac_daily_energy.csv` |
| Operating days / total days | 17 / 19 | 2 zero-or-near-zero days (03-02 = 0, 03-18 = 0.3 kWh) |

**Raw vs processed — a ~9 % gap.** Naively integrating the raw instantaneous
`P_kW` column gives **6,426 kWh**, about **9 % higher** than the dashboard's
reported **5,888 kWh** (which equals the sum of the daily energies). The reported
total is the *processed / quality-controlled* figure; the naive integral
includes transient spikes, restart artefacts, and 20 samples of negative power.
**Use 5,888 kWh as the measured energy** and treat the raw integral as an
upper, artefact-inflated bound. This is a provenance distinction, not an error.

Several low-energy days (03-08 = 54.7, 03-09 = 51.9, 03-13 = 10.4, 03-18 = 0.3,
03-02 = 0 kWh) indicate overcast weather or downtime; they are genuine but
should not be mistaken for collector under-performance.

---

## 2. Thermal power

| Metric | Value | Notes |
|---|---|---|
| Peak power (reported) | **209 kW** | `meta.peak_kW` |
| Peak of 15-min rolled power `P_roll15` | 170.8 kW | recomputed |
| Single raw instantaneous max `P_kW` | 279.9 kW | recomputed — only **1** sample exceeds 209 kW |
| Median power (reported) | **62 kW** | `meta.median_kW` |
| Median power over generating samples (P > 0) | 54.4 kW | recomputed |
| Total generating time (P > 0) | 110.8 h over 19 days (~5.8 h/day) | recomputed |

The reported 209 kW peak sits **between** the de-spiked 15-min max (171 kW) and
the single 280 kW raw spike, consistent with a percentile/de-spiked peak rather
than the raw maximum. The small reported-vs-recomputed median gap (62 vs 54 kW)
is a definitional one (which samples count as "generating"), not a discrepancy
of concern.

---

## 3. Thermal efficiency

| Metric | Value | Source |
|---|---|---|
| Median efficiency | **0.196** | `meta.median_eta` (recomputed 0.197 — matches) |
| Peak efficiency (reported) | **0.474** | `meta.peak_eta` |
| Raw instantaneous max efficiency | 0.661 | recomputed |
| Certified optical efficiency η₀ | 0.4112 | modelled, `meta.eta0` |

**Physically implausible instantaneous points exist.** 27 samples show
efficiency **above the modelled optical η₀ (0.4112)**, peaking at a raw 0.661.
Steady-state efficiency cannot exceed η₀; these points reflect thermal-mass
discharge, cloud/flow transients, or sensor timing — i.e. **transient, not
steady-state, behaviour**. They must be excluded from any steady-state check.

---

## 4. Relationships: irradiance, inlet temperature, efficiency, output

Pearson correlations over the operating scatter cloud (`soac_scatter.csv`, n = 5,511):

| Pair | r | Interpretation |
|---|---|---|
| ΔT ↔ P_kW | **+0.95** | Near-mechanical: P = flow · cₚ · ΔT, so ΔT drives power. |
| G ↔ P_kW | **+0.68** | More irradiance → more thermal power (expected). |
| T_in ↔ η | **+0.54** | **Confounded — do not read as causal (see below).** |
| G ↔ η | +0.14 | Efficiency rises weakly with irradiance (relative losses fall; startup low-G points drag η down). |

**The positive T_in ↔ η correlation is a confounding artefact, not physics.**
First-order collector theory says efficiency *falls* as inlet temperature rises
(the loss term a₁·(Tₘ − Tₐ)/G grows). The raw data shows the *opposite* sign
because high inlet temperatures occur at midday when irradiance is high and the
array is running well (high η), while low inlet temperatures occur at cold
start-up with low η. Time-of-day and irradiance confound the raw correlation.
**A thesis must not cite this as "hotter inlet improves efficiency."** The
correct, de-confounded relationship only appears when efficiency is compared at
matched (Tₘ − Tₐ)/G — i.e. against the ISO curve (§6).

Operating envelope in the field cloud: G ≈ 101–893 W/m², T_in ≈ 22.9–37.5 °C.

---

## 5. Transient / restart behaviour to exclude from steady-state validation

The source flags **220 restart events** and **1,496 transient samples**
(`meta.n_restarts`, `meta.n_transient`) out of 5,472 — i.e. roughly a quarter of
all samples are non-steady. Direct evidence in the extracted data:

- 27 samples with η > η₀ (impossible in steady state);
- 20 samples with negative `P_kW`;
- a single 280 kW power spike well above the 171 kW rolled maximum.

**Any steady-state efficiency comparison must first filter to steady points**
(pump on, stable flow, η ≤ η₀, non-restart). The provided columns do not carry a
per-sample "transient" boolean, so the pragmatic filter used below is
*bright-sun, generating* points (G ≥ 700 W/m², P > 0); a stricter validation
would re-derive the steady-state mask from the raw feed.

---

## 6. Comparison against the CoolSheet website model

This is deliberately conservative. Two very different things could be "compared",
and only one of them is defensible.

### 6a. NOT comparable: website annual TMY estimate vs this campaign

The public calculator produces an **annual** energy estimate from a **Typical
Meteorological Year** and a generic collector parameterisation. This dataset is a
**19-day autumn** window with the site's **own measured weather**. They differ in
period, weather, season, and aggregation. Comparing the calculator's annual kWh
to 5,888 kWh over 19 days — or scaling either to match — would be **misleading
and is not done here.**

### 6b. Defensible: ISO steady-state collector model vs field, at matched conditions

The physics inside the calculator's ISO 9806 thermal model is
η = η₀ − a₁·(Tₘ − Tₐ)/G. Driving **that formula with the SOAC certified
coefficients** and the field's **own** measured conditions is a fair,
like-for-like check of the collector model (not of the TMY pipeline):

| Condition band | Field median η | ISO model η (certified a₁) | ISO model η (wind a₁) | Field ÷ ISO(cert) |
|---|---|---|---|---|
| G ≥ 700 W/m² (n = 405), Tₘ ≈ 34 °C, Tₐ ≈ 27 °C | **0.202** | 0.321 | 0.305 | **0.63** |
| G ≥ 600 W/m² (n = 603), Tₘ ≈ 33.7 °C, Tₐ ≈ 27.1 °C | 0.202 | 0.318 | 0.302 | 0.64 |
| All generating medians, G ≈ 574, Tₘ ≈ 31.4 °C, Tₐ ≈ 25.3 °C | 0.196 | 0.302 | 0.284 | 0.65 |

**Finding: the certified ISO model over-predicts field efficiency by roughly
55–60 % (relative) even in bright, quasi-steady conditions.** The field array
delivers about **0.63× the certified steady-state efficiency**. The wind
correction (a₁ = 12.106) moves the model in the right direction — *lower*
efficiency — but only closes a small part of the gap.

This is **not** evidence the calculator is "wrong"; it is evidence that a
laboratory-certified steady-state curve is an **optimistic envelope** for a real,
intermittently-operated pool-heating array with start-up losses, part-load
running, plumbing/optical/soiling losses, and pool-return inlet temperatures. A
thesis should present the ratio (~0.63) as a **real-world derating**, not force
the model onto the data.

### What would be needed for a *fair, quantitative* comparison

1. **Load the SOAC collector coefficients into the calculator** (η₀ = 0.4112,
   a₁ = 10.358 / 12.106, F′ = 0.46, area 534.7 m²). The public defaults are a
   generic collector and will not match this array.
2. **Drive the model with the field's measured G, Tₐ, T_in** at 5-min cadence —
   not TMY — so both sides see identical weather and inlet conditions.
3. **Apply the same steady-state mask** (exclude the 220 restarts / 1,496
   transients; require η ≤ η₀, stable flow).
4. **Compare on matched aggregation** (per-timestep η, or energy over the same
   window) — never annual-vs-19-day.
5. Report an explicit **real-world derating factor** (field ÷ model) with its
   spread, rather than a single "validated / not validated" verdict.

Only after (1)–(4) could a difference be attributed to the model rather than to
mismatched inputs.

---

## 7. Headline recommendations (detail in the proposal)

- Treat 5,888 kWh (processed) as the measured energy; the raw integral over-counts by ~9 %.
- The certified ISO curve over-predicts real efficiency by ~55–60 %; surface a **real-world derating band (~0.6–0.65×)** rather than implying certified numbers are achievable in the field.
- Keep and explain the **wind correction** (a₁ 10.358 → 12.106): it is directionally correct but small relative to the total field/model gap.
- Add an explicit warning that **TMY annual estimates ≠ short-period field measurements.**

See [`SOAC_field_validation_proposal.md`](SOAC_field_validation_proposal.md) for the
proposed validation report and website changes.
