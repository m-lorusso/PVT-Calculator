import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LIVE_BASE_URL = process.env.LIVE_BASE_URL || "https://coolsheet-pvt.github.io/";
const LOCAL_BASE_URL = process.env.LOCAL_BASE_URL || pathToFileURL(path.resolve("index.html")).href;
const RUN_LOCAL_COMPARISON = process.env.LIVE_MATRIX_SKIP_LOCAL !== "1";
const STRICT_SOLAR_HOUR = process.env.LIVE_MATRIX_STRICT_SOLARHOUR === "1";
const REPORT_DIR = path.resolve("validation", "reports", "live-results");
const REPORT_PATH = path.join(REPORT_DIR, "live-industry-matrix.json");

const CITY_DEFINITIONS = [
  { key: "sydney", name: "Sydney", address: "1 George St, Sydney NSW, Australia" },
  { key: "melbourne", name: "Melbourne", address: "1 Swanston St, Melbourne VIC, Australia" }
];
const REQUESTED_CITY_KEYS = (process.env.LIVE_MATRIX_CITIES || "sydney,melbourne")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const CITIES = CITY_DEFINITIONS.filter(city => REQUESTED_CITY_KEYS.includes(city.key));
const PRIMARY_CITY_KEY = CITIES[0]?.key || "sydney";

if (CITIES.length === 0) {
  throw new Error(`LIVE_MATRIX_CITIES did not match any supported city keys: ${CITY_DEFINITIONS.map(city => city.key).join(", ")}`);
}

const INDUSTRIES = [
  {
    key: "dairy_farm",
    name: "Dairy Farm",
    classification: "benchmarked plus hand-equation checked",
    requiredInputs: ["#throughputInput"],
    baseline: async page => {
      await page.selectOption("#industrySelect", "dairy_farm");
      await page.fill("#throughputInput", "5000000");
    },
    variant: async page => {
      await page.fill("#throughputInput", "6000000");
    },
    variantName: "higher milk volume"
  },
  {
    key: "brewery",
    name: "Brewery",
    classification: "benchmarked plus hand-equation checked",
    requiredInputs: ["#throughputInput"],
    baseline: async page => {
      await page.selectOption("#industrySelect", "brewery");
      await page.fill("#throughputInput", "500000");
    },
    variant: async page => {
      await page.fill("#throughputInput", "650000");
    },
    variantName: "higher beer production"
  },
  {
    key: "aquatic_centres",
    name: "Aquatic Centre",
    classification: "engineering model with documented assumptions",
    requiredInputs: ["#aquaticInputsPanel", "#aquaticIndoorArea", "#aquaticOutdoorArea"],
    baseline: async page => {
      await page.selectOption("#industrySelect", "aquatic_centres");
      await setInputValue(page, "#aquaticIndoorArea", "350");
      await setInputValue(page, "#aquaticOutdoorArea", "250");
      await setInputValue(page, "#aquaticKidsArea", "90");
      await setInputValue(page, "#aquaticSaunaArea", "25");
      await setCheckbox(page, "#aquaticPoolCover", true);
      await setProcessCheckboxes(page, ".aquatic-process-toggle", true);
    },
    variant: async page => {
      await setInputValue(page, "#aquaticIndoorArea", "525");
      await setInputValue(page, "#aquaticOutdoorArea", "375");
      await setInputValue(page, "#aquaticKidsArea", "135");
      await setInputValue(page, "#aquaticSaunaArea", "38");
    },
    variantName: "larger heated water area"
  },
  {
    key: "hotel",
    name: "Hotel",
    classification: "benchmark-based demand model",
    requiredInputs: ["#hotelInputsPanel", "#hotelRoomsInput", "#hotelOccupancyInput"],
    baseline: async page => {
      await page.selectOption("#industrySelect", "hotel");
      await setInputValue(page, "#hotelRoomsInput", "120");
      await setInputValue(page, "#hotelOccupancyInput", "70");
      await setInputValue(page, "#tankVolume", "5000");
    },
    variant: async page => {
      await setInputValue(page, "#hotelOccupancyInput", "90");
    },
    variantName: "higher occupancy"
  },
  {
    key: "commercial_laundry",
    name: "Commercial Laundry",
    classification: "assumption-based hot-water washing model with hand-equation checks",
    requiredInputs: ["#laundryInputsPanel", "#laundryKgPerDay", "#laundryWaterUseLPerKg"],
    baseline: async page => {
      await page.selectOption("#industrySelect", "commercial_laundry");
      await setInputValue(page, "#laundryKgPerDay", "1500");
      await setInputValue(page, "#laundryOperatingDaysPerWeek", "6");
      await setInputValue(page, "#laundryWashTempC", "60");
      await setInputValue(page, "#laundryWaterUseLPerKg", "10");
      await setInputValue(page, "#laundryHotWaterFraction", "0.65");
      await setInputValue(page, "#laundryWarmRinseFraction", "0.20");
      await setInputValue(page, "#laundryWarmRinseTempC", "35");
      await setInputValue(page, "#laundrySystemLossFraction", "0");
    },
    variant: async page => {
      await setInputValue(page, "#laundryKgPerDay", "2200");
    },
    extraCheck: async page => page.evaluate(() => {
      const inputs = getCommercialLaundryInputs();
      const selectedKeys = getSelectedProcessKeys();
      const baseDemand = calcCommercialLaundryHourlyDemand({
        ...inputs,
        selectedKeys,
        met: CURRENT_MET,
        mains: CURRENT_MAINS
      }).thermalHourly.reduce((sum, value) => sum + value, 0);
      const coldMains = {
        annualAvgC: 10,
        byDay: Object.fromEntries(Array.from({ length: 365 }, (_, idx) => [idx + 1, 10]))
      };
      const colderDemand = calcCommercialLaundryHourlyDemand({
        ...inputs,
        selectedKeys,
        met: CURRENT_MET,
        mains: coldMains
      }).thermalHourly.reduce((sum, value) => sum + value, 0);
      return {
        name: "lower mains-water temperature increases laundry heat demand",
        pass: colderDemand > baseDemand,
        baseDemand,
        colderDemand
      };
    }),
    variantName: "higher laundry mass"
  }
];

