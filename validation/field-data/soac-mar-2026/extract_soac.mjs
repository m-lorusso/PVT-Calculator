// ============================================================================
//  SOAC March 2026 field-data extractor
// ----------------------------------------------------------------------------
//  Reads the embedded `const DATA = {...}` object from the CoolSheet SOAC
//  dashboard HTML and writes clean, machine-readable copies of the raw arrays.
//
//  It does NOT alter, round, or recompute any values — every number written is
//  exactly the value found in the dashboard's DATA object. Derived analysis is
//  kept out of this file on purpose (see analysis_report.md).
//
//  Run from the repo root:
//    node validation/field-data/soac-mar-2026/extract_soac.mjs
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "CoolSheet_Dashboard_SOAC_Mar2026_WindCorrected.htm");

// --- Locate and parse the DATA object literal (string-aware brace matching) ---
const html = fs.readFileSync(SRC, "utf8");
const marker = "const DATA =";
const markerIdx = html.indexOf(marker);
if (markerIdx < 0) throw new Error("`const DATA =` not found in source HTML");
const braceStart = html.indexOf("{", markerIdx + marker.length);
let depth = 0, inStr = false, strCh = "", esc = false, end = -1;
for (let j = braceStart; j < html.length; j++) {
  const c = html[j];
  if (inStr) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === strCh) inStr = false;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") { depth--; if (depth === 0) { end = j; break; } }
}
if (end < 0) throw new Error("Unbalanced DATA object literal");
// eslint-disable-next-line no-eval
const DATA = (0, eval)("(" + html.slice(braceStart, end + 1) + ")");

// --- CSV helper (values written verbatim; blank cell for null/undefined) ----
const cell = (v) => (v === null || v === undefined) ? "" : String(v);
function writeCsv(file, header, rows) {
  const lines = [header.join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  fs.writeFileSync(path.join(HERE, file), lines.join("\n") + "\n");
  return rows.length;
}

// 1) meta -> JSON (verbatim) --------------------------------------------------
fs.writeFileSync(path.join(HERE, "soac_meta.json"), JSON.stringify(DATA.meta, null, 2) + "\n");

// 2) timeseries -> CSV (5-min columns, one row per timestamp) -----------------
const ts = DATA.ts;
const tsCols = ["t", "T_in", "T_out", "T_amb", "T1", "T2", "flow", "delta_T",
                "P_kW", "P_roll15", "eta", "eta_roll", "G", "buf_high", "buf_low"];
const nTs = ts.t.length;
const tsRows = [];
for (let i = 0; i < nTs; i++) tsRows.push(tsCols.map((k) => ts[k][i]));
const nTsWritten = writeCsv("soac_timeseries.csv", tsCols, tsRows);

// 3) daily energy -> CSV ------------------------------------------------------
const daily = DATA.daily;
const dailyRows = daily.date.map((d, i) => [d, daily.E_kWh[i]]);
const nDaily = writeCsv("soac_daily_energy.csv", ["date", "E_kWh"], dailyRows);

// 4) operating scatter cloud -> CSV -------------------------------------------
const sc = DATA.scatter;
const scCols = ["G", "eta", "P_kW", "delta_T", "T_in"];
const nSc = sc.G.length;
const scRows = [];
for (let i = 0; i < nSc; i++) scRows.push(scCols.map((k) => sc[k][i]));
const nScWritten = writeCsv("soac_scatter.csv", scCols, scRows);

console.log("Extracted from:", path.basename(SRC));
console.log("  soac_meta.json        (site/model metadata, verbatim)");
console.log(`  soac_timeseries.csv   ${nTsWritten} rows x ${tsCols.length} cols (5-min)`);
console.log(`  soac_daily_energy.csv ${nDaily} rows`);
console.log(`  soac_scatter.csv      ${nScWritten} rows x ${scCols.length} cols`);
