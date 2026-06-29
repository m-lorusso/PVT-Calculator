import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(path.resolve("index.html")).href;

test("calculator UI loads without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(pageUrl);
  await expect(page.locator("#btnAnnual")).toBeVisible();
  await expect(page.locator("#industrySelect")).toBeVisible();
  await expect(page.locator("#downloadLink")).toBeHidden();
  expect(errors).toEqual([]);
});

test("commercial laundry controls are exposed", async ({ page }) => {
  await page.goto(pageUrl);
  await page.selectOption("#industrySelect", "commercial_laundry");
  await expect(page.locator("#laundryInputsPanel")).toBeVisible();
  await expect(page.locator("#throughputInput")).toBeHidden();
  await expect(page.locator("#laundryKgPerDay")).toHaveValue("1500");
  await expect(page.locator("#laundryWaterUseLPerKg")).toHaveValue("10");
});

test("summary exports and share payload prefer calculation state", async ({ page }) => {
  await page.goto(pageUrl);
  const result = await page.evaluate(() => {
    document.getElementById("annualOutput").innerHTML = `
      <div class="annual-summary-item">
        <span>PVT electricity</span><strong>999,999 kWh</strong><small>DOM text</small>
      </div>
      <table><tr><td>DOM-only table row</td><td>should not export</td></tr></table>`;
    document.getElementById("area").value = "20";
    CURRENT_LOC = { name:"State Test Site", lat:-33.86, lon:151.20 };
    CURRENT_TZ = { timeZone:"Australia/Sydney", gmtOffset:10 };
    CURRENT_MET = [{ dayN:1, hourN:12, solarHour:12, dni:800, dhi:100, ghi:900, ta:20, vwind:3 }];
    CURRENT_CALC_RESULT = {
      schemaVersion: 1,
      generatedAtIso: "2026-06-29T00:00:00.000Z",
      location: { name:"State Test Site", lat:-33.86, lon:151.20 },
      weather: buildWeatherExportMetadata(),
      inputs: collectInputState(),
      thermalModel: "A",
      annualMetrics: [
        { label:"PVT electricity", value:1234.567, unit:"kWh", decimals:1, note:"state metric" }
      ],
      annualTables: [
        { title:"Energy Detail", rows:[["Thermal Energy", "222.2 kWh"]] }
      ],
      industrySummary: null,
      annualRaw: { pvtElectricKWh:1234.567 }
    };
    const metrics = collectAnnualReportMetrics();
    const csv = buildSummaryCsv();
    const sharePayload = buildShareScenarioPayload();
    return { metrics, csv, sharePayload };
  });

  expect(result.metrics[0]).toEqual({
    label: "PVT electricity",
    value: "1,234.6 kWh",
    note: "state metric"
  });
  expect(result.csv).toContain("1,234.6 kWh");
  expect(result.csv).toContain("Thermal Energy,222.2 kWh");
  expect(result.csv).not.toContain("999,999");
  expect(result.csv).not.toContain("DOM-only table row");
  expect(result.sharePayload.schemaVersion).toBe(2);
  expect(result.sharePayload.weather.hasSolarHour).toBe(true);
  expect(result.sharePayload.weather.annualGhiKWhM2).toBeCloseTo(0.9, 6);
  expect(result.sharePayload.resultSummary.annualRaw.pvtElectricKWh).toBe(1234.567);
});