test.describe.configure({ mode: "serial", timeout: 900000 });

test("live deployed industry matrix", async ({ browser }) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    generatedAtIso: new Date().toISOString(),
    liveBaseUrl: LIVE_BASE_URL,
    localBaseUrl: RUN_LOCAL_COMPARISON ? LOCAL_BASE_URL : null,
    strictSolarHour: STRICT_SOLAR_HOUR,
    cities: CITIES.map(c => c.name),
    industries: INDUSTRIES.map(i => ({ key: i.key, name: i.name, classification: i.classification })),
    scenarios: [],
    comparisons: [],
    failures: [],
    knownFailures: []
  };

  const liveRows = [];
  const localRows = [];

  writeReport(report);

  for (const city of CITIES) {
    console.log(`Loading live weather for ${city.name}`);
    const context = await browser.newContext({ acceptDownloads: true });
    try {
      const page = await context.newPage();
      const liveErrors = collectRuntimeErrors(page);
      await loadWeather(page, LIVE_BASE_URL, city);
      console.log(`Live weather loaded for ${city.name}`);

      for (const industry of INDUSTRIES) {
        console.log(`Running live ${city.name} / ${industry.name}`);
        const baseline = await runIndustryScenario(page, city, industry, "live", liveErrors);
        liveRows.push(baseline);
        report.scenarios.push(baseline);
        writeReport(report);

        console.log(`Checking share reload for live ${city.name} / ${industry.name}`);
        const share = await validateShareReload(context, baseline, city, industry);
        baseline.exportShareReport.shareReload = share;
        writeReport(report);
      }
    } finally {
      await context.close();
    }

    if (RUN_LOCAL_COMPARISON && city.key === PRIMARY_CITY_KEY) {
      console.log(`Loading local weather for ${city.name}`);
      const context = await browser.newContext({ acceptDownloads: true });
      try {
        const page = await context.newPage();
        const localErrors = collectRuntimeErrors(page);
        await loadWeather(page, LOCAL_BASE_URL, city);
        console.log(`Local weather loaded for ${city.name}`);

        for (const industry of INDUSTRIES) {
          console.log(`Running local ${city.name} / ${industry.name}`);
          const baseline = await runIndustryScenario(page, city, industry, "local", localErrors);
          localRows.push(baseline);
          report.scenarios.push(baseline);
          writeReport(report);
        }
      } finally {
        await context.close();
      }
    }
  }

  for (const live of liveRows) {
    const local = localRows.find(row => row.city.key === live.city.key && row.industry.key === live.industry.key);
    if (!local) continue;
    const comparison = compareScenario(live, local);
    report.comparisons.push(comparison);
    if (!comparison.pass) report.failures.push(`${live.city.name} ${live.industry.name}: live/local comparison outside tolerance`);
  }

  for (const scenario of report.scenarios) {
    for (const failure of scenario.failures) report.failures.push(`${scenario.target} ${scenario.city.name} ${scenario.industry.name}: ${failure}`);
    if (scenario.weather.records !== 8760) report.failures.push(`${scenario.target} ${scenario.city.name} ${scenario.industry.name}: weather record count ${scenario.weather.records}`);
    if (scenario.weather.solarHourRecords !== 8760) {
      const msg = `${scenario.target} ${scenario.city.name} ${scenario.industry.name}: backend solarHour ${scenario.weather.solarHourRecords}/${scenario.weather.records}`;
      report.knownFailures.push(msg);
      if (STRICT_SOLAR_HOUR) report.failures.push(msg);
    }
  }

  writeReport(report);
  console.log(`Live industry matrix report written to ${REPORT_PATH}`);
  console.log(`Scenarios: ${report.scenarios.length}`);
  console.log(`Known backend solarHour failures: ${report.knownFailures.length}`);
  console.log(`Hard failures: ${report.failures.length}`);

  expect(report.failures, `See ${REPORT_PATH}`).toEqual([]);
});

function writeReport(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function setInputValue(page, selector, value) {
  await page.fill(selector, String(value));
  await page.locator(selector).evaluate(el => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function setCheckbox(page, selector, checked) {
  const locator = page.locator(selector);
  if ((await locator.isChecked()) !== checked) await locator.setChecked(checked);
}

async function setProcessCheckboxes(page, selector, checked) {
  await page.locator(selector).evaluateAll((elements, nextChecked) => {
    elements.forEach(el => {
      el.checked = nextChecked;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, checked);
}

function collectRuntimeErrors(page) {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => {
    errors.push(err.message || String(err));
  });
  return errors;
}

async function loadWeather(page, baseUrl, city) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(page.locator("#btnAnnual")).toBeVisible({ timeout: 30000 });
  await page.fill("#addressInput", city.address);
  await page.click("#btnLoadTMY");
  await expect(page.locator("#locConfirm")).toContainText("8,760", { timeout: 120000 });
}

async function calculate(page) {
  await page.click("#btnAnnual");
  await expect(page.locator("#annualOutput .annual-summary-item")).toHaveCount(7, { timeout: 120000 });
  await expect(page.locator("#downloadLink")).toBeVisible({ timeout: 30000 });
}

async function runIndustryScenario(page, city, industry, target, errors) {
  const beforeErrorCount = errors.length;
  await industry.baseline(page);
  await assertIndustryInputsVisible(page, industry);
  await calculate(page);
  const baseline = await collectScenarioOutputs(page, city, industry, target);
  baseline.runtimeErrors = errors.slice(beforeErrorCount);

  if (industry.extraCheck) {
    baseline.extraCheck = await industry.extraCheck(page);
  }

  await industry.variant(page);
  await calculate(page);
  const variant = await collectScenarioOutputs(page, city, industry, target, { collectExports: false });
  baseline.variant = {
    name: industry.variantName,
    heatDemandKWh: variant.outputs.heatDemandKWh,
    pass: variant.outputs.heatDemandKWh > baseline.outputs.heatDemandKWh
  };

  baseline.failures = validateScenario(baseline);
  return baseline;
}

async function assertIndustryInputsVisible(page, industry) {
  await expect(page.locator("#industrySelect")).toHaveValue(industry.key);
  for (const selector of industry.requiredInputs) {
    await expect(page.locator(selector)).toBeVisible({ timeout: 10000 });
  }
}

async function collectScenarioOutputs(page, city, industry, target, options = {}) {
  const collectExports = options.collectExports !== false;
  return page.evaluate(async ({ city, industry, target, collectExports }) => {
    const text = document.body.innerText || "";
    const finite = value => typeof value === "number" && Number.isFinite(value);
    const parseNumber = raw => {
      const match = String(raw || "").replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    const cardMap = selector => {
      const out = {};
      document.querySelectorAll(selector).forEach(card => {
        const label = card.querySelector("span")?.textContent?.trim() || "";
        const valueText = card.querySelector("strong")?.textContent?.trim() || "";
        if (label) out[label] = { text: valueText, value: parseNumber(valueText) };
      });
      return out;
    };
    const annualCards = cardMap("#annualOutput .annual-summary-item");
    const energyCards = cardMap("#industryOutput .energy-flow-card");
    const annualText = document.querySelector("#annualOutput")?.innerText || "";
    const parseAfter = label => {
      const idx = annualText.indexOf(label);
      if (idx < 0) return null;
      return parseNumber(annualText.slice(idx + label.length, idx + label.length + 120));
    };
    const insightPairs = {};
    document.querySelectorAll("#industryOutput .insight-pill").forEach(pill => {
      const labels = Array.from(pill.querySelectorAll(".eyebrow")).map(el => el.textContent.trim());
      const values = Array.from(pill.querySelectorAll(".big")).map(el => el.textContent.trim());
      labels.forEach((label, idx) => {
        insightPairs[label] = { text: values[idx] || "", value: parseNumber(values[idx] || "") };
      });
    });
    const annualRaw = CURRENT_CALC_RESULT?.annualRaw || {};
    const annualTables = CURRENT_CALC_RESULT?.annualTables || [];
    const tableMetric = label => {
      for (const table of annualTables) {
        for (const row of table.rows || []) {
          if (String(row[0] || "").includes(label)) return parseNumber(row[1] || row.join(" "));
        }
      }
      return null;
    };
    const weather = typeof buildWeatherExportMetadata === "function" ? buildWeatherExportMetadata() : {};
    const location = CURRENT_LOC ? { name: CURRENT_LOC.name, lat: CURRENT_LOC.lat, lon: CURRENT_LOC.lon } : null;
    const heatDemandKWh = energyCards["Heat demand consumed"]?.value;
    const solarHeatUsedKWh = energyCards["Solar heat used"]?.value;
    const backupHeatKWh = energyCards["Backup heat needed"]?.value;
    const electricDemandKWh = energyCards["Electric demand consumed"]?.value;
    const solarHeatCoveragePct = insightPairs["Solar Heat"]?.value;
    const savingsAud = insightPairs["Yearly Savings"]?.value;
    const processTotalText = document.querySelector("#industryOutput .process-breakdown-total .process-kwh")?.textContent || "";

    let hourlyCsv = null;
    let summaryCsv = null;
    let sharePayload = null;
    let reportHtml = null;
    if (collectExports) {
      const dl = document.querySelector("#downloadLink");
      const href = dl?.href || "";
      if (href.startsWith("blob:")) {
        try {
          const csvText = await fetch(href).then(resp => resp.text());
          hourlyCsv = {
            ok: csvText.includes("hour") || csvText.includes("dayN") || csvText.includes("PVT"),
            length: csvText.length,
            head: csvText.slice(0, 200)
          };
        } catch (err) {
          hourlyCsv = { ok: false, error: err.message };
        }
      } else {
        hourlyCsv = { ok: false, error: "downloadLink is not a blob URL", href };
      }
      try {
        summaryCsv = {
          ok: typeof buildSummaryCsv === "function",
          length: typeof buildSummaryCsv === "function" ? buildSummaryCsv().length : 0,
          head: typeof buildSummaryCsv === "function" ? buildSummaryCsv().slice(0, 300) : ""
        };
      } catch (err) {
        summaryCsv = { ok: false, error: err.message };
      }
      try {
        sharePayload = typeof buildShareScenarioPayload === "function" ? buildShareScenarioPayload() : null;
      } catch (err) {
        sharePayload = { error: err.message };
      }
      try {
        const html = typeof buildPdfTemplateDocument === "function" ? buildPdfTemplateDocument() : "";
        reportHtml = {
          ok: html.includes("PVT Report") && html.includes("Annual") && !/(NaN|Infinity|undefined)/.test(html),
          length: html.length,
          hasIndustry: html.includes("Industry") || html.includes("Solar Performance"),
          head: html.slice(0, 200)
        };
      } catch (err) {
        reportHtml = { ok: false, error: err.message };
      }
    }

    return {
      target,
      city,
      industry,
      location,
      weather,
      classification: industry.classification,
      outputs: {
        pvOnlyKWh: annualRaw.pvOnlyKWh ?? annualCards["PV-only baseline"]?.value,
        pvtElectricKWh: annualRaw.pvtElectricKWh ?? annualCards["PVT electricity"]?.value,
        pvtThermalKWh: annualRaw.pvtThermalKWh ?? annualCards["PVT thermal"]?.value,
        totalEnergyKWh: annualRaw.totalEnergyKWh ?? annualCards["Total output"]?.value,
        heatDemandKWh,
        solarHeatUsedKWh,
        backupHeatKWh,
        electricDemandKWh,
        solarHeatCoveragePct,
        savingsAud,
        processTotalKWh: parseNumber(processTotalText),
        lcoeAudPerKWh: annualRaw.lcoeAudPerKWh ?? tableMetric("LCOE") ?? parseAfter("LCOE"),
        lcohAudPerKWh: annualRaw.lcohAudPerKWh ?? tableMetric("LCOH") ?? parseAfter("LCOH"),
        npvAud: annualRaw.npvAud ?? tableMetric("NPV") ?? parseAfter("NPV"),
        paybackYears: annualRaw.paybackYears ?? tableMetric("Simple Payback Period") ?? parseAfter("Simple Payback Period")
      },
      ui: {
        selectedIndustry: document.querySelector("#industrySelect")?.value || "",
        annualTableCount: document.querySelectorAll("#annualOutput table").length,
        industryTableCount: document.querySelectorAll("#industryOutput table").length,
        industryCardCount: document.querySelectorAll("#industryOutput .energy-flow-card").length,
        canvasCount: document.querySelectorAll("canvas").length,
        noNaN: !text.includes("NaN"),
        noInfinity: !text.includes("Infinity"),
        noUndefined: !text.includes("undefined"),
        noNullText: !/\bnull\b/i.test(text),
        industryTextHead: (document.querySelector("#industryOutput")?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 600)
      },
      exportShareReport: {
        hourlyCsv,
        summaryCsv,
        sharePayload: sharePayload ? {
          shareUrl: typeof buildShareUrl === "function" ? buildShareUrl() : null,
          schemaVersion: sharePayload.schemaVersion,
          hasInputs: !!sharePayload.inputs,
          industryInput: sharePayload.inputs?.industrySelect,
          weatherRecords: sharePayload.weather?.records,
          weatherSolarHourRecords: sharePayload.weather?.solarHourRecords,
          weatherHasSolarHour: sharePayload.weather?.hasSolarHour,
          hasResultSummary: !!sharePayload.resultSummary,
          hasNote: !!sharePayload.reproducibilityNote,
          error: sharePayload.error
        } : null,
        reportHtml
      },
      _finiteProbe: [
        annualRaw.pvOnlyKWh,
        annualRaw.pvtElectricKWh,
        annualRaw.pvtThermalKWh,
        heatDemandKWh,
        solarHeatUsedKWh,
        backupHeatKWh,
        solarHeatCoveragePct,
        savingsAud
      ].every(v => finite(v))
    };
  }, { city, industry: { key: industry.key, name: industry.name, classification: industry.classification }, target, collectExports });
}

function validateScenario(row) {
  const failures = [];
  const o = row.outputs;
  const finiteRequired = [
    ["PV-only electricity", o.pvOnlyKWh],
    ["PVT electricity", o.pvtElectricKWh],
    ["PVT thermal output", o.pvtThermalKWh],
    ["industry demand", o.heatDemandKWh],
    ["solar heat used", o.solarHeatUsedKWh],
    ["backup heat", o.backupHeatKWh],
    ["solar coverage", o.solarHeatCoveragePct],
    ["savings", o.savingsAud],
    ["payback", o.paybackYears],
    ["NPV", o.npvAud],
    ["LCOE", o.lcoeAudPerKWh],
    ["LCOH", o.lcohAudPerKWh]
  ];
  for (const [name, value] of finiteRequired) {
    if (!Number.isFinite(value)) failures.push(`${name} is not finite (${value})`);
  }
  if (Number.isFinite(o.pvOnlyKWh) && o.pvOnlyKWh <= 0) failures.push("PV-only electricity is not positive");
  if (Number.isFinite(o.pvtElectricKWh) && o.pvtElectricKWh <= 0) failures.push("PVT electricity is not positive");
  if (Number.isFinite(o.pvtThermalKWh) && o.pvtThermalKWh <= 0) failures.push("PVT thermal output is not positive");
  if (Number.isFinite(o.heatDemandKWh) && o.heatDemandKWh <= 0) failures.push("industry heat demand is not positive");
  if (Number.isFinite(o.backupHeatKWh) && o.backupHeatKWh < -0.1) failures.push("backup heat is negative");
  if (Number.isFinite(o.solarHeatCoveragePct) && (o.solarHeatCoveragePct < -0.1 || o.solarHeatCoveragePct > 100.1)) failures.push("solar coverage outside 0-100%");
  if (Number.isFinite(o.solarHeatUsedKWh) && Number.isFinite(o.heatDemandKWh) && o.solarHeatUsedKWh > o.heatDemandKWh + 1) failures.push("solar heat used exceeds heat demand");
  if (Number.isFinite(o.solarHeatUsedKWh) && Number.isFinite(o.pvtThermalKWh) && o.solarHeatUsedKWh > o.pvtThermalKWh + 1) failures.push("solar heat used exceeds PVT thermal output");
  if (!row.ui.noNaN) failures.push("page text contains NaN");
  if (!row.ui.noInfinity) failures.push("page text contains Infinity");
  if (!row.ui.noUndefined) failures.push("page text contains undefined");
  if (!row.ui.noNullText) failures.push("page text contains null");
  if (row.runtimeErrors?.length) failures.push(`console/page errors: ${row.runtimeErrors.join(" | ")}`);
  if (row.ui.selectedIndustry !== row.industry.key) failures.push(`selected industry mismatch (${row.ui.selectedIndustry})`);
  if (row.ui.annualTableCount < 1) failures.push("annual result tables did not render");
  if (row.ui.industryCardCount < 4) failures.push("industry energy cards did not render");
  if (row.ui.canvasCount < 1) failures.push("charts did not render");
  if (!row.variant?.pass) failures.push(`${row.variant?.name || "variant"} did not increase heat demand`);
  if (row.extraCheck && !row.extraCheck.pass) failures.push(row.extraCheck.name);
  if (row.industry.key === "commercial_laundry" && Math.abs(row.outputs.electricDemandKWh || 0) > 0.1) failures.push("commercial laundry appears to include nonzero site electricity");
  if (row.exportShareReport.hourlyCsv && !row.exportShareReport.hourlyCsv.ok) failures.push(`hourly CSV not verified: ${row.exportShareReport.hourlyCsv.error || "bad content"}`);
  if (row.exportShareReport.summaryCsv && !(row.exportShareReport.summaryCsv.ok && row.exportShareReport.summaryCsv.length > 100)) failures.push("summary CSV content not verified");
  if (row.exportShareReport.reportHtml && !row.exportShareReport.reportHtml.ok) failures.push(`PDF/report HTML content not verified: ${row.exportShareReport.reportHtml.error || "bad content"}`);
  if (row.exportShareReport.sharePayload) {
    const share = row.exportShareReport.sharePayload;
    if (share.schemaVersion !== 2) failures.push("share payload is not schema v2");
    if (!share.hasInputs || !share.hasResultSummary || !share.hasNote) failures.push("share payload missing inputs/result/note");
    if (share.industryInput !== row.industry.key) failures.push(`share payload industry mismatch (${share.industryInput})`);
  }
  if (row.exportShareReport.shareReload && !row.exportShareReport.shareReload.pass) failures.push(`share reload mismatch: ${row.exportShareReport.shareReload.reason}`);
  return failures;
}

async function validateShareReload(context, baseline, city, industry) {
  const page = await context.newPage();
  const errors = collectRuntimeErrors(page);
  try {
    const shareUrl = baseline.exportShareReport?.sharePayload?.shareUrl;
    if (!shareUrl) return { pass: false, reason: "share URL was not captured" };
    await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await expect(page.locator("#industrySelect")).toHaveValue(industry.key, { timeout: 30000 });
    await page.click("#btnLoadTMY");
    await expect(page.locator("#locConfirm")).toContainText("8,760", { timeout: 120000 });
    await calculate(page);
    const reloaded = await collectScenarioOutputs(page, city, industry, "live-share-reload", { collectExports: false });
    const comparison = compareScenario(baseline, reloaded, 0.2);
    return {
      pass: comparison.pass && errors.length === 0,
      reason: comparison.pass
        ? (errors.length ? `share reload console/page errors: ${errors.join(" | ")}` : "")
        : "recalculated shared scenario changed",
      selectedIndustry: reloaded.ui.selectedIndustry,
      comparison
    };
  } finally {
    await page.close();
  }
}

function compareScenario(live, local, tolerancePct = 0.5) {
  const keys = [
    "pvOnlyKWh",
    "pvtElectricKWh",
    "pvtThermalKWh",
    "heatDemandKWh",
    "solarHeatUsedKWh",
    "backupHeatKWh",
    "solarHeatCoveragePct",
    "savingsAud"
  ];
  const rows = keys.map(key => {
    const liveValue = live.outputs[key];
    const localValue = local.outputs[key];
    const absoluteDifference = Number.isFinite(liveValue) && Number.isFinite(localValue) ? liveValue - localValue : null;
    const percentageDifference = Number.isFinite(absoluteDifference) && Math.abs(localValue) > 1e-9
      ? (absoluteDifference / localValue) * 100
      : 0;
    const pass = Number.isFinite(liveValue) &&
      Number.isFinite(localValue) &&
      (Math.abs(absoluteDifference) <= 1 || Math.abs(percentageDifference) <= tolerancePct);
    return {
      key,
      liveValue,
      localValue,
      absoluteDifference,
      percentageDifference,
      tolerancePct,
      pass
    };
  });
  return {
    city: live.city,
    industry: live.industry,
    pass: rows.every(row => row.pass),
    rows
  };
}
