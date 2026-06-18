// Application logic for the Annual PVT Calculator (extracted from index.html).
// Loaded at the end of <body>, after Chart.js and bc_aus_zone_constants.js.
// ================================================================
//  DETAILS ANIMATION — replay slideDown every time a panel opens
// ================================================================
document.querySelectorAll('.advanced-settings').forEach(details => {
  details.addEventListener('toggle', () => {
    if (details.open) {
      const body = details.querySelector('.advanced-settings-body');
      body.classList.remove('animate');
      void body.offsetHeight; // force reflow so animation restarts
      body.classList.add('animate');
    }
  });
});

// ================================================================
//  UTILITIES
// ================================================================
function setOutput(html, isError=false){
  document.getElementById("annualOutput").innerHTML = isError
    ? `<span class="err">${html}</span>` : html;
  if (isError){
    const charts = document.getElementById("supplyChartsPanel");
    if (charts) charts.style.display = "none";
    resetExportActions();
    setIndustryOutput("");
  }
}

function setIndustryOutput(html){
  const el = document.getElementById("industryOutput");
  if (!el) return;
  el.innerHTML = html
    ? `<div class="industry-section-head">
        <div class="industry-section-kicker">Industry analysis</div>
        <h3>Industry Specific Results</h3>
      </div>${html}`
    : "";
  el.style.display = html ? "block" : "none";
}

function resetExportActions(){
  const csvLink = document.getElementById("downloadLink");
  if (csvLink){
    csvLink.style.display = "none";
    csvLink.removeAttribute("href");
  }
  const pdfBtn = document.getElementById("btnGeneratePdf");
  if (pdfBtn){
    pdfBtn.style.display = "none";
    pdfBtn.disabled = true;
    pdfBtn.textContent = "Generate PDF report";
  }
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

const SQFT_PER_M2 = 10.76391041671;

function getInputNumber(id, fallback=null){
  const value = parseFloat(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function getSelectedOptionText(id){
  const el = document.getElementById(id);
  return el?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function getReportFieldValue(id, fallback=""){
  const el = document.getElementById(id);
  const value = el?.value;
  return String(value ?? fallback).trim();
}

function getCheckedThermalModelLabel(){
  const selected = document.querySelector('input[name="thermalModel"]:checked')?.value || "A";
  return selected === "B"
    ? "Model B - ISO 9806 full model"
    : "Model A - Simple linear thermal model";
}

function getInstalledCostBasis(){
  const pvCostPerW = getInputNumber("pvInstalledCostPerW", 1.20);
  const thermalCostPerW = getInputNumber("thermalInstalledCostPerW", 1.50);
  const etaPv = getInputNumber("etaPv", 0.20);
  if (![pvCostPerW, thermalCostPerW, etaPv].every(Number.isFinite) || pvCostPerW < 0 || thermalCostPerW < 0 || etaPv < 0) return null;
  const ratedWpPerM2 = etaPv * 1000;
  const capexPerM2 = (pvCostPerW + thermalCostPerW) * ratedWpPerM2;
  return {
    pvCostPerW,
    thermalCostPerW,
    ratedWpPerM2,
    capexPerM2,
    costPerFt2: capexPerM2 / SQFT_PER_M2
  };
}

function syncInstalledCostInputs(){
  const basis = getInstalledCostBasis();
  const capexDisplay = document.getElementById("calculatedCapexPerM2");
  const ft2Display = document.getElementById("installedCostPerFt2");
  const capexInput = document.getElementById("capexInput");
  const autoFill = document.getElementById("autoCapexFromWatts")?.checked;

  if (!basis){
    if (capexDisplay) capexDisplay.value = "";
    if (ft2Display) ft2Display.value = "";
    return;
  }

  if (capexDisplay) capexDisplay.value = basis.capexPerM2.toFixed(0);
  if (ft2Display) ft2Display.value = basis.costPerFt2.toFixed(2);
  if (autoFill && capexInput) capexInput.value = String(Math.round(basis.capexPerM2));
}

function getInstalledCostBasisSummary(){
  const basis = getInstalledCostBasis();
  if (!basis) return "N/A";
  return `${basis.pvCostPerW.toFixed(2)} AUD/W PV + ${basis.thermalCostPerW.toFixed(2)} AUD/W thermal/PVT; ${basis.capexPerM2.toFixed(0)} AUD/m2 (${basis.costPerFt2.toFixed(2)} AUD/ft2)`;
}

function buildReportFilename(locationName){
  const safeName = String(locationName || "pvt-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "pvt-report";
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `${safeName}-pvt-report-${dateStamp}.html`;
}

function compactReportText(el){
  return String(el?.textContent || "").replace(/\s+/g, " ").trim();
}

function collectAnnualReportMetrics(){
  const root = document.getElementById("annualOutput");
  if (!root || !root.textContent.trim() || root.textContent.trim().startsWith("Ready")) return [];
  return Array.from(root.querySelectorAll(".annual-summary-item")).map(card => ({
    label: compactReportText(card.querySelector("span")),
    value: compactReportText(card.querySelector("strong")),
    note: compactReportText(card.querySelector("small"))
  })).filter(item => item.label && item.value);
}

function collectIndustryReportSummary(){
  const root = document.getElementById("industryOutput");
  if (!root || !root.textContent.trim()) return null;

  const metrics = [];
  root.querySelectorAll(".insight-pill").forEach(pill => {
    const labels = Array.from(pill.querySelectorAll(".eyebrow")).map(compactReportText);
    const values = Array.from(pill.querySelectorAll(".big")).map(compactReportText);
    labels.forEach((label, idx) => {
      if (label && values[idx]){
        metrics.push({
          label,
          value: values[idx],
          note: idx === 0 ? compactReportText(pill.querySelector("small")) : ""
        });
      }
    });
  });

  const energy = Array.from(root.querySelectorAll(".energy-flow-card")).map(card => ({
    label: compactReportText(card.querySelector("span")),
    value: compactReportText(card.querySelector("strong")),
    note: compactReportText(card.querySelector("small"))
  })).filter(item => item.label && item.value);

  return {
    headline: compactReportText(root.querySelector(".insight-title")),
    subhead: compactReportText(root.querySelector(".insight-sub")),
    metrics,
    energy
  };
}

function renderReportKpis(items, maxItems=4){
  const visible = (items || []).slice(0, maxItems);
  if (!visible.length) return `<div class="empty-note">Run a calculation first to populate this section.</div>`;
  return `
    <div class="kpi-grid">
      ${visible.map(item => `
        <div class="kpi-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
        </div>`).join("")}
    </div>`;
}

function renderReportTable(rows, className=""){
  return `
    <table class="report-table ${className}">
      ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}
    </table>`;
}

function splitEnergyMetrics(energyMetrics){
  const electrical = [];
  const thermal = [];
  for (const item of energyMetrics || []){
    const label = item.label.toLowerCase();
    if (label.includes("electric") || label.includes("grid") || label.includes("pv exported")){
      electrical.push(item);
    } else if (label.includes("heat") || label.includes("thermal")){
      thermal.push(item);
    }
  }
  return { electrical, thermal };
}

function renderEnergyBalanceGroup(title, items){
  if (!items?.length) return "";
  return `
    <div class="balance-box">
      <h3>${escapeHtml(title)}</h3>
      <table class="balance-table">
        ${items.map(item => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`).join("")}
      </table>
    </div>`;
}

function buildPdfTemplateDocument(){
  const generatedAt = new Date().toLocaleString();
  const locationName = CURRENT_LOC?.name || "Location not loaded";
  const coolsheetLogoSrc = new URL("assets/coolsheet-logo.jpg", window.location.href).href;
  const unswLogoSrc = new URL("assets/unsw-logo.jpg", window.location.href).href;
  const area = getReportFieldValue("area");
  const industryLabel = getSelectedOptionText("industrySelect") || "None";
  const profileLabel = getSelectedOptionText("profileType") || "N/A";
  const reportFilename = buildReportFilename(locationName);
  const reportVersion = document.querySelector(".brand-meta span")?.textContent?.trim() || "Version 11.8";
  const weatherRecords = Array.isArray(CURRENT_MET) ? CURRENT_MET.length : 0;
  const timezoneText = CURRENT_TZ ? getTimezoneDisplay(CURRENT_TZ) : "N/A";
  const mainsText = CURRENT_MAINS
    ? `${CURRENT_MAINS.annualAvgC.toFixed(1)} C annual average; ${CURRENT_MAINS.minC.toFixed(1)}-${CURRENT_MAINS.maxC.toFixed(1)} C daily range`
    : "N/A";
  const reportEmailEndpoints = getReportEmailEndpoints();
  const emailSubject = `Annual PVT report - ${locationName}`;
  const emailBody = [
    "Hi,",
    "",
    "Please find attached the Annual PVT Calculator report for review.",
    "",
    `Site: ${locationName}`,
    `Collector / PV area: ${area || "N/A"} m2`,
    `Industry: ${industryLabel}`,
    `Operating profile: ${profileLabel}`,
    `Generated: ${generatedAt}`,
    "",
    "Regards,"
  ].join("\n");

  const annualMetrics = collectAnnualReportMetrics();
  const industrySummary = collectIndustryReportSummary();
  const energyGroups = splitEnergyMetrics(industrySummary?.energy || []);
  const assumptionRows = [
    ["Site", locationName],
    ["Coordinates", CURRENT_LOC ? `${CURRENT_LOC.lat.toFixed(6)}, ${CURRENT_LOC.lon.toFixed(6)} (${timezoneText})` : "N/A"],
    ["System", `${area || "N/A"} m2 collector/PV area; tilt ${getReportFieldValue("tiltAngle", "N/A")} deg; azimuth ${getReportFieldValue("azimuthAngle", "N/A")} deg`],
    ["Models", `${getCheckedThermalModelLabel()}; PV efficiency ${getReportFieldValue("etaPv", "N/A")}; flow ${getReportFieldValue("flowRate", "N/A")} L/s/m2`],
    ["Weather and mains", `${weatherRecords ? weatherRecords.toLocaleString() : "N/A"} PVGIS TMY hourly records; BC-Aus mains model, ${mainsText}`],
    ["Demand case", `${industryLabel}; ${profileLabel}`],
    ["Prices", `Electricity ${getReportFieldValue("electricityPrice", "N/A")} AUD/kWh; feed-in ${getReportFieldValue("feedInTariffInput", "N/A")} AUD/kWh; gas ${getReportFieldValue("gasPriceInput", "N/A")} AUD/MJ; boiler efficiency ${getReportFieldValue("boilerEffInput", "N/A")}`],
    ["Installed cost basis", getInstalledCostBasisSummary()],
    ["Finance", `CAPEX ${getReportFieldValue("capexInput", "N/A")} AUD/m2; OPEX ${getReportFieldValue("opexRateInput", "N/A")}%/yr; life ${getReportFieldValue("systemLifeInput", "N/A")} years; discount ${getReportFieldValue("discountRateInput", "N/A")}%`]
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PVT Report - ${escapeHtml(locationName)}</title>
  <style>
    @page{size:A4;margin:10mm;}
    *{box-sizing:border-box;}
    html,body{margin:0;padding:0;}
    body{font-family:Arial,Helvetica,sans-serif;color:#142437;background:#edf3f7;font-size:10.2px;line-height:1.32;}
    .report-shell{max-width:820px;margin:0 auto;padding:16px;}
    .handoff-actions{position:sticky;top:0;z-index:10;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:9px;border:1px solid #c9d8e5;border-radius:8px;background:rgba(255,255,255,.97);box-shadow:0 4px 18px rgba(20,40,60,.08);}
    .handoff-actions button{padding:8px 11px;border:1px solid #1a5f9a;border-radius:6px;background:#1f6fb2;color:#fff;font-weight:700;cursor:pointer;font-size:12px;}
    .handoff-actions button.secondary{background:#fff;color:#1a5f9a;border-color:#9ebed8;}
    .handoff-actions input{min-width:220px;flex:1 1 220px;padding:8px 10px;border:1px solid #c8d0db;border-radius:6px;font:inherit;font-size:12px;}
    .handoff-status{flex-basis:100%;font-size:11px;font-weight:700;color:#425466;}
    .handoff-status.ok{color:#0b6b2d;}
    .handoff-status.err{color:#b00020;}
    .report-doc{background:#fff;border:1px solid #ccd9e8;border-radius:10px;padding:16px 18px;}
    .report-head{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:12px;align-items:start;border-bottom:2px solid #dfe8f1;padding-bottom:10px;margin-bottom:10px;}
    .report-logo-row{display:flex;align-items:center;gap:10px;margin:0 0 8px;}
    .report-logo{display:block;max-height:34px;width:auto;object-fit:contain;}
    .report-logo.coolsheet{max-width:118px;}
    .report-logo.unsw{max-width:88px;}
    .report-kicker{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#66778c;font-weight:700;margin-bottom:3px;}
    h1{margin:0 0 5px;font-size:22px;line-height:1.05;color:#0e2941;}
    h2{margin:0 0 7px;font-size:13.5px;line-height:1.15;color:#0e2941;}
    h3{margin:0 0 5px;font-size:11px;color:#16324a;}
    p{margin:0;}
    .muted{color:#5c6d82;}
    .head-meta{display:grid;grid-template-columns:1fr;gap:4px;font-size:9.5px;}
    .head-meta div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #e6edf4;padding-bottom:3px;}
    .head-meta span{color:#617286;font-weight:700;}
    .section{margin:9px 0 0;padding:10px;border:1px solid #d7e1ec;border-radius:8px;background:#fbfdff;break-inside:avoid;}
    .section.compact{padding:9px 10px;}
    .section-title{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:7px;}
    .section-title small{color:#617286;font-size:9px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;}
    .industry .kpi-grid{grid-template-columns:repeat(5,minmax(0,1fr));}
    .kpi-card{min-height:49px;padding:7px;border-left:3px solid #2f7fba;border-radius:6px;background:#fff;overflow:hidden;}
    .kpi-card span{display:block;font-size:8.2px;line-height:1.15;letter-spacing:.04em;text-transform:uppercase;color:#596b80;font-weight:700;margin-bottom:3px;}
    .kpi-card strong{display:block;font-size:14px;line-height:1.08;color:#102d45;overflow-wrap:anywhere;}
    .kpi-card small{display:block;margin-top:3px;color:#617286;font-size:8.6px;line-height:1.18;}
    .industry-headline{margin:0 0 7px;padding:8px 9px;border:1px solid #d7e7f4;border-radius:7px;background:#f7fbff;}
    .industry-headline strong{display:block;font-size:13px;color:#0d2d46;line-height:1.15;}
    .industry-headline span{display:block;margin-top:2px;color:#617286;font-size:9.3px;}
    .balance-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px;}
    .balance-box{padding:7px;border:1px solid #d9e2eb;border-radius:7px;background:#fff;}
    .balance-table,.report-table{width:100%;border-collapse:collapse;}
    .balance-table th,.balance-table td,.report-table th,.report-table td{padding:4px 5px;text-align:left;border-bottom:1px solid #e4ebf2;vertical-align:top;}
    .balance-table th,.report-table th{color:#506278;font-weight:700;}
    .balance-table th{width:58%;font-size:8.7px;text-transform:uppercase;letter-spacing:.035em;}
    .balance-table td{font-weight:700;color:#102d45;text-align:right;font-size:10px;}
    .report-table{font-size:9.2px;}
    .report-table th{width:23%;}
    .basis-note{margin-top:9px;padding-top:8px;border-top:1px solid #dfe8f1;color:#5d6f84;font-size:9px;}
    .basis-note b{color:#34495e;}
    .empty-note{padding:8px;border:1px dashed #bac8d6;border-radius:6px;color:#617286;background:#fff;}
    @media (max-width:720px){
      .report-head{grid-template-columns:1fr;}
      .kpi-grid,.industry .kpi-grid,.balance-grid{grid-template-columns:1fr 1fr;}
    }
    @media print{
      body{background:#fff;font-size:9.4px;line-height:1.24;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .handoff-actions{display:none;}
      .report-shell{max-width:none;padding:0;}
      .report-doc{border:0;border-radius:0;padding:0;}
      .report-head,.section,.balance-box,.kpi-card{break-inside:avoid;}
      .report-logo-row{margin-bottom:6px;}
      .report-logo{max-height:28px;}
      .report-logo.coolsheet{max-width:98px;}
      .report-logo.unsw{max-width:74px;}
      h1{font-size:19px;}
      h2{font-size:12.2px;}
      .section{margin-top:7px;padding:8px;}
      .kpi-grid{gap:5px;}
      .kpi-card{padding:6px;min-height:43px;}
      .kpi-card strong{font-size:12.4px;}
      .kpi-card small{display:none;}
      .industry-headline{padding:6px 8px;margin-bottom:6px;}
      .balance-grid{gap:6px;margin-top:6px;}
      .balance-table th,.balance-table td,.report-table th,.report-table td{padding:3px 4px;}
      .basis-note{font-size:8.2px;margin-top:7px;padding-top:6px;}
    }
  </style>
</head>
<body data-report-filename="${escapeHtml(reportFilename)}" data-email-subject="${escapeHtml(emailSubject)}">
  <main class="report-shell">
    <div class="handoff-actions" aria-label="Report actions">
      <button type="button" onclick="window.print()">Save PDF</button>
      <input id="handoffEmail" type="email" placeholder="recipient@example.gov.au" aria-label="Recipient email address" />
      <button id="btnSendReport" type="button" class="secondary" onclick="sendReportEmail()">Send report</button>
      <div id="emailStatus" class="handoff-status" aria-live="polite"></div>
    </div>
    <article class="report-doc">
      <header class="report-head">
        <div>
          <div class="report-logo-row" aria-label="Report organisations">
            <img class="report-logo coolsheet" src="${escapeHtml(coolsheetLogoSrc)}" alt="Coolsheet" />
            <img class="report-logo unsw" src="${escapeHtml(unswLogoSrc)}" alt="UNSW" />
          </div>
          <div class="report-kicker">Planning hand-off summary</div>
          <h1>Annual PVT Report</h1>
          <p class="muted">${escapeHtml(locationName)}</p>
        </div>
        <div class="head-meta">
          <div><span>Generated</span>${escapeHtml(generatedAt)}</div>
          <div><span>Version</span>${escapeHtml(reportVersion)}</div>
          <div><span>Area</span>${escapeHtml(area || "N/A")} m<sup>2</sup></div>
          <div><span>Industry</span>${escapeHtml(industryLabel)}</div>
          <div><span>Profile</span>${escapeHtml(profileLabel)}</div>
        </div>
      </header>

      <section class="section compact">
        <div class="section-title">
          <h2>Annual System Output</h2>
          <small>PV + thermal production</small>
        </div>
        ${renderReportKpis(annualMetrics, 4)}
      </section>

      ${industrySummary ? `<section class="section compact industry">
        <div class="section-title">
          <h2>Industry Assessment</h2>
          <small>Matched against hourly demand</small>
        </div>
        ${industrySummary.headline ? `<div class="industry-headline"><strong>${escapeHtml(industrySummary.headline)}</strong>${industrySummary.subhead ? `<span>${escapeHtml(industrySummary.subhead)}</span>` : ""}</div>` : ""}
        ${renderReportKpis(industrySummary.metrics, 5)}
        <div class="balance-grid">
          ${renderEnergyBalanceGroup("Electrical Balance", energyGroups.electrical)}
          ${renderEnergyBalanceGroup("Thermal Balance", energyGroups.thermal)}
        </div>
      </section>` : ""}

      <section class="section compact">
        <div class="section-title">
          <h2>Inputs And Assumptions</h2>
          <small>Values used for this estimate</small>
        </div>
        ${renderReportTable(assumptionRows, "compact-table")}
      </section>

      <div class="basis-note">
        <b>Basis of estimate:</b> PVGIS typical meteorological year weather is evaluated hour by hour against the selected PVT model and, where selected, the industry demand profile. Financial results use the editable rates, lifetime, CAPEX, OPEX, boiler efficiency, and discount rate above. Final design, compliance, and procurement decisions should be confirmed by the responsible project team.
      </div>
    </article>
  </main>
  <script>
    window.REPORT_EMAIL_BODY = ${JSON.stringify(emailBody)};
    window.REPORT_EMAIL_ENDPOINTS = ${JSON.stringify(reportEmailEndpoints)};
    function getReportExportHtml(){
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll(".handoff-actions, script").forEach(el => el.remove());
      return "<!doctype html>\\n" + clone.outerHTML;
    }
    async function sendReportEmail(){
      const emailInput = document.getElementById("handoffEmail");
      const status = document.getElementById("emailStatus");
      const button = document.getElementById("btnSendReport");
      const recipient = (emailInput?.value || "").trim();
      if (!recipient){
        status.textContent = "Enter a recipient email address first.";
        status.className = "handoff-status err";
        return;
      }
      const payload = {
        recipient,
        subject: document.body.dataset.emailSubject || "Annual PVT report",
        body_text: window.REPORT_EMAIL_BODY || "",
        report_html: getReportExportHtml(),
        filename: document.body.dataset.reportFilename || "annual-pvt-report.html"
      };
      button.disabled = true;
      status.textContent = "Sending report...";
      status.className = "handoff-status";
      const errors = [];
      for (const endpoint of (window.REPORT_EMAIL_ENDPOINTS || [])){
        try {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
          });
          if (resp.ok){
            status.textContent = "Report sent to " + recipient + ".";
            status.className = "handoff-status ok";
            button.disabled = false;
            return;
          }
          let detail = "HTTP " + resp.status;
          try {
            const data = await resp.json();
            detail = data.detail || detail;
          } catch (_e){}
          errors.push(endpoint + ": " + detail);
        } catch (err){
          errors.push(endpoint + ": " + (err?.message || String(err)));
        }
      }
      status.textContent = "Could not send email. " + errors.join(" | ");
      status.className = "handoff-status err";
      button.disabled = false;
    }
  </script>
</body>
</html>`;
}

function generatePdfTemplate(){
  if (!collectAnnualReportMetrics().length){
    alert("Run a calculation before generating the PDF template.");
    return;
  }

  const reportWindow = window.open("", "_blank");
  if (!reportWindow){
    alert("Please allow pop-ups so the PDF template can open.");
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(buildPdfTemplateDocument());
  reportWindow.document.close();
  reportWindow.focus();
}
function clamp(x, lo, hi){ return Math.min(hi, Math.max(lo, x)); }
function isFiniteNumber(x){ return typeof x === "number" && Number.isFinite(x); }
function cToF(c){ return (c * 9 / 5) + 32; }
function fToC(f){ return (f - 32) * 5 / 9; }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_DAYS  = [31,28,31,30,31,30,31,31,30,31,30,31];

function monthFromDayN(dayN){
  let s = 0;
  for (let m = 0; m < MONTH_DAYS.length; m++){
    s += MONTH_DAYS[m];
    if (dayN <= s) return m + 1;
  }
  return 12;
}
function monthMidDay(monthIndex){
  let start = 1;
  for (let i = 0; i < monthIndex; i++) start += MONTH_DAYS[i];
  return start + (MONTH_DAYS[monthIndex] / 2);
}
function dayOfYearFromMonthDay(month, day){
  let s = 0;
  for (let i = 0; i < month - 1; i++) s += MONTH_DAYS[i];
  return s + day;
}

function getInputNumberValue(id){
  const el = document.getElementById(id);
  if (!el) return NaN;
  const raw = String(el.value ?? "").replace(/,/g, "").trim();
  if (!raw) return NaN;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

function isInputChecked(id){
  return !!document.getElementById(id)?.checked;
}

function calculateThermalStorage(requestPayload){
  const tankVolumeLitres = Number(requestPayload?.tank_volume_litres);
  const pvtSupplyArray = Array.isArray(requestPayload?.pvt_supply_array) ? requestPayload.pvt_supply_array : [];
  const demandArray = Array.isArray(requestPayload?.hotel_demand_array) ? requestPayload.hotel_demand_array : [];
  const mainsTemp = Number(requestPayload?.mains_temp);

  if (!isFiniteNumber(tankVolumeLitres) || tankVolumeLitres < 0){
    throw new Error("tank_volume_litres must be >= 0.");
  }
  if (pvtSupplyArray.length !== demandArray.length){
    throw new Error("pvt_supply_array and hotel_demand_array must have the same length.");
  }

  const len = pvtSupplyArray.length;
  const targetTempC = 35.0;
  const safeMainsTemp = isFiniteNumber(mainsTemp) ? mainsTemp : 14;
  const tankCapacityKWh = Math.max(0, (tankVolumeLitres * 4.184 * (targetTempC - safeMainsTemp)) / 3600.0);
  const tankSoc = new Array(len).fill(0);
  const unmetDemandKWh = new Array(len).fill(0);
  const excessPvtKWh = new Array(len).fill(0);
  let currentTankKWh = 0;

  for (let hourIdx = 0; hourIdx < len; hourIdx++){
    const supplyKWh = Math.max(0, Number(pvtSupplyArray[hourIdx]) || 0);
    const demandKWh = Math.max(0, Number(demandArray[hourIdx]) || 0);

    currentTankKWh += supplyKWh;
    currentTankKWh -= demandKWh;

    if (currentTankKWh < 0){
      unmetDemandKWh[hourIdx] = Math.abs(currentTankKWh);
      currentTankKWh = 0;
    } else if (currentTankKWh > tankCapacityKWh){
      excessPvtKWh[hourIdx] = currentTankKWh - tankCapacityKWh;
      currentTankKWh = tankCapacityKWh;
    }

    tankSoc[hourIdx] = currentTankKWh;
  }

  const totalDemandKWh = demandArray.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const totalUnmetDemandKWh = unmetDemandKWh.reduce((sum, value) => sum + value, 0);
  const totalExcessPvtKWh = excessPvtKWh.reduce((sum, value) => sum + value, 0);
  const totalMetDemandKWh = Math.max(0, totalDemandKWh - totalUnmetDemandKWh);
  const solarFractionPct = totalDemandKWh > 0 ? (totalMetDemandKWh / totalDemandKWh) * 100 : 0;

  return {
    tank_capacity_kwh: tankCapacityKWh,
    tank_soc_kwh: tankSoc,
    unmet_demand_kwh: unmetDemandKWh,
    excess_pvt_kwh: excessPvtKWh,
    total_unmet_demand_kwh: totalUnmetDemandKWh,
    total_excess_pvt_kwh: totalExcessPvtKWh,
    solar_fraction_pct: solarFractionPct
  };
}

// ================================================================
//  TILTED SURFACE RADIATION  (Supply-side core)
// ================================================================
class TiltedSurfaceRadiation {
  constructor(latitude, longitude, tiltAngle, surfaceAzimuth, albedo = 0.2){
    this.latitude = latitude; this.longitude = longitude;
    this.tiltAngle = tiltAngle; this.surfaceAzimuth = surfaceAzimuth;
    this.albedo = albedo;
  }
  toRadians(deg){ return deg * (Math.PI / 180); }
  toDegrees(rad){ return rad * (180 / Math.PI); }
  declinationAngle(dayN){
    return 23.45 * Math.sin(this.toRadians((360 / 365) * (dayN + 284)));
  }
  hourAngle(hourN){ return 15 * (hourN - 12); }
  zenithAngle(dayN, hourN){
    const deltaRad = this.toRadians(this.declinationAngle(dayN));
    const omegaRad = this.toRadians(this.hourAngle(hourN));
    const latRad   = this.toRadians(this.latitude);
    const cosThetaZ = Math.sin(deltaRad)*Math.sin(latRad)
                    + Math.cos(deltaRad)*Math.cos(latRad)*Math.cos(omegaRad);
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, cosThetaZ))));
  }
  incidenceAngle(dayN, hourN){
    const deltaRad = this.toRadians(this.declinationAngle(dayN));
    const omegaRad = this.toRadians(this.hourAngle(hourN));
    const latRad   = this.toRadians(this.latitude);
    const sRad     = this.toRadians(this.tiltAngle);
    const gammaRad = this.toRadians(this.surfaceAzimuth - 180);
    const item1 = Math.sin(deltaRad)*Math.sin(latRad)*Math.cos(sRad);
    const item2 = Math.sin(deltaRad)*Math.cos(latRad)*Math.sin(sRad)*Math.cos(gammaRad);
    const item3 = Math.cos(deltaRad)*Math.cos(latRad)*Math.cos(sRad)*Math.cos(omegaRad);
    const item4 = Math.cos(deltaRad)*Math.sin(latRad)*Math.sin(sRad)*Math.cos(gammaRad)*Math.cos(omegaRad);
    const item5 = Math.cos(deltaRad)*Math.sin(sRad)*Math.sin(gammaRad)*Math.sin(omegaRad);
    const cosThetaT = item1 - item2 + item3 + item4 + item5;
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, cosThetaT))));
  }
  beamRadiationRatio(dayN, hourN){
    const thetaT = this.incidenceAngle(dayN, hourN);
    const thetaZ = this.zenithAngle(dayN, hourN);
    const cosThetaT = Math.cos(this.toRadians(thetaT));
    const cosThetaZ = Math.cos(this.toRadians(thetaZ));
    if (cosThetaZ <= 1e-6) return 0;
    return Math.max(0, cosThetaT) / cosThetaZ;
  }
  calculate(dayN, hourN, dni, dhi){
    const thetaZ    = this.zenithAngle(dayN, hourN);
    const cosThetaZ = Math.cos(this.toRadians(thetaZ));
    const eps = 1e-6;
    const DNI = Math.max(0, (dni || 0));
    const DHI = Math.max(0, (dhi || 0));
    const BHI = (cosThetaZ > eps) ? (DNI * Math.max(0, cosThetaZ)) : 0;
    const ghi = BHI + DHI;
    const thetaT    = this.incidenceAngle(dayN, hourN);
    const cosThetaT = Math.cos(this.toRadians(thetaT));
    const beamComponent           = (cosThetaZ > eps) ? (DNI * Math.max(0, cosThetaT)) : 0;
    const diffuseComponent        = DHI * ((1 + Math.cos(this.toRadians(this.tiltAngle))) / 2);
    const groundReflectedComponent = ghi * this.albedo * ((1 - Math.cos(this.toRadians(this.tiltAngle))) / 2);
    const totalIrradiance = Math.max(0, beamComponent + diffuseComponent + groundReflectedComponent);
    return { totalIrradiance, ghi, dni: DNI, bhi: BHI };
  }
}

// ================================================================
//  NETWORKING  (geocoding, timezone, TMY)
// ================================================================
const LOAD_TIMEOUT_MS = { geocode:8000, localTMY:45000, remoteTMY:90000 };
const GEOCODE_CACHE = new Map();
const TMY_CACHE     = new Map();
const NETWORK_CACHE_PREFIX = "pvtCalcNetworkCache.v1";
const NETWORK_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NETWORK_CACHE_LIMITS = { geocode:30, tmy:6 };

function makeLocCacheKey(lat, lon){ return `${lat.toFixed(4)},${lon.toFixed(4)}`; }

function getStoredNetworkCache(scope, key){
  try {
    const storageKey = `${NETWORK_CACHE_PREFIX}.${scope}.${key}`;
    const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!cached || typeof cached !== "object" || !("data" in cached)) return null;
    if (!Number.isFinite(cached.ts) || Date.now() - cached.ts > NETWORK_CACHE_TTL_MS){
      localStorage.removeItem(storageKey);
      return null;
    }
    return cached.data;
  } catch(_e){
    return null;
  }
}

function pruneStoredNetworkCache(scope, maxEntries){
  try {
    const prefix = `${NETWORK_CACHE_PREFIX}.${scope}.`;
    const entries = [];
    for (let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      let ts = 0;
      try { ts = JSON.parse(localStorage.getItem(key) || "{}").ts || 0; } catch(_e){}
      entries.push({ key, ts });
    }
    entries.sort((a, b) => b.ts - a.ts);
    entries.slice(maxEntries).forEach(entry => localStorage.removeItem(entry.key));
  } catch(_e){}
}

function setStoredNetworkCache(scope, key, data){
  const maxEntries = NETWORK_CACHE_LIMITS[scope] || 10;
  const storageKey = `${NETWORK_CACHE_PREFIX}.${scope}.${key}`;
  const payload = JSON.stringify({ ts:Date.now(), data });
  try {
    localStorage.setItem(storageKey, payload);
    pruneStoredNetworkCache(scope, maxEntries);
  } catch(_e){
    pruneStoredNetworkCache(scope, Math.max(1, maxEntries - 1));
    try { localStorage.setItem(storageKey, payload); } catch(_ignored){}
  }
}

async function fetchWithTimeout(url, options={}, timeoutMs=10000){
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timerId); }
}

function delay(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeAddress(address){
  const q = (address || "").trim();
  if (!q) throw new Error("Please input an address.");
  const qKey = q.toLowerCase();
  if (GEOCODE_CACHE.has(qKey)) return GEOCODE_CACHE.get(qKey);
  const stored = getStoredNetworkCache("geocode", qKey);
  if (stored){
    GEOCODE_CACHE.set(qKey, stored);
    return stored;
  }
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=" + encodeURIComponent(q);
  const resp = await fetchWithTimeout(url, { headers:{"Accept":"application/json"} }, LOAD_TIMEOUT_MS.geocode);
  if (!resp.ok) throw new Error("Geocoding failed: " + resp.status);
  const arr = await resp.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error("No geocoding result for this address.");
  const countryCode = (arr[0].address?.country_code || "").toLowerCase();
  const loc = { lat:parseFloat(arr[0].lat), lon:parseFloat(arr[0].lon), name:arr[0].display_name || q, countryCode };
  GEOCODE_CACHE.set(qKey, loc);
  setStoredNetworkCache("geocode", qKey, loc);
  return loc;
}

// The timezone comes back with the TMY response — the API derives it from the
// coordinates server-side (timezonefinder), so no separate timezone service is used.

function parseGmtOffset(raw){
  if (Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object"){
    if (Number.isFinite(raw.seconds)) return raw.seconds / 3600;
    if (Number.isFinite(raw.hours)) {
      const minutes = Number.isFinite(raw.minutes) ? raw.minutes : 0;
      const sign = raw.hours < 0 ? -1 : 1;
      return raw.hours + sign * (Math.abs(minutes) / 60);
    }
    if (typeof raw.utcOffset === "string") return parseGmtOffset(raw.utcOffset);
  }
  if (typeof raw === "string"){
    const match = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (match){
      const sign = match[1] === "-" ? -1 : 1;
      const hours = Number(match[2]) || 0;
      const minutes = Number(match[3] || 0);
      return sign * (hours + minutes / 60);
    }
  }
  return null;
}

function normalizeTimezoneInfo(raw){
  if (!raw || typeof raw !== "object") return null;
  const timeZone =
    raw.timeZone ||
    raw.timezone ||
    raw.tz ||
    raw.zoneName ||
    raw.timezoneName ||
    raw.meta?.timeZone ||
    raw.meta?.timezone ||
    raw.meta?.tz ||
    "";
  const gmtOffset =
    parseGmtOffset(raw.gmtOffset) ??
    parseGmtOffset(raw.utcOffset) ??
    parseGmtOffset(raw.currentUtcOffset) ??
    parseGmtOffset(raw.currentUtcOffset?.utcOffset);

  if (!timeZone && !Number.isFinite(gmtOffset)) return null;
  return {
    timeZone,
    gmtOffset: Number.isFinite(gmtOffset) ? gmtOffset : null
  };
}

function formatGmtOffset(gmtOffset){
  if (!Number.isFinite(gmtOffset)) return "";
  const sign = gmtOffset >= 0 ? "+" : "-";
  const abs = Math.abs(gmtOffset);
  let hours = Math.floor(abs);
  let minutes = Math.round((abs - hours) * 60);
  if (minutes === 60){
    hours += 1;
    minutes = 0;
  }
  return `GMT${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getTimezoneDisplay(tzInfo){
  const normalized = normalizeTimezoneInfo(tzInfo);
  if (!normalized) return "unknown";
  if (normalized.timeZone && Number.isFinite(normalized.gmtOffset)){
    return `${normalized.timeZone} (${formatGmtOffset(normalized.gmtOffset)})`;
  }
  if (normalized.timeZone) return normalized.timeZone;
  return formatGmtOffset(normalized.gmtOffset);
}

const LOCAL_TMY_ENDPOINT = "http://localhost:8000/tmy";
const REMOTE_TMY_ENDPOINT = "https://pvt-tmy-api.onrender.com/tmy";

function isLocalFrontend(){
  const host = window.location.hostname;
  return window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "";
}

function getTMYEndpoints(){
  const localEndpoint = {
    label: "local API",
    url: LOCAL_TMY_ENDPOINT,
    timeoutMs: LOAD_TIMEOUT_MS.localTMY,
    attempts: 1
  };
  const remoteEndpoint = {
    label: "hosted API",
    url: REMOTE_TMY_ENDPOINT,
    timeoutMs: LOAD_TIMEOUT_MS.remoteTMY,
    attempts: 2
  };
  return isLocalFrontend() ? [localEndpoint, remoteEndpoint] : [remoteEndpoint];
}

function getReportEmailEndpoints(){
  const localEndpoint = LOCAL_TMY_ENDPOINT.replace(/\/tmy$/, "/email-report");
  const remoteEndpoint = REMOTE_TMY_ENDPOINT.replace(/\/tmy$/, "/email-report");
  return isLocalFrontend() ? [localEndpoint] : [remoteEndpoint];
}

function setTmyLoadStatus(msg, spinning){
  const el = document.getElementById("locConfirm");
  if (el && msg){
    const spin = spinning ? `<span class="cs-spinner"></span>` : "";
    el.innerHTML = `<span style="color:#8a6d00;display:inline-flex;align-items:center;">${spin}${escapeHtml(msg)}</span>`;
  }
}

async function fetchTMY(lat, lon){
  const cacheKey = makeLocCacheKey(lat, lon);
  if (TMY_CACHE.has(cacheKey)) return TMY_CACHE.get(cacheKey);
  const stored = getStoredNetworkCache("tmy", cacheKey);
  if (stored){
    TMY_CACHE.set(cacheKey, stored);
    setTmyLoadStatus("Using cached TMY weather for this location...");
    return stored;
  }

  const query = `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

  const endpointErrors = [];
  for (const endpoint of getTMYEndpoints()){
    for (let attempt = 1; attempt <= endpoint.attempts; attempt++){
      try {
        if (/hosted/i.test(endpoint.label)){
          setTmyLoadStatus("Contacting the hosted weather service — this can take up to ~1 minute if it is waking up…", true);
        }
        const resp = await fetchWithTimeout(endpoint.url + query, { headers:{"Accept":"application/json"} }, endpoint.timeoutMs);
        if (!resp.ok){
          let detail = "";
          try {
            const errData = await resp.json();
            detail = errData?.detail || errData?.error || "";
          } catch(_e){}
          throw new Error(`HTTP ${resp.status}${detail ? `: ${detail}` : ""}`);
        }
        const data = await resp.json();
        console.log("TMY served by:", endpoint.url);
        TMY_CACHE.set(cacheKey, data);
        setStoredNetworkCache("tmy", cacheKey, data);
        return data;
      } catch(e){
        const message = e?.name === "AbortError"
          ? `timed out after ${Math.round(endpoint.timeoutMs / 1000)}s`
          : (e?.message || String(e));
        console.warn(`TMY endpoint ${endpoint.url} failed (attempt ${attempt}/${endpoint.attempts}):`, message);
        if (attempt < endpoint.attempts){
          await delay(1500);
        } else {
          endpointErrors.push(`${endpoint.label} ${endpoint.url}: ${message}`);
        }
      }
    }
  }
  throw new Error("TMY fetch failed. The hosted weather API may still be waking up, or PVGIS may be temporarily unavailable. Try again in about a minute. Details: " + endpointErrors.join("; "));
}

function warmHostedTMYService(){
  const healthUrl = REMOTE_TMY_ENDPOINT.replace(/\/tmy$/, "/health");
  fetchWithTimeout(healthUrl, { headers:{"Accept":"application/json"} }, 8000).catch(() => {});
}

// ================================================================
//  WEATHER DATA PROCESSING
// ================================================================
function normalizeWeatherRecords(raw){
  let arr;
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") arr = Object.values(raw);
  else throw new Error("Unsupported weather data structure.");
  const out = [];
  for (const r of arr){
    if (!r || typeof r !== "object") continue;
    const dayN  = +(r.dayN ?? r.dayn ?? r.DayN ?? r.DAYN);
    let   hourN = +(r.hourN ?? r.hourn ?? r.HourN ?? r.HOURN);
    // solarHour (optional): true solar time (0..24, 12 = solar noon), DST-free and
    // meridian-corrected by the backend. Used for solar-geometry only. When absent
    // (older backend), solar position falls back to local-clock hourN.
    const solarHour = +(r.solarHour ?? r.solarhour ?? r.SolarHour ?? r.SOLARHOUR);
    const dni   = +(r.DNI ?? r.dni ?? r.Dni);
    const dhi   = +(r.DHI ?? r.dhi ?? r.Dhi);
    const ta    = +(r.Ta  ?? r.ta  ?? r.TA);
    const vwind = +(r.Vwind ?? r.vwind ?? r.VWIND ?? r.VWind);
    if (Number.isFinite(hourN) && hourN >= 1 && hourN <= 24) hourN = hourN - 1;
    out.push({ dayN, hourN, solarHour, dni, dhi, ta, vwind });
  }
  return out;
}

function normalizeTMYRecords(raw){
  const arr = Array.isArray(raw?.records) ? raw.records : (Array.isArray(raw) ? raw : null);
  if (!arr) throw new Error("TMY JSON missing records[]");
  return normalizeWeatherRecords(arr);
}

// ================================================================
//  GLOBAL STATE
// ================================================================
let CURRENT_LOC  = null;   // {name, lat, lon}
let CURRENT_MET  = null;   // normalized weather array
let CURRENT_TZ   = null;   // {timeZone, gmtOffset}
let CURRENT_MAINS = null;  // {annualAvgC, minC, maxC, byDay, byMonth}
let CURRENT_PROCESS_DETAIL = null;
let CURRENT_EVAN_VIEW = null;
let evanPrimaryChartInstance = null;

// ================================================================
//  MAINS WATER TEMPERATURE MODEL
// ================================================================
function calculateLocalTMains(met, latitude, longitude){
  const validTa = met.map(r => r.ta).filter(isFiniteNumber);
  if (!validTa.length) throw new Error("Cannot calculate T_mains: missing ambient temperature data.");

  const annualAvgTaC = validTa.reduce((a,b)=>a+b,0) / validTa.length;
  const monthBuckets = Array.from({length:12}, () => []);
  for (const r of met){
    if (!isFiniteNumber(r.dayN) || !isFiniteNumber(r.ta)) continue;
    monthBuckets[monthFromDayN(r.dayN) - 1].push(r.ta);
  }
  const monthAvgC    = monthBuckets.map(arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : annualAvgTaC);
  const maxMonthAvgC = Math.max(...monthAvgC);
  const minMonthAvgC = Math.min(...monthAvgC);
  const deltaMonthC  = maxMonthAvgC - minMonthAvgC;

  const annualAvgTaF = cToF(annualAvgTaC);
  const deltaMonthF  = deltaMonthC * 9 / 5;

  // Select BC-Aus parameters: use regional zone constants (bc_aus_zone_constants.js)
  // based on the nearest CER climate zone. Falls back to BC+6 if not loaded.
  let offsetF = 6, ratioC0 = 0.4, ratioC1 = 0.01, lagC0 = 35, lagC1 = -1;
  if (
    typeof BC_AUS_ZONE_CONSTANTS !== "undefined" &&
    BC_AUS_ZONE_CONSTANTS &&
    Number.isFinite(latitude) && Number.isFinite(longitude)
  ){
    const { zone } = findNearestCERZone(latitude, longitude, met);
    const zp = BC_AUS_ZONE_CONSTANTS[zone.key];
    if (zp && Number.isFinite(zp.offsetF)){
      ({ offsetF, ratioC0, ratioC1, lagC0, lagC1 } = zp);
    }
  }

  const ratio = ratioC0 + ratioC1 * (annualAvgTaF - 44);
  const lag   = lagC0   + lagC1   * (annualAvgTaF - 44);
  const lat = Number.isFinite(latitude) ? latitude : 0;

  const byDay = {};
  const byMonthBuckets = Array.from({length:12}, () => []);
  let minC = Infinity, maxC = -Infinity, sumC = 0;

  for (let day = 1; day <= 365; day++){
    const modelDay = lat >= 0 ? day : (((day + 182 - 1) % 365) + 1);
    const angleDeg = 0.986 * (modelDay - 15 - lag) - 90;
    const angleRad = angleDeg * Math.PI / 180;
    const tMainsF  = (annualAvgTaF + offsetF) + ratio * (deltaMonthF / 2) * Math.sin(angleRad);
    const tMainsC  = fToC(tMainsF);
    byDay[day] = tMainsC;
    byMonthBuckets[monthFromDayN(day) - 1].push(tMainsC);
    minC = Math.min(minC, tMainsC);
    maxC = Math.max(maxC, tMainsC);
    sumC += tMainsC;
  }

  const byMonth = byMonthBuckets.map((arr, i) => ({
    month: i + 1,
    avgC: arr.length ? (arr.reduce((a,b)=>a+b,0) / arr.length) : null
  }));

  return { annualAvgC: sumC / 365, minC, maxC, byDay, byMonth };
}

function getAmbientMonthlyAverages(met){
  const buckets = Array.from({length:12}, () => []);
  for (const r of (met || [])){
    if (!isFiniteNumber(r?.dayN) || !isFiniteNumber(r?.ta)) continue;
    const m = monthFromDayN(r.dayN);
    if (m >= 1 && m <= 12) buckets[m - 1].push(r.ta);
  }
  return buckets.map((arr, i) => ({
    month: i + 1,
    avgC: arr.length ? (arr.reduce((a,b)=>a+b,0) / arr.length) : null
  }));
}

function updateMainsDisplay(){
  const el  = document.getElementById("mainsTempDisplay");
  const tin = document.getElementById("tin");
  if (!CURRENT_MAINS){
    el.innerHTML = `<div class="mains-summary-box"><div><b>Monthly average T_mains (\xb0C):</b></div><table class="result-table mains-monthly" style="margin-top:6px;pointer-events:none;"><tbody><tr><td colspan="12" style="text-align:center;font-style:italic;font-family:inherit;opacity:0.5;border:none;">not available yet, load TMY</td></tr></tbody></table></div>`;
    tin.value = "10.0";
    return;
  }
  tin.value = CURRENT_MAINS.annualAvgC.toFixed(1);
  const monthHeader = MONTH_NAMES.map(m => `<th>${m}</th>`).join("");
  const monthValues = (CURRENT_MAINS.byMonth || [])
    .map(m => `<td class="num">${m.avgC == null ? "-" : m.avgC.toFixed(2)}</td>`).join("");
  el.innerHTML = `
    <div class="mains-summary-box">
      <div class="mains-links">
      </div>
      <div><b>Monthly average T_mains (&deg;C):</b></div>
      <table class="result-table mains-monthly" style="margin-top:6px;">
        <tr>${monthHeader}</tr>
        <tr>${monthValues}</tr>
      </table>
      <div class="mains-links" style="margin-top:8px;">
        <a class="mains-link" href="#" onclick="openClimateCharts(event)">View T_mains + Ta charts</a>
        <a class="mains-link" href="validation.html" target="_blank" rel="noopener" title="BC-Aus vs CER reference, standard +6°F offset">Validation 1: vs CER (+6°F)</a>
        <a class="mains-link" href="validation2.html" target="_blank" rel="noopener" title="BC-Aus vs CER reference, no-offset variant">Validation 2: vs CER (0°F)</a>
        <a class="mains-link" href="validation3.html" target="_blank" rel="noopener" title="BC-Aus vs EnergyPlus 0.5 m ground temperatures">Validation 3: vs ground 0.5 m</a>
        <a class="mains-link" href="validation4.html" target="_blank" rel="noopener" title="BC-Aus vs EnergyPlus 2.0 m ground temperatures">Validation 4: vs ground 2.0 m</a>
        <a class="mains-link" href="validation5.html" target="_blank" rel="noopener" title="The BC-Aus formula explained step by step">Validation 5: formula</a>
      </div>
      <div class="mains-links" style="margin-top:8px;">
        <a class="mains-link" href="cer_comparison.html" target="_blank" rel="noopener">CER Comparison</a>
      </div>
    </div>`;
}

// ================================================================
//  INDUSTRY DEFINITIONS
// ================================================================
const INDUSTRY_PROCESSES = {
  dairy_farm: {
    fatty_film_rinse: { label: "Process A: Fatty Film Rinse (kWater = 0.30)" },
    cip_preheating:   { label: "Process B: CIP Pre-heating (kWater = 0.57)" },
    boiler_preheat:   { label: "Process C: Boiler Feedwater Pre-heating (kWater = 0.50)" }
  },
  brewery: {
    cip_prerinse:      { label: "Process A: CIP Pre-Rinse (kWater = 0.80)" },
    bottle_keg_rinse:  { label: "Process B: Bottle/Keg Rinsing (kWater = 0.45)" },
    boiler_preheat:    { label: "Process C: Boiler Feedwater Pre-heating (kWater = 0.60)" }
  },
  aquatic_centres: {
    sauna:        { label: "Sauna" },
    kids_pool:    { label: "Kids Pool" },
    outdoor_pool: { label: "Outdoor Pool" },
    indoor_pool:  { label: "Indoor Pool" }
  },
  hotel: {
    domestic_hot_water:  { label: "Domestic hot water (showers/basins)" },
    kitchen_dishwashing: { label: "Kitchen/dishwashing" },
    laundry:             { label: "Laundry" },
    pool_heating:        { label: "Pool heating (optional)" }
  },
  commercial_laundry: {
    wash_water:     { label: "Wash water heating" },
    rinse_preheat:  { label: "Rinse water preheat" },
    boiler_preheat: { label: "Steam/boiler preheat" }
  }
};

const INDUSTRY_UI = {
  dairy_farm:         { name:"Dairy Farm",         throughput:"Raw milk throughput (L per year):", defaultVal:5000000 },
  brewery:            { name:"Brewery",            throughput:"Beer produced (L per year):",       defaultVal:500000  },
  aquatic_centres:    { name:"Aquatic Centres",    throughput:"Water volume (L):",                 defaultVal:5000000 },
  hotel:              { name:"Hotel",              throughput:"Occupied room-nights per year:",     defaultVal:60000   },
  commercial_laundry: { name:"Commercial Laundry", throughput:"Laundry processed (kg per year):",  defaultVal:500000  }
};

const INDUSTRY_DIAGRAMS = {
  dairy_farm: { title:"Dairy Farm Process Diagram", src:"assets/dairy-process-diagram.png" },
  brewery:    { title:"Brewery Process Diagram",    src:"assets/brewery-process-diagram.png" }
};

// ================================================================
//  DAIRY DEMAND MODEL
// ================================================================
const DAIRY_SEASONAL = [0.85,0.80,0.85,0.90,0.85,0.75,0.75,0.80,1.10,1.30,1.30,1.05];

const DAIRY_PROCESS_PARAMS = {
  fatty_film_rinse: {
    kWater: 0.30, T_target: 35,
    weights24: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0]
  },
  cip_preheating: {
    kWater: 0.57, T_target: 35,
    weights24: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0]
  },
  boiler_preheat: {
    kWater: 0.50, T_target: 35,
    weights24: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  }
};

const DAIRY_ELEC_PARAMS = {
  kWhPerKL: 51.7,
  weights24: [0.1,0.05,0.05,0.05,0.05,3,3,3,1,0.5,0.3,0.2,0.2,0.2,0.2,3,3,3,1,0.5,0.2,0.1,0.1,0.1]
};

const DAIRY_PROCESS_COLORS = {
  fatty_film_rinse: "#4a86c8",
  cip_preheating: "#e8923f",
  boiler_preheat: "#5bb5a2"
};

const DAIRY_PROCESS_SHORT_LABELS = {
  fatty_film_rinse: "Fatty rinse",
  cip_preheating: "CIP pre-heat",
  boiler_preheat: "Boiler pre-heat"
};

const DAIRY_PROCESS_STACK_ORDER = ["fatty_film_rinse","cip_preheating","boiler_preheat"];

// Brewery seasonal scaling and direct-PVT process limits follow the brewery load-profile references [B1]-[B7].
const BREWERY_SEASONAL = [1.25,1.10,0.95,0.85,0.80,0.75,0.78,0.88,1.05,1.15,1.22,1.35];

const BREWERY_PROCESS_PARAMS = {
  cip_prerinse: {
    kWater: 0.80, T_target: 45,
    weights24: [0,0,0,0,0,0,0.2,0.4,0.4,0.4,0.4,0.4,0.6,0.8,1.0,1.0,1.0,0.8,0.6,0.4,0.2,0,0,0]
  },
  bottle_keg_rinse: {
    kWater: 0.45, T_target: 40,
    weights24: [0,0,0,0,0,0,0,0,0.1,0.5,1.0,1.0,0.9,0.9,1.0,1.0,0.8,0.4,0.1,0,0,0,0,0]
  },
  boiler_preheat: {
    kWater: 0.60, T_target: 45,
    weights24: [0,0,0,0,0,0,0,0.2,0.5,0.8,1.0,1.0,0.6,0.4,0.4,0.4,0.4,0.2,0,0,0,0,0,0]
  }
};

const BREWERY_ELEC_PARAMS = {
  kWhPerHL: 11.50,
  kWhPerL: 0.115,
  weights24: [0.40,0.40,0.40,0.42,0.45,0.60,0.85,0.95,1.00,0.98,0.95,0.92,0.90,0.98,1.00,0.95,0.80,0.65,0.55,0.50,0.45,0.42,0.40,0.40]
};

const BREWERY_PROCESS_COLORS = {
  cip_prerinse: "#2e86ab",
  bottle_keg_rinse: "#f4a261",
  boiler_preheat: "#e76f51"
};

const BREWERY_PROCESS_SHORT_LABELS = {
  cip_prerinse: "CIP pre-rinse",
  bottle_keg_rinse: "Bottle/keg rinse",
  boiler_preheat: "Boiler pre-heat"
};

const BREWERY_PROCESS_STACK_ORDER = ["cip_prerinse","bottle_keg_rinse","boiler_preheat"];

function _normW(arr){
  const w = arr.map(v => (isFiniteNumber(v) && v > 0) ? v : 0);
  const s = w.reduce((a,b)=>a+b,0);
  return s > 0 ? w.map(v=>v/s) : w.map(()=>1/24);
}

// Scale monthly seasonal factors so the day-weighted annual mean is exactly 1.0.
// Keeps the seasonal shape but makes annual totals match the stated benchmarks
// (e.g. dairy 51.7 kWh/kL, throughput x kWater litres of process water per year).
// Without this, the raw dairy factors averaged ~0.94, understating annual demand ~6%.
function normalizeSeasonalFactors(seasonal){
  let daySum = 0;
  for (let m = 0; m < 12; m++) daySum += MONTH_DAYS[m] * (isFiniteNumber(seasonal[m]) ? seasonal[m] : 1);
  const scale = daySum > 0 ? 365 / daySum : 1;
  return seasonal.map(v => (isFiniteNumber(v) ? v : 1) * scale);
}

function isMonToFriDay(dayN){
  if (!Number.isFinite(dayN)) return true;
  const d = Math.floor(dayN);
  if (d < 1) return true;
  return ((d - 1) % 7) <= 4;
}

// ================================================================
//  HOTEL DEMAND MODEL
// ================================================================
const HOTEL_PROCESS_PARAMS = {
  domestic_hot_water:  { kWhPerUnit: 5.50 },
  kitchen_dishwashing: { kWhPerUnit: 1.60 },
  laundry:             { kWhPerUnit: 1.20 },
  pool_heating:        { kWhPerUnit: 0.80 }
};

// Hourly weight arrays (24 elements, index 0 = midnight)
const HOTEL_HOURLY_WEIGHTS = {
  domestic_hot_water:  [2,2,2,2,2,3, 8,12,8,4,3,3, 3,3,3,3,3,4, 6,9,9,7,3,2],
  laundry:             [1,1,1,1,1,1, 2,8,11,11,10,6, 3,8,10,9,6,4, 2,2,1,1,1,1],
  kitchen_dishwashing: [1,1,1,1,1,3, 8,10,8,4,3,3, 9,8,4,3,3,4, 8,10,8,5,3,1],
  pool_heating:        [1,1,1,1,1,2, 3,4,6,8,9,9, 9,9,8,7,6,5, 4,3,2,1,1,1]
};

// Monthly seasonal factors (index 0 = January)
const HOTEL_MONTHLY_FACTORS = {
  domestic_hot_water:  [0.90,0.90,0.95,1.00,1.05,1.10, 1.15,1.10,1.05,1.00,0.90,0.85],
  laundry:             [1.10,1.05,1.00,0.95,0.90,0.85, 0.85,0.90,0.95,1.00,1.05,1.10],
  kitchen_dishwashing: [1.08,1.05,1.00,0.95,0.92,0.88, 0.88,0.92,0.95,1.00,1.05,1.10],
  pool_heating:        [0.60,0.65,0.75,0.95,1.15,1.30, 1.35,1.25,1.10,0.90,0.70,0.60]
};

// Electrical load profile: ~15 kWh per occupied room-night
const HOTEL_ELECTRICAL_KWH_PER_UNIT = 15.0;
const HOTEL_ELECTRICAL_HOURLY  = [3,3,3,3,3,3, 4,5,6,5,5,5, 5,5,5,5,5,6, 7,7,6,5,4,3];
const HOTEL_ELECTRICAL_MONTHLY = [1.05,1.05,1.00,0.95,0.95,1.00, 1.00,0.95,0.95,1.00,1.05,1.05];
// Aquatic-centre Phase C economics copied from Evan's working assumptions.
const PVT_CAPEX_PV_PER_W = 0.25;
const PVT_CAPEX_THERMAL_PER_W = 0.40;
const PVT_BOS_MULTIPLIER = 2.0;

// Process chart styling
const HOTEL_PROCESS_COLORS = {
  domestic_hot_water: "#4a86c8", kitchen_dishwashing: "#e8923f",
  laundry: "#7a8b99", pool_heating: "#5bb5a2"
};
const HOTEL_PROCESS_SHORT_LABELS = {
  domestic_hot_water: "DHW", kitchen_dishwashing: "Kitchen",
  laundry: "Laundry", pool_heating: "Pool"
};
const HOTEL_PROCESS_STACK_ORDER = ["domestic_hot_water","kitchen_dishwashing","laundry","pool_heating"];

const AQUATIC_PROCESS_PARAMS = {
  indoor_pool: {
    targetTempC: 27,
    avgDepthM: 1.5,
    makeupLitresPerM2Day: 22,
    convectiveUWm2K: 4.2,
    radiativeUWm2K: 1.2,
    evaporationCoeff: 0.070,
    splashMultiplierOpen: 1.10,
    splashMultiplierClosed: 0.80,
    indoorAirTempOffsetC: 1.5,
    indoorRh: 0.60
  },
  outdoor_pool: {
    targetTempC: 27,
    avgDepthM: 1.5,
    makeupLitresPerM2Day: 30,
    convectiveUWm2K: 7.5,
    radiativeUWm2K: 2.0,
    evaporationCoeff: 0.105,
    splashMultiplierOpen: 1.15,
    splashMultiplierClosed: 0.90
  },
  kids_pool: {
    targetTempC: 30,
    avgDepthM: 0.7,
    makeupLitresPerM2Day: 26,
    convectiveUWm2K: 5.0,
    radiativeUWm2K: 1.3,
    evaporationCoeff: 0.082,
    splashMultiplierOpen: 1.18,
    splashMultiplierClosed: 0.82,
    indoorAirTempOffsetC: 1.0,
    indoorRh: 0.62
  },
  sauna: {
    targetTempC: 35,
    avgDepthM: 0.9,
    makeupLitresPerM2Day: 18,
    convectiveUWm2K: 5.5,
    radiativeUWm2K: 1.4,
    evaporationCoeff: 0.060,
    splashMultiplierOpen: 1.05,
    splashMultiplierClosed: 0.78,
    indoorAirTempOffsetC: 2.0,
    indoorRh: 0.50
  }
};

const AQUATIC_PROCESS_COLORS = {
  indoor_pool: "#4a86c8",
  outdoor_pool: "#3cb371",
  kids_pool: "#f6ae2d",
  sauna: "#d1495b"
};
const AQUATIC_PROCESS_SHORT_LABELS = {
  indoor_pool: "Indoor",
  outdoor_pool: "Outdoor",
  kids_pool: "Kids",
  sauna: "Sauna"
};
const AQUATIC_PROCESS_STACK_ORDER = ["indoor_pool","outdoor_pool","kids_pool","sauna"];
const AQUATIC_DEFAULT_HOURS = { openStart: 6, openEnd: 22 };
const AQUATIC_WEEKDAY_HOURS = { openStart: 7, openEnd: 20 };
const AQUATIC_COVER_REDUCTION = 0.60;
const AQUATIC_ELEC_KWH_PER_M2_PER_YEAR = 250;
const AQUATIC_ELEC_BASE_SHARE = 0.55;
const WATER_CP_KWH_PER_KG_C = 4.184 / 3600.0;
const EVAP_LATENT_KWH_PER_KG = 0.680;

// Per-process hourly weight considering profile type
function hotelProcessWeight(processKey, hourN, dayN, monthIdx, profileType){
  const h = Math.floor(hourN);
  const hWeights = HOTEL_HOURLY_WEIGHTS[processKey];
  const mFactors = HOTEL_MONTHLY_FACTORS[processKey];
  if (!hWeights || !mFactors) return 1;
  const hW = hWeights[h] || 0;
  const mF = mFactors[monthIdx] || 1.0;

  if (profileType === "mon_fri"){
    // DHW and pool still run 24/7; laundry and kitchen compressed to weekday 9-17
    if (processKey === "laundry" || processKey === "kitchen_dishwashing"){
      const dayIdx = ((Math.floor(dayN) - 1) % 7 + 7) % 7;
      const isWeekday = dayIdx < 5;
      if (!(isWeekday && h >= 9 && h < 17)) return 0;
      const windowWeights = hWeights.slice(9, 17);
      const sumW = windowWeights.reduce((a,b)=>a+b,0);
      return (sumW > 0 ? (hWeights[h] / sumW) * 8 : 1) * mF;
    }
    return hW * mF;
  }
  // "continuous" (24/7): full hourly shape x seasonal factor
  return hW * mF;
}

// Weight sum for normalisation
function hotelProcessWeightSum(processKey, profileType, met){
  let total = 0;
  for (const r of met){
    if (!isFiniteNumber(r.dayN) || !isFiniteNumber(r.hourN)) continue;
    const mIdx = monthFromDayN(r.dayN) - 1;
    total += hotelProcessWeight(processKey, r.hourN, r.dayN, mIdx, profileType);
  }
  return total;
}

// Hotel daily shape chart (stacked area, 24-hour profile)
function buildHotelDailyShapeChart(processByHour, met, activeKeys, profileLabel){
  // Aggregate into average hour-of-day buckets
  const hourBuckets = {};
  const hourCounts = new Array(24).fill(0);
  for (const key of activeKeys) hourBuckets[key] = new Array(24).fill(0);

  let prevDayN = -1, hourCounter = -1;
  for (let i = 0; i < met.length; i++){
    const dn = met[i].dayN;
    if (dn !== prevDayN){ hourCounter = 0; prevDayN = dn; } else { hourCounter++; }
    const h = Math.min(23, Math.max(0, hourCounter));
    hourCounts[h]++;
    for (const key of activeKeys){
      const arr = processByHour[key];
      if (arr && i < arr.length) hourBuckets[key][h] += arr[i];
    }
  }
  for (const key of activeKeys){
    for (let h = 0; h < 24; h++){
      if (hourCounts[h] > 0) hourBuckets[key][h] /= hourCounts[h];
    }
  }

  // Stacked totals
  const running = new Array(24).fill(0);
  const stacked = [];
  for (const key of activeKeys){
    const bottom = running.slice();
    const top = running.map((v,h) => v + (hourBuckets[key]?.[h] || 0));
    stacked.push({key, bottom, top});
    for (let h = 0; h < 24; h++) running[h] = top[h];
  }
  let maxV = Math.max(...running);
  if (maxV <= 0) maxV = 1;
  maxV *= 1.12;

  const width=860, height=380;
  const mg={top:36,right:130,bottom:52,left:68};
  const cw=width-mg.left-mg.right, ch=height-mg.top-mg.bottom;
  const xp=h=>mg.left+(h/23)*cw;
  const yp=v=>mg.top+((maxV-v)/maxV)*ch;
  const baseline=yp(0);

  let svg=[];
  for(let i=0;i<=5;i++){
    const v=(i/5)*maxV, py=yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v<10?v.toFixed(2):v.toFixed(0)}</text>`);
  }

  for(const layer of stacked){
    const color=HOTEL_PROCESS_COLORS[layer.key]||"#999";
    let d=`M ${xp(0).toFixed(1)} ${yp(layer.bottom[0]).toFixed(1)}`;
    for(let h=0;h<24;h++) d+=` L ${xp(h).toFixed(1)} ${yp(layer.top[h]).toFixed(1)}`;
    for(let h=23;h>=0;h--) d+=` L ${xp(h).toFixed(1)} ${yp(layer.bottom[h]).toFixed(1)}`;
    d+=" Z";
    svg.push(`<path d="${d}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="0.5"/>`);
  }
  let topLine="";
  for(let h=0;h<24;h++){topLine+=(h===0?`M`:`L`)+` ${xp(h).toFixed(1)} ${yp(running[h]).toFixed(1)}`;}
  svg.push(`<path d="${topLine}" fill="none" stroke="#333" stroke-width="1.5"/>`);

  // Peak annotations
  if(running[7]>0) svg.push(`<text x="${xp(7).toFixed(1)}" y="${(yp(running[7])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Morning Peak</text>`);
  if(running[19]>0) svg.push(`<text x="${xp(19).toFixed(1)}" y="${(yp(running[19])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Evening Peak</text>`);

  for(let h=0;h<24;h+=3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,'0')}:00</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  let ly=mg.top+10;
  for(const key of activeKeys){
    const lx=width-mg.right+14;
    svg.push(`<rect x="${lx}" y="${ly-6}" width="14" height="14" rx="2" fill="${HOTEL_PROCESS_COLORS[key]||'#999'}" fill-opacity="0.8"/>`);
    svg.push(`<text x="${lx+20}" y="${ly+5}" font-size="12" fill="#333">${HOTEL_PROCESS_SHORT_LABELS[key]||key}</text>`);
    ly+=22;
  }
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Demand (kWh/h)</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#222">Hourly Thermal Demand \u2013 Hotel</text>`);

  return `<div class="note" style="margin:0 0 6px;">Profile: "${profileLabel}". Values are annual averages per hour-of-day.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

// Hotel 24/7 vs Mon-Fri profile comparison chart
function buildHotelProfileCompareChart(activeKeys){
  function buildNormShape(profType){
    const shape=new Array(24).fill(0);
    for(const key of activeKeys){
      for(let h=0;h<24;h++) shape[h]+=hotelProcessWeight(key,h,3,5,profType);
    }
    const mx=Math.max(...shape);
    if(mx>0) for(let h=0;h<24;h++) shape[h]/=mx;
    return shape;
  }
  const shape247=buildNormShape("continuous");
  const shapeMF=buildNormShape("mon_fri");

  const width=860,height=380;
  const mg={top:36,right:160,bottom:52,left:68};
  const cw=width-mg.left-mg.right, ch=height-mg.top-mg.bottom;
  const xp=h=>mg.left+(h/23)*cw;
  const yp=v=>mg.top+((1.1-v)/1.1)*ch;
  const baseline=yp(0);

  let svg=[];
  for(let i=0;i<=5;i++){
    const v=i/5*1.1, py=yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    if(i<=5) svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v.toFixed(1)}</text>`);
  }

  // 24/7 filled area
  let areaPath=`M ${xp(0).toFixed(1)} ${baseline.toFixed(1)}`;
  for(let h=0;h<24;h++) areaPath+=` L ${xp(h).toFixed(1)} ${yp(shape247[h]).toFixed(1)}`;
  areaPath+=` L ${xp(23).toFixed(1)} ${baseline.toFixed(1)} Z`;
  svg.push(`<path d="${areaPath}" fill="#4a86c8" fill-opacity="0.25"/>`);

  let line247="";
  for(let h=0;h<24;h++){line247+=(h===0?`M`:` L`)+` ${xp(h).toFixed(1)} ${yp(shape247[h]).toFixed(1)}`;}
  svg.push(`<path d="${line247}" fill="none" stroke="#1565c0" stroke-width="2.5"/>`);

  let lineMF="";
  for(let h=0;h<24;h++){lineMF+=(h===0?`M`:` L`)+` ${xp(h).toFixed(1)} ${yp(shapeMF[h]).toFixed(1)}`;}
  svg.push(`<path d="${lineMF}" fill="none" stroke="#e8923f" stroke-width="2.5" stroke-dasharray="8,4"/>`);

  for(let h=0;h<24;h+=3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,'0')}</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  const lx=width-mg.right+14;
  svg.push(`<line x1="${lx}" y1="${mg.top+12}" x2="${lx+22}" y2="${mg.top+12}" stroke="#1565c0" stroke-width="2.5"/>`);
  svg.push(`<text x="${lx+28}" y="${mg.top+16}" font-size="12" font-weight="600" fill="#1565c0">24/7 Continuous</text>`);
  svg.push(`<line x1="${lx}" y1="${mg.top+36}" x2="${lx+22}" y2="${mg.top+36}" stroke="#e8923f" stroke-width="2.5" stroke-dasharray="6,3"/>`);
  svg.push(`<text x="${lx+28}" y="${mg.top+40}" font-size="12" font-weight="600" fill="#e8923f">Mon\u2013Fri</text>`);

  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Normalised Demand</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#222">24/7 vs Mon\u2013Fri Thermal Load Profile</text>`);

  return `<div class="note" style="margin:0 0 6px;">Normalised weekday demand shapes. 24/7 shows full DHW morning/evening peaks; Mon\u2013Fri compresses laundry &amp; kitchen into business hours.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

function openHotelDailyShape(ev){
  if(ev) ev.preventDefault();
  if(!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry!=="hotel") return;
  const pd=CURRENT_PROCESS_DETAIL;
  const activeKeys=HOTEL_PROCESS_STACK_ORDER.filter(k=>Object.keys(pd.processByHour).includes(k));
  const profileLabel=pd.profileType==="mon_fri"?"Mon\u2013Fri":"24/7 Continuous";
  document.getElementById("mainsChartTitle").textContent="Daily thermal demand shape by process";
  document.getElementById("mainsChartBody").innerHTML=buildHotelDailyShapeChart(pd.processByHour, pd.met, activeKeys, profileLabel);
  const modal=document.getElementById("mainsChartModal");
  modal.style.display="flex"; modal.setAttribute("aria-hidden","false");
}

function openHotelProfileCompare(ev){
  if(ev) ev.preventDefault();
  if(!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry!=="hotel") return;
  const activeKeys=HOTEL_PROCESS_STACK_ORDER.filter(k=>Object.keys(CURRENT_PROCESS_DETAIL.processByHour).includes(k));
  document.getElementById("mainsChartTitle").textContent="24/7 vs Mon\u2013Fri Thermal Load Profile";
  document.getElementById("mainsChartBody").innerHTML=buildHotelProfileCompareChart(activeKeys);
  const modal=document.getElementById("mainsChartModal");
  modal.style.display="flex"; modal.setAttribute("aria-hidden","false");
}

function getAnnualAmbientAverage(met){
  const vals = (met || []).map(r => Number(r?.ta)).filter(Number.isFinite);
  if (!vals.length) return 18;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

function getAquaticPoolAreaInputs(){
  return {
    indoor_pool: Math.max(0, getInputNumberValue("aquaticIndoorArea") || 0),
    outdoor_pool: Math.max(0, getInputNumberValue("aquaticOutdoorArea") || 0),
    kids_pool: Math.max(0, getInputNumberValue("aquaticKidsArea") || 0),
    sauna: Math.max(0, getInputNumberValue("aquaticSaunaArea") || 0)
  };
}

function getAquaticSchedule(profileType, dayN, hourN){
  const h = Math.floor(hourN);
  const weekday = isMonToFriDay(dayN);
  const hours = profileType === "mon_fri" ? AQUATIC_WEEKDAY_HOURS : AQUATIC_DEFAULT_HOURS;
  const openNow = h >= hours.openStart && h < hours.openEnd && (profileType !== "mon_fri" || weekday);
  return {
    openNow,
    openHoursPerDay: Math.max(1, hours.openEnd - hours.openStart)
  };
}

function saturationVaporPressureKPa(tempC){
  const safeTemp = Number.isFinite(tempC) ? tempC : 0;
  return 0.61078 * Math.exp((17.2694 * safeTemp) / (safeTemp + 237.3));
}

function getAquaticRelativeHumidity(record, processKey){
  const params = AQUATIC_PROCESS_PARAMS[processKey] || {};
  return params.indoorRh ?? 0.55;
}

function calcAquaticHourlyDemand(config){
  const met = Array.isArray(config?.met) ? config.met : [];
  const activeProcesses = Array.isArray(config?.activeProcesses) ? config.activeProcesses : [];
  const profileType = config?.profileType || "continuous";
  const processAreas = config?.processAreas || {};
  const coverEnabled = !!config?.coverEnabled;
  const mainsTempC = Number(config?.mainsTempC);
  const safeMainsTempC = isFiniteNumber(mainsTempC) ? mainsTempC : 15;
  const validKeys = activeProcesses.filter(key => AQUATIC_PROCESS_PARAMS[key] && (processAreas[key] || 0) > 0);
  if (!validKeys.length) return {
    thermalHourly: new Array(met.length || 8760).fill(0),
    processByHour: {},
    processAnnuals: {},
    processAreas: {},
    processVolumesLitres: {},
    processBreakdownAnnuals: {},
    ambientAnnualAvg: 0,
    totalAreaM2: 0
  };

  const len = met.length || 8760;
  const thermalHourly = new Array(len).fill(0);
  const processByHour = {};
  const processAnnuals = {};
  const processBreakdownAnnuals = {};
  const processVolumesLitres = {};
  let totalAreaM2 = 0;

  for (const key of validKeys){
    processByHour[key] = new Array(len).fill(0);
    processAnnuals[key] = 0;
    processBreakdownAnnuals[key] = { evaporation:0, makeup:0, sensible:0 };
    const params = AQUATIC_PROCESS_PARAMS[key];
    const areaM2 = Math.max(0, Number(processAreas[key]) || 0);
    totalAreaM2 += areaM2;
    processVolumesLitres[key] = areaM2 * (params.avgDepthM || 1.5) * 1000;
  }

  for (let i = 0; i < len; i++){
    const row = met[i] || {};
    const ambientTempC = Number.isFinite(Number(row.ta)) ? Number(row.ta) : 15;
    const windMs = Math.max(0, Number(row.vwind) || 0);
    let totalThisHour = 0;

    for (const key of validKeys){
      const params = AQUATIC_PROCESS_PARAMS[key];
      const areaM2 = processAreas[key] || 0;
      const { openNow, openHoursPerDay } = getAquaticSchedule(profileType, row.dayN, row.hourN);
      const airTempC = params.indoorAirTempOffsetC != null
        ? Math.max(ambientTempC, params.targetTempC - params.indoorAirTempOffsetC)
        : ambientTempC;
      const rh = getAquaticRelativeHumidity(row, key);
      const pWater = saturationVaporPressureKPa(params.targetTempC);
      const pAir = saturationVaporPressureKPa(airTempC) * clamp(rh, 0, 1);
      const vaporDelta = Math.max(0, pWater - pAir);
      const splashMultiplier = openNow ? params.splashMultiplierOpen : params.splashMultiplierClosed;
      let evaporationKgPerM2Hr = params.evaporationCoeff * (1 + 0.22 * windMs) * vaporDelta * splashMultiplier;
      if (coverEnabled && !openNow){
        evaporationKgPerM2Hr *= (1 - AQUATIC_COVER_REDUCTION);
      }
      const evaporationKWh = evaporationKgPerM2Hr * areaM2 * EVAP_LATENT_KWH_PER_KG;

      const makeupLitresPerDay = areaM2 * (params.makeupLitresPerM2Day || 0);
      const makeupLitresThisHour = openNow ? makeupLitresPerDay / openHoursPerDay : 0;
      const makeupKWh = makeupLitresThisHour * WATER_CP_KWH_PER_KG_C * Math.max(0, params.targetTempC - safeMainsTempC);

      const sensibleU = (params.convectiveUWm2K || 0) + (params.radiativeUWm2K || 0);
      const sensibleKWh = (sensibleU * areaM2 * Math.max(0, params.targetTempC - airTempC)) / 1000.0;

      const totalKWh = evaporationKWh + makeupKWh + sensibleKWh;
      processByHour[key][i] = totalKWh;
      processAnnuals[key] += totalKWh;
      processBreakdownAnnuals[key].evaporation += evaporationKWh;
      processBreakdownAnnuals[key].makeup += makeupKWh;
      processBreakdownAnnuals[key].sensible += sensibleKWh;
      totalThisHour += totalKWh;
    }

    thermalHourly[i] = totalThisHour;
  }

  const ambientAnnualAvg = getAnnualAmbientAverage(met);
  return { thermalHourly, processByHour, processAnnuals, processAreas, processVolumesLitres, processBreakdownAnnuals, ambientAnnualAvg, totalAreaM2 };
}

function buildAquaticElectricalHourlyDemand(totalAnnualKWh, thermalHourly, met){
  const len = Math.max(0, met?.length || thermalHourly?.length || 0);
  const hourly = new Array(len).fill(0);
  if (!len || !isFiniteNumber(totalAnnualKWh) || totalAnnualKWh <= 0) return hourly;

  const thermalMonthly = aggregateMonthly(thermalHourly || [], met || []);
  const thermalTotal = thermalMonthly.reduce((sum, value) => sum + (value || 0), 0);
  const monthHours = new Array(12).fill(0);
  for (let i = 0; i < len; i++){
    const monthIdx = monthFromDayN(met?.[i]?.dayN || 1) - 1;
    if (monthIdx >= 0 && monthIdx < 12) monthHours[monthIdx] += 1;
  }

  const totalHours = Math.max(1, monthHours.reduce((sum, value) => sum + value, 0));
  const baseAnnual = totalAnnualKWh * AQUATIC_ELEC_BASE_SHARE;
  const weatherAnnual = totalAnnualKWh - baseAnnual;
  const monthlyTargets = new Array(12).fill(0);

  for (let m = 0; m < 12; m++){
    const hourShare = monthHours[m] > 0 ? monthHours[m] / totalHours : 0;
    const thermalShare = thermalTotal > 0 ? (thermalMonthly[m] || 0) / thermalTotal : hourShare;
    monthlyTargets[m] = (baseAnnual * hourShare) + (weatherAnnual * thermalShare);
  }

  for (let i = 0; i < len; i++){
    const monthIdx = monthFromDayN(met?.[i]?.dayN || 1) - 1;
    const hoursInMonth = monthHours[monthIdx] || 1;
    hourly[i] = (monthlyTargets[monthIdx] || 0) / hoursInMonth;
  }
  return hourly;
}

function buildAquaticDailyShapeChart(processByHour, met, activeKeys, profileLabel){
  const hourBuckets = {};
  const hourCounts = new Array(24).fill(0);
  for (const key of activeKeys) hourBuckets[key] = new Array(24).fill(0);

  let prevDayN = -1, hourCounter = -1;
  for (let i = 0; i < met.length; i++){
    const dn = met[i].dayN;
    if (dn !== prevDayN){ hourCounter = 0; prevDayN = dn; } else { hourCounter++; }
    const h = Math.min(23, Math.max(0, hourCounter));
    hourCounts[h]++;
    for (const key of activeKeys){
      const arr = processByHour[key];
      if (arr && i < arr.length) hourBuckets[key][h] += arr[i];
    }
  }
  for (const key of activeKeys){
    for (let h = 0; h < 24; h++){
      if (hourCounts[h] > 0) hourBuckets[key][h] /= hourCounts[h];
    }
  }

  const running = new Array(24).fill(0);
  const stacked = [];
  for (const key of activeKeys){
    const bottom = running.slice();
    const top = running.map((v,h) => v + (hourBuckets[key]?.[h] || 0));
    stacked.push({key, bottom, top});
    for (let h = 0; h < 24; h++) running[h] = top[h];
  }
  let maxV = Math.max(...running);
  if (maxV <= 0) maxV = 1;
  maxV *= 1.12;

  const width=860, height=380;
  const mg={top:36,right:142,bottom:52,left:68};
  const cw=width-mg.left-mg.right, ch=height-mg.top-mg.bottom;
  const xp=h=>mg.left+(h/23)*cw;
  const yp=v=>mg.top+((maxV-v)/maxV)*ch;
  const baseline=yp(0);

  let svg=[];
  for(let i=0;i<=5;i++){
    const v=(i/5)*maxV, py=yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8eef2"/>`);
    svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#51606b">${v<10?v.toFixed(2):v.toFixed(0)}</text>`);
  }

  for(const layer of stacked){
    const color=AQUATIC_PROCESS_COLORS[layer.key]||"#999";
    let d=`M ${xp(0).toFixed(1)} ${yp(layer.bottom[0]).toFixed(1)}`;
    for(let h=0;h<24;h++) d+=` L ${xp(h).toFixed(1)} ${yp(layer.top[h]).toFixed(1)}`;
    for(let h=23;h>=0;h--) d+=` L ${xp(h).toFixed(1)} ${yp(layer.bottom[h]).toFixed(1)}`;
    d+=" Z";
    svg.push(`<path d="${d}" fill="${color}" fill-opacity="0.76" stroke="${color}" stroke-width="0.6"/>`);
  }
  let topLine="";
  for(let h=0;h<24;h++){ topLine += (h===0?`M`:`L`) + ` ${xp(h).toFixed(1)} ${yp(running[h]).toFixed(1)}`; }
  svg.push(`<path d="${topLine}" fill="none" stroke="#083d5b" stroke-width="1.8"/>`);

  for(let h=0;h<24;h+=3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#7a8a96"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#314451">${String(h).padStart(2,'0')}:00</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#7a8a96"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#7a8a96"/>`);

  let ly=mg.top+10;
  for(const key of activeKeys){
    const lx=width-mg.right+14;
    svg.push(`<rect x="${lx}" y="${ly-6}" width="14" height="14" rx="2" fill="${AQUATIC_PROCESS_COLORS[key]||'#999'}" fill-opacity="0.85"/>`);
    svg.push(`<text x="${lx+20}" y="${ly+5}" font-size="12" fill="#29404e">${AQUATIC_PROCESS_SHORT_LABELS[key]||key}</text>`);
    ly+=22;
  }
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#314451">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#314451" transform="rotate(-90 16 ${height/2})">Demand (kWh/h)</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#083d5b">Hourly Thermal Demand \u2013 Aquatic Centre</text>`);

  return `<div class="note" style="margin:0 0 6px;">Profile: "${profileLabel}". Values are annual average hourly loads shaped by the selected aquatic processes.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

function openAquaticDailyShape(ev){
  if (ev) ev.preventDefault();
  if (!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry !== "aquatic_centres") return;
  const pd = CURRENT_PROCESS_DETAIL;
  const activeKeys = AQUATIC_PROCESS_STACK_ORDER.filter(k => Object.keys(pd.processByHour).includes(k));
  const profileLabel = pd.profileType === "mon_fri"
    ? "Weekday-focused operation"
    : "Standard operating hours (6 AM - 10 PM)";
  document.getElementById("mainsChartTitle").textContent = "Daily thermal demand shape by process";
  document.getElementById("mainsChartBody").innerHTML = buildAquaticDailyShapeChart(pd.processByHour, pd.met, activeKeys, profileLabel);
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function calcDairyHourlyDemand(throughput_L, profileType, selectedKeys, met, mains){
  // Dairy operations are biologically continuous, so Mon-Fri is ignored if ever passed in.
  const normW = {};
  for (const key of selectedKeys){
    const p = DAIRY_PROCESS_PARAMS[key];
    if (p) normW[key] = _normW(p.weights24);
  }
  const elecW = _normW(DAIRY_ELEC_PARAMS.weights24);
  const seasonal = normalizeSeasonalFactors(DAIRY_SEASONAL);
  const annualElec = DAIRY_ELEC_PARAMS.kWhPerKL * (throughput_L / 1000);

  const thermalHourly  = [];
  const electricHourly = [];
  const processByHour  = {};
  for (const k of selectedKeys) processByHour[k] = [];

  for (const r of met){
    const mIdx = monthFromDayN(r.dayN) - 1;
    const h    = r.hourN;
    const seas = seasonal[mIdx] ?? 1;
    const Tm   = (mains?.byDay?.[r.dayN]) ?? (mains?.annualAvgC ?? 15);
    const dayOn = 1;

    electricHourly.push((annualElec / 365) * seas * (elecW[h] || 0) * dayOn);

    let totTh = 0;
    for (const key of selectedKeys){
      const p = DAIRY_PROCESS_PARAMS[key];
      if (!p || !normW[key]){ processByHour[key].push(0); continue; }
      const vol_h = (throughput_L * p.kWater / 365) * seas * (normW[key][h] || 0) * dayOn;
      const dT    = Math.max(0, p.T_target - Tm);
      const Q_h   = (vol_h * 4.184 * dT) / 3600;
      processByHour[key].push(Q_h);
      totTh += Q_h;
    }
    thermalHourly.push(totTh);
  }
  return { thermalHourly, electricHourly, processByHour };
}

function calcBreweryHourlyDemand(throughput_L, profileType, selectedKeys, met, mains){
  // Brewery baseline currently assumes year-round operation; weekday shutdown scaling is not yet applied.
  const normW = {};
  for (const key of selectedKeys){
    const p = BREWERY_PROCESS_PARAMS[key];
    if (p) normW[key] = _normW(p.weights24);
  }
  const elecW = _normW(BREWERY_ELEC_PARAMS.weights24);
  const seasonal = normalizeSeasonalFactors(BREWERY_SEASONAL);
  const annualElec = BREWERY_ELEC_PARAMS.kWhPerL * throughput_L;

  const thermalHourly  = [];
  const electricHourly = [];
  const processByHour  = {};
  for (const k of selectedKeys) processByHour[k] = [];

  for (const r of met){
    const mIdx = monthFromDayN(r.dayN) - 1;
    const h    = r.hourN;
    const seas = seasonal[mIdx] ?? 1;
    const Tm   = (mains?.byDay?.[r.dayN]) ?? (mains?.annualAvgC ?? 15);
    const dayOn = 1;

    electricHourly.push((annualElec / 365) * seas * (elecW[h] || 0) * dayOn);

    let totTh = 0;
    for (const key of selectedKeys){
      const p = BREWERY_PROCESS_PARAMS[key];
      if (!p || !normW[key]){ processByHour[key].push(0); continue; }
      const vol_h = (throughput_L * p.kWater / 365) * seas * (normW[key][h] || 0) * dayOn;
      const dT    = Math.max(0, p.T_target - Tm);
      const Q_h   = (vol_h * 4.184 * dT) / 3600;
      processByHour[key].push(Q_h);
      totTh += Q_h;
    }
    thermalHourly.push(totTh);
  }
  return { thermalHourly, electricHourly, processByHour };
}

function buildDairyDailyShapeChart(processByHour, met, activeKeys, profileLabel){
  if (!activeKeys.length){
    return `<div class="note">No dairy thermal processes selected.</div>`;
  }

  const hourBuckets = {};
  const hourCounts = new Array(24).fill(0);
  for (const key of activeKeys) hourBuckets[key] = new Array(24).fill(0);

  let prevDayN = -1;
  let hourCounter = -1;
  for (let i = 0; i < met.length; i++){
    const dn = met[i].dayN;
    if (dn !== prevDayN){ hourCounter = 0; prevDayN = dn; }
    else { hourCounter++; }
    const h = Math.min(23, Math.max(0, hourCounter));
    hourCounts[h]++;
    for (const key of activeKeys){
      const arr = processByHour[key];
      if (arr && i < arr.length) hourBuckets[key][h] += arr[i];
    }
  }

  for (const key of activeKeys){
    for (let h = 0; h < 24; h++){
      if (hourCounts[h] > 0) hourBuckets[key][h] /= hourCounts[h];
    }
  }

  const running = new Array(24).fill(0);
  const stacked = [];
  for (const key of activeKeys){
    const bottom = running.slice();
    const top = running.map((v,h) => v + (hourBuckets[key]?.[h] || 0));
    stacked.push({ key, bottom, top });
    for (let h = 0; h < 24; h++) running[h] = top[h];
  }

  let maxV = Math.max(...running);
  if (maxV <= 0) maxV = 1;
  maxV *= 1.12;

  const width = 860;
  const height = 380;
  const mg = { top:36, right:150, bottom:52, left:68 };
  const cw = width - mg.left - mg.right;
  const ch = height - mg.top - mg.bottom;
  const xp = h => mg.left + (h / 23) * cw;
  const yp = v => mg.top + ((maxV - v) / maxV) * ch;
  const baseline = yp(0);

  let svg = [];
  for (let i = 0; i <= 5; i++){
    const v = (i / 5) * maxV;
    const py = yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v < 10 ? v.toFixed(2) : v.toFixed(0)}</text>`);
  }

  for (const layer of stacked){
    const color = DAIRY_PROCESS_COLORS[layer.key] || "#999";
    let d = `M ${xp(0).toFixed(1)} ${yp(layer.bottom[0]).toFixed(1)}`;
    for (let h = 0; h < 24; h++) d += ` L ${xp(h).toFixed(1)} ${yp(layer.top[h]).toFixed(1)}`;
    for (let h = 23; h >= 0; h--) d += ` L ${xp(h).toFixed(1)} ${yp(layer.bottom[h]).toFixed(1)}`;
    d += " Z";
    svg.push(`<path d="${d}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="0.5"/>`);
  }

  let topLine = "";
  for (let h = 0; h < 24; h++){
    topLine += (h === 0 ? "M" : "L") + ` ${xp(h).toFixed(1)} ${yp(running[h]).toFixed(1)}`;
  }
  svg.push(`<path d="${topLine}" fill="none" stroke="#333" stroke-width="1.5"/>`);

  if (running[7] > 0){
    svg.push(`<text x="${xp(7).toFixed(1)}" y="${(yp(running[7])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Morning clean</text>`);
  }
  if (running[18] > 0){
    svg.push(`<text x="${xp(18).toFixed(1)}" y="${(yp(running[18])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Evening clean</text>`);
  }

  for (let h = 0; h < 24; h += 3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,"0")}:00</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  let ly = mg.top + 10;
  for (const key of activeKeys){
    const lx = width - mg.right + 14;
    svg.push(`<rect x="${lx}" y="${ly-6}" width="14" height="14" rx="2" fill="${DAIRY_PROCESS_COLORS[key] || "#999"}" fill-opacity="0.8"/>`);
    svg.push(`<text x="${lx+20}" y="${ly+5}" font-size="12" fill="#333">${DAIRY_PROCESS_SHORT_LABELS[key] || key}</text>`);
    ly += 22;
  }

  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Demand (kWh/h)</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#222">Hourly Thermal Demand - Dairy Farm</text>`);

  return `<div class="note" style="margin:0 0 6px;">Profile: "${profileLabel}". Values are annual averages per hour-of-day.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

function buildBreweryDailyShapeChart(processByHour, met, activeKeys, profileLabel){
  if (!activeKeys.length){
    return `<div class="note">No brewery thermal processes selected.</div>`;
  }

  const hourBuckets = {};
  const hourCounts = new Array(24).fill(0);
  for (const key of activeKeys) hourBuckets[key] = new Array(24).fill(0);

  let prevDayN = -1;
  let hourCounter = -1;
  for (let i = 0; i < met.length; i++){
    const dn = met[i].dayN;
    if (dn !== prevDayN){ hourCounter = 0; prevDayN = dn; }
    else { hourCounter++; }
    const h = Math.min(23, Math.max(0, hourCounter));
    hourCounts[h]++;
    for (const key of activeKeys){
      const arr = processByHour[key];
      if (arr && i < arr.length) hourBuckets[key][h] += arr[i];
    }
  }

  for (const key of activeKeys){
    for (let h = 0; h < 24; h++){
      if (hourCounts[h] > 0) hourBuckets[key][h] /= hourCounts[h];
    }
  }

  const running = new Array(24).fill(0);
  const stacked = [];
  for (const key of activeKeys){
    const bottom = running.slice();
    const top = running.map((v,h) => v + (hourBuckets[key]?.[h] || 0));
    stacked.push({ key, bottom, top });
    for (let h = 0; h < 24; h++) running[h] = top[h];
  }

  let maxV = Math.max(...running);
  if (maxV <= 0) maxV = 1;
  maxV *= 1.12;

  const width = 860;
  const height = 380;
  const mg = { top:36, right:150, bottom:52, left:68 };
  const cw = width - mg.left - mg.right;
  const ch = height - mg.top - mg.bottom;
  const xp = h => mg.left + (h / 23) * cw;
  const yp = v => mg.top + ((maxV - v) / maxV) * ch;
  const baseline = yp(0);

  let svg = [];
  for (let i = 0; i <= 5; i++){
    const v = (i / 5) * maxV;
    const py = yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v < 10 ? v.toFixed(2) : v.toFixed(0)}</text>`);
  }

  for (const layer of stacked){
    const color = BREWERY_PROCESS_COLORS[layer.key] || "#999";
    let d = `M ${xp(0).toFixed(1)} ${yp(layer.bottom[0]).toFixed(1)}`;
    for (let h = 0; h < 24; h++) d += ` L ${xp(h).toFixed(1)} ${yp(layer.top[h]).toFixed(1)}`;
    for (let h = 23; h >= 0; h--) d += ` L ${xp(h).toFixed(1)} ${yp(layer.bottom[h]).toFixed(1)}`;
    d += " Z";
    svg.push(`<path d="${d}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="0.5"/>`);
  }

  let topLine = "";
  for (let h = 0; h < 24; h++){
    topLine += (h === 0 ? "M" : "L") + ` ${xp(h).toFixed(1)} ${yp(running[h]).toFixed(1)}`;
  }
  svg.push(`<path d="${topLine}" fill="none" stroke="#333" stroke-width="1.5"/>`);

  if (running[10] > 0){
    svg.push(`<text x="${xp(10).toFixed(1)}" y="${(yp(running[10])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Brew day peak</text>`);
  }
  if (running[15] > 0){
    svg.push(`<text x="${xp(15).toFixed(1)}" y="${(yp(running[15])-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#333">Packaging / CIP</text>`);
  }

  for (let h = 0; h < 24; h += 3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,"0")}:00</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  let ly = mg.top + 10;
  for (const key of activeKeys){
    const lx = width - mg.right + 14;
    svg.push(`<rect x="${lx}" y="${ly-6}" width="14" height="14" rx="2" fill="${BREWERY_PROCESS_COLORS[key] || "#999"}" fill-opacity="0.8"/>`);
    svg.push(`<text x="${lx+20}" y="${ly+5}" font-size="12" fill="#333">${BREWERY_PROCESS_SHORT_LABELS[key] || key}</text>`);
    ly += 22;
  }

  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Demand (kWh/h)</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#222">Hourly Thermal Demand - Brewery</text>`);

  return `<div class="note" style="margin:0 0 6px;">Profile: "${profileLabel}". Values are annual averages per hour-of-day.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

function buildDairyProfileCompareChart(activeKeys){
  if (!activeKeys.length){
    return `<div class="note">No dairy thermal processes selected.</div>`;
  }

  function buildRawShape(profileType){
    const shape = new Array(24).fill(0);
    for (const key of activeKeys){
      const weights = _normW(DAIRY_PROCESS_PARAMS[key]?.weights24 || []);
      for (let h = 0; h < 24; h++) shape[h] += weights[h] || 0;
    }
    if (profileType === "mon_fri"){
      for (let h = 0; h < 24; h++) shape[h] *= (5 / 7);
    }
    return shape;
  }

  const raw247 = buildRawShape("continuous");
  const rawMF = buildRawShape("mon_fri");
  const scaleMax = Math.max(...raw247, ...rawMF, 0.01);
  const shape247 = raw247.map(v => v / scaleMax);
  const shapeMF = rawMF.map(v => v / scaleMax);

  const width = 860;
  const height = 380;
  const mg = { top:36, right:160, bottom:52, left:68 };
  const cw = width - mg.left - mg.right;
  const ch = height - mg.top - mg.bottom;
  const xp = h => mg.left + (h / 23) * cw;
  const yp = v => mg.top + ((1.1 - v) / 1.1) * ch;
  const baseline = yp(0);

  let svg = [];
  for (let i = 0; i <= 5; i++){
    const v = i / 5 * 1.1;
    const py = yp(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-10}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v.toFixed(1)}</text>`);
  }

  let areaPath = `M ${xp(0).toFixed(1)} ${baseline.toFixed(1)}`;
  for (let h = 0; h < 24; h++) areaPath += ` L ${xp(h).toFixed(1)} ${yp(shape247[h]).toFixed(1)}`;
  areaPath += ` L ${xp(23).toFixed(1)} ${baseline.toFixed(1)} Z`;
  svg.push(`<path d="${areaPath}" fill="#4a86c8" fill-opacity="0.25"/>`);

  let line247 = "";
  for (let h = 0; h < 24; h++) line247 += (h === 0 ? "M" : " L") + ` ${xp(h).toFixed(1)} ${yp(shape247[h]).toFixed(1)}`;
  svg.push(`<path d="${line247}" fill="none" stroke="#1565c0" stroke-width="2.5"/>`);

  let lineMF = "";
  for (let h = 0; h < 24; h++) lineMF += (h === 0 ? "M" : " L") + ` ${xp(h).toFixed(1)} ${yp(shapeMF[h]).toFixed(1)}`;
  svg.push(`<path d="${lineMF}" fill="none" stroke="#e8923f" stroke-width="2.5" stroke-dasharray="8,4"/>`);

  for (let h = 0; h < 24; h += 3){
    svg.push(`<line x1="${xp(h).toFixed(1)}" y1="${baseline}" x2="${xp(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${xp(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,"0")}</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  const lx = width - mg.right + 14;
  svg.push(`<line x1="${lx}" y1="${mg.top+12}" x2="${lx+22}" y2="${mg.top+12}" stroke="#1565c0" stroke-width="2.5"/>`);
  svg.push(`<text x="${lx+28}" y="${mg.top+16}" font-size="12" font-weight="600" fill="#1565c0">24/7 Continuous</text>`);
  svg.push(`<line x1="${lx}" y1="${mg.top+36}" x2="${lx+22}" y2="${mg.top+36}" stroke="#e8923f" stroke-width="2.5" stroke-dasharray="6,3"/>`);
  svg.push(`<text x="${lx+28}" y="${mg.top+40}" font-size="12" font-weight="600" fill="#e8923f">Mon-Fri</text>`);

  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Normalised Demand</text>`);
  svg.push(`<text x="${(mg.left+width-mg.right)/2}" y="18" text-anchor="middle" font-size="14" font-weight="600" fill="#222">24/7 vs Mon-Fri Thermal Load Profile</text>`);

  return `<div class="note" style="margin:0 0 6px;">Normalised demand shapes. For dairy, Mon-Fri mainly removes weekend demand rather than changing the weekday cleaning peaks.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>`;
}

function formatHourWindow(hourIdx){
  const start = String(hourIdx).padStart(2,"0");
  const end = String((hourIdx + 1) % 24).padStart(2,"0");
  return `${start}:00-${end}:00`;
}

function buildWeightSummary(weights24){
  const norm = _normW(weights24);
  const parts = [];
  for (let h = 0; h < weights24.length; h++){
    if ((weights24[h] || 0) > 0){
      parts.push(`${formatHourWindow(h)} (${(norm[h] * 100).toFixed(1)}%)`);
    }
  }
  return parts.length ? parts.join(", ") : "No active hours";
}

function buildDairyModelBasisHtml(){
  const electricalNorm = _normW(DAIRY_ELEC_PARAMS.weights24);
  // Public source links restored. The internal justification PDF is not publicly
  // hosted, so links pointing at it stay disabled until it has a public home.
  const dairyPdfHref = "#"; // internal: "Dairy Farm Techno-Economic Model Justification" (unpublished)
  const raceHref = "https://www.racefor2030.com.au/content/uploads/B3-OA-Project-Final-Report-July-2021-20210721a-compressed.pdf";
  const ecoHref = "https://www.ecoefficiencygroup.com.au/wp-content/uploads/2020/10/Ecoefficiency-for-the-Dairy-Processing-Industry.pdf";
  const benchmarkHref = "https://northernaustraliandairyhub.com.au/wp-content/uploads/2020/10/Dairy-Shed-Energy-Use-Check.pdf";
  const ausAuditHref = "https://extensionaus.com.au/energysmartfarming/saving-energy-on-dairy-farms/";
  const src = (label, href) => (href && href !== "#")
    ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>`
    : `<a href="#" onclick="return false;" aria-disabled="true" title="Internal report — not published yet">${label}</a>`;

  return `
    <div class="panel" style="background:#fff;margin-bottom:10px;">
      <p style="margin:0 0 8px 0;"><b>Quick summary</b></p>
      <p style="margin:0 0 6px 0;">Total heated water is 1.37 L per L of milk: 0.30 rinse + 0.57 CIP pre-heat + 0.50 boiler feedwater. ${src("Source", dairyPdfHref)} ${src("Eco-efficiency", ecoHref)}</p>
      <p style="margin:0 0 6px 0;">PVT only targets low-temperature pre-heating at 35 C. ${src("Source", dairyPdfHref)} ${src("RACE", raceHref)}</p>
      <p style="margin:0;">Electrical demand uses 51.7 kWh/kL with strong morning and afternoon peaks. ${src("Source", dairyPdfHref)} ${src("Benchmark", benchmarkHref)}</p>
    </div>
    <h4 style="margin:0 0 8px 0;">How it works</h4>
    <div class="panel" style="background:#fff;margin-bottom:10px;">
      <p style="margin:0 0 6px 0;">1. Start with annual milk throughput.</p>
      <p style="margin:0 0 6px 0;">2. Apply the seasonal factor and hourly weighting for each process.</p>
      <p style="margin:0 0 6px 0;">3. Heat that water from mains temperature up to 35 C to get hourly thermal demand.</p>
      <p style="margin:0 0 6px 0;"><code>V_h = (Throughput_L x kWater / 365) x seasonalFactor x normalisedHourlyWeight[h]</code></p>
      <p style="margin:0 0 6px 0;"><code>Q_h = (V_h x 4.184 x max(0, 35 - T_mains)) / 3600</code> <span style="color:#777;">Q = m c_p ΔT</span></p>
      <p style="margin:0;"><code>Electrical_h = (51.7 x Throughput_kL / 365) x seasonalFactor x normalisedElectricalWeight[h]</code></p>
    </div>
    <h4 style="margin:0 0 8px 0;">Normalised weighting</h4>
    <div class="note" style="margin:0 0 8px 0;">
      <a href="#" onclick="toggleDairyWeightingGraph(event)">View normalised weighting graph</a>
    </div>
    <div id="dairyWeightingGraphWrap" style="display:none;margin:0 0 10px 0;"></div>
    <table class="method-table">
      <tr><th>Item</th><th>Weighting used</th><th>Source</th></tr>
      <tr><td>Fatty film rinse</td><td>50% at 07:00 and 50% at 17:00</td><td>${src("Source", dairyPdfHref)}</td></tr>
      <tr><td>CIP pre-heating</td><td>25% at 08:00, 09:00, 17:00, and 18:00</td><td>${src("Source", dairyPdfHref)}</td></tr>
      <tr><td>Boiler feedwater</td><td>Evenly spread across all 24 hours</td><td>${src("Source", dairyPdfHref)} ${src("RACE", raceHref)}</td></tr>
      <tr><td>Electrical profile</td><td>Peaks at 05:00-07:00 and 15:00-17:00</td><td>${src("Source", dairyPdfHref)} ${src("Benchmark", benchmarkHref)}</td></tr>
    </table>
    <h4 style="margin:12px 0 8px 0;">Key values</h4>
    <table class="method-table">
      <tr><th>Item</th><th>Value used</th><th>Source</th></tr>
      <tr><td>Seasonal factors</td><td>[${DAIRY_SEASONAL.join(", ")}] (normalised so the annual total matches the benchmarks)</td><td>${src("Source", dairyPdfHref)}</td></tr>
      <tr><td>Fatty film rinse</td><td>0.30 L/L milk, 35 C</td><td>${src("Source", dairyPdfHref)}</td></tr>
      <tr><td>CIP pre-heating</td><td>0.57 L/L milk, 35 C</td><td>${src("Source", dairyPdfHref)}</td></tr>
      <tr><td>Boiler feedwater pre-heat</td><td>0.50 L/L milk, 35 C</td><td>${src("Source", dairyPdfHref)} ${src("RACE", raceHref)}</td></tr>
      <tr><td>Electrical benchmark</td><td>51.7 kWh/kL</td><td>${src("Source", dairyPdfHref)} ${src("Benchmark", benchmarkHref)}</td></tr>
    </table>
    <p class="note" style="margin:10px 0 0;">Cross-check: Australian dairy energy audits average &asymp;48 kWh/kL (range 27&ndash;75 kWh/kL), so the 51.7 kWh/kL benchmark sits close to the national average. ${src("Energy Smart Farming (Australia)", ausAuditHref)}</p>`;
}

function buildBreweryModelBasisHtml(){
  const seasonalHref1 = "https://rpubs.com/Holikma/Beer_Analysis";
  const seasonalHref2 = "https://www.kaggle.com/code/ashmib/time-series-forecast-australian-beer-production";
  const cipHref = "https://www.idpublications.org/wp-content/uploads/2017/10/Full-Paper-OPTIMIZATION-OF-CLEANING-PROCESS-IN-BREWERIES-AN-IMPORTANT-TOOL.pdf";
  const rinseHref1 = "https://www.asianbeernetwork.com/pasteurization-equipment-for-small-breweries/";
  const rinseHref2 = "https://skoge.folk.ntnu.no/prost/proceedings/icheap8-pres07/pres07webpapers/93%20Tokos.pdf";
  const boilerHref1 = "https://www.osti.gov/servlets/purl/881595";
  const boilerHref2 = "https://www.mdpi.com/1996-1073/17/10/2300";
  const elecHref1 = "https://satec-global.com.au/smart-metering-for-breweries-distilleries-reduce-energy-costs-and-improve-uptime/";
  const elecHref2 = "https://www.researchgate.net/publication/228472802_Efficient_Use_of_Energy_in_the_Brewhouse";
  const schedHref1 = "https://www.asianbeernetwork.com/brewery-schedule-planning-brewing-like-a-pro/";
  const schedHref2 = "https://rockstarbrewer.com/the-5-critical-things-you-need-to-consider-when-building-a-brewery/";
  const pvtHref1 = "https://www.researchgate.net/publication/273489554_Manufacture_of_Malt_and_Beer_with_Low_Temperature_Solar_Process_Heat";
  const pvtHref2 = "https://www.racefor2030.com.au/content/uploads/B3-OA-Project-Final-Report-July-2021-20210721a-compressed.pdf";
  const src = (label, href) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;

  return `
    <div class="panel" style="background:#fff;margin-bottom:10px;">
      <p style="margin:0 0 8px 0;"><b>Quick summary</b></p>
      <p style="margin:0 0 6px 0;">Total modelled warm-water demand is 1.85 L per L of beer: 0.80 CIP pre-rinse + 0.45 bottle/keg rinsing + 0.60 boiler makeup pre-heat. ${src("CIP source", cipHref)} ${src("Bottle/keg source", rinseHref2)} ${src("Boiler source", boilerHref1)}</p>
      <p style="margin:0 0 6px 0;">All three processes are capped at 40-45 C, so the brewery model is explicitly limited to direct PVT-eligible pre-heating rather than full steam duty. ${src("Solar brewery heat", pvtHref1)} ${src("RACE", pvtHref2)}</p>
      <p style="margin:0;">Electrical demand uses an 11.50 kWh/hL benchmark with a 24/7 refrigeration baseload and daytime brewing/packaging peaks. ${src("Benchmark", elecHref1)} ${src("Brewhouse energy", elecHref2)}</p>
    </div>
    <h4 style="margin:0 0 8px 0;">How it works</h4>
    <div class="panel" style="background:#fff;margin-bottom:10px;">
      <p style="margin:0 0 6px 0;">1. Start with annual beer throughput in litres.</p>
      <p style="margin:0 0 6px 0;">2. Apply the brewery seasonal production factor and each process's own hourly schedule.</p>
      <p style="margin:0 0 6px 0;">3. Heat that process water from local mains temperature up to the brewery process target temperature.</p>
      <p style="margin:0 0 6px 0;"><code>V_h = (Throughput_L x kWater / 365) x brewerySeasonalFactor x normalisedHourlyWeight[h]</code></p>
      <p style="margin:0 0 6px 0;"><code>Q_h = (V_h x 4.184 x max(0, T_target - T_mains)) / 3600</code></p>
      <p style="margin:0;"><code>Electrical_h = (0.115 x Throughput_L / 365) x brewerySeasonalFactor x normalisedElectricalWeight[h]</code></p>
    </div>
    <h4 style="margin:0 0 8px 0;">Why these three processes</h4>
    <div class="panel" style="background:#fff;margin-bottom:10px;">
      <p style="margin:0 0 6px 0;"><b>CIP pre-rinse:</b> warm water helps strip yeast, proteins, and hop residues without jumping to caustic/steam conditions. ${src("CIP source", cipHref)}</p>
      <p style="margin:0 0 6px 0;"><b>Bottle/keg rinsing:</b> moderate-temperature rinse water helps avoid thermal shock and supports packaging-line cleanliness before filling. ${src("Packaging source", rinseHref1)} ${src("Water minimisation", rinseHref2)}</p>
      <p style="margin:0;"><b>Boiler feedwater pre-heat:</b> PVT only handles the low-temperature lift to 45 C, so the boiler still provides the final steam lift. ${src("Boiler source", boilerHref1)} ${src("Energies review", boilerHref2)}</p>
    </div>
    <h4 style="margin:0 0 8px 0;">Normalised weighting</h4>
    <div class="note" style="margin:0 0 8px 0;">
      <a href="#" onclick="toggleBreweryWeightingGraph(event)">View brewery weighting graph</a>
    </div>
    <div id="breweryWeightingGraphWrap" style="display:none;margin:0 0 10px 0;"></div>
    <table class="method-table">
      <tr><th>Item</th><th>Weighting used</th><th>Reasoning / source</th></tr>
      <tr><td>CIP pre-rinse</td><td>${buildWeightSummary(BREWERY_PROCESS_PARAMS.cip_prerinse.weights24)}</td><td>Single extended shift with strongest afternoon cleanup activity. ${src("Schedule", schedHref1)} ${src("Brewery planning", schedHref2)} ${src("CIP source", cipHref)}</td></tr>
      <tr><td>Bottle/keg rinsing</td><td>${buildWeightSummary(BREWERY_PROCESS_PARAMS.bottle_keg_rinse.weights24)}</td><td>Packaging line centred on the working day with a mid-shift plateau. ${src("Packaging source", rinseHref1)} ${src("Brewery planning", schedHref2)}</td></tr>
      <tr><td>Boiler feedwater pre-heat</td><td>${buildWeightSummary(BREWERY_PROCESS_PARAMS.boiler_preheat.weights24)}</td><td>Boiler makeup follows wort boiling and later wash/CIP activity. ${src("Boiler source", boilerHref1)} ${src("Schedule", schedHref1)}</td></tr>
      <tr><td>Electrical profile</td><td>${buildWeightSummary(BREWERY_ELEC_PARAMS.weights24)}</td><td>Refrigeration baseload overnight, then brewhouse and packaging demand through the day. ${src("Benchmark", elecHref1)} ${src("Brewhouse energy", elecHref2)}</td></tr>
    </table>
    <h4 style="margin:12px 0 8px 0;">Key values</h4>
    <table class="method-table">
      <tr><th>Item</th><th>Value used</th><th>Source</th></tr>
      <tr><td>Seasonal factors</td><td>[${BREWERY_SEASONAL.join(", ")}] (normalised so the annual total matches the benchmarks)</td><td>${src("RPubs", seasonalHref1)} ${src("Kaggle", seasonalHref2)}</td></tr>
      <tr><td>CIP pre-rinse</td><td>0.80 L/L beer, 45 C</td><td>${src("CIP source", cipHref)}</td></tr>
      <tr><td>Bottle/keg rinsing</td><td>0.45 L/L beer, 40 C</td><td>${src("Packaging source", rinseHref1)} ${src("Water minimisation", rinseHref2)}</td></tr>
      <tr><td>Boiler feedwater pre-heat</td><td>0.60 L/L beer, 45 C</td><td>${src("Boiler source", boilerHref1)} ${src("Energies review", boilerHref2)}</td></tr>
      <tr><td>Electrical benchmark</td><td>11.50 kWh/hL = 0.115 kWh/L</td><td>${src("Benchmark", elecHref1)} ${src("Brewhouse energy", elecHref2)}</td></tr>
    </table>`;
}

function buildDairyWeightingGraphHtml(){
  const series = [
    { label:"Fatty film rinse", color:"#1976d2", values:_normW(DAIRY_PROCESS_PARAMS.fatty_film_rinse.weights24).map(v => v * 100) },
    { label:"CIP pre-heating", color:"#43a047", values:_normW(DAIRY_PROCESS_PARAMS.cip_preheating.weights24).map(v => v * 100) },
    { label:"Boiler feedwater", color:"#e65100", values:_normW(DAIRY_PROCESS_PARAMS.boiler_preheat.weights24).map(v => v * 100) },
    { label:"Electrical profile", color:"#7b1fa2", values:_normW(DAIRY_ELEC_PARAMS.weights24).map(v => v * 100) }
  ];

  const width = 860;
  const height = 360;
  const mg = { top:28, right:180, bottom:52, left:60 };
  const cw = width - mg.left - mg.right;
  const ch = height - mg.top - mg.bottom;
  const maxV = 55;
  const x = h => mg.left + (h / 23) * cw;
  const y = v => mg.top + ((maxV - v) / maxV) * ch;
  const baseline = y(0);

  let svg = [];
  for (let i = 0; i <= 5; i++){
    const v = (i / 5) * maxV;
    const py = y(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-8}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v.toFixed(0)}%</text>`);
  }

  for (const item of series){
    let path = "";
    for (let h = 0; h < 24; h++){
      path += (h === 0 ? "M" : " L") + ` ${x(h).toFixed(1)} ${y(item.values[h]).toFixed(1)}`;
    }
    svg.push(`<path d="${path}" fill="none" stroke="${item.color}" stroke-width="2.5"/>`);
    for (let h = 0; h < 24; h++){
      svg.push(`<circle cx="${x(h).toFixed(1)}" cy="${y(item.values[h]).toFixed(1)}" r="2.5" fill="${item.color}"/>`);
    }
  }

  for (let h = 0; h < 24; h += 3){
    svg.push(`<line x1="${x(h).toFixed(1)}" y1="${baseline}" x2="${x(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${x(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,"0")}</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  let ly = mg.top + 8;
  for (const item of series){
    const lx = width - mg.right + 12;
    svg.push(`<line x1="${lx}" y1="${ly}" x2="${lx+20}" y2="${ly}" stroke="${item.color}" stroke-width="2.5"/>`);
    svg.push(`<text x="${lx+28}" y="${ly+4}" font-size="12" fill="#333">${item.label}</text>`);
    ly += 22;
  }

  svg.push(`<text x="${(mg.left + width - mg.right)/2}" y="16" text-anchor="middle" font-size="14" font-weight="600" fill="#222">Normalised Hourly Weighting</text>`);
  svg.push(`<text x="${(mg.left + width - mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Share of Daily Load</text>`);

  return `<div class="panel" style="background:#fff;">
    <div class="note" style="margin:0 0 6px 0;">Each line sums to 100% across the day. Boiler feedwater is flat; rinse, CIP, and electrical demand peak around milking times.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>
  </div>`;
}

function buildBreweryWeightingGraphHtml(){
  const series = [
    { label:"CIP pre-rinse", color:BREWERY_PROCESS_COLORS.cip_prerinse, values:_normW(BREWERY_PROCESS_PARAMS.cip_prerinse.weights24).map(v => v * 100) },
    { label:"Bottle/keg rinsing", color:BREWERY_PROCESS_COLORS.bottle_keg_rinse, values:_normW(BREWERY_PROCESS_PARAMS.bottle_keg_rinse.weights24).map(v => v * 100) },
    { label:"Boiler pre-heat", color:BREWERY_PROCESS_COLORS.boiler_preheat, values:_normW(BREWERY_PROCESS_PARAMS.boiler_preheat.weights24).map(v => v * 100) },
    { label:"Electrical profile", color:"#7b1fa2", values:_normW(BREWERY_ELEC_PARAMS.weights24).map(v => v * 100) }
  ];

  const width = 860;
  const height = 360;
  const mg = { top:28, right:180, bottom:52, left:60 };
  const cw = width - mg.left - mg.right;
  const ch = height - mg.top - mg.bottom;
  const maxV = 24;
  const x = h => mg.left + (h / 23) * cw;
  const y = v => mg.top + ((maxV - v) / maxV) * ch;
  const baseline = y(0);

  let svg = [];
  for (let i = 0; i <= 6; i++){
    const v = (i / 6) * maxV;
    const py = y(v);
    svg.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${width-mg.right}" y2="${py.toFixed(1)}" stroke="#e8e8e8"/>`);
    svg.push(`<text x="${mg.left-8}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#555">${v.toFixed(0)}%</text>`);
  }

  for (const item of series){
    let path = "";
    for (let h = 0; h < 24; h++){
      path += (h === 0 ? "M" : " L") + ` ${x(h).toFixed(1)} ${y(item.values[h]).toFixed(1)}`;
    }
    svg.push(`<path d="${path}" fill="none" stroke="${item.color}" stroke-width="2.5"/>`);
    for (let h = 0; h < 24; h++){
      svg.push(`<circle cx="${x(h).toFixed(1)}" cy="${y(item.values[h]).toFixed(1)}" r="2.5" fill="${item.color}"/>`);
    }
  }

  for (let h = 0; h < 24; h += 3){
    svg.push(`<line x1="${x(h).toFixed(1)}" y1="${baseline}" x2="${x(h).toFixed(1)}" y2="${baseline+5}" stroke="#888"/>`);
    svg.push(`<text x="${x(h).toFixed(1)}" y="${baseline+20}" text-anchor="middle" font-size="11" fill="#333">${String(h).padStart(2,"0")}</text>`);
  }
  svg.push(`<line x1="${mg.left}" y1="${baseline}" x2="${width-mg.right}" y2="${baseline}" stroke="#888"/>`);
  svg.push(`<line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${baseline}" stroke="#888"/>`);

  let ly = mg.top + 8;
  for (const item of series){
    const lx = width - mg.right + 12;
    svg.push(`<line x1="${lx}" y1="${ly}" x2="${lx+20}" y2="${ly}" stroke="${item.color}" stroke-width="2.5"/>`);
    svg.push(`<text x="${lx+28}" y="${ly+4}" font-size="12" fill="#333">${item.label}</text>`);
    ly += 22;
  }

  svg.push(`<text x="${(mg.left + width - mg.right)/2}" y="16" text-anchor="middle" font-size="14" font-weight="600" fill="#222">Brewery Normalised Hourly Weighting</text>`);
  svg.push(`<text x="${(mg.left + width - mg.right)/2}" y="${height-8}" text-anchor="middle" font-size="12" fill="#333">Hour of Day</text>`);
  svg.push(`<text x="16" y="${height/2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${height/2})">Share of Daily Load</text>`);

  return `<div class="panel" style="background:#fff;">
    <div class="note" style="margin:0 0 6px 0;">Each line sums to 100% across the day. The brewery profile is built around a morning brewhouse ramp, a midday packaging plateau, and an afternoon CIP / boiler shoulder rather than dairy cleaning peaks.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg.join("")}</svg>
  </div>`;
}

function toggleDairyWeightingGraph(ev){
  if (ev) ev.preventDefault();
  const wrap = document.getElementById("dairyWeightingGraphWrap");
  if (!wrap) return;
  if (wrap.style.display === "none"){
    if (!wrap.innerHTML) wrap.innerHTML = buildDairyWeightingGraphHtml();
    wrap.style.display = "block";
    return;
  }
  wrap.style.display = "none";
}

function toggleBreweryWeightingGraph(ev){
  if (ev) ev.preventDefault();
  const wrap = document.getElementById("breweryWeightingGraphWrap");
  if (!wrap) return;
  if (wrap.style.display === "none"){
    if (!wrap.innerHTML) wrap.innerHTML = buildBreweryWeightingGraphHtml();
    wrap.style.display = "block";
    return;
  }
  wrap.style.display = "none";
}

function openDairyModelBasis(ev){
  if (ev) ev.preventDefault();
  document.getElementById("mainsChartTitle").textContent = "Dairy farm demand model basis";
  document.getElementById("mainsChartBody").innerHTML = buildDairyModelBasisHtml();
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function openBreweryModelBasis(ev){
  if (ev) ev.preventDefault();
  document.getElementById("mainsChartTitle").textContent = "Brewery demand model basis";
  document.getElementById("mainsChartBody").innerHTML = buildBreweryModelBasisHtml();
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function openDairyDailyShape(ev){
  if (ev) ev.preventDefault();
  if (!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry !== "dairy_farm") return;
  const pd = CURRENT_PROCESS_DETAIL;
  const activeKeys = DAIRY_PROCESS_STACK_ORDER.filter(k => Object.keys(pd.processByHour).includes(k));
  const profileLabel = pd.profileType === "mon_fri" ? "Mon-Fri" : "24/7 Continuous";
  document.getElementById("mainsChartTitle").textContent = "Daily thermal demand shape by process";
  document.getElementById("mainsChartBody").innerHTML = buildDairyDailyShapeChart(pd.processByHour, pd.met, activeKeys, profileLabel);
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function openBreweryDailyShape(ev){
  if (ev) ev.preventDefault();
  if (!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry !== "brewery") return;
  const pd = CURRENT_PROCESS_DETAIL;
  const activeKeys = BREWERY_PROCESS_STACK_ORDER.filter(k => Object.keys(pd.processByHour).includes(k));
  const profileLabel = pd.profileType === "mon_fri" ? "Mon-Fri" : "24/7 Continuous";
  document.getElementById("mainsChartTitle").textContent = "Daily thermal demand shape by process";
  document.getElementById("mainsChartBody").innerHTML = buildBreweryDailyShapeChart(pd.processByHour, pd.met, activeKeys, profileLabel);
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function openDairyProfileCompare(ev){
  if (ev) ev.preventDefault();
  if (!CURRENT_PROCESS_DETAIL || CURRENT_PROCESS_DETAIL.industry !== "dairy_farm") return;
  const activeKeys = DAIRY_PROCESS_STACK_ORDER.filter(k => Object.keys(CURRENT_PROCESS_DETAIL.processByHour).includes(k));
  document.getElementById("mainsChartTitle").textContent = "24/7 vs Mon-Fri Thermal Load Profile";
  document.getElementById("mainsChartBody").innerHTML = buildDairyProfileCompareChart(activeKeys);
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

// ================================================================
//  DEMAND AGGREGATION
// ================================================================
function aggregateMonthly(hourlyArr, met){
  const monthly = new Array(12).fill(0);
  for (let i = 0; i < met.length; i++){
    if (!isFiniteNumber(hourlyArr[i])) continue;
    monthly[monthFromDayN(met[i].dayN) - 1] += hourlyArr[i];
  }
  return monthly;
}

function calculateMonthlyEnergyBalance(supplyHourly, demandHourly, met){
  const supplyMonthly = aggregateMonthly(supplyHourly, met);
  const demandMonthly = aggregateMonthly(demandHourly, met);
  let metBySupply = 0;
  let unmet = 0;
  let excess = 0;

  for (let m = 0; m < 12; m++){
    const supply = supplyMonthly[m] || 0;
    const demand = demandMonthly[m] || 0;
    metBySupply += Math.min(supply, demand);
    unmet += Math.max(0, demand - supply);
    excess += Math.max(0, supply - demand);
  }

  const totalDemand = demandMonthly.reduce((sum, value) => sum + (value || 0), 0);
  return {
    supplyMonthly,
    demandMonthly,
    metBySupply,
    unmet,
    excess,
    solarFraction: totalDemand > 0 ? metBySupply / totalDemand : 0
  };
}

function calculateMonthlyElectricityBalance(pvHourly, demandHourly, met){
  const balance = calculateMonthlyEnergyBalance(pvHourly, demandHourly, met);
  return {
    pvMonthly: balance.supplyMonthly,
    demandMonthly: balance.demandMonthly,
    metByPv: balance.metBySupply,
    unmet: balance.unmet,
    excess: balance.excess,
    solarFraction: balance.solarFraction
  };
}

// Hourly (direct-use) matching: supply only meets demand that occurs in the same
// hour. This is the honest no-storage baseline used for the headline results.
// Monthly matching (above) implicitly assumes a month of free heat storage, so it
// is kept only as the "with ideal storage" upper bound shown in the storage note.
function calculateHourlyEnergyBalance(supplyHourly, demandHourly, met){
  const n = Math.min(supplyHourly.length, demandHourly.length);
  let metBySupply = 0, unmet = 0, excess = 0, totalDemand = 0;
  for (let i = 0; i < n; i++){
    const s = Math.max(0, supplyHourly[i] || 0);
    const d = Math.max(0, demandHourly[i] || 0);
    metBySupply += Math.min(s, d);
    unmet += Math.max(0, d - s);
    excess += Math.max(0, s - d);
    totalDemand += d;
  }
  return {
    supplyMonthly: aggregateMonthly(supplyHourly, met),
    demandMonthly: aggregateMonthly(demandHourly, met),
    metBySupply,
    unmet,
    excess,
    solarFraction: totalDemand > 0 ? metBySupply / totalDemand : 0
  };
}

function calculateHourlyElectricityBalance(pvHourly, demandHourly, met){
  const balance = calculateHourlyEnergyBalance(pvHourly, demandHourly, met);
  return {
    pvMonthly: balance.supplyMonthly,
    demandMonthly: balance.demandMonthly,
    metByPv: balance.metBySupply,
    unmet: balance.unmet,
    excess: balance.excess,
    solarFraction: balance.solarFraction
  };
}

function getProcessUsageRanges(hourlySeries, met){
  const hourTotal  = new Array(24).fill(0);
  const hourActive = new Array(24).fill(0);
  for (let i = 0; i < Math.min(hourlySeries.length, met.length); i++){
    const h = met[i]?.hourN;
    if (!Number.isInteger(h) || h < 0 || h > 23) continue;
    hourTotal[h]  += 1;
    if ((hourlySeries[i] || 0) > 1e-9) hourActive[h] += 1;
  }
  const activeHour = new Array(24).fill(false);
  for (let h = 0; h < 24; h++) activeHour[h] = hourActive[h] > 0;

  const ranges = [];
  let start = null;
  for (let h = 0; h <= 24; h++){
    const on = h < 24 ? activeHour[h] : false;
    if (on && start === null) start = h;
    if (!on && start !== null){ ranges.push({startH:start, endH:h-1}); start = null; }
  }
  return ranges.map(r => {
    let sumPct = 0, n = 0;
    for (let h = r.startH; h <= r.endH; h++){
      if (hourTotal[h] > 0){ sumPct += (hourActive[h]/hourTotal[h])*100; n++; }
    }
    const pct = n > 0 ? (sumPct / n) : 0;
    const st = `${String(r.startH).padStart(2,"0")}:00`;
    const endHour = r.endH === 23 ? "24:00" : `${String(r.endH+1).padStart(2,"0")}:00`;
    return `${st}-${endHour} (${pct.toFixed(0)}% of days)`;
  });
}

// ================================================================
//  SVG CHART BUILDERS  (Demand-side)
// ================================================================
function buildMonthlyBarChart(datasets, title, yLabel, width=820, height=280){
  const m = {top:30,right:20,bottom:36,left:70};
  const cw = width-m.left-m.right, ch = height-m.top-m.bottom;
  const monthlyTotals = Array.from({length:12}, (_,i) =>
    datasets.reduce((sum,ds) => sum + (isFiniteNumber(ds?.monthly?.[i]) ? ds.monthly[i] : 0), 0));
  const maxVal = Math.max(...monthlyTotals, 0.01) * 1.1;
  const barW = (cw/12)*0.7;
  const barX = i => m.left + (i/12)*cw + (cw/12 - barW)/2;
  const y    = v => m.top + ch*(1 - v/maxVal);
  const mn   = MONTH_NAMES;

  const bars = [];
  for (let i = 0; i < 12; i++){
    let base = 0;
    for (const ds of datasets){
      const v = ds.monthly[i] || 0;
      const bh = (v/maxVal)*ch;
      if (bh > 0.1) bars.push(`<rect x="${barX(i).toFixed(1)}" y="${(m.top+ch-base-bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${ds.color}" opacity="0.85"/>`);
      base += bh;
    }
    bars.push(`<text x="${(barX(i)+barW/2).toFixed(1)}" y="${(height-m.bottom+16)}" text-anchor="middle" font-size="11" fill="#333">${mn[i]}</text>`);
  }
  const yTicks = [];
  for (let t = 0; t <= 5; t++){
    const v = maxVal*t/5, py = y(v);
    yTicks.push(`<line x1="${m.left}" y1="${py.toFixed(1)}" x2="${width-m.right}" y2="${py.toFixed(1)}" stroke="#eee"/>`,
      `<text x="${m.left-8}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#555">${v>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0)}</text>`);
  }
  const legendHtml = datasets.map(ds =>
    `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#222;white-space:nowrap;"><span style="width:10px;height:10px;border-radius:2px;background:${ds.color};display:inline-block;"></span><span>${ds.label}</span></span>`
  ).join("");
  return `<div style="margin:10px 0;"><div style="font-size:13px;font-weight:600;margin-bottom:4px;">${title}</div>
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;border:1px solid #eee;border-radius:6px;background:#fff;">
      ${yTicks.join('')}<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top+ch}" stroke="#666"/>
      <line x1="${m.left}" y1="${m.top+ch}" x2="${width-m.right}" y2="${m.top+ch}" stroke="#666"/>${bars.join('')}
      <text x="16" y="${m.top+ch/2}" text-anchor="middle" font-size="11" fill="#555" transform="rotate(-90 16 ${m.top+ch/2})">${yLabel}</text>
    </svg><div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin-top:8px;">${legendHtml}</div></div>`;
}

function buildSupplyDemandLineChart(pvtMonthly, demandMonthly, title, width=820, height=260, opts={}){
  const m = {top:28,right:78,bottom:50,left:78};
  const cw = width-m.left-m.right, ch = height-m.top-m.bottom;
  const supplyColor = opts.supplyColor || "#1976d2";
  const demandColor = opts.demandColor || "#d32f2f";
  const supplyLabel = opts.supplyLabel || "PVT Thermal Supply";
  const demandLabel = opts.demandLabel || "Thermal Demand";
  const leftAxisLabel  = opts.leftAxisLabel  || "PVT kWh";
  const rightAxisLabel = opts.rightAxisLabel || "Demand kWh";
  const sameScale = !!opts.sameScale;
  const fixedMax  = isFiniteNumber(opts.fixedMax) ? Number(opts.fixedMax) : null;

  const pvtVals = pvtMonthly.map(v => isFiniteNumber(v)?v:0);
  const demVals = demandMonthly.map(v => isFiniteNumber(v)?v:0);
  const rawShared = fixedMax != null ? Math.max(fixedMax,0.01) : Math.max(...pvtVals,...demVals,0.01);
  const maxPvt = (sameScale ? rawShared : Math.max(...pvtVals,0.01)) * 1.15;
  const maxDem = (sameScale ? rawShared : Math.max(...demVals,0.01)) * 1.15;

  const x    = i => m.left + (i/11)*cw;
  const yPvt = v => m.top + ch*(1 - (v||0)/maxPvt);
  const yDem = v => m.top + ch*(1 - (v||0)/maxDem);
  const fmtK = v => v>=1000?(v/1000).toFixed(1)+"k":v.toFixed(0);

  const makePath = (arr,yFn,color) => {
    let d=""; for(let i=0;i<12;i++) d+=(i===0?`M`:` L`)+`${x(i).toFixed(1)} ${yFn(arr[i]||0).toFixed(1)}`;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
  };
  const makeDots = (arr,yFn,color) => arr.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${yFn(v||0).toFixed(1)}" r="3" fill="${color}"/>`).join("");

  const leftTicks=[],rightTicks=[],gridLines=[];
  for(let t=0;t<=5;t++){
    const vP=maxPvt*t/5, vD=maxDem*t/5, py=yPvt(vP);
    gridLines.push(`<line x1="${m.left}" y1="${py.toFixed(1)}" x2="${width-m.right}" y2="${py.toFixed(1)}" stroke="#eee"/>`);
    leftTicks.push(`<text x="${m.left-8}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="10" fill="${supplyColor}">${fmtK(vP)}</text>`);
    rightTicks.push(`<text x="${width-m.right+8}" y="${(py+4).toFixed(1)}" text-anchor="start" font-size="10" fill="${demandColor}">${fmtK(vD)}</text>`);
  }
  const xTicks = MONTH_NAMES.map((n,i)=>`<text x="${x(i).toFixed(1)}" y="${height-m.bottom+16}" text-anchor="middle" font-size="11" fill="#333">${n}</text>`);

  return `<div style="margin:10px 0;"><div style="font-size:13px;font-weight:600;margin-bottom:4px;">${title}</div>
    <svg viewBox="0 0 ${width} ${height}" style="width:100%;border:1px solid #eee;border-radius:6px;background:#fff;">
      ${gridLines.join("")}
      <line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top+ch}" stroke="#666"/>
      <line x1="${width-m.right}" y1="${m.top}" x2="${width-m.right}" y2="${m.top+ch}" stroke="#666"/>
      <line x1="${m.left}" y1="${m.top+ch}" x2="${width-m.right}" y2="${m.top+ch}" stroke="#666"/>
      ${makePath(pvtVals,yPvt,supplyColor)}${makeDots(pvtVals,yPvt,supplyColor)}
      ${makePath(demVals,yDem,demandColor)}${makeDots(demVals,yDem,demandColor)}
      ${leftTicks.join("")}${rightTicks.join("")}${xTicks.join("")}
      <rect x="${m.left}" y="${height-m.bottom+30}" width="10" height="10" fill="${supplyColor}"/>
      <text x="${m.left+14}" y="${height-m.bottom+40}" font-size="11" fill="#333">${supplyLabel}</text>
      <rect x="${m.left+180}" y="${height-m.bottom+30}" width="10" height="10" fill="${demandColor}"/>
      <text x="${m.left+194}" y="${height-m.bottom+40}" font-size="11" fill="#333">${demandLabel}</text>
      <text x="20" y="${m.top+ch/2}" text-anchor="middle" font-size="11" fill="${supplyColor}" transform="rotate(-90 20 ${m.top+ch/2})">${leftAxisLabel}</text>
      <text x="${width-20}" y="${m.top+ch/2}" text-anchor="middle" font-size="11" fill="${demandColor}" transform="rotate(90 ${width-20} ${m.top+ch/2})">${rightAxisLabel}</text>
    </svg></div>`;
}

function buildIndustryChartGroups(chartThermalDemand, chartThermalSupply, chartElectricalDemand, chartElectricalSupply){
  return `
    <div class="industry-chart-grid">
      <section class="industry-chart-section thermal">
        <h4>Thermal charts</h4>
        ${chartThermalDemand}${chartThermalSupply}
      </section>
      <section class="industry-chart-section electrical">
        <h4>Electrical charts</h4>
        ${chartElectricalDemand}${chartElectricalSupply}
      </section>
    </div>`;
}

function formatSummaryWhole(value){
  return isFiniteNumber(value)
    ? Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "\u2014";
}

function formatSummaryPercent(value){
  return isFiniteNumber(value) ? `${(value * 100).toFixed(1)}%` : "\u2014";
}

function formatSummaryCurrency(value){
  return isFiniteNumber(value)
    ? `$${Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} AUD/yr`
    : "\u2014";
}

function buildIndustryPerformanceSummary(opts){
  const savingsAud = isFiniteNumber(opts.savingsAud) ? opts.savingsAud : 0;
  const heatCoverage = isFiniteNumber(opts.solarHeatFraction) ? `${(opts.solarHeatFraction * 100).toFixed(1)}%` : "\u2014";
  const electricCoverage = isFiniteNumber(opts.solarElecFraction) ? `${(opts.solarElecFraction * 100).toFixed(1)}%` : "\u2014";
  const unusedHeat = isFiniteNumber(opts.unusedHeatKWh) ? `${formatSummaryWhole(opts.unusedHeatKWh)} kWh` : "\u2014";
  const unusedElectricity = isFiniteNumber(opts.unusedElectricityKWh) ? `${formatSummaryWhole(opts.unusedElectricityKWh)} kWh` : "\u2014";
  const areaText = isFiniteNumber(opts.areaM2)
    ? `${Number(opts.areaM2).toLocaleString(undefined, { maximumFractionDigits: 1 })} m\u00B2`
    : "\u2014";
  const locationText = escapeHtml(opts.locationName || "selected location");

  return `
    <div class="insight-hero" style="margin-bottom:16px;">
      <div class="insight-kicker">Solar Performance Summary</div>
      <div class="insight-title">You save $${formatSummaryWhole(savingsAud)} AUD/yr with ${heatCoverage} solar heat coverage</div>
      <div class="insight-sub">Based on ${areaText} PVT collector area at ${locationText}</div>
      <div class="insight-strip">
        <div class="insight-pill"><div class="eyebrow">Solar Electricity</div><div class="big">${electricCoverage}</div><small>Share of site electricity covered by PV.</small></div>
        <div class="insight-pill"><div class="eyebrow">Solar Heat</div><div class="big">${heatCoverage}</div><small>Share of process heat covered by PVT heat.</small></div>
        <div class="insight-pill"><div class="eyebrow">Yearly Savings</div><div class="big">$${formatSummaryWhole(savingsAud)} /yr</div><small>Thermal fuel plus electricity value counted for this industry each year.</small></div>
        <div class="insight-pill"><div class="eyebrow">Unused heat energy</div><div class="big">${unusedHeat}</div><div class="eyebrow" style="margin-top:12px;">Unused electrical energy</div><div class="big">${unusedElectricity}</div></div>
      </div>
    </div>`;
}

function buildIndustryEnergyFlowSummary(opts){
  const energyValue = (value) => isFiniteNumber(value) ? `${formatSummaryWhole(value)} kWh/yr` : "\u2014";
  return `
    <div class="energy-flow-summary">
      <section class="energy-flow-group electrical">
        <div class="energy-flow-heading">
          <span>Electrical energy</span>
        </div>
        <div class="energy-flow-cards">
          <div class="energy-flow-card">
            <span>Electric demand consumed</span>
            <strong>${energyValue(opts.electricDemandKWh)}</strong>
            <small>Total electricity required by the site.</small>
          </div>
          <div class="energy-flow-card">
            <span>Solar electricity used</span>
            <strong>${energyValue(opts.solarElectricUsedKWh)}</strong>
            <small>PV electricity consumed on site.</small>
          </div>
          <div class="energy-flow-card">
            <span>Grid electricity needed</span>
            <strong>${energyValue(opts.gridElectricityNeededKWh)}</strong>
            <small>Remaining electricity imported from grid.</small>
          </div>
          <div class="energy-flow-card">
            <span>PV exported</span>
            <strong>${energyValue(opts.exportedElectricityKWh)}</strong>
            <small>PV electricity above hourly site demand, exported to the grid.</small>
          </div>
        </div>
      </section>
      <section class="energy-flow-group thermal">
        <div class="energy-flow-heading">
          <span>Thermal energy</span>
        </div>
        <div class="energy-flow-cards">
          <div class="energy-flow-card">
            <span>Heat demand consumed</span>
            <strong>${energyValue(opts.thermalDemandKWh)}</strong>
            <small>Total process heat required.</small>
          </div>
          <div class="energy-flow-card">
            <span>Solar heat used</span>
            <strong>${energyValue(opts.solarHeatUsedKWh)}</strong>
            <small>Demand supplied directly by PVT heat.</small>
          </div>
          <div class="energy-flow-card">
            <span>Backup heat needed</span>
            <strong>${energyValue(opts.backupHeatNeededKWh)}</strong>
            <small>Remaining heat from boiler or backup.</small>
          </div>
          <div class="energy-flow-card">
            <span>Solar heat unused</span>
            <strong>${energyValue(opts.unusedHeatKWh)}</strong>
            <small>${opts.unusedHeatNote || "PVT heat above hourly process demand (no storage)."}</small>
          </div>
        </div>
      </section>
    </div>`;
}

function buildProcessBreakdown(rows, totalKWh){
  const rowHtml = rows.map(row => `
    <div class="process-breakdown-row">
      <div>
        <div class="process-title">${row.name}</div>
        <div class="process-meta">
          ${[row.rate, row.hours, ...(row.details || [])].filter(Boolean).map(item => `<span class="process-pill">${item}</span>`).join("")}
        </div>
      </div>
      <div class="process-kwh">${formatSummaryWhole(row.kWh)}<span class="process-unit">kWh/yr</span></div>
    </div>`).join("");

  return `
    <div class="process-breakdown">
      <div class="process-breakdown-head">
        <div>Process</div>
        <div style="text-align:right;">Annual demand</div>
      </div>
      ${rowHtml || `<div class="process-breakdown-row"><div class="note">No processes selected.</div><div class="process-kwh">\u2014<span class="process-unit">kWh/yr</span></div></div>`}
      <div class="process-breakdown-total">
        <div>Total</div>
        <div class="process-kwh">${formatSummaryWhole(totalKWh)}<span class="process-unit">kWh/yr</span></div>
      </div>
    </div>`;
}

function describeUsageInline(text){
  if (!text || text === "No active hours") return "No active hours";
  if (text === "00:00-24:00" || text === "All hours") return "All day";
  return text;
}

function buildIndustryQuickRead(opts){
  const thermalDemandKWh = Math.max(0, opts.thermalDemandKWh || 0);
  const solarHeatUsedKWh = Math.max(0, opts.solarHeatUsedKWh || 0);
  const backupHeatKWh = Math.max(0, opts.backupHeatKWh || 0);
  const unusedHeatKWh = Math.max(0, opts.unusedHeatKWh || 0);
  const electricDemandKWh = Math.max(0, opts.electricDemandKWh || 0);
  const solarElecUsedKWh = Math.max(0, opts.solarElecUsedKWh || 0);
  const gridElecKWh = Math.max(0, opts.gridElecKWh || 0);
  const exportElecKWh = Math.max(0, opts.exportElecKWh || 0);
  const feedInValueAud = Math.max(0, opts.feedInValueAud || 0);
  const feedInTariff = isFiniteNumber(opts.feedInTariff) ? opts.feedInTariff : 0;
  const heatFraction = thermalDemandKWh > 0 ? solarHeatUsedKWh / thermalDemandKWh : 0;
  const elecFraction = electricDemandKWh > 0 ? solarElecUsedKWh / electricDemandKWh : 0;

  return `
    <div class="quick-read">
      <h5>Quick Read</h5>
      <p class="quick-read-note">This is a simpler summary view added underneath the existing detailed tables and charts, so you can compare both styles before deciding what you prefer.</p>
      <div class="summary-card-grid">
        <div class="summary-card">
          <b>Yearly heat demand</b>
          <div class="summary-value">${formatSummaryWhole(thermalDemandKWh)} kWh/yr</div>
          <div class="summary-sub">Total low-temperature process heat demand for the selected profile.</div>
        </div>
        <div class="summary-card">
          <b>Solar heat used</b>
          <div class="summary-value">${formatSummaryWhole(solarHeatUsedKWh)} kWh/yr</div>
          <div class="summary-sub">${formatSummaryPercent(heatFraction)} of the heat demand is covered by solar.</div>
        </div>
        <div class="summary-card">
          <b>Backup heat still needed</b>
          <div class="summary-value">${formatSummaryWhole(backupHeatKWh)} kWh/yr</div>
          <div class="summary-sub">Unused solar heat without storage: ${formatSummaryWhole(unusedHeatKWh)} kWh/yr.</div>
        </div>
        <div class="summary-card">
          <b>Yearly electricity demand</b>
          <div class="summary-value">${formatSummaryWhole(electricDemandKWh)} kWh/yr</div>
          <div class="summary-sub">${formatSummaryPercent(elecFraction)} of electrical demand is covered by PV.</div>
        </div>
        <div class="summary-card">
          <b>Solar electricity used on site</b>
          <div class="summary-value">${formatSummaryWhole(solarElecUsedKWh)} kWh/yr</div>
          <div class="summary-sub">Grid electricity still needed: ${formatSummaryWhole(gridElecKWh)} kWh/yr.</div>
        </div>
        <div class="summary-card summary-card-highlight">
          <b>ELECTRICITY SAVING ONLY</b>
          <div class="summary-value">${formatSummaryCurrency(opts.totalSavingsAud || 0)}</div>
          <div class="summary-sub">${opts.savingsSubtext || "Current estimate counts on-site PV electricity savings only."}</div>
          <div class="summary-inline-box">
            <b>Feed-in electricity generated</b>
            <div class="summary-value">${formatSummaryWhole(exportElecKWh)} kWh/yr</div>
            <div class="summary-sub">Export value at ${feedInTariff.toFixed(2)} AUD/kWh: ${formatSummaryCurrency(feedInValueAud)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function formatEvanMetricValue(value, opts={}){
  const num = Number(value) || 0;
  if (opts.percent) return `${num.toFixed(1)}%`;
  if (opts.currency) return `$${Math.round(num).toLocaleString()} AUD`;
  return `${Math.round(num).toLocaleString()} kWh`;
}

function buildPrimaryLegend(items){
  return items.map(item => `
    <span class="legend-item">
      ${item.type === "line"
        ? `<span class="legend-line" style="border-top-color:${item.color};"></span>`
        : `<span class="legend-swatch" style="background:${item.color};"></span>`}
      <span>${item.label}</span>
    </span>`).join("");
}

function renderMetricCardsBodyHtml(cards){
  return cards.map(card => `
    <div class="metric-card">
      <div class="metric-label">${card.labelHtml || card.label}</div>
      <div class="metric-value">${card.value}</div>
    </div>`).join("");
}

function renderMetricCardsHtml(cards, extraClass=""){
  const cls = extraClass ? `metric-cards ${extraClass}` : "metric-cards";
  return `<div class="${cls}">${renderMetricCardsBodyHtml(cards)}</div>`;
}

function buildEvanIndustryViewHtml(opts){
  return `
    <details class="advanced-settings" style="margin-top:16px;">
      <summary>Show Evan View</summary>
      <div class="advanced-settings-body">
        <div class="note" style="margin:0 0 10px;">Original Evan-style summary view using the merged data from this calculator.</div>
        <div class="primary-chart-card">
          <div class="primary-chart-title">${opts.title}</div>
          <div class="custom-legend">${buildPrimaryLegend(opts.legendItems || [])}</div>
          ${opts.chartCallout ? `<div class="note" style="display:block;margin:8px 0 0;padding:10px 12px;border-radius:10px;background:#eef6fb;border:1px solid #c7dbe9;color:#21445b;">${opts.chartCallout}</div>` : ``}
          ${renderMetricCardsHtml(opts.metricCards || [])}
          <div class="chart-container" style="height:340px;margin:14px 0 0;">
            <canvas id="evanPrimaryChart"></canvas>
          </div>
        </div>
        <div class="results-block">
          <h5>Hourly demand shape</h5>
          ${opts.hourlyDemandHtml || `<div class="note">No hourly demand shape available.</div>`}
        </div>
        <div class="results-block">
          <h5>Monthly breakdown</h5>
          ${opts.monthlyBreakdownHtml || `<div class="note">No monthly breakdown available.</div>`}
        </div>
        <div class="results-block">
          <h5>Profile comparison</h5>
          ${opts.profileCompareHtml || `<div class="note">No profile comparison available.</div>`}
        </div>
      </div>
    </details>`;
}

function renderHotelPrimaryChart(primaryData){
  const ctx = document.getElementById("evanPrimaryChart");
  if (!ctx) return;
  if (evanPrimaryChartInstance) evanPrimaryChartInstance.destroy();
  evanPrimaryChartInstance = new Chart(ctx.getContext("2d"), {
    data:{
      labels: MONTH_NAMES,
      datasets: [
        { type:"bar", label:"DHW", data:primaryData.dhw, backgroundColor:HOTEL_PROCESS_COLORS.domestic_hot_water, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Kitchen", data:primaryData.kitchen, backgroundColor:HOTEL_PROCESS_COLORS.kitchen_dishwashing, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Laundry", data:primaryData.laundry, backgroundColor:HOTEL_PROCESS_COLORS.laundry, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Pool", data:primaryData.pool, backgroundColor:HOTEL_PROCESS_COLORS.pool_heating, stack:"demand", borderWidth:0, order:2 },
        {
          type:"line",
          label:"PVT thermal supply",
          data:primaryData.pvtSupply,
          borderColor:"#d32f2f",
          backgroundColor:"#d32f2f",
          tension:0.25,
          pointRadius:4,
          pointHoverRadius:5,
          pointBackgroundColor:"#d32f2f",
          pointBorderColor:"#d32f2f",
          yAxisID:"y",
          order:1
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:false},title:{display:false}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,title:{display:true,text:"kWh"}}}
    }
  });
}

function renderAquaticPrimaryChart(primaryData){
  const ctx = document.getElementById("evanPrimaryChart");
  if (!ctx) return;
  if (evanPrimaryChartInstance) evanPrimaryChartInstance.destroy();
  evanPrimaryChartInstance = new Chart(ctx.getContext("2d"), {
    data:{
      labels: MONTH_NAMES,
      datasets: [
        { type:"bar", label:"Met by PVT", data:primaryData.metByPvt, backgroundColor:"rgba(8,61,91,0.16)", borderColor:"rgba(8,61,91,0.45)", borderWidth:1, stack:"met", order:1 },
        { type:"bar", label:"Indoor", data:primaryData.indoor, backgroundColor:AQUATIC_PROCESS_COLORS.indoor_pool, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Outdoor", data:primaryData.outdoor, backgroundColor:AQUATIC_PROCESS_COLORS.outdoor_pool, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Kids", data:primaryData.kids, backgroundColor:AQUATIC_PROCESS_COLORS.kids_pool, stack:"demand", borderWidth:0, order:2 },
        { type:"bar", label:"Sauna", data:primaryData.sauna, backgroundColor:AQUATIC_PROCESS_COLORS.sauna, stack:"demand", borderWidth:0, order:2 },
        {
          type:"line",
          label:"PVT thermal supply",
          data:primaryData.pvtSupply,
          borderColor:"#083d5b",
          backgroundColor:"#083d5b",
          tension:0.28,
          pointRadius:4,
          pointHoverRadius:5,
          pointBackgroundColor:"#083d5b",
          pointBorderColor:"#083d5b",
          yAxisID:"y",
          order:1
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:false},title:{display:false}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,title:{display:true,text:"kWh"}}}
    }
  });
}

function renderCurrentEvanView(){
  if (!CURRENT_EVAN_VIEW){
    if (evanPrimaryChartInstance){
      evanPrimaryChartInstance.destroy();
      evanPrimaryChartInstance = null;
    }
    return;
  }
  if (CURRENT_EVAN_VIEW.mode === "hotel"){
    renderHotelPrimaryChart(CURRENT_EVAN_VIEW.primaryData);
  } else if (CURRENT_EVAN_VIEW.mode === "aquatic_centres"){
    renderAquaticPrimaryChart(CURRENT_EVAN_VIEW.primaryData);
  }
}

function build8760DemandChart(hourlySeries, met, title, width=920, height=300){
  const n = Math.min(hourlySeries.length, met.length);
  if (!n) return `<p class="note">No hourly demand data available.</p>`;
  const vals = [];
  for (let i = 0; i < n; i++) vals.push(isFiniteNumber(hourlySeries[i]) ? hourlySeries[i] : 0);

  const mg = {top:28,right:20,bottom:44,left:70};
  const pxPerHour = 1.0;
  const plotWidth = Math.max(width, mg.left+mg.right+Math.max(1,(n-1))*pxPerHour);
  const cw = plotWidth-mg.left-mg.right, ch = height-mg.top-mg.bottom;
  const maxV = Math.max(...vals,0.01)*1.1;
  const x = i => mg.left + (i/Math.max(1,n-1))*cw;
  const y = v => mg.top + ch*(1 - (v||0)/maxV);

  let path="";
  for(let i=0;i<n;i++) path+=(i===0?`M`:`L`)+`${x(i).toFixed(2)} ${y(vals[i]).toFixed(2)} `;

  const yTicks=[];
  for(let t=0;t<=5;t++){
    const v=maxV*t/5, py=y(v);
    yTicks.push(`<line x1="${mg.left}" y1="${py.toFixed(1)}" x2="${plotWidth-mg.right}" y2="${py.toFixed(1)}" stroke="#eee"/>`,
      `<text x="${mg.left-8}" y="${(py+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#555">${v>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0)}</text>`);
  }
  const monthStarts = new Array(12).fill(null);
  for(let i=0;i<n;i++){ const mm=monthFromDayN(met[i].dayN)-1; if(mm>=0&&mm<12&&monthStarts[mm]===null) monthStarts[mm]=i; }
  const xTicks=[];
  for(let mIdx=0;mIdx<12;mIdx++){
    const idx=monthStarts[mIdx]; if(idx===null) continue;
    const px=x(idx);
    xTicks.push(`<line x1="${px.toFixed(1)}" y1="${height-mg.bottom}" x2="${px.toFixed(1)}" y2="${height-mg.bottom+5}" stroke="#666"/>`,
      `<text x="${px.toFixed(1)}" y="${height-mg.bottom+18}" text-anchor="middle" font-size="10" fill="#333">${MONTH_NAMES[mIdx]}</text>`);
  }
  return `<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;margin-bottom:4px;">${title}</div>
    <div class="note" style="margin:0 0 6px 0;">Full 8760 hourly points shown. Scroll horizontally to inspect detail.</div>
    <div style="overflow-x:auto;border:1px solid #eee;border-radius:6px;background:#fff;">
      <svg viewBox="0 0 ${plotWidth} ${height}" style="width:${plotWidth}px;height:auto;display:block;background:#fff;">
        ${yTicks.join("")}
        <line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${mg.top+ch}" stroke="#666"/>
        <line x1="${mg.left}" y1="${mg.top+ch}" x2="${plotWidth-mg.right}" y2="${mg.top+ch}" stroke="#666"/>
        <path d="${path}" fill="none" stroke="#1565c0" stroke-width="1.2"/>
        ${xTicks.join("")}
        <text x="${plotWidth/2}" y="${height-8}" text-anchor="middle" font-size="11" fill="#555">Hour index across year (8760)</text>
        <text x="16" y="${mg.top+ch/2}" text-anchor="middle" font-size="11" fill="#555" transform="rotate(-90 16 ${mg.top+ch/2})">kWh</text>
      </svg></div></div>`;
}

// ================================================================
//  MAINS / CLIMATE SVG CHARTS
// ================================================================
function buildMainsChartSvg(){
  if (!CURRENT_MAINS || !CURRENT_MAINS.byDay) return `<p class="note">Load a location first.</p>`;
  const width=860,height=360;
  const mg={top:24,right:24,bottom:44,left:56};
  const cw=width-mg.left-mg.right, ch=height-mg.top-mg.bottom;
  const days=[];
  for(let d=1;d<=365;d++){ const t=CURRENT_MAINS.byDay[d]; days.push(Number.isFinite(t)?t:CURRENT_MAINS.annualAvgC); }
  let minT=Math.min(...days), maxT=Math.max(...days);
  if(!Number.isFinite(minT)||!Number.isFinite(maxT)||maxT<=minT){minT=CURRENT_MAINS.annualAvgC-1;maxT=CURRENT_MAINS.annualAvgC+1;}
  const pad=Math.max(0.5,(maxT-minT)*0.15); minT-=pad; maxT+=pad;
  const x=day=>mg.left+((day-1)/364)*cw;
  const y=temp=>mg.top+((maxT-temp)/(maxT-minT))*ch;
  const yTicks=[];
  for(let i=0;i<=6;i++){const v=minT+(i/6)*(maxT-minT),py=y(v);
    yTicks.push(`<line x1="${mg.left}" y1="${py.toFixed(2)}" x2="${width-mg.right}" y2="${py.toFixed(2)}" stroke="#eee"/>`,
      `<text x="${mg.left-8}" y="${(py+4).toFixed(2)}" text-anchor="end" font-size="11" fill="#444">${v.toFixed(1)}</text>`);}
  let linePath="";
  for(let d=1;d<=365;d++){const px=x(d).toFixed(2),py=y(days[d-1]).toFixed(2);linePath+=(d===1?`M ${px} ${py}`:` L ${px} ${py}`);}
  const monthTicks=[],monthDots=[];
  for(let i=0;i<12;i++){
    const dayMid=monthMidDay(i),mx=x(dayMid);
    const mt=CURRENT_MAINS.byMonth?.[i]?.avgC, my=y(Number.isFinite(mt)?mt:CURRENT_MAINS.annualAvgC);
    monthTicks.push(`<line x1="${mx.toFixed(2)}" y1="${height-mg.bottom}" x2="${mx.toFixed(2)}" y2="${height-mg.bottom+5}" stroke="#666"/>`,
      `<text x="${mx.toFixed(2)}" y="${height-mg.bottom+20}" text-anchor="middle" font-size="11" fill="#222">${MONTH_NAMES[i]}</text>`);
    monthDots.push(`<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="3.2" fill="#d33"/>`);
  }
  return `<div class="note" style="margin:0 0 8px 0;">Sinusoidal daily profile from the local T_mains model.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks.join("")}
      <line x1="${mg.left}" y1="${height-mg.bottom}" x2="${width-mg.right}" y2="${height-mg.bottom}" stroke="#666"/>
      <line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${height-mg.bottom}" stroke="#666"/>
      <path d="${linePath}" fill="none" stroke="#1976d2" stroke-width="2.2"/>
      ${monthDots.join("")}${monthTicks.join("")}
      <text x="${width/2}" y="${height-8}" text-anchor="middle" font-size="11" fill="#222">Month</text>
      <text x="14" y="${height/2}" text-anchor="middle" font-size="11" fill="#222" transform="rotate(-90 14 ${height/2})">T_mains (&deg;C)</text>
    </svg>`;
}

function buildAmbientChartSvg(){
  if (!Array.isArray(CURRENT_MET) || !CURRENT_MET.length) return `<p class="note">Load a location first.</p>`;
  const monthly = getAmbientMonthlyAverages(CURRENT_MET);
  const values = monthly.map(m => (Number.isFinite(m.avgC)?m.avgC:0));
  let minT=Math.min(...values), maxT=Math.max(...values);
  if(!Number.isFinite(minT)||!Number.isFinite(maxT)||maxT<=minT){minT=0;maxT=1;}
  const pad=Math.max(0.5,(maxT-minT)*0.2); minT-=pad; maxT+=pad;
  const width=860,height=340;
  const mg={top:24,right:24,bottom:44,left:56};
  const cw=width-mg.left-mg.right, ch=height-mg.top-mg.bottom;
  const x=i=>mg.left+(i/11)*cw;
  const y=temp=>mg.top+((maxT-temp)/(maxT-minT))*ch;
  const yTicks=[];
  for(let i=0;i<=6;i++){const v=minT+(i/6)*(maxT-minT),py=y(v);
    yTicks.push(`<line x1="${mg.left}" y1="${py.toFixed(2)}" x2="${width-mg.right}" y2="${py.toFixed(2)}" stroke="#eee"/>`,
      `<text x="${mg.left-8}" y="${(py+4).toFixed(2)}" text-anchor="end" font-size="11" fill="#444">${v.toFixed(1)}</text>`);}
  let linePath=""; const dots=[],xTicks=[];
  for(let i=0;i<12;i++){
    const val=Number.isFinite(monthly[i]?.avgC)?monthly[i].avgC:0;
    const px=x(i),py=y(val);
    linePath+=(i===0?`M ${px.toFixed(2)} ${py.toFixed(2)}`:` L ${px.toFixed(2)} ${py.toFixed(2)}`);
    dots.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="3.2" fill="#ef6c00"/>`);
    xTicks.push(`<line x1="${px.toFixed(2)}" y1="${height-mg.bottom}" x2="${px.toFixed(2)}" y2="${height-mg.bottom+5}" stroke="#666"/>`,
      `<text x="${px.toFixed(2)}" y="${height-mg.bottom+20}" text-anchor="middle" font-size="11" fill="#222">${MONTH_NAMES[i]}</text>`);
  }
  return `<div class="note" style="margin:0 0 8px 0;">Monthly average ambient temperature (Ta) from loaded TMY data.</div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${yTicks.join("")}
      <line x1="${mg.left}" y1="${height-mg.bottom}" x2="${width-mg.right}" y2="${height-mg.bottom}" stroke="#666"/>
      <line x1="${mg.left}" y1="${mg.top}" x2="${mg.left}" y2="${height-mg.bottom}" stroke="#666"/>
      <path d="${linePath}" fill="none" stroke="#ef6c00" stroke-width="2.2"/>
      ${dots.join("")}${xTicks.join("")}
      <text x="${width/2}" y="${height-8}" text-anchor="middle" font-size="11" fill="#222">Month</text>
      <text x="14" y="${height/2}" text-anchor="middle" font-size="11" fill="#222" transform="rotate(-90 14 ${height/2})">Ta (degC)</text>
    </svg>`;
}

// ================================================================
//  CHART.JS RENDERERS  (Supply-side)
// ================================================================
let monthlyChartInstance = null, dailyChartInstance = null, temperatureChartInstance = null;

function updateSupplySectionVisibility(){
  const monthlyBlock = document.getElementById("monthlySupplyBlock");
  const dailyBlock = document.getElementById("dailyDetailBlock");
  const tempBlock = document.getElementById("outletTemperatureBlock");
  const emptyNote = document.getElementById("supplyChartsEmpty");

  const showMonthly = document.getElementById("showMonthlySupply")?.checked;
  const showDaily = document.getElementById("showDailyDetail")?.checked;
  const showTemp = document.getElementById("showOutletTemperature")?.checked;

  monthlyBlock.style.display = showMonthly ? "block" : "none";
  dailyBlock.style.display = showDaily ? "block" : "none";
  tempBlock.style.display = showTemp ? "block" : "none";
  emptyNote.style.display = (showMonthly || showDaily || showTemp) ? "none" : "block";

  setTimeout(() => {
    if (showMonthly && monthlyChartInstance) monthlyChartInstance.resize();
    if (showDaily && dailyChartInstance) dailyChartInstance.resize();
    if (showTemp && temperatureChartInstance) temperatureChartInstance.resize();
  }, 0);
}

function renderMonthlyChart(monthlyData){
  const labels=[],pvData=[],thData=[];
  monthlyData.forEach(row => {
    if (row.month === 0) return;
    labels.push(MONTH_NAMES[row.month - 1]);
    pvData.push(row.pv_kWh.toFixed(1));
    thData.push(row.th_kWh.toFixed(1));
  });
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(ctx.getContext('2d'), {
    type:'bar',
    data:{labels, datasets:[
      {label:'PV Energy (kWh)',data:pvData,backgroundColor:'rgba(8,61,91,0.7)',borderColor:'rgba(8,61,91,1)',borderWidth:1},
      {label:'Thermal Energy (kWh)',data:thData,backgroundColor:'rgba(13,111,143,0.7)',borderColor:'rgba(13,111,143,1)',borderWidth:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},plugins:{title:{display:true,text:'Monthly PV & Thermal Energy'}}}
  });
}

function renderDailyChart(dailyData){
  const labels=[],pvData=[],thData=[];
  dailyData.forEach(row => {
    labels.push(row.date.split('-')[2]);
    pvData.push(row.pv_kWh.toFixed(2));
    thData.push(row.th_kWh.toFixed(2));
  });
  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;
  if (dailyChartInstance) dailyChartInstance.destroy();
  dailyChartInstance = new Chart(ctx.getContext('2d'), {
    type:'bar',
    data:{labels, datasets:[
      {label:'PV Energy (kWh)',data:pvData,backgroundColor:'rgba(8,61,91,0.7)',borderColor:'rgba(8,61,91,1)',borderWidth:1},
      {label:'Thermal Energy (kWh)',data:thData,backgroundColor:'rgba(13,111,143,0.7)',borderColor:'rgba(13,111,143,1)',borderWidth:1}
    ]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},plugins:{title:{display:true,text:'Daily PV & Thermal Energy'}}}
  });
}

function renderTemperatureChartJS(monthlyData){
  const labels=[],toutData=[];
  monthlyData.forEach(row => {
    if (row.month === 0) return;
    labels.push(MONTH_NAMES[row.month - 1]);
    toutData.push(row.Tout_C_avg > 0 ? row.Tout_C_avg.toFixed(1) : 0);
  });
  const ctx = document.getElementById('temperatureChart');
  if (!ctx) return;
  if (temperatureChartInstance) temperatureChartInstance.destroy();
  temperatureChartInstance = new Chart(ctx.getContext('2d'), {
    type:'line',
    data:{labels, datasets:[{label:'Average Outlet Temperature (\u00B0C)',data:toutData,borderColor:'rgba(103,199,216,1)',backgroundColor:'rgba(103,199,216,0.12)',borderWidth:2,fill:true,tension:0.4}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},plugins:{title:{display:true,text:'Monthly Average Outlet Temperature'}}}
  });
}

// ================================================================
//  DATA TABLES  (Supply-side)
// ================================================================
function renderMonthlyAllTable(monthlyData){
  const container = document.getElementById("monthlyDataTable");
  if (!monthlyData?.length){container.innerHTML="";return;}
  const mn = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let html = `<table class="result-table"><tr><th>Month</th><th style="text-align:right;">PV (kWh)</th><th style="text-align:right;">Thermal (kWh)</th><th style="text-align:right;">Avg Tout (\u00B0C)</th></tr>`;
  monthlyData.forEach(row => {
    if (row.month === 0) return;
    html += `<tr><td>${mn[row.month]}</td><td class="num">${row.pv_kWh.toFixed(1)}</td><td class="num">${row.th_kWh.toFixed(1)}</td><td class="num">${row.Tout_C_avg > 0 ? row.Tout_C_avg.toFixed(1) : '\u2014'}</td></tr>`;
  });
  container.innerHTML = html + `</table>`;
}

function renderDailyAllTable(dailyData){
  const container = document.getElementById("dailyDataTable");
  if (!dailyData?.length){container.innerHTML="";return;}
  let html = `<table class="result-table"><tr><th>Date</th><th style="text-align:right;">PV (kWh)</th><th style="text-align:right;">Thermal (kWh)</th><th style="text-align:right;">Avg Tout (\u00B0C)</th></tr>`;
  dailyData.forEach(row => {
    html += `<tr><td>${row.date}</td><td class="num">${row.pv_kWh.toFixed(2)}</td><td class="num">${row.th_kWh.toFixed(2)}</td><td class="num">${row.Tout_C_avg > 0 ? row.Tout_C_avg.toFixed(1) : '\u2014'}</td></tr>`;
  });
  container.innerHTML = html + `</table>`;
}

function renderTemperatureTable(monthlyData){
  const container = document.getElementById("temperatureDataTable");
  if (!monthlyData?.length){container.innerHTML="";return;}
  const mn = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let html = `<table class="result-table"><tr><th>Month</th><th style="text-align:right;">Avg Tout (\u00B0C)</th></tr>`;
  monthlyData.forEach(row => {
    if (row.month === 0) return;
    html += `<tr><td>${mn[row.month]}</td><td class="num">${row.Tout_C_avg > 0 ? row.Tout_C_avg.toFixed(1) : '\u2014'}</td></tr>`;
  });
  container.innerHTML = html + `</table>`;
}

// ================================================================
//  SUPPLY DATA AGGREGATION  (for Chart.js)
// ================================================================
function aggregateMonthlyAll(series, year){
  const months = Array.from({length:12}, () => ({month:0, pv_kWh:0, th_kWh:0, Tout_C_sum:0, Tout_C_count:0, Tout_C_avg:0}));
  series.forEach(r => {
    if (!r.date) return;
    const d = new Date(r.date);
    if (d.getFullYear() === year){
      const m = d.getMonth();
      months[m].month = m + 1;
      months[m].pv_kWh += Number(r.pv_kWh) || 0;
      months[m].th_kWh += Number(r.th_kWh) || 0;
      if (Number(r.Tout_C) > 0){months[m].Tout_C_sum += Number(r.Tout_C); months[m].Tout_C_count += 1;}
    }
  });
  months.forEach(m => m.Tout_C_avg = m.Tout_C_count > 0 ? m.Tout_C_sum / m.Tout_C_count : 0);
  return months;
}

function aggregateDailyAll(series, year, month){
  const days = new Date(year, month, 0).getDate();
  const daysArr = Array.from({length:days}, (_,i) => ({
    date:`${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,
    pv_kWh:0, th_kWh:0, Tout_C_sum:0, Tout_C_count:0, Tout_C_avg:0
  }));
  series.forEach(r => {
    if (!r.date) return;
    const d = new Date(r.date);
    if (d.getFullYear() === year && (d.getMonth()+1) === month){
      const day = d.getDate();
      daysArr[day-1].pv_kWh += Number(r.pv_kWh) || 0;
      daysArr[day-1].th_kWh += Number(r.th_kWh) || 0;
      if (Number(r.Tout_C) > 0){daysArr[day-1].Tout_C_sum += Number(r.Tout_C); daysArr[day-1].Tout_C_count += 1;}
    }
  });
  daysArr.forEach(d => d.Tout_C_avg = d.Tout_C_count > 0 ? d.Tout_C_sum / d.Tout_C_count : 0);
  return daysArr;
}

// ================================================================
//  MODAL FUNCTIONS
// ================================================================
function openClimateCharts(ev){
  if (ev) ev.preventDefault();
  if (!CURRENT_MAINS) return;
  document.getElementById("mainsChartTitle").textContent = "Local Temperature Charts";
  document.getElementById("mainsChartBody").innerHTML =
    `<div class="chart-grid"><div>${buildMainsChartSvg()}</div><div>${buildAmbientChartSvg()}</div></div>`;
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex"; modal.setAttribute("aria-hidden","false");
}

function closeMainsChart(){
  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "none"; modal.setAttribute("aria-hidden","true");
  closeHowItWorksStep();
  document.querySelectorAll("rect[data-step]").forEach(r => r.classList.remove("active"));
}

function openProcessDiagram(ev){
  if (ev) ev.preventDefault();
  const industry = document.getElementById("industrySelect").value;
  const diagram = INDUSTRY_DIAGRAMS[industry];
  if (!diagram) return;
  document.getElementById("processDiagramTitle").textContent = diagram.title;
  let extraHtml = "";
  if (industry === "dairy_farm"){
    extraHtml = `
      <button type="button" class="diagram-hotspot"
        style="left:5.6%;top:79.2%;width:12.4%;height:11.8%;"
        onclick="toggleDairyBoilerHotspot()"
        aria-label="Boiler hotspot">
        <span class="diagram-hotspot-label">Boiler</span>
      </button>
      <div id="dairyBoilerNote" class="diagram-hotspot-note" style="display:none;">
        <b>Boiler / Process C</b>
        This boiler maps to boiler feedwater pre-heating in the calculator. It is modelled at <b>0.50 L/L milk</b>, <b>35 C</b>, and runs as a continuous 24-hour pre-heat load.
      </div>`;
  }
  document.getElementById("processDiagramBody").innerHTML = `
    <div class="diagram-wrap">
      <div class="diagram-image-box">
        <img src="${diagram.src}?t=${Date.now()}" alt="${diagram.title}"
          onerror="this.style.display='none';document.getElementById('processDiagramMissing').style.display='block';"/>
        ${extraHtml}
      </div>
      <div id="processDiagramMissing" class="note" style="display:none;">Diagram image not found at <code>${diagram.src}</code>.</div>
      ${industry === "dairy_farm" ? `<div class="note" style="margin-top:8px;">The red outline highlights the boiler. Click it for the calculator mapping.</div>` : ``}
    </div>`;
  const modal = document.getElementById("processDiagramModal");
  modal.style.display = "flex"; modal.setAttribute("aria-hidden","false");
}

function closeProcessDiagram(){
  const modal = document.getElementById("processDiagramModal");
  modal.style.display = "none"; modal.setAttribute("aria-hidden","true");
}

function toggleDairyBoilerHotspot(){
  const note = document.getElementById("dairyBoilerNote");
  if (!note) return;
  note.style.display = note.style.display === "none" ? "block" : "none";
}

function openProcessUsage(ev, processKey){
  if (ev) ev.preventDefault();
  if (!CURRENT_PROCESS_DETAIL) return;
  const met = CURRENT_PROCESS_DETAIL.met || [];
  const processByHour = CURRENT_PROCESS_DETAIL.processByHour || {};
  const arr = processByHour[processKey];
  if (!Array.isArray(arr) || !arr.length) return;

  const label = (CURRENT_PROCESS_DETAIL.processLabels && CURRENT_PROCESS_DETAIL.processLabels[processKey]) || processKey;
  const profileType = CURRENT_PROCESS_DETAIL.profileType || "continuous";
  const profileLabel = profileType === "mon_fri" ? "5 days/week (Mon-Fri)" : "Continuously active (24/7)";
  const usageRanges = getProcessUsageRanges(arr, met);
  const usageText = usageRanges.length ? usageRanges.join(" | ") : "No active usage periods detected.";

  document.getElementById("processUsageTitle").textContent = `${label} - usage and yearly demand`;
  document.getElementById("processUsageBody").innerHTML = `
    <p style="margin:0 0 6px 0;"><b>Operating profile:</b> ${profileLabel}</p>
    <p style="margin:0 0 6px 0;"><b>Periods of day in use:</b> ${usageText}</p>
    <p class="note" style="margin:0 0 8px 0;">Percent values indicate how often those hours are active across the year.</p>
    ${build8760DemandChart(arr, met, "Yearly hourly thermal demand (8760)")}`;
  const modal = document.getElementById("processUsageModal");
  modal.style.display = "flex"; modal.setAttribute("aria-hidden","false");
}

function closeProcessUsage(){
  const modal = document.getElementById("processUsageModal");
  modal.style.display = "none"; modal.setAttribute("aria-hidden","true");
}

// ================================================================
//  TMY LOADING & LOCATION
// ================================================================
let LOAD_REQUEST_SEQ = 0;

// ----------------------------------------------------------------
//  CER CLIMATE ZONE — nearest-zone lookup (display only, no algorithm)
// ----------------------------------------------------------------
// avgC / swingC are each zone city's climate fingerprint: day-weighted annual
// average dry-bulb and max-minus-min monthly swing, derived from the TMYx .stat
// files in validation2/ (the same climates the BC-Aus zone constants were fitted to).
// Zone matching prefers climate similarity over geographic distance: Perth is
// ~2,000 km from every anchor city, but its climate matches Sydney (zone 3),
// not Alice Springs (zone 1). Swing matters as much as average — Alice Springs
// and Rockhampton share an annual average but differ 7°C in seasonal swing.
const CER_ZONE_CENTRES = [
  { key: "zone1", name: "Zone 1 — Alice Springs",  lat: -23.698, lon: 133.881, avgC: 21.6, swingC: 17.5 },
  { key: "zone2", name: "Zone 2 — Rockhampton",    lat: -23.379, lon: 150.510, avgC: 22.2, swingC: 10.1 },
  { key: "zone3", name: "Zone 3 — Sydney",          lat: -33.869, lon: 151.209, avgC: 18.0, swingC: 10.0 },
  { key: "zone4", name: "Zone 4 — Melbourne",       lat: -37.814, lon: 144.963, avgC: 14.1, swingC: 10.8 },
  { key: "zone5", name: "Zone 5 — Canberra",        lat: -35.281, lon: 149.130, avgC: 12.7, swingC: 14.8 },
];

// Annual average + monthly swing of ambient temperature for the loaded site.
function siteClimateStats(met){
  const monthly = getAmbientMonthlyAverages(met).map(m => m.avgC).filter(Number.isFinite);
  if (monthly.length < 12) return null;
  const valid = met.map(r => r.ta).filter(isFiniteNumber);
  if (!valid.length) return null;
  return {
    avgC: valid.reduce((a,b)=>a+b,0) / valid.length,
    swingC: Math.max(...monthly) - Math.min(...monthly)
  };
}

function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestCERZone(lat, lon, met){
  // Climate similarity when TMY weather is loaded; geographic distance as the
  // fallback before weather arrives (display only — T_mains always has weather).
  const stats = (Array.isArray(met) && met.length) ? siteClimateStats(met) : null;
  let nearest = null, minScore = Infinity;
  for (const z of CER_ZONE_CENTRES){
    const score = stats
      ? Math.abs(stats.avgC - z.avgC) + Math.abs(stats.swingC - z.swingC)
      : haversineKm(lat, lon, z.lat, z.lon);
    if (score < minScore){ minScore = score; nearest = z; }
  }
  return { zone: nearest, score: minScore, usedClimate: !!stats, siteStats: stats };
}

function isTestingMode(){
  return document.getElementById("chkHideMains")?.checked ?? false;
}

function onTestingModeChange(){
  const testingMode = isTestingMode();
  document.body.classList.toggle("testing-mode", testingMode);

  const mainsEl = document.getElementById("mainsTempDisplay");
  if (mainsEl) mainsEl.style.display = testingMode ? "" : "none";

  const el = document.getElementById("cerZoneDisplay");
  if (!el) return;
  if (!testingMode){
    el.style.display = "none";
    return;
  }
  if (window._cerZoneState) updateCERZoneDisplay(window._cerZoneState.lat, window._cerZoneState.lon, window._cerZoneState.countryCode);
}

function toggleAnnualDetails(button){
  const card = button.closest(".output-card-annual");
  const panel = card?.querySelector(".annual-detail-panel");
  if (!panel) return;
  const willShow = panel.hidden;
  panel.hidden = !willShow;
  button.setAttribute("aria-expanded", String(willShow));
  button.textContent = willShow ? "Hide detailed results" : "Show detailed results";
}

function toggleIndustryDetails(button){
  const card = button.closest(".output-card-industry");
  const panel = card?.querySelector(".industry-detail-panel");
  if (!panel) return;
  const willShow = panel.hidden;
  panel.hidden = !willShow;
  button.setAttribute("aria-expanded", String(willShow));
  button.textContent = willShow ? "Hide detailed industry results" : "Show detailed industry results";
}

function updateCERZoneDisplay(lat, lon, countryCode){
  window._cerZoneState = { lat, lon, countryCode };
  const el = document.getElementById("cerZoneDisplay");
  if (!el) return;
  // The non-Australia warning always shows — the BC-Aus mains model and CER zone
  // lookup are only calibrated for Australia. Zone chips remain testing-mode only.
  if (countryCode && countryCode !== "au"){
    el.textContent = "⚠ Warning: The selected location does not appear to be in Australia. The CER climate zone lookup and BC-Aus model are only valid for Australian locations.";
    el.style.background = "#fff3cd";
    el.style.borderColor = "#f0ad4e";
    el.style.color = "#7a4f00";
    el.style.display = "block";
    return;
  }
  if (!isTestingMode()){ el.style.display = "none"; return; }
  const { zone: nearest, usedClimate, siteStats } = findNearestCERZone(lat, lon, CURRENT_MET);
  const items = CER_ZONE_CENTRES.map(z => {
    const detail = usedClimate
      ? `ΔT̄ ${Math.abs(siteStats.avgC - z.avgC).toFixed(1)}°C · Δswing ${Math.abs(siteStats.swingC - z.swingC).toFixed(1)}°C`
      : `${haversineKm(lat, lon, z.lat, z.lon).toFixed(0)} km away`;
    const isNearest = z.key === nearest.key;
    const style = isNearest
      ? "padding:4px 10px;border-radius:4px;background:#e8f4e8;border:1px solid #a3c9a3;color:#1a4d1a;font-weight:600;"
      : "padding:4px 10px;border-radius:4px;background:#f5f5f5;border:1px solid #ddd;color:#555;";
    return `<div style="${style}">${z.name} (${detail})</div>`;
  }).join("");
  const method = usedClimate
    ? `matched by climate similarity — site annual avg ${siteStats.avgC.toFixed(1)}°C, seasonal swing ${siteStats.swingC.toFixed(1)}°C`
    : "matched by distance (load TMY weather for climate-based matching)";
  el.style.background = "transparent";
  el.style.borderColor = "transparent";
  el.style.color = "inherit";
  el.style.display = "block";
  el.innerHTML = `<div style="font-size:11px;font-weight:600;color:#444;margin-bottom:5px;">CER Climate Zone <span style="font-weight:400;">(${method})</span></div><div style="display:flex;flex-direction:column;gap:4px;">${items}</div>`;
}

function showLocationMap(lat, lon){
  const mapDiv = document.getElementById("locationMap");
  if (!mapDiv) return;
  const bbox = `${(lon-0.05).toFixed(6)},${(lat-0.05).toFixed(6)},${(lon+0.05).toFixed(6)},${(lat+0.05).toFixed(6)}`;
  mapDiv.innerHTML = `<iframe
    src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lon.toFixed(6)}"
    width="100%" height="220" style="border:0;display:block;" loading="lazy"
    title="Location map" referrerpolicy="no-referrer"></iframe>`;
  mapDiv.style.display = "block";
}

function setLocationConfirm(loc, tzInfo, tzPending){
  const tzDisplay = tzPending
    ? "loading..."
    : getTimezoneDisplay(tzInfo);
  const dataState = (CURRENT_MET && CURRENT_MET.length)
    ? ` — ✓ TMY weather loaded (${CURRENT_MET.length.toLocaleString()} hourly records)`
    : " — loading TMY weather… (a first fetch can take up to a minute)";
  document.getElementById("locConfirm").textContent =
    `Location: ${loc.name} (lat=${loc.lat.toFixed(6)}, lon=${loc.lon.toFixed(6)}), Timezone: ${tzDisplay}${dataState}`;
  updateCERZoneDisplay(loc.lat, loc.lon, loc.countryCode);
}

async function loadTMYByAddress(){
  const requestSeq = ++LOAD_REQUEST_SEQ;
  const addr = document.getElementById("addressInput").value;
  const loc = await geocodeAddress(addr);
  if (requestSeq !== LOAD_REQUEST_SEQ) return;

  CURRENT_LOC = loc;
  CURRENT_MET = null; CURRENT_MAINS = null; CURRENT_TZ = null;
  updateMainsDisplay();
  setLocationConfirm(loc, null, true);
  showLocationMap(loc.lat, loc.lon);

  const raw = await fetchTMY(loc.lat, loc.lon);
  if (requestSeq !== LOAD_REQUEST_SEQ) return;

  CURRENT_MET = normalizeTMYRecords(raw);
  CURRENT_MAINS = calculateLocalTMains(CURRENT_MET, loc.lat, loc.lon);
  CURRENT_TZ = normalizeTimezoneInfo(raw); // tz ships with the TMY response
  setLocationConfirm(loc, CURRENT_TZ, !CURRENT_TZ);
  updateMainsDisplay();
}

async function loadTMYFromUI(){
  const addr = (document.getElementById("addressInput")?.value || "").trim();
  if (!addr) throw new Error("Please input an address first.");
  await loadTMYByAddress();
}

// ================================================================
//  INDUSTRY UI
// ================================================================
function updateProcessDiagramVisibility(industryKey){
  const button = document.getElementById("btnOpenProcessDiagram");
  const diagram = INDUSTRY_DIAGRAMS[industryKey];
  if (diagram){
    button.style.visibility = "visible";
    button.title = diagram.title;
  } else {
    button.style.visibility = "hidden";
    button.removeAttribute("title");
  }
}

function revealPanel(el, display="block", delayMs=0){
  el.style.display = display;
  el.classList.remove("reveal");
  void el.offsetHeight;
  el.style.animationDelay = delayMs + "ms";
  el.classList.add("reveal");
}

function syncAquaticProcessInputs(){
  const inputByProcess = {
    indoor_pool: "aquaticIndoorArea",
    outdoor_pool: "aquaticOutdoorArea",
    kids_pool: "aquaticKidsArea",
    sauna: "aquaticSaunaArea"
  };
  document.querySelectorAll(".aquatic-process-toggle").forEach(cb => {
    const input = document.getElementById(inputByProcess[cb.value]);
    if (!input) return;
    input.disabled = !cb.checked;
    input.classList.toggle("aquatic-area-disabled", !cb.checked);
  });
}

function showProcessCheckboxes(industryKey){
  const panel = document.getElementById("processPanel");
  const profilePanel = document.getElementById("profilePanel");
  const container = document.getElementById("processChecks");
  container.innerHTML = "";
  updateProcessDiagramVisibility(industryKey);
  updateProfileTypeRules(industryKey);
  const processes = INDUSTRY_PROCESSES[industryKey];
  if (!processes){ panel.style.display="none"; profilePanel.style.display="none"; return; }
  if (industryKey === "aquatic_centres"){
    syncAquaticProcessInputs();
    revealPanel(profilePanel, "block", 0);
    panel.style.display = "none";
    return;
  }
  for (const [key, proc] of Object.entries(processes)){
    const div = document.createElement("div");
    div.className = "process-check";
    const labelMatch = proc.label.match(/^(.*?)(\s*\(kWater\s*=\s*[\d.]+\))$/);
    const baseName = labelMatch ? labelMatch[1] : proc.label;
    const kWaterPart = labelMatch ? labelMatch[2] : "";
    div.innerHTML = `<label><input type="checkbox" value="${key}" checked /><span>${baseName}<span class="kwater-label">${kWaterPart}</span></span></label>`;
    container.appendChild(div);
  }
  revealPanel(profilePanel, "block", 0);
  revealPanel(panel, "block", 120);
}

function getSelectedProcessKeys(){
  if (document.getElementById("industrySelect")?.value === "aquatic_centres"){
    return Array.from(document.querySelectorAll('.aquatic-process-toggle'))
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }
  const allChecks = Array.from(document.querySelectorAll('#processChecks input[type=checkbox]'));
  const selected = allChecks.filter(cb => cb.checked).map(cb => cb.value);
  if (selected.length || !allChecks.length) return selected;
  allChecks.forEach(cb => { cb.checked = true; });
  return allChecks.map(cb => cb.value);
}

function strikeText(text){
  return Array.from(text).map(ch => (ch === " " ? " " : `${ch}\u0336`)).join("");
}

function updateProfileTypeRules(industryKey){
  const profileType = document.getElementById("profileType");
  const continuousOption = profileType?.querySelector('option[value="continuous"]');
  const monFriOption = profileType?.querySelector('option[value="mon_fri"]');
  const note = document.getElementById("profileTypeNote");
  if (!profileType || !continuousOption || !monFriOption || !note) return;

  continuousOption.textContent = "Continuously active (24/7)";
  monFriOption.disabled = false;
  monFriOption.textContent = "5 days/week (Mon-Fri)";
  monFriOption.style.textDecoration = "";
  monFriOption.style.color = "";
  note.style.display = "none";
  note.textContent = "";

  if (industryKey === "aquatic_centres"){
    continuousOption.textContent = "Standard operating hours (6 AM - 10 PM)";
    monFriOption.textContent = "Weekday-focused operation";
    if (profileType.value !== "mon_fri") profileType.value = "continuous";
    note.style.display = "block";
    note.textContent = "For aquatic centres, profile type controls pool open hours, makeup-water timing, and when the optional cover is treated as active.";
  } else if (industryKey === "dairy_farm"){
    profileType.value = "continuous";
    monFriOption.disabled = true;
    monFriOption.textContent = `${strikeText("5 days/week (Mon-Fri)")} (dairies operate 365 days/year)`;
    monFriOption.style.color = "#666";
  } else if (industryKey === "brewery"){
    profileType.value = "continuous";
    monFriOption.disabled = true;
    monFriOption.textContent = `${strikeText("5 days/week (Mon-Fri)")} (brewery weekday scaling not yet applied)`;
    monFriOption.style.color = "#666";
    note.style.display = "none";
    note.textContent = "";
  }
}

function syncIndustrySelectionUI(industryKey, resetThroughput=false){
  showProcessCheckboxes(industryKey);
  const ui = INDUSTRY_UI[industryKey];
  const lbl = document.getElementById("throughputLabel");
  const inp = document.getElementById("throughputInput");
  const hotelPanel = document.getElementById("hotelInputsPanel");
  const aquaticPanel = document.getElementById("aquaticInputsPanel");

  if (hotelPanel){
    if (industryKey === "hotel"){ revealPanel(hotelPanel, "block", 100); }
    else { hotelPanel.style.display = "none"; }
  }
  if (aquaticPanel){
    if (industryKey === "aquatic_centres"){ revealPanel(aquaticPanel, "block", 100); }
    else { aquaticPanel.style.display = "none"; }
  }

  if (ui){
    if (industryKey === "hotel" || industryKey === "aquatic_centres"){
      lbl.style.display = "none";
      inp.style.display = "none";
    } else {
      lbl.textContent = ui.throughput;
      if (resetThroughput || !String(inp.value || "").trim()){
        inp.value = ui.defaultVal;
      }
      lbl.style.display = "";
      inp.style.display = "";
      lbl.classList.remove("reveal"); void lbl.offsetHeight;
      lbl.style.animationDelay = "100ms"; lbl.classList.add("reveal");
      inp.classList.remove("reveal"); void inp.offsetHeight;
      inp.style.animationDelay = "100ms"; inp.classList.add("reveal");
    }
  } else {
    lbl.style.display = "none";
    inp.style.display = "none";
  }
}

// ================================================================
//  "HOW IT WORKS" FLOW CHART
//  A clickable overview of the data flow: where the weather comes
//  from, and how the supply side and demand side meet in the middle.
// ================================================================
const HOW_IT_WORKS_DETAIL = {
  address: {
    title: "1. Your address",
    body: "You type any Australian street address, suburb, or postcode into the calculator. This locates the site so the correct solar resource and climate zone are fetched automatically.",
    inputs: ["Street address, suburb, or postcode"],
    outputs: ["Address string passed to the geocoding service"]
  },
  geocoding: {
    title: "2. Geocoding",
    body: "The address text is sent to OpenStreetMap's free Nominatim API, which converts it to a latitude/longitude coordinate pair. No manual coordinate entry is needed. The resolved location is confirmed on screen before the weather data is fetched.",
    inputs: ["Address text string"],
    outputs: ["Latitude (°)", "Longitude (°)"],
    buildMiniSvg: () => buildMiniSvg_geocoding()
  },
  weather: {
    title: "3. Weather download",
    body: "Coordinates are passed to the PVGIS API — first via a local FastAPI server, then via the hosted Render fallback if the local server is not running. PVGIS returns a Typical Meteorological Year (TMY) assembled from multi-year satellite observations. The first hosted request may take ~1 minute while the server cold-starts.",
    inputs: ["Latitude", "Longitude"],
    outputs: ["8,760 hourly rows: GHI (W/m²), DHI (W/m²), Ta (°C), wind (m/s)"],
    buildMiniSvg: () => buildMiniSvg_weather()
  },
  records: {
    title: "8,760 hourly weather records",
    body: "Every hour of a typical year carries four measured values from the TMY dataset. All downstream steps — solar geometry, panel output, and energy matching — run independently once for each of these 8,760 hours.",
    inputs: ["PVGIS TMY dataset for the site location"],
    outputs: ["Global horizontal irradiance GHI (W/m²)", "Diffuse irradiance DHI (W/m²)", "Ambient air temperature Ta (°C)", "Wind speed u (m/s)"]
  },
  "solar-geo": {
    title: "4a. Solar geometry & irradiance",
    body: "For each hour the sun's altitude and azimuth are calculated from site latitude and time of year. The collector's tilt and surface azimuth are used with a transposition model to convert horizontal irradiance into irradiance on the tilted panel surface (GTI), accounting for direct beam, sky diffuse, and ground-reflected components.",
    inputs: ["Hour of year", "Site latitude/longitude", "Collector tilt angle (°)", "Surface azimuth angle (°)", "Ground albedo (0–1)"],
    outputs: ["GTI — irradiance on tilted panel surface (W/m²)"],
    buildMiniSvg: () => buildMiniSvg_solarGeo()
  },
  "mains-temp": {
    title: "4b. Mains water temperature",
    body: "The BC-Aus model predicts hourly cold mains water temperature using the NREL Burch–Christensen sinusoidal method, refitted to AS/NZS 4234 Australian climate zones. Temperature varies by month and location rather than being fixed, giving a realistic heat demand baseline.",
    inputs: ["Site climate zone (1–5)", "Month of year", "BC-Aus zone constants"],
    outputs: ["Hourly mains water temperature Tmains (°C)"]
  },
  "pvt-model": {
    title: "5a. PVT panel model",
    body: "Two thermal models are available. Model A uses a simple linear efficiency equation based on inlet temperature. Model B implements the full ISO 9806 Eq.12, iterating Newton's method to converge on the mean fluid temperature across the collector. Both compute hourly electrical and thermal energy from the same PVT panel.",
    inputs: ["GTI (W/m²)", "Inlet temperature Tin (°C)", "Ambient temperature Ta (°C)", "Wind speed (m/s)", "Model coefficients"],
    outputs: ["Hourly electrical energy kWh_el", "Hourly thermal yield kWh_th"],
    buildMiniSvg: () => buildMiniSvg_pvtModel()
  },
  "load-profiles": {
    title: "5b. Industry load profiles",
    body: "Hourly heat and electricity demand schedules are generated for the selected industry — dairy, brewery, hotel, or aquatic centre. Each profile reflects realistic operating hours, seasonal demand patterns, and process temperatures calibrated to Australian commercial conditions.",
    inputs: ["Industry type", "Collector area m² (scales demand totals)", "Mains water temperature (from BC-Aus model)"],
    outputs: ["Hourly heat demand Q_demand (kWh)", "Hourly electricity demand E_demand (kWh)"]
  },
  matching: {
    title: "6. Hour-by-hour energy matching",
    body: "Each of the 8,760 hours is balanced independently. PVT thermal output covers heat demand first — any shortfall is met by the gas boiler. PV electricity covers electrical demand first — any surplus is exported to the grid. Hourly matching captures the real mismatch between solar availability and demand rather than masking it with annual averages.",
    inputs: ["Hourly PVT thermal output (kWh)", "Hourly PV electrical output (kWh)", "Hourly heat demand (kWh)", "Hourly electricity demand (kWh)"],
    outputs: ["Solar heat used on-site (kWh/yr)", "Gas boiler top-up (kWh/yr)", "PV self-consumed (kWh/yr)", "Grid export / import (kWh/yr)"],
    buildMiniSvg: () => buildMiniSvg_matching()
  },
  results: {
    title: "7. Results",
    body: "Annual totals are summed across all 8,760 hours and converted to economics using the tariff and gas price inputs. Payback and NPV use the Capital Recovery Factor over the system lifetime. Thermal savings assume 100% utilisation of PVT heat output — see footnotes.",
    inputs: ["Annual energy flows (kWh)", "Electricity tariff (¢/kWh)", "Gas price ($/GJ)", "System cost, lifetime, discount rate"],
    outputs: ["Annual PV + thermal yield (kWh)", "Bill savings ($/yr)", "Simple payback (years)", "NPV ($)", "CO₂-e avoided (t/yr)"]
  }
};

function buildFlowSvg(W, H, drawFn){
  const parts = [];
  const box = (x, y, w, h, lines, fill="#f4f9ff", stroke="#7da7cf", textColor="#16202b") => {
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);
    const lineH = 15;
    const startY = y + h/2 - ((lines.length-1)*lineH)/2 + 4.5;
    lines.forEach((t, i) => {
      const weight = i === 0 ? "600" : "400";
      const size = i === 0 ? 12 : 11;
      parts.push(`<text x="${x+w/2}" y="${startY+i*lineH}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${textColor}">${t}</text>`);
    });
  };
  const arrow = (x1, y1, x2, y2) => {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a6e80" stroke-width="1.3" marker-end="url(#mArrow)"/>`);
  };
  const lbl = (x, y, text, color="#1565c0") => {
    parts.push(`<text x="${x}" y="${y}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${text}</text>`);
  };
  drawFn(box, arrow, lbl);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;margin:12px auto 0;" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="mArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#5a6e80"/></marker></defs>
    ${parts.join("")}
  </svg>`;
}

function buildMiniSvg_geocoding(){
  return buildFlowSvg(360, 182, (box, arrow) => {
    box(40, 10, 280, 38, ["Your address text"]);
    arrow(180, 48, 180, 66);
    box(40, 68, 280, 44, ["Nominatim API", "(OpenStreetMap geocoding service)"]);
    arrow(180, 112, 180, 130);
    box(40, 132, 280, 40, ["Latitude + Longitude"], "#eef6ff", "#7da7cf");
  });
}

function buildMiniSvg_weather(){
  return buildFlowSvg(400, 248, (box, arrow) => {
    box(50, 10, 300, 38, ["Latitude + Longitude"], "#eef6ff", "#7da7cf");
    arrow(200, 48, 200, 66);
    box(50, 68, 300, 50, ["PVGIS API request", "local FastAPI server → hosted Render fallback"]);
    arrow(200, 118, 200, 136);
    box(50, 138, 300, 40, ["Satellite observation database"]);
    arrow(200, 178, 200, 196);
    box(50, 198, 300, 40, ["8,760 TMY hourly rows"], "#eef6ff", "#7da7cf");
  });
}

function buildMiniSvg_solarGeo(){
  return buildFlowSvg(400, 308, (box, arrow) => {
    box(50, 10, 300, 38, ["Hour of year + site latitude"]);
    arrow(200, 48, 200, 66);
    box(50, 68, 300, 38, ["Sun altitude + azimuth"]);
    arrow(200, 106, 200, 124);
    box(50, 126, 300, 38, ["Collector tilt · azimuth · ground albedo"]);
    arrow(200, 164, 200, 182);
    box(50, 184, 300, 46, ["Transposition model", "direct + sky diffuse + ground-reflected"]);
    arrow(200, 230, 200, 250);
    box(50, 252, 300, 40, ["GTI on tilted panel surface (W/m²)"], "#eef6ff", "#7da7cf");
  });
}

function buildMiniSvg_pvtModel(){
  return buildFlowSvg(520, 306, (box, arrow, lbl) => {
    box(110, 10, 300, 38, ["GTI · Tin · Ta · wind · coefficients"]);
    arrow(260, 48, 260, 76);
    box(160, 78, 200, 36, ["Select thermal model"], "#fffbe6", "#d9c25c");
    arrow(160, 96, 100, 136);
    arrow(360, 96, 420, 136);
    lbl(100, 128, "Model A");
    lbl(420, 128, "Model B");
    box(18, 138, 164, 62, ["Simple linear η_th", "uses inlet temp Tin", "directly"], "#f4f9ff", "#7da7cf");
    box(338, 138, 164, 62, ["ISO 9806 Eq.12", "Newton iteration", "→ mean temp Tm"], "#f4f9ff", "#7da7cf");
    arrow(100, 200, 185, 246);
    arrow(420, 200, 335, 246);
    box(120, 248, 280, 46, ["kWh electricity + kWh heat per hour"], "#eef6ff", "#7da7cf");
  });
}

function buildMiniSvg_matching(){
  return buildFlowSvg(520, 252, (box, arrow) => {
    box(20, 10, 216, 40, ["Thermal output this hour (kWh)"], "#f4f9ff", "#7da7cf");
    box(284, 10, 216, 40, ["PV electricity this hour (kWh)"], "#f4f9ff", "#7da7cf");
    arrow(128, 50, 128, 86);
    arrow(392, 50, 392, 86);
    box(20, 88, 216, 52, ["Covers heat demand?", "shortfall → gas boiler tops up"], "#f2fbf6", "#8fc9a6");
    box(284, 88, 216, 52, ["Covers elec demand?", "surplus → exported to grid"], "#f2fbf6", "#8fc9a6");
    arrow(128, 140, 205, 192);
    arrow(392, 140, 315, 192);
    box(160, 194, 200, 46, ["Annual totals", "→ savings · CO₂-e avoided"], "#fffbe6", "#d9c25c");
  });
}

function openHowItWorksStep(stepId){
  const step = HOW_IT_WORKS_DETAIL[stepId];
  if (!step) return;
  document.getElementById("howItWorksStepTitle").textContent = step.title;

  const ioCol = (heading, items, color) => !items?.length ? "" : `
    <div style="flex:1;min-width:170px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${color};margin-bottom:6px;">${heading}</div>
      <ul style="margin:0;padding:0 0 0 16px;font-size:12px;line-height:1.75;color:#2c3a4a;">${items.map(i=>`<li>${i}</li>`).join("")}</ul>
    </div>`;

  const ioBlock = (step.inputs?.length || step.outputs?.length) ? `
    <div style="display:flex;gap:20px;flex-wrap:wrap;background:#f8fafc;border:1px solid #d6e4ef;border-radius:8px;padding:12px 16px;margin:12px 0 14px;">
      ${ioCol("Key inputs", step.inputs, "#1565c0")}
      ${ioCol("Key outputs", step.outputs, "#1d8a5f")}
    </div>` : "";

  const miniSvgBlock = step.buildMiniSvg ? `
    <div style="background:#f4f8fb;border:1px solid #d0dce8;border-radius:8px;padding:14px 12px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5a7080;margin-bottom:4px;">Process flow</div>
      ${step.buildMiniSvg()}
    </div>` : "";

  document.getElementById("howItWorksStepBody").innerHTML = `
    <p style="font-size:13px;line-height:1.65;color:#1a2a38;margin:0 0 4px;">${step.body}</p>
    ${ioBlock}${miniSvgBlock}`;

  const modal = document.getElementById("howItWorksStepModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

function closeHowItWorksStep(){
  const modal = document.getElementById("howItWorksStepModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden","true");
  const b = document.getElementById("howItWorksStepBody");
  if (b) b.innerHTML = "";
}

function buildHowItWorksSvg(){
  const W = 860, H = 820;
  const parts = [];

  const box = (x, y, w, h, lines, fill, stroke, textColor="#16202b", titleLine=0, stepId="") => {
    const stepAttr = stepId ? ` data-step="${stepId}"` : "";
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${stepAttr}/>`);
    const lineH = 16;
    const startY = y + h/2 - ((lines.length-1)*lineH)/2 + 5;
    lines.forEach((t, i) => {
      const weight = i === titleLine ? "700" : "400";
      const size = i === titleLine ? 13 : 11.5;
      parts.push(`<text x="${x+w/2}" y="${startY + i*lineH}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${textColor}" style="pointer-events:none">${t}</text>`);
    });
  };
  const arrow = (x1, y1, x2, y2, label="") => {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a6e80" stroke-width="1.6" marker-end="url(#flowArrow)"/>`);
    if (label) parts.push(`<text x="${(x1+x2)/2 + 8}" y="${(y1+y2)/2}" font-size="10.5" fill="#5a6e80">${label}</text>`);
  };

  // Top: shared data pipeline
  box(290, 14, 280, 44, ["1. Your address", "typed into the calculator"], "#fdfdfd", "#9fb4c6", "#16202b", 0, "address");
  arrow(430, 58, 430, 86);
  box(290, 88, 280, 44, ["2. Geocoding", "OpenStreetMap → latitude / longitude"], "#fdfdfd", "#9fb4c6", "#16202b", 0, "geocoding");
  arrow(430, 132, 430, 160);
  box(250, 162, 360, 56, ["3. Weather download", "TMY API (local or hosted) pulls a typical", "year from the PVGIS satellite database"], "#fdfdfd", "#9fb4c6", "#16202b", 0, "weather");
  arrow(430, 218, 430, 248);
  box(250, 250, 360, 48, ["8,760 hourly weather records", "sunshine · air temperature · wind"], "#eef6ff", "#7da7cf", "#16202b", 0, "records");

  // Split — long clean diagonals
  arrow(340, 298, 190, 382);
  arrow(520, 298, 670, 382);

  // Column headings
  parts.push(`<text x="190" y="408" text-anchor="middle" font-size="12" font-weight="700" fill="#1565c0" letter-spacing="1">SOLAR SUPPLY</text>`);
  parts.push(`<text x="670" y="408" text-anchor="middle" font-size="12" font-weight="700" fill="#1d8a5f" letter-spacing="1">SITE DEMAND</text>`);

  // Left column: SUPPLY
  box(40, 422, 300, 66, ["4a. Solar geometry", "tilt, azimuth and albedo turn sun position", "into irradiance on the collector"], "#f4f9ff", "#7da7cf", "#16202b", 0, "solar-geo");
  arrow(190, 488, 190, 520);
  box(40, 522, 300, 66, ["5a. PVT panel model", "PV efficiency → electricity (kWh)", "thermal model → useful heat (kWh)"], "#f4f9ff", "#7da7cf", "#16202b", 0, "pvt-model");

  // Right column: DEMAND
  box(520, 422, 300, 66, ["4b. Mains water temperature", "BC-Aus model (NREL method refitted to", "AS/NZS 4234 Australian climate zones)"], "#f2fbf6", "#8fc9a6", "#16202b", 0, "mains-temp");
  arrow(670, 488, 670, 520);
  box(520, 522, 300, 66, ["5b. Industry load profiles", "dairy / brewery / hotel / aquatic schedules", "→ hourly heat + electricity demand"], "#f2fbf6", "#8fc9a6", "#16202b", 0, "load-profiles");

  // Converge
  arrow(190, 588, 348, 642);
  arrow(670, 588, 512, 642);
  box(290, 644, 280, 60, ["6. Hour-by-hour matching", "every hour: solar covers demand first;", "boiler + grid cover the rest; spare PV exports"], "#fffbe6", "#d9c25c", "#16202b", 0, "matching");
  arrow(430, 704, 430, 734);
  box(250, 736, 360, 68, ["7. Results", "annual energy, bill savings, payback,", "solar fractions and CO₂-e avoided"], "#0f4f34", "#0c3f2a", "#ffffff", 0, "results");

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><marker id="flowArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#5a6e80"/></marker></defs>
      <style>rect[data-step]{cursor:pointer;transition:opacity 0.15s,stroke-width 0.15s;}rect[data-step]:hover{opacity:0.82;}rect[data-step].active{stroke-width:2.6px;}</style>
      ${parts.join("")}
    </svg>`;
}

function openHowItWorks(ev){
  if (ev) ev.preventDefault();
  document.getElementById("mainsChartTitle").textContent = "How the PVT Calculator works";
  const body = document.getElementById("mainsChartBody");
  body.innerHTML = buildHowItWorksSvg() +
    `<p style="text-align:center;font-size:11.5px;color:#6a7e8e;margin:10px 0 0;">Click any box to explore that step in detail</p>`;

  body.querySelectorAll("rect[data-step]").forEach(rect => {
    rect.addEventListener("click", () => {
      body.querySelectorAll("rect[data-step]").forEach(r => r.classList.remove("active"));
      rect.classList.add("active");
      openHowItWorksStep(rect.dataset.step);
    });
  });

  const modal = document.getElementById("mainsChartModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden","false");
}

// ================================================================
//  SHARED INDUSTRY RESULT BLOCKS
//  One implementation of the savings / balance tables and the chart
//  set used by all four industries, so wording and maths can't drift
//  between branches.
// ================================================================
const NATURAL_GAS_KG_CO2E_PER_GJ = 51.4; // NGA Factors 2025, scope 1 stationary energy

function buildSavingsTable(opts){
  // CO2 avoided = on-site solar electricity x grid factor, plus the gas the
  // boiler no longer burns (heat / boiler efficiency) x gas factor.
  const gasGJ = (Math.max(0, opts.solarHeatUsedKWh || 0) * 3.6 / (opts.boilerEff || 1)) / 1000;
  const co2Tonnes = (
    Math.max(0, opts.solarElecUsedKWh || 0) * (opts.gridEmissionFactor || 0) +
    gasGJ * NATURAL_GAS_KG_CO2E_PER_GJ
  ) / 1000;
  return `
        <table class="result-table" style="margin-bottom:12px;">
          <tr><th colspan="2">Savings (Current Estimate)</th></tr>
          <tr><td>Thermal fuel savings (gas displaced at ${(opts.boilerEff*100).toFixed(0)}% boiler efficiency)</td><td class="num">$${formatSummaryWhole(opts.thermalFuelSavingsAud)} AUD/yr</td></tr>
          <tr><td>Electricity bill savings from PV used on site</td><td class="num">$${formatSummaryWhole(opts.electricalSavingsAud)} AUD/yr</td></tr>
          <tr><td>Feed-in electricity export value</td><td class="num">$${formatSummaryWhole(opts.exportSavingsAud)} AUD/yr</td></tr>
          <tr><td><b>Total industry savings counted</b></td><td class="num"><b>$${formatSummaryWhole(opts.totalSavingsAud)} AUD/yr</b></td></tr>
          <tr><td>Estimated CO&#8322;-e avoided (on-site PV + displaced gas, NGA Factors 2025)</td><td class="num">${co2Tonnes.toFixed(1)} t/yr</td></tr>
        </table>`;
}

function buildHeatBalanceTable(title, demandMet, unmet, excess, solarFraction){
  return `
        <table class="result-table" style="margin-bottom:12px;">
          <tr><th colspan="2">${title}</th></tr>
          <tr><td>Heat demand met by solar</td><td class="num">${demandMet.toFixed(0)} kWh</td></tr>
          <tr><td>Heat still needed from boiler</td><td class="num">${unmet.toFixed(0)} kWh</td></tr>
          <tr><td>Unused solar heat</td><td class="num">${excess.toFixed(0)} kWh</td></tr>
          <tr><td>Share of heat demand covered by solar</td><td class="num">${(solarFraction*100).toFixed(1)}%</td></tr>
        </table>`;
}

function buildElecBalanceTable(totalRowLabel, totalKWh, metByPv, unmet, excess, solarFraction){
  return `
        <table class="result-table" style="margin-bottom:12px;">
          <tr><th colspan="2">Electricity Balance (hourly direct use)</th></tr>
          <tr><td>${totalRowLabel}</td><td class="num">${totalKWh.toFixed(0)} kWh</td></tr>
          <tr><td>Solar electricity used on site</td><td class="num">${metByPv.toFixed(0)} kWh</td></tr>
          <tr><td>Electricity still needed from grid</td><td class="num">${unmet.toFixed(0)} kWh</td></tr>
          <tr><td>PV electricity above hourly site demand (exported)</td><td class="num">${excess.toFixed(0)} kWh</td></tr>
          <tr><td>Share of electricity covered by PV</td><td class="num">${(solarFraction*100).toFixed(1)}%</td></tr>
        </table>`;
}

function buildStorageNote(solarFraction, storageUpperFraction){
  return `
        <div class="storage-note-banner">
          <div class="storage-note-content">
            <b class="storage-note-title">Notes</b>
            <ul>
              <li>No hot-water storage tank is included: solar heat only counts when it arrives in the same hour as demand.</li>
              <li>With ideal storage (every excess kWh kept and reused within the month), coverage could rise from ${(solarFraction*100).toFixed(1)}% to at most ${(storageUpperFraction*100).toFixed(1)}%.</li>
            </ul>
          </div>
        </div>`;
}

// The four monthly charts every industry shows. sharedScale puts all four
// series on a common axis; separate scales suit industries whose thermal and
// electrical magnitudes differ wildly (aquatic).
function buildIndustryChartSet(opts){
  const chartThermal = buildMonthlyBarChart(opts.thermalDatasets, opts.thermalTitle, "kWh");
  const chartElec = buildMonthlyBarChart(
    [{label:"Electrical demand", color:"#7b1fa2", monthly:opts.elecMonthly}], opts.elecTitle, "kWh");
  const all = [...opts.pvtMonthly, ...opts.thermMonthly, ...opts.pvMonthly, ...opts.elecMonthly].filter(isFiniteNumber);
  const commonMax = Math.max(...all, 0.01);
  const thermalMax = opts.sharedScale ? commonMax : Math.max(...[...opts.pvtMonthly, ...opts.thermMonthly].filter(isFiniteNumber), 0.01);
  const elecMax    = opts.sharedScale ? commonMax : Math.max(...[...opts.pvMonthly, ...opts.elecMonthly].filter(isFiniteNumber), 0.01);
  const chartSupply = buildSupplyDemandLineChart(opts.pvtMonthly, opts.thermMonthly,
    opts.supplyTitle || "Monthly PVT Thermal Supply vs Thermal Demand", 820, 260, {sameScale:true, fixedMax:thermalMax});
  const chartElecSupply = buildSupplyDemandLineChart(opts.pvMonthly, opts.elecMonthly,
    "Monthly PV Electrical Supply vs Electrical Demand", 820, 260, {
      supplyColor:"#1565c0", demandColor:"#8e24aa",
      supplyLabel:"PV Electrical Supply", demandLabel:"Electrical Demand",
      leftAxisLabel:"PV kWh", rightAxisLabel:"Demand kWh",
      sameScale:true, fixedMax:elecMax
    });
  return buildIndustryChartGroups(chartThermal, chartSupply, chartElec, chartElecSupply);
}

// ================================================================
//  MODEL COEFFICIENT DEFAULTS  (single source of truth for "reset")
// ================================================================
const DEFAULT_MODEL_COEFFS = {
  pvtA0: "0.279952866", pvtA1: "-10.52839866", pvtA2: "-0.008135537",
  isoEta0: "0.762", isoA1: "3.93", isoA2: "0.0095", isoA3: "0",
  isoA4: "0", isoA6: "0", isoA8: "0", isoTout0: "40", isoIterMax: "5"
};
const DEFAULT_SITE_SETTINGS = {
  tiltAngle: "30",
  azimuthAngle: "0",
  albedo: "0.2",
  flowRate: "0.02",
  etaPv: "0.20"
};
function resetCoeffs(ids){
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && DEFAULT_MODEL_COEFFS[id] != null){
      el.value = DEFAULT_MODEL_COEFFS[id];
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}
function resetModelACoeffs(){ resetCoeffs(["pvtA0","pvtA1","pvtA2"]); }
function resetModelBCoeffs(){ resetCoeffs(["isoEta0","isoA1","isoA2","isoA3","isoA4","isoA6","isoA8","isoTout0","isoIterMax"]); }
function resetSiteDefaults(){
  Object.entries(DEFAULT_SITE_SETTINGS).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el){
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

// ================================================================
//  MAIN CALCULATION
// ================================================================
async function calcAnnualPVT(){
  const btnAnnual = document.getElementById("btnAnnual");
  try {
    btnAnnual.disabled = true;
    document.getElementById("calcHint").style.display = "inline";
    resetExportActions();
    syncInstalledCostInputs();

    // 1) Read inputs
    const tiltAngle    = parseFloat(document.getElementById("tiltAngle").value);
    const azimuthAngle = parseFloat(document.getElementById("azimuthAngle").value);
    const albedo       = parseFloat(document.getElementById("albedo").value);
    const A            = parseFloat(document.getElementById("area").value);
    const flowRate     = parseFloat(document.getElementById("flowRate").value);
    const etaPv        = parseFloat(document.getElementById("etaPv").value);
    // Optional PV temperature correction (comparison only — does not affect economics).
    // NOCT cell-temperature model + power temperature coefficient, like PVWatts.
    const pvTempCorrEnable = !!document.getElementById("pvTempCorrEnable")?.checked;
    const pvTempCoeffPerC  = (parseFloat(document.getElementById("pvTempCoeff")?.value) || 0) / 100; // %/degC -> per degC
    const PV_NOCT_C = 45;
    const a0           = parseFloat(document.getElementById("pvtA0").value);
    const a1           = parseFloat(document.getElementById("pvtA1").value);
    const a2           = parseFloat(document.getElementById("pvtA2").value);
    const electricityPrice = Math.max(0, parseFloat(document.getElementById("electricityPrice").value) || 0);
    const feedInTariff    = Math.max(0, parseFloat(document.getElementById("feedInTariffInput").value) || 0);
    const gasPrice        = Math.max(0, parseFloat(document.getElementById("gasPriceInput").value) || 0);
    // Gas displaced by solar heat = heat / boiler efficiency (a boiler burns more
    // fuel than the heat it delivers), so savings are heat x 3.6 MJ/kWh / eta x AUD/MJ.
    const boilerEff       = clamp(parseFloat(document.getElementById("boilerEffInput").value) || 0.85, 0.5, 1);
    const gridEmissionFactor = Math.max(0, parseFloat(document.getElementById("gridEmissionFactor")?.value) || 0.62);
    const capexPerM2   = Math.max(0, parseFloat(document.getElementById("capexInput").value) || 800);
    const opexRate     = (Math.max(0, parseFloat(document.getElementById("opexRateInput").value) || 1.5)) / 100;
    const systemLife   = Math.max(1, parseInt(document.getElementById("systemLifeInput").value) || 25);
    const discountRate = (Math.max(0, parseFloat(document.getElementById("discountRateInput").value) || 6)) / 100;
    const thermalModel = document.querySelector('input[name="thermalModel"]:checked')?.value || 'A';
    const isoEta0    = parseFloat(document.getElementById("isoEta0").value) || 0.762;
    const isoA1      = parseFloat(document.getElementById("isoA1").value) || 3.93;
    const isoA2      = parseFloat(document.getElementById("isoA2").value) || 0.0095;
    const isoA3      = parseFloat(document.getElementById("isoA3").value) || 0;
    const isoA4      = parseFloat(document.getElementById("isoA4").value) || 0;
    const isoA6      = parseFloat(document.getElementById("isoA6").value) || 0;
    const isoA8      = parseFloat(document.getElementById("isoA8").value) || 0;
    const isoTout0   = parseFloat(document.getElementById("isoTout0").value) || 40;
    const isoIterMax = Math.max(1, parseInt(document.getElementById("isoIterMax").value) || 5);
    const SIGMA = 5.67e-8;

    const needed = [tiltAngle, azimuthAngle, albedo, A, flowRate, etaPv, a0, a1, a2];
    if (needed.some(v => !isFiniteNumber(v))){ setOutput("Please fill in all inputs with valid numbers.", true); return; }
    if (A <= 0){ setOutput("Collector / PV area must be greater than 0 m\u00b2.", true); return; }
    if (tiltAngle < 0 || tiltAngle > 90){ setOutput("Tilt angle must be between 0\u00b0 (horizontal) and 90\u00b0 (vertical).", true); return; }
    if (azimuthAngle < -180 || azimuthAngle > 180){ setOutput("Surface azimuth must be between \u2212180\u00b0 and 180\u00b0 (0\u00b0 = north-facing, 90\u00b0 = east, 180\u00b0/\u2212180\u00b0 = south).", true); return; }
    if (albedo < 0 || albedo > 1){ setOutput("Ground albedo must be between 0 and 1 (typical grass/roof \u2248 0.2).", true); return; }
    if (!(flowRate > 0)){ setOutput("Flow rate must be greater than 0 L/s/m\u00b2 \u2014 a PVT collector needs coolant flow to capture heat (typical \u2248 0.02).", true); return; }
    if (etaPv < 0 || etaPv > 1){ setOutput("PV efficiency must be between 0 and 1.", true); return; }

    const totalFlow_kg_hr = flowRate * A * 3600;

    // 2) Ensure TMY loaded
    if (!CURRENT_MET || !CURRENT_LOC) await loadTMYFromUI();
    const latitude  = CURRENT_LOC.lat;
    const longitude = CURRENT_LOC.lon;
    const met = CURRENT_MET;

    if (!CURRENT_MAINS){
      CURRENT_MAINS = calculateLocalTMains(met, latitude, longitude);
      updateMainsDisplay();
    }
    if (!met || !met.length){ setOutput("TMY contains no usable records.", true); return; }

    // 3) Calculate supply
    const calculator = new TiltedSurfaceRadiation(latitude, longitude, tiltAngle, azimuthAngle, albedo);
    let E_pv_kWh = 0, E_th_kWh = 0, E_pv_tc_kWh = 0;
    const out = [];
    out.push(["dayN","hourN","gtilt_Wm2","eta_th","pv_kWh","th_kWh","totalFlow_kg_hr","Tout_C"].join(","));
    let used = 0;
    const pvtThermalHourly = [];
    const pvElectricHourly = [];

    for (const r of met){
      if (![r.dayN,r.hourN,r.dni,r.dhi,r.ta,r.vwind].every(isFiniteNumber)) continue;

      // Solar geometry uses true solar time when the backend provides it; otherwise
      // falls back to local-clock hourN (older backend). Demand scheduling below still
      // uses r.hourN (clock time) as before.
      const solarH = isFiniteNumber(r.solarHour) ? r.solarHour : r.hourN;
      const res = calculator.calculate(r.dayN, solarH, r.dni, r.dhi);
      const G   = Math.max(0, res.totalIrradiance);
      const Tin = CURRENT_MAINS.byDay[r.dayN] ?? CURRENT_MAINS.annualAvgC;

      let etaTh = 0, th_W = 0;
      const pv_kWh = (etaPv * G * A) / 1000;

      // Comparison-only temperature-corrected PV (NOCT cell temp + power coefficient).
      let pv_kWh_tc = pv_kWh;
      if (pvTempCorrEnable && G > 1e-6){
        const Tcell  = r.ta + ((PV_NOCT_C - 20) / 800) * G;     // deg C
        const factor = 1 + pvTempCoeffPerC * (Tcell - 25);      // 1 at 25 deg C cell
        pv_kWh_tc = pv_kWh * Math.max(0, factor);
      }
      E_pv_tc_kWh += pv_kWh_tc;

      if (thermalModel === 'A') {
        // Model A: simple linear
        if (G > 1e-6){ etaTh = a0 + a1 * ((Tin - r.ta) / G) + a2 * r.vwind; etaTh = clamp(etaTh, 0, 1); }
        th_W = etaTh * G * A;
      } else {
        // Model B: ISO 9806 Eq.12 with Newton iteration
        const Ta_K = r.ta + 273.15;
        const Ta4  = SIGMA * Math.pow(Ta_K, 4);            // black-body flux at ambient temp
        // Sky long-wave irradiance E_L. TMY carries no measured E_L, so use Swinbank's
        // clear-sky estimate L_down = 5.31e-13 * Ta_K^6 (W/m^2). (E_L - sigma*Ta^4) is then
        // negative, i.e. a net radiative loss to the sky. Only active when a4 (isoA4) > 0.
        const EL   = 5.31e-13 * Math.pow(Ta_K, 6);
        const u    = r.vwind || 0;
        if (G > 1e-6 && totalFlow_kg_hr > 1e-12) {
          const mdot_cp = (totalFlow_kg_hr / 3600) * 4184; // W/K
          let Tout_iter = isoTout0;
          for (let iter = 0; iter < isoIterMax; iter++) {
            const Tm  = (Tin + Tout_iter) / 2;
            const dT  = Tm - r.ta;
            const Q_model = A * (isoEta0 * G
                               - isoA1 * dT
                               - isoA2 * dT * dT
                               - isoA3 * u  * dT
                               + isoA4 * (EL - Ta4)
                               - isoA6 * u  * G
                               - isoA8 * Math.pow(dT, 4));
            const Q_flow  = mdot_cp * (Tout_iter - Tin);
            const dQm_dTout = A * (-isoA1 * 0.5 - isoA2 * dT - isoA3 * u * 0.5 - isoA8 * 2 * Math.pow(dT, 3));
            const step = (Q_flow - Q_model) / (mdot_cp - dQm_dTout);
            Tout_iter -= step;
            if (Math.abs(step) < 1e-4) break;
          }
          const Tm_f = (Tin + Tout_iter) / 2;
          const dT_f = Tm_f - r.ta;
          th_W = Math.max(0, A * (isoEta0 * G
                                  - isoA1 * dT_f
                                  - isoA2 * dT_f * dT_f
                                  - isoA3 * u  * dT_f
                                  + isoA4 * (EL - Ta4)
                                  - isoA6 * u  * G
                                  - isoA8 * Math.pow(dT_f, 4)));
          etaTh = (G * A > 1e-6) ? clamp(th_W / (G * A), 0, 1) : 0;
        }
      }

      const th_kWh = th_W / 1000;

      pvtThermalHourly.push(th_kWh);
      pvElectricHourly.push(pv_kWh);

      const hourlyFlow = (th_kWh > 1e-12) ? totalFlow_kg_hr : "";
      E_pv_kWh += pv_kWh;
      E_th_kWh += th_kWh;

      let Tout_C = "";
      if (th_kWh > 1e-12 && totalFlow_kg_hr > 1e-12){
        Tout_C = Tin + (th_kWh * 3600) / (totalFlow_kg_hr * 4.184);
      }

      out.push([r.dayN, r.hourN + 1, G.toFixed(2), etaTh.toFixed(2), pv_kWh.toFixed(2), th_kWh.toFixed(2),
        (hourlyFlow === "" ? "" : (+hourlyFlow).toFixed(2)),
        (Tout_C === "" ? "" : (+Tout_C).toFixed(2))].join(","));
      used++;
    }

    if (used === 0){ setOutput("No valid numeric rows found in the TMY records.", true); return; }

    // 4) Build supply-side results HTML
    const capex            = capexPerM2 * A;
    const annualSavingPV   = E_pv_kWh * electricityPrice;
    // Useful solar heat displaces boiler gas: kWh_th ->(x3.6) MJ_heat ->(/boilerEff) MJ_fuel
    // ->(xgasPrice) AUD. Same formula as the demand-matched industry section, applied to the
    // full supply. This credits 100% utilisation of BOTH streams (the PV term already assumes
    // 100% self-consumption), so the supply card is an explicit upper bound, not demand-matched.
    const annualSavingHeat = (E_th_kWh * 3.6 / boilerEff) * gasPrice;
    const opexAnnual       = capex * opexRate;
    const netAnnualBenefit = annualSavingPV + annualSavingHeat - opexAnnual;
    const N = systemLife;
    const CRF = discountRate > 1e-9
      ? discountRate * Math.pow(1 + discountRate, N) / (Math.pow(1 + discountRate, N) - 1)
      : 1 / N;
    // f_th2e converts thermal kWh to electrical-equivalent kWh for the CAPEX split only.
    // = 1 treats 1 kWh of heat as equal in value to 1 kWh of electricity (a simplifying
    // assumption, NOT an exergy/quality weighting). Affects only the PV/thermal CAPEX share.
    const f_th2e      = 1;
    const totalEnergyEq = E_pv_kWh + E_th_kWh * f_th2e;
    const pvShare     = totalEnergyEq > 1e-9 ? E_pv_kWh / totalEnergyEq : 0.5;
    const thShare     = 1 - pvShare;
    const lcoe        = E_pv_kWh > 1e-9 ? (capex * pvShare * CRF + opexAnnual * pvShare) / E_pv_kWh : null;
    const lcoh        = E_th_kWh > 1e-9 ? (capex * thShare * CRF + opexAnnual * thShare) / E_th_kWh : null;
    const lcoeCombo   = totalEnergyEq > 1e-9 ? (capex * CRF + opexAnnual) / totalEnergyEq : null;
    const spp         = netAnnualBenefit > 1e-9 ? capex / netAnnualBenefit : null;
    const npv         = discountRate > 1e-9
      ? -capex + netAnnualBenefit * (1 - Math.pow(1 + discountRate, -N)) / discountRate
      : -capex + netAnnualBenefit * N;
    const totalEnergy    = E_pv_kWh + E_th_kWh;
    const fmtNumber = (v, d=2) => Number(v).toLocaleString(undefined, { minimumFractionDigits:d, maximumFractionDigits:d });
    const fmtE = (v, d=2, unit='') => v != null ? `${fmtNumber(v, d)}${unit ? ' '+unit : ''}` : '&mdash;';
    const fmtC = (v) => v != null ? `$${fmtNumber(v, 2)}` : '&mdash;';
    // Temperature-correction comparison strings (only when the toggle is on).
    const pvTcDeltaPct = (pvTempCorrEnable && E_pv_kWh > 1e-9) ? (E_pv_tc_kWh / E_pv_kWh - 1) * 100 : 0;
    const pvTcSign = pvTcDeltaPct >= 0 ? '+' : '';
    const pvTcBox = pvTempCorrEnable
      ? `<div class="annual-summary-item annual-tempcorr">
          <span>PV (temp-corrected)</span>
          <strong>${fmtE(E_pv_tc_kWh,1,'kWh')}</strong>
          <small>Uncooled-equivalent &middot; ${pvTcSign}${pvTcDeltaPct.toFixed(1)}%</small>
        </div>`
      : '';
    const pvTcDetailRow = pvTempCorrEnable
      ? `<tr><td><b>PV Energy (temp-corrected, &gamma;=${(pvTempCoeffPerC*100).toFixed(2)}%/&deg;C)</b></td><td class="num"><span class="ok">${fmtE(E_pv_tc_kWh,1,'kWh')}</span> <span style="color:#b35900;">(${pvTcSign}${pvTcDeltaPct.toFixed(1)}%)</span></td></tr>`
      : '';
    let html = `
      <div class="output-card output-card-annual" style="position:relative;">
      <div class="annual-card-head">
        <div>
          <div class="annual-kicker">Hourly annual summary</div>
          <h3>Annual PVT Results</h3>
          <p class="annual-location"><b>Location:</b> ${escapeHtml(CURRENT_LOC.name)} (lat=${latitude.toFixed(6)}, lon=${longitude.toFixed(6)})</p>
        </div>
      </div>
      <div class="annual-summary-grid">
        <div class="annual-summary-item">
          <span>PV electricity</span>
          <strong>${fmtE(E_pv_kWh,1,'kWh')}</strong>
          <small>Annual electrical yield</small>
        </div>
        <div class="annual-summary-item">
          <span>PVT thermal</span>
          <strong>${fmtE(E_th_kWh,1,'kWh')}</strong>
          <small>Annual thermal yield</small>
        </div>
        <div class="annual-summary-item">
          <span>Total output</span>
          <strong>${fmtE(totalEnergy,1,'kWh')}</strong>
          <small>Electrical + thermal combined</small>
        </div>
        <div class="annual-summary-item annual-finance ${netAnnualBenefit>=0?'':'negative'}">
          <span>PVT supply value</span>
          <strong>${fmtC(netAnnualBenefit)} /yr</strong>
          <small>Upper-bound annual value (100% utilisation)</small>
        </div>
        ${pvTcBox}
      </div>
      <div class="annual-actions">
        <button type="button" class="detail-toggle" onclick="toggleAnnualDetails(this)" aria-expanded="false">Show detailed results</button>
        <span class="note">Open for economics, levelised costs, and calculation detail.</span>
      </div>
      <div class="annual-detail-panel" hidden>
      <h4 style="margin:4px 0 6px;color:#1a5276;">Energy Detail</h4>
      <table class="result-table">
        <tr><td><b>PV Energy</b></td><td class="num"><span class="ok">${fmtE(E_pv_kWh,1,'kWh')}</span></td></tr>
        ${pvTcDetailRow}
        <tr><td><b>Thermal Energy (PVT model)</b></td><td class="num"><span class="ok">${fmtE(E_th_kWh,1,'kWh')}</span></td></tr>
        <tr><td><b>Total Energy</b></td><td class="num"><span class="ok">${fmtE(totalEnergy,1,'kWh')}</span></td></tr>
      </table>
      <h4 style="margin:14px 0 6px;color:#1a5276;">Economic Analysis</h4>
      <table class="result-table">
        <tr><td><b>CAPEX</b> (${fmtE(capexPerM2,0,'AUD/m\u00B2')} &times; ${fmtE(A,1,'m\u00B2')})</td><td class="num">${fmtC(capex)}</td></tr>
        <tr><td><b>OPEX (annual)</b></td><td class="num">${fmtC(opexAnnual)} /yr</td></tr>
        <tr><td><b>Annual Electricity Saving</b></td><td class="num"><span class="ok">${fmtC(annualSavingPV)} /yr</span></td></tr>
        <tr><td><b>Annual Heat Saving</b> (gas displaced @ ${(boilerEff*100).toFixed(0)}% boiler)</td><td class="num"><span class="ok">${fmtC(annualSavingHeat)} /yr</span></td></tr>
        <tr><td><b>Annual Net Benefit</b></td><td class="num"><span class="${netAnnualBenefit>=0?'ok':'err'}">${fmtC(netAnnualBenefit)} /yr</span></td></tr>
        <tr><td><b>Simple Payback Period (SPP)</b></td><td class="num">${spp != null ? fmtE(spp,1,'years') : '&mdash;'}</td></tr>
        <tr><td><b>NPV (${N} yr @ ${fmtE(discountRate*100,1,'%')})</b></td><td class="num"><span class="${npv>=0?'ok':'err'}">${fmtC(npv)}</span></td></tr>
      </table>
      <h4 style="margin:14px 0 6px;color:#1a5276;">Levelised Cost</h4>
      <table class="result-table">
        <tr><td><b>LCOE</b> (electricity only)</td><td class="num">${lcoe != null ? fmtC(lcoe)+' /kWh_e' : '&mdash;'}</td></tr>
        <tr><td><b>LCOH</b> (heat only)</td><td class="num">${lcoh != null ? fmtC(lcoh)+' /kWh_th' : '&mdash;'}</td></tr>
        <tr><td><b>Combined LCOE</b> (heat&rarr;electricity equiv.)</td><td class="num">${lcoeCombo != null ? fmtC(lcoeCombo)+' /kWh_eq' : '&mdash;'}</td></tr>
        <tr style="background:#fffbe6;"><td style="font-size:11px;color:#888;" colspan="2">
          CAPEX split: PV ${fmtE(pvShare*100,1,'%')} / Thermal ${fmtE(thShare*100,1,'%')} &nbsp;|&nbsp;
          CRF = ${fmtE(CRF,5)} &nbsp;|&nbsp; Heat-to-elec equiv. = ${fmtE(f_th2e,3)} (1 kWh heat valued as 1 kWh electricity for the split)
        </td></tr>
      </table>
      </div>
      </div>`;
    let industryHtml = "";

    CURRENT_PROCESS_DETAIL = null;
    CURRENT_EVAN_VIEW = null;

    // 5) Industry demand section
    const industry   = document.getElementById("industrySelect").value;
    const profileType = document.getElementById("profileType")?.value || "continuous";
    const profileLabels = { continuous:"Continuously active (24/7)", mon_fri:"5 days/week (Mon-Fri)" };

    if (industry === "dairy_farm" && INDUSTRY_UI[industry]){
      const ui = INDUSTRY_UI[industry];
      const throughput_L = getInputNumberValue("throughputInput");
      const selectedKeys = getSelectedProcessKeys();
      if (!isFiniteNumber(throughput_L) || throughput_L <= 0){
        setOutput("For the dairy calculation, enter a milk throughput greater than 0 L per year.", true); return;
      }
      if (!selectedKeys.length){
        setOutput("Select at least one dairy thermal process to calculate demand.", true); return;
      }
      const dairyProfileType = "continuous";

      const demand = calcDairyHourlyDemand(throughput_L, dairyProfileType, selectedKeys, met, CURRENT_MAINS);
      const { thermalHourly, electricHourly, processByHour } = demand;
      const totalThermal_kWh  = thermalHourly.reduce((s,v)=>s+(v||0),0);
      const totalElectric_kWh = electricHourly.reduce((s,v)=>s+(v||0),0);

      const thermalBalance = calculateHourlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const storageBound = calculateMonthlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const demandMet = thermalBalance.metBySupply;
      const unmet = thermalBalance.unmet;
      const excess = thermalBalance.excess;
      const solarFraction = thermalBalance.solarFraction;
      const elecBalance = calculateHourlyElectricityBalance(pvElectricHourly, electricHourly, met);
      const elecMetByPv = elecBalance.metByPv;
      const elecUnmet = elecBalance.unmet;
      const elecExcess = elecBalance.excess;
      const elecSolarFrac = elecBalance.solarFraction;
      const electricalSavingsAud = elecMetByPv * electricityPrice;
      const exportSavingsAud = elecExcess * feedInTariff;
      const thermalFuelSavingsAud = (demandMet * 3.6 / boilerEff) * gasPrice;
      const totalSavingsAud = electricalSavingsAud + exportSavingsAud + thermalFuelSavingsAud;

      const procLabels = {
        fatty_film_rinse: "Process A: Fatty Film Rinse (kWater = 0.30)",
        cip_preheating: "Process B: CIP Pre-heating (kWater = 0.57)",
        boiler_preheat: "Process C: Boiler Feedwater Pre-heating (kWater = 0.50)"
      };
      const procRowMeta = {
        fatty_film_rinse: { name: "Process A: Fatty Film Rinse", kWater: "0.30" },
        cip_preheating: { name: "Process B: CIP Pre-heating", kWater: "0.57" },
        boiler_preheat: { name: "Process C: Boiler Feedwater Pre-heating", kWater: "0.50" }
      };
      const procColors = { fatty_film_rinse:"#1976d2", cip_preheating:"#43a047", boiler_preheat:"#e65100" };

      const processRows = [];
      for (const key of selectedKeys){
        const arr = processByHour[key] || [];
        const tot = arr.reduce((s,v)=>s+(v||0),0);
        const meta = procRowMeta[key];
        const lbl = procLabels[key] || key;
        const usageRanges = getProcessUsageRanges(arr, met);
        const usageInline = usageRanges.length
          ? usageRanges.map(s => s.replace(/\s*\([^)]*\)\s*$/,"")).join(", ") : "No active hours";
        if (meta){
          processRows.push({ name: meta.name, rate: `${meta.kWater} L/L milk`, hours: describeUsageInline(usageInline), kWh: tot });
        } else {
          processRows.push({ name: lbl, rate: "Rate not specified", hours: describeUsageInline(usageInline), kWh: tot });
        }
      }

      CURRENT_PROCESS_DETAIL = { industry:"dairy_farm", profileType:dairyProfileType, met, processByHour, processLabels:procLabels };

      const pvtMonthly   = thermalBalance.supplyMonthly;
      const pvMonthly    = elecBalance.pvMonthly;
      const thermMonthly = thermalBalance.demandMonthly;
      const elecMonthly  = elecBalance.demandMonthly;

      const thermalDatasets = selectedKeys.map(k => ({
        label: procLabels[k]||k, color: procColors[k]||"#888",
        monthly: aggregateMonthly(processByHour[k]||[], met)
      }));
      const chartSet = buildIndustryChartSet({
        thermalDatasets, pvtMonthly, thermMonthly, pvMonthly, elecMonthly,
        thermalTitle: `Monthly Thermal Demand \u2014 ${profileLabels[dairyProfileType]}`,
        elecTitle: "Monthly Electrical Demand (Benchmark: 51.7 kWh/kL)",
        sharedScale: true
      });
      industryHtml += `
        <div class="output-card output-card-industry">
        ${buildIndustryPerformanceSummary({
          savingsAud: totalSavingsAud,
          solarHeatFraction: solarFraction,
          solarElecFraction: elecSolarFrac,
          unusedHeatKWh: excess,
          unusedElectricityKWh: elecExcess,
          areaM2: A,
          locationName: CURRENT_LOC?.name || "selected location"
        })}
        <div class="dairy-result-area">
          <div class="dairy-result-head">
            <div class="dairy-intro-card">
              <div class="dairy-kicker">Dairy load profile</div>
              <h3>Dairy Farm \u2014 ${profileLabels[dairyProfileType]}</h3>
              <div class="dairy-meta-row">
                <span class="dairy-meta-pill"><b>Milk throughput</b><strong>${(throughput_L/1000).toLocaleString(undefined,{maximumFractionDigits:0})} kL/yr</strong></span>
                <a class="dairy-shape-link" href="#" onclick="openDairyDailyShape(event)">Daily demand shape</a>
              </div>
            </div>
            <button type="button" class="industry-model-box dairy-model-box" onclick="openDairyModelBasis(event)">
              <b>Dairy Model Basis</b>
              <span>Calculation assumptions and research sources.</span>
            </button>
          </div>
          ${buildIndustryEnergyFlowSummary({
            thermalDemandKWh: totalThermal_kWh,
            solarHeatUsedKWh: demandMet,
            backupHeatNeededKWh: unmet,
            unusedHeatKWh: excess,
            electricDemandKWh: totalElectric_kWh,
            solarElectricUsedKWh: elecMetByPv,
            gridElectricityNeededKWh: elecUnmet,
            exportedElectricityKWh: elecExcess
          })}
        </div>
        <div class="industry-actions">
          <button type="button" class="detail-toggle" onclick="toggleIndustryDetails(this)" aria-expanded="false">Show detailed industry results</button>
          <span class="note">Open for process breakdown, balances, storage note, and charts.</span>
        </div>
        <div class="industry-detail-panel" hidden>
        ${buildProcessBreakdown(processRows, totalThermal_kWh)}
        ${buildStorageNote(solarFraction, storageBound.solarFraction)}
        ${buildHeatBalanceTable("Heat Balance (hourly direct use)", demandMet, unmet, excess, solarFraction)}
        ${buildElecBalanceTable("Total yearly electricity use (51.7 kWh/kL benchmark)", totalElectric_kWh, elecMetByPv, elecUnmet, elecExcess, elecSolarFrac)}
        ${buildSavingsTable({ boilerEff, gridEmissionFactor, solarHeatUsedKWh: demandMet, solarElecUsedKWh: elecMetByPv, thermalFuelSavingsAud, electricalSavingsAud, exportSavingsAud, totalSavingsAud })}
        <div class="industry-chart-group">
          ${chartSet}
        </div>
        </div>
        </div>`;

    } else if (industry === "brewery" && INDUSTRY_UI[industry]){
      const throughput_L = getInputNumberValue("throughputInput");
      const selectedKeys = getSelectedProcessKeys();
      if (!isFiniteNumber(throughput_L) || throughput_L <= 0){
        setOutput("For the brewery calculation, enter a beer production volume greater than 0 L per year.", true); return;
      }
      if (!selectedKeys.length){
        setOutput("Select at least one brewery thermal process to calculate demand.", true); return;
      }
      const breweryProfileType = "continuous";

      const demand = calcBreweryHourlyDemand(throughput_L, breweryProfileType, selectedKeys, met, CURRENT_MAINS);
      const { thermalHourly, electricHourly, processByHour } = demand;
      const totalThermal_kWh  = thermalHourly.reduce((s,v)=>s+(v||0),0);
      const totalElectric_kWh = electricHourly.reduce((s,v)=>s+(v||0),0);

      const thermalBalance = calculateHourlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const storageBound = calculateMonthlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const demandMet = thermalBalance.metBySupply;
      const unmet = thermalBalance.unmet;
      const excess = thermalBalance.excess;
      const solarFraction = thermalBalance.solarFraction;
      const elecBalance = calculateHourlyElectricityBalance(pvElectricHourly, electricHourly, met);
      const elecMetByPv = elecBalance.metByPv;
      const elecUnmet = elecBalance.unmet;
      const elecExcess = elecBalance.excess;
      const elecSolarFrac = elecBalance.solarFraction;
      const electricalSavingsAud = elecMetByPv * electricityPrice;
      const exportSavingsAud = elecExcess * feedInTariff;
      const thermalFuelSavingsAud = (demandMet * 3.6 / boilerEff) * gasPrice;
      const totalSavingsAud = electricalSavingsAud + exportSavingsAud + thermalFuelSavingsAud;

      const procLabels = {
        cip_prerinse: "Process A: CIP Pre-Rinse (kWater = 0.80)",
        bottle_keg_rinse: "Process B: Bottle/Keg Rinsing (kWater = 0.45)",
        boiler_preheat: "Process C: Boiler Feedwater Pre-heating (kWater = 0.60)"
      };
      const procRowMeta = {
        cip_prerinse: { name: "Process A: CIP Pre-Rinse", kWater: "0.80" },
        bottle_keg_rinse: { name: "Process B: Bottle/Keg Rinsing", kWater: "0.45" },
        boiler_preheat: { name: "Process C: Boiler Feedwater Pre-heating", kWater: "0.60" }
      };
      const procColors = BREWERY_PROCESS_COLORS;

      const processRows = [];
      for (const key of selectedKeys){
        const arr = processByHour[key] || [];
        const tot = arr.reduce((s,v)=>s+(v||0),0);
        const meta = procRowMeta[key];
        const lbl = procLabels[key] || key;
        const usageRanges = getProcessUsageRanges(arr, met);
        const usageInline = usageRanges.length
          ? usageRanges.map(s => s.replace(/\s*\([^)]*\)\s*$/,"")).join(", ") : "No active hours";
        if (meta){
          processRows.push({ name: meta.name, rate: `${meta.kWater} L/L beer`, hours: describeUsageInline(usageInline), kWh: tot });
        } else {
          processRows.push({ name: lbl, rate: "Rate not specified", hours: describeUsageInline(usageInline), kWh: tot });
        }
      }

      CURRENT_PROCESS_DETAIL = { industry:"brewery", profileType:breweryProfileType, met, processByHour, processLabels:procLabels };

      const pvtMonthly   = thermalBalance.supplyMonthly;
      const pvMonthly    = elecBalance.pvMonthly;
      const thermMonthly = thermalBalance.demandMonthly;
      const elecMonthly  = elecBalance.demandMonthly;

      const thermalDatasets = selectedKeys.map(k => ({
        label: procLabels[k]||k, color: procColors[k]||"#888",
        monthly: aggregateMonthly(processByHour[k]||[], met)
      }));
      const chartSet = buildIndustryChartSet({
        thermalDatasets, pvtMonthly, thermMonthly, pvMonthly, elecMonthly,
        thermalTitle: `Monthly Thermal Demand \u2014 ${profileLabels[breweryProfileType]}`,
        elecTitle: `Monthly Electrical Demand (Benchmark: ${BREWERY_ELEC_PARAMS.kWhPerHL.toFixed(2)} kWh/hL)`,
        sharedScale: true
      });

      industryHtml += `
        <div class="output-card output-card-industry">
        ${buildIndustryPerformanceSummary({
          savingsAud: totalSavingsAud,
          solarHeatFraction: solarFraction,
          solarElecFraction: elecSolarFrac,
          unusedHeatKWh: excess,
          unusedElectricityKWh: elecExcess,
          areaM2: A,
          locationName: CURRENT_LOC?.name || "selected location"
        })}
        <div class="industry-top-row">
          <div style="flex:1 1 420px;">
            <h3 style="margin:0 0 8px 0;">Brewery \u2014 ${profileLabels[breweryProfileType]}</h3>
            <p style="font-size:13px;margin:0 0 6px 0;"><b>Annual beer throughput:</b> ${(throughput_L/1000).toLocaleString(undefined,{maximumFractionDigits:0})} kL</p>
            <div class="mains-links" style="margin:6px 0 10px 0;">
              <a class="mains-link" href="#" onclick="openBreweryDailyShape(event)">Daily demand shape</a>
            </div>
          </div>
          <button type="button" class="industry-model-box" onclick="openBreweryModelBasis(event)">
            <b>Brewery Model Basis</b>
            <span>Click to view brewery-specific assumptions and research sources.</span>
          </button>
        </div>
        ${buildIndustryEnergyFlowSummary({
          thermalDemandKWh: totalThermal_kWh,
          solarHeatUsedKWh: demandMet,
          backupHeatNeededKWh: unmet,
          unusedHeatKWh: excess,
          electricDemandKWh: totalElectric_kWh,
          solarElectricUsedKWh: elecMetByPv,
          gridElectricityNeededKWh: elecUnmet,
          exportedElectricityKWh: elecExcess
        })}
        <div class="industry-actions">
          <button type="button" class="detail-toggle" onclick="toggleIndustryDetails(this)" aria-expanded="false">Show detailed industry results</button>
          <span class="note">Open for process breakdown, balances, storage note, and charts.</span>
        </div>
        <div class="industry-detail-panel" hidden>
        ${buildProcessBreakdown(processRows, totalThermal_kWh)}
        ${buildStorageNote(solarFraction, storageBound.solarFraction)}
        ${buildHeatBalanceTable("Heat Balance (hourly direct use)", demandMet, unmet, excess, solarFraction)}
        ${buildElecBalanceTable(`Total yearly electricity use (${BREWERY_ELEC_PARAMS.kWhPerHL.toFixed(2)} kWh/hL benchmark)`, totalElectric_kWh, elecMetByPv, elecUnmet, elecExcess, elecSolarFrac)}
        <p class="note" style="margin-top:6px;">Brewery demand uses its own seasonal factors, process water intensities, and schedule reasoning from brewery-specific references rather than the dairy model basis.</p>
        ${buildSavingsTable({ boilerEff, gridEmissionFactor, solarHeatUsedKWh: demandMet, solarElecUsedKWh: elecMetByPv, thermalFuelSavingsAud, electricalSavingsAud, exportSavingsAud, totalSavingsAud })}
        <div class="industry-chart-group">
          ${chartSet}
        </div>
        </div>
        </div>`;

    } else if (industry === "hotel" && INDUSTRY_UI[industry]){
      const rooms = getInputNumberValue("hotelRoomsInput");
      const occupancyPct = getInputNumberValue("hotelOccupancyInput");
      const tankVolumeLitres = getInputNumberValue("tankVolume");
      if (!isFiniteNumber(rooms) || rooms <= 0){
        setOutput("For hotel calculations, total available rooms must be greater than 0.", true);
        return;
      }
      if (!isFiniteNumber(occupancyPct) || occupancyPct < 0 || occupancyPct > 100){
        setOutput("For hotel calculations, occupancy rate must be between 0 and 100%.", true);
        return;
      }
      if (!isFiniteNumber(tankVolumeLitres) || tankVolumeLitres < 0){
        setOutput("For hotel calculations, thermal storage tank volume must be 0 litres or greater.", true);
        return;
      }

      const throughput = rooms * 365 * (occupancyPct / 100);
      const selectedKeys = getSelectedProcessKeys();
      const processes = INDUSTRY_PROCESSES[industry] || {};
      const hotelProfileLabel = profileType === "mon_fri" ? "5 days/week (Mon-Fri)" : "Continuously active (24/7)";

      const processAnnuals = {};
      let totalThermalDemandKWh = 0;
      for (const key of selectedKeys){
        const kWh = HOTEL_PROCESS_PARAMS[key]?.kWhPerUnit || 0;
        const annual = Math.max(0, throughput) * kWh;
        processAnnuals[key] = annual;
        totalThermalDemandKWh += annual;
      }

      const weightSums = {};
      for (const key of selectedKeys){
        weightSums[key] = hotelProcessWeightSum(key, profileType, met);
      }

      const thermalHourly = [];
      const processByHour = {};
      for (const key of selectedKeys) processByHour[key] = [];
      let demandMet=0, unmet=0, excess=0;

      for (let i = 0; i < met.length; i++){
        const r = met[i];
        const mIdx = monthFromDayN(r.dayN) - 1;
        let totalDemandThisHour = 0;
        for (const key of selectedKeys){
          const wSum = weightSums[key] || 1;
          const w = hotelProcessWeight(key, r.hourN, r.dayN, mIdx, profileType);
          const procDemand = (processAnnuals[key] || 0) * (w / wSum);
          processByHour[key].push(procDemand);
          totalDemandThisHour += procDemand;
        }
        thermalHourly.push(totalDemandThisHour);
        const sup = pvtThermalHourly[i] || 0;
        demandMet += Math.min(totalDemandThisHour, sup);
        unmet     += Math.max(0, totalDemandThisHour - sup);
        excess    += Math.max(0, sup - totalDemandThisHour);
      }
      let solarFraction = totalThermalDemandKWh > 0 ? demandMet / totalThermalDemandKWh : 0;
      let thermalSectionTitle = "Heat Balance (Detailed)";
      let tankCapacityKWh = 0;

      const storageResult = calculateThermalStorage({
        tank_volume_litres: tankVolumeLitres,
        pvt_supply_array: pvtThermalHourly,
        hotel_demand_array: thermalHourly,
        mains_temp: CURRENT_MAINS?.annualAvgC ?? 14
      });
      const totalUnmetDemandKWh = Number(storageResult?.total_unmet_demand_kwh) || 0;
      const totalExcessPvtKWh = Number(storageResult?.total_excess_pvt_kwh) || 0;
      tankCapacityKWh = Number(storageResult?.tank_capacity_kwh) || 0;
      demandMet = Math.max(0, totalThermalDemandKWh - totalUnmetDemandKWh);
      unmet = totalUnmetDemandKWh;
      excess = totalExcessPvtKWh;
      solarFraction = totalThermalDemandKWh > 0 ? ((Number(storageResult?.solar_fraction_pct) || 0) / 100) : 0;
      thermalSectionTitle = tankVolumeLitres > 0 ? "Heat Balance (with storage)" : "Heat Balance (no storage)";

      const totalElecDemandKWh = Math.max(0, throughput) * HOTEL_ELECTRICAL_KWH_PER_UNIT;
      let elecWSum = 0;
      for (const r of met){
        const h = Math.floor(r.hourN);
        const mIdx = monthFromDayN(r.dayN) - 1;
        elecWSum += (HOTEL_ELECTRICAL_HOURLY[h] || 1) * (HOTEL_ELECTRICAL_MONTHLY[mIdx] || 1);
      }
      const electricHourly = [];
      for (let i = 0; i < met.length; i++){
        const r = met[i];
        const h = Math.floor(r.hourN);
        const mIdx = monthFromDayN(r.dayN) - 1;
        const w = (HOTEL_ELECTRICAL_HOURLY[h] || 1) * (HOTEL_ELECTRICAL_MONTHLY[mIdx] || 1);
        const elecDemand = totalElecDemandKWh * (w / Math.max(1, elecWSum));
        electricHourly.push(elecDemand);
      }
      const elecBalance = calculateHourlyElectricityBalance(pvElectricHourly, electricHourly, met);
      const elecMetByPv = elecBalance.metByPv;
      const elecUnmet = elecBalance.unmet;
      const elecExcess = elecBalance.excess;
      const elecSolarFrac = elecBalance.solarFraction;
      const electricalSavingsAud = elecMetByPv * electricityPrice;
      const exportSavingsAud = elecExcess * feedInTariff;
      const thermalFuelSavingsAud = (demandMet * 3.6 / boilerEff) * gasPrice;
      const totalSavingsAud = electricalSavingsAud + exportSavingsAud + thermalFuelSavingsAud;

      const procLabels = {};
      for (const key of selectedKeys) procLabels[key] = (processes[key]?.label || HOTEL_PROCESS_SHORT_LABELS[key] || key);
      CURRENT_PROCESS_DETAIL = { industry:"hotel", profileType, met, processByHour, processLabels:procLabels };

      const processRows = [];
      for (const key of selectedKeys){
        const proc = processes[key];
        if (!proc) continue;
        const annual = processAnnuals[key] || 0;
        const arr = processByHour[key] || [];
        const usageRanges = getProcessUsageRanges(arr, met);
        const usageInline = usageRanges.length
          ? usageRanges.map(s => s.replace(/\s*\([^)]*\)\s*$/,"")).join(", ")
          : "All hours";
        const kWhPerUnit = HOTEL_PROCESS_PARAMS[key]?.kWhPerUnit;
        processRows.push({
          name: proc.label,
          rate: isFiniteNumber(kWhPerUnit) ? `${kWhPerUnit.toFixed(2)} kWh/occupied room-night` : "Rate not specified",
          hours: describeUsageInline(usageInline),
          kWh: annual
        });
      }

      const pvtMonthly   = aggregateMonthly(pvtThermalHourly, met);
      const pvMonthly    = elecBalance.pvMonthly;
      const thermMonthly = aggregateMonthly(thermalHourly, met);
      const elecMonthly  = elecBalance.demandMonthly;

      const thermalDatasets = selectedKeys.map(k => ({
        label: HOTEL_PROCESS_SHORT_LABELS[k]||k, color: HOTEL_PROCESS_COLORS[k]||"#888",
        monthly: aggregateMonthly(processByHour[k]||[], met)
      }));
      const chartSet = buildIndustryChartSet({
        thermalDatasets, pvtMonthly, thermMonthly, pvMonthly, elecMonthly,
        thermalTitle: `Monthly Thermal Demand \u2014 ${hotelProfileLabel}`,
        elecTitle: `Monthly Electrical Demand (${HOTEL_ELECTRICAL_KWH_PER_UNIT} kWh/room-night)`,
        sharedScale: true
      });

      industryHtml += `
        <div class="output-card output-card-industry">
        ${buildIndustryPerformanceSummary({
          savingsAud: totalSavingsAud,
          solarHeatFraction: solarFraction,
          solarElecFraction: elecSolarFrac,
          unusedHeatKWh: excess,
          unusedElectricityKWh: elecExcess,
          areaM2: A,
          locationName: CURRENT_LOC?.name || "selected location"
        })}
        <h3>Hotel \u2014 ${hotelProfileLabel}</h3>
        ${buildIndustryEnergyFlowSummary({
          thermalDemandKWh: totalThermalDemandKWh,
          solarHeatUsedKWh: demandMet,
          backupHeatNeededKWh: unmet,
          unusedHeatKWh: excess,
          unusedHeatNote: "Excess PVT thermal after storage matching.",
          electricDemandKWh: totalElecDemandKWh,
          solarElectricUsedKWh: elecMetByPv,
          gridElectricityNeededKWh: elecUnmet,
          exportedElectricityKWh: elecExcess
        })}
        <div class="industry-actions">
          <button type="button" class="detail-toggle" onclick="toggleIndustryDetails(this)" aria-expanded="false">Show detailed industry results</button>
          <span class="note">Open for process breakdown, balances, storage note, and charts.</span>
        </div>
        <div class="industry-detail-panel" hidden>
        <p style="font-size:13px;"><b>Total available rooms:</b> ${rooms.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
        <p style="font-size:13px;"><b>Occupancy rate:</b> ${occupancyPct.toFixed(2)}%</p>
        <p style="font-size:13px;"><b>Occupied room-nights per year:</b> ${throughput.toLocaleString(undefined,{maximumFractionDigits:0})}</p>
        <p style="font-size:13px;"><b>Tank volume:</b> ${tankVolumeLitres.toLocaleString(undefined,{maximumFractionDigits:0})} L${tankCapacityKWh > 0 ? ` (${tankCapacityKWh.toFixed(1)} kWh usable storage to 35&deg;C)` : ""}</p>
        <div class="mains-links" style="margin:6px 0 10px 0;">
          <a class="mains-link" href="#" onclick="openHotelDailyShape(event)">Daily demand shape</a>
          <a class="mains-link" href="#" onclick="openHotelProfileCompare(event)">24/7 vs Mon\u2013Fri comparison</a>
        </div>
        ${buildProcessBreakdown(processRows, totalThermalDemandKWh)}
        <p class="note" style="margin-top:6px;">Assumed specific thermal demand (kWh per occupied room-night): DHW 5.50, Kitchen 1.60, Laundry 1.20, Pool 0.80.</p>
        ${buildHeatBalanceTable(thermalSectionTitle, demandMet, unmet, excess, solarFraction)}
        ${buildElecBalanceTable(`Total yearly electricity use (${HOTEL_ELECTRICAL_KWH_PER_UNIT} kWh/room-night benchmark)`, totalElecDemandKWh, elecMetByPv, elecUnmet, elecExcess, elecSolarFrac)}
        ${buildSavingsTable({ boilerEff, gridEmissionFactor, solarHeatUsedKWh: demandMet, solarElecUsedKWh: elecMetByPv, thermalFuelSavingsAud, electricalSavingsAud, exportSavingsAud, totalSavingsAud })}
        <div class="industry-chart-group">
          ${chartSet}
        </div>
        </div>
        </div>`;

    } else if (industry === "aquatic_centres" && INDUSTRY_UI[industry]){
      const selectedKeys = getSelectedProcessKeys();
      const processes = INDUSTRY_PROCESSES[industry] || {};
      const areaInputs = getAquaticPoolAreaInputs();
      const coverEnabled = isInputChecked("aquaticPoolCover");
      const activeAquaticKeys = AQUATIC_PROCESS_STACK_ORDER.filter(k => selectedKeys.includes(k));
      const aquaticProfileLabel = profileType === "mon_fri"
        ? "Weekday-focused operation"
        : "Standard operating hours (6 AM - 10 PM)";
      if (!selectedKeys.length){
        setOutput("Select at least one aquatic-centre thermal process to calculate demand.", true);
        return;
      }
      for (const key of activeAquaticKeys){
        if (!isFiniteNumber(areaInputs[key]) || areaInputs[key] <= 0){
          const label = processes[key]?.label || AQUATIC_PROCESS_SHORT_LABELS[key] || key;
          setOutput(`For aquatic-centre calculations, enter a pool surface area greater than 0 for ${label}.`, true);
          return;
        }
      }

      const demand = calcAquaticHourlyDemand({
        met,
        activeProcesses: activeAquaticKeys,
        processAreas: areaInputs,
        profileType,
        coverEnabled,
        mainsTempC: CURRENT_MAINS?.annualAvgC ?? 15
      });
      const {
        thermalHourly,
        processByHour,
        processAnnuals,
        processAreas,
        processVolumesLitres,
        processBreakdownAnnuals,
        ambientAnnualAvg,
        totalAreaM2
      } = demand;
      const totalThermalDemandKWh = thermalHourly.reduce((sum, value) => sum + (value || 0), 0);
      const totalDerivedVolumeLitres = Object.values(processVolumesLitres || {}).reduce((sum, value) => sum + (value || 0), 0);

      const thermalBalance = calculateHourlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const storageBound = calculateMonthlyEnergyBalance(pvtThermalHourly, thermalHourly, met);
      const demandMet = thermalBalance.metBySupply;
      const unmet = thermalBalance.unmet;
      const excess = thermalBalance.excess;
      const solarFraction = thermalBalance.solarFraction;
      const thermalSectionTitle = "Heat Balance (hourly direct use, no storage)";
      const thermalFuelSavingsAud = (demandMet * 3.6 / boilerEff) * gasPrice;
      const totalAquaticElecKWh = totalAreaM2 * AQUATIC_ELEC_KWH_PER_M2_PER_YEAR;
      const aquaticElecHourly = buildAquaticElectricalHourlyDemand(totalAquaticElecKWh, thermalHourly, met);
      const aquaticElecBalance = calculateHourlyElectricityBalance(pvElectricHourly, aquaticElecHourly, met);
      const aquaticElecMetByPv = aquaticElecBalance.metByPv;
      const aquaticElecUnmet = aquaticElecBalance.unmet;
      const aquaticElecExcess = aquaticElecBalance.excess;
      const aquaticElecSolarFrac = aquaticElecBalance.solarFraction;
      const aquaticElectricalSavingsAud = aquaticElecMetByPv * electricityPrice;
      const aquaticExportSavingsAud = aquaticElecExcess * feedInTariff;
      const annualSavings = thermalFuelSavingsAud + aquaticElectricalSavingsAud + aquaticExportSavingsAud;
      const pvtRatedWp = Math.max(0, A * etaPv * 1000);
      const pvCapex = pvtRatedWp * PVT_CAPEX_PV_PER_W;
      const thermalCapex = pvtRatedWp * PVT_CAPEX_THERMAL_PER_W;
      const panelSubtotal = pvCapex + thermalCapex;
      const installedCapex = panelSubtotal * PVT_BOS_MULTIPLIER;
      const simplePaybackYears = annualSavings > 0 ? installedCapex / annualSavings : null;

      const procLabels = {};
      for (const key of activeAquaticKeys) procLabels[key] = (processes[key]?.label || AQUATIC_PROCESS_SHORT_LABELS[key] || key);
      CURRENT_PROCESS_DETAIL = { industry:"aquatic_centres", profileType, met, processByHour, processLabels:procLabels };

      const processRows = [];
      for (const key of activeAquaticKeys){
        const proc = processes[key];
        if (!proc) continue;
        const annual = processAnnuals[key] || 0;
        const areaM2 = processAreas[key] || 0;
        const volumeLitres = processVolumesLitres[key] || 0;
        const breakdown = processBreakdownAnnuals[key] || {};
        processRows.push({
          name: proc.label,
          rate: `${areaM2.toFixed(1)} m\u00B2`,
          hours: `Derived volume ${volumeLitres.toFixed(0)} L`,
          details: [
            `Evaporation ${(breakdown.evaporation || 0).toFixed(0)} kWh`,
            `Makeup water ${(breakdown.makeup || 0).toFixed(0)} kWh`,
            `Convective/radiative ${(breakdown.sensible || 0).toFixed(0)} kWh`
          ],
          kWh: annual
        });
      }

      const pvtMonthly = thermalBalance.supplyMonthly;
      const pvMonthly = aquaticElecBalance.pvMonthly;
      const thermMonthly = thermalBalance.demandMonthly;
      const elecMonthly = aquaticElecBalance.demandMonthly;
      const thermalDatasets = activeAquaticKeys.map(k => ({
        label: AQUATIC_PROCESS_SHORT_LABELS[k] || k,
        color: AQUATIC_PROCESS_COLORS[k] || "#888",
        monthly: aggregateMonthly(processByHour[k] || [], met)
      }));
      const chartSet = buildIndustryChartSet({
        thermalDatasets, pvtMonthly, thermMonthly, pvMonthly, elecMonthly,
        thermalTitle: `Monthly Aquatic Thermal Demand \u2014 ${aquaticProfileLabel}`,
        elecTitle: `Monthly Electrical Demand (Benchmark: ${AQUATIC_ELEC_KWH_PER_M2_PER_YEAR} kWh/m\u00b2/yr, seasonal)`,
        supplyTitle: "Monthly PVT Thermal Supply vs Aquatic Thermal Demand",
        sharedScale: false
      });
      const processChips = activeAquaticKeys.map(key => `
        <span class="process-chip">
          <span class="dot" style="background:${AQUATIC_PROCESS_COLORS[key] || "#999"};"></span>
          ${processes[key]?.label || key}
        </span>`).join("");

      industryHtml += `
        <div class="output-card output-card-industry">
        ${buildIndustryPerformanceSummary({
          savingsAud: annualSavings,
          solarHeatFraction: solarFraction,
          solarElecFraction: aquaticElecSolarFrac,
          unusedHeatKWh: excess,
          unusedElectricityKWh: aquaticElecExcess,
          areaM2: A,
          locationName: CURRENT_LOC?.name || "selected location"
        })}
        <h3>Aquatic Centre \u2014 Area-Based Heat Loss Model</h3>
        <div class="process-chip-row" style="margin:0 0 12px;">${processChips}</div>
        ${buildIndustryEnergyFlowSummary({
          thermalDemandKWh: totalThermalDemandKWh,
          solarHeatUsedKWh: demandMet,
          backupHeatNeededKWh: unmet,
          unusedHeatKWh: excess,
          electricDemandKWh: totalAquaticElecKWh,
          solarElectricUsedKWh: aquaticElecMetByPv,
          gridElectricityNeededKWh: aquaticElecUnmet,
          exportedElectricityKWh: aquaticElecExcess
        })}
        <div class="industry-actions">
          <button type="button" class="detail-toggle" onclick="toggleIndustryDetails(this)" aria-expanded="false">Show detailed industry results</button>
          <span class="note">Open for process breakdown, balances, storage note, and charts.</span>
        </div>
        <div class="industry-detail-panel" hidden>
        <p style="font-size:13px;"><b>Annual average ambient temperature:</b> ${ambientAnnualAvg.toFixed(1)}&deg;C</p>
        <p style="font-size:13px;"><b>Total entered pool area:</b> ${totalAreaM2.toFixed(1)} m&sup2;</p>
        <p style="font-size:13px;"><b>Derived water volume:</b> ${totalDerivedVolumeLitres.toLocaleString(undefined,{maximumFractionDigits:0})} L (used only as a secondary reference from default depths)</p>
        <p style="font-size:13px;"><b>Pool cover assumption:</b> ${coverEnabled ? "On during off-hours with a 60% evaporation reduction." : "No cover reduction applied."}</p>
        <div class="mains-links" style="margin:6px 0 10px 0;">
          <a class="mains-link" href="#" onclick="openAquaticDailyShape(event)">Daily demand shape</a>
        </div>
        <p class="note" style="margin:0 0 10px 0;">Aquatic demand is area-based and follows hourly evaporation, makeup-water heating, and convective/radiative heat loss from the loaded weather data.</p>
        ${buildProcessBreakdown(processRows, totalThermalDemandKWh)}
        ${buildStorageNote(solarFraction, storageBound.solarFraction)}
        ${buildHeatBalanceTable(thermalSectionTitle, demandMet, unmet, excess, solarFraction)}
        ${buildElecBalanceTable(`Total yearly electricity use (${AQUATIC_ELEC_KWH_PER_M2_PER_YEAR} kWh/m²/yr benchmark)`, totalAquaticElecKWh, aquaticElecMetByPv, aquaticElecUnmet, aquaticElecExcess, aquaticElecSolarFrac)}
        ${buildSavingsTable({ boilerEff, gridEmissionFactor, solarHeatUsedKWh: demandMet, solarElecUsedKWh: aquaticElecMetByPv, thermalFuelSavingsAud, electricalSavingsAud: aquaticElectricalSavingsAud, exportSavingsAud: aquaticExportSavingsAud, totalSavingsAud: annualSavings })}
        <div class="assumption-callout">
          <strong>Physics assumptions used</strong>
          Evaporation is modeled hourly from water temperature, air temperature, relative humidity when available from TMY, and wind speed. Makeup-water heating uses 18-30 L/m&sup2;/day depending on pool type, heated from local mains temperature to the pool setpoint. Convective and radiative losses are added with fixed U-values, and the cover toggle reduces off-hour evaporation by 60%.
        </div>
        <div class="industry-chart-group">
          ${chartSet}
        </div>
        </div>
        </div>`;

    } else if (industry && INDUSTRY_UI[industry]){
      const ui = INDUSTRY_UI[industry];
      const throughput = parseFloat(document.getElementById("throughputInput").value) || 0;
      const selectedKeys = getSelectedProcessKeys();
      const processes = INDUSTRY_PROCESSES[industry] || {};
      const processRows = [];
      for (const key of selectedKeys){
        const proc = processes[key];
        if (!proc) continue;
        processRows.push({
          name: proc.label,
          rate: "Process selected",
          hours: profileLabels[profileType] || "Continuously active (24/7)",
          kWh: null
        });
      }
      industryHtml += `
        <div class="output-card output-card-industry">
        <h3>Thermal Demand \u2014 ${ui.name}</h3>
        <p style="font-size:13px;">${ui.throughput.replace(':','')} <b>${throughput.toLocaleString()}</b></p>
        <p style="font-size:13px;"><b>Operating profile:</b> ${profileLabels[profileType] || "Continuously active (24/7)"}</p>
        ${buildProcessBreakdown(processRows, null)}
        <p class="note" style="margin-top:10px;"><b>Note:</b> Load profile calculations for ${ui.name} are under development.</p>
        </div>`;
    }

    setOutput(html);
    setIndustryOutput(industryHtml);
    renderCurrentEvanView();

    // 6) Chart.js supply charts
    const BASE_YEAR = new Date().getFullYear() - 1;
    const timeSeries = [];
    for (let i = 1; i < out.length; i++){
      const cols = out[i].split(",");
      const dayN = +cols[0], hourN = +cols[1]-1, pvKwh = +cols[4], thKwh = +cols[5];
      const toutC = cols[7] === "" ? 0 : +cols[7];
      const d = new Date(BASE_YEAR, 0, 1);
      d.setDate(d.getDate() + (dayN - 1));
      timeSeries.push({ date:d.toISOString().slice(0,10), dayN, hourN, pv_kWh:pvKwh, th_kWh:thKwh, Tout_C:toutC });
    }

    const monthlyAll = aggregateMonthlyAll(timeSeries, BASE_YEAR);
    renderMonthlyAllTable(monthlyAll);
    renderMonthlyChart(monthlyAll);
    renderTemperatureChartJS(monthlyAll);
    renderTemperatureTable(monthlyAll);

    const selectedMonth = parseInt(document.getElementById("monthSelector").value) || 1;
    const dailyAll = aggregateDailyAll(timeSeries, BASE_YEAR, selectedMonth);
    renderDailyAllTable(dailyAll);
    renderDailyChart(dailyAll);

    document.getElementById("monthSelector").onchange = function(){
      const sm = parseInt(this.value) || 1;
      const da = aggregateDailyAll(timeSeries, BASE_YEAR, sm);
      renderDailyAllTable(da);
      renderDailyChart(da);
    };

    document.getElementById("supplyChartsPanel").style.display = "block";

    // 7) CSV download
    const csv  = out.join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url  = URL.createObjectURL(blob);
    const a    = document.getElementById("downloadLink");
    const safeName = (CURRENT_LOC.name || "location").toLowerCase().replace(/[^a-z0-9]+/g,"_");
    a.href = url;
    a.download = `Annual_PVT_${safeName}_${used}h.csv`;
    a.style.display = "inline-block";
    a.textContent = "Download hourly details CSV";
    const pdfBtn = document.getElementById("btnGeneratePdf");
    if (pdfBtn){
      pdfBtn.style.display = "inline-block";
      pdfBtn.disabled = false;
      pdfBtn.textContent = "Generate PDF report";
    }

  } catch(err){
    console.error(err);
    setOutput(`Error: ${err.message}`, true);
  } finally {
    btnAnnual.disabled = false;
    document.getElementById("calcHint").style.display = "none";
  }
}

// ================================================================
//  INPUT PERSISTENCE — inputs survive page reloads (localStorage)
// ================================================================
const INPUT_STORE_KEY = "pvtCalcInputs.v1";

function saveInputsToStorage(){
  try {
    const data = {};
    document.querySelectorAll("input[id], select[id]").forEach(el => {
      if (el.id === "tin") return; // derived from TMY weather, not user-set
      data[el.id] = (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
    });
    localStorage.setItem(INPUT_STORE_KEY, JSON.stringify(data));
  } catch(_e){ /* private browsing or storage full — persistence is best-effort */ }
}

function restoreInputsFromStorage(){
  try {
    const data = JSON.parse(localStorage.getItem(INPUT_STORE_KEY) || "{}");
    for (const [id, value] of Object.entries(data)){
      const el = document.getElementById(id);
      if (!el || id === "tin") continue;
      if (el.type === "checkbox" || el.type === "radio") el.checked = !!value;
      else el.value = value;
    }
  } catch(_e){}
}

document.addEventListener("change", ev => {
  if (ev.target?.matches?.("input[id], select[id]")) saveInputsToStorage();
});

// ================================================================
//  EVENT LISTENERS
// ================================================================
restoreInputsFromStorage();
// Sync UI that depends on restored values: thermal-model panel + testing mode.
{
  const modelBSelected = document.getElementById("modelB")?.checked;
  document.getElementById("modelAParams").style.display = modelBSelected ? "none" : "block";
  document.getElementById("modelBParams").style.display = modelBSelected ? "block" : "none";
}
onTestingModeChange();
document.querySelectorAll('input[name="thermalModel"]').forEach(radio => {
  radio.addEventListener('change', function(){
    const isA = this.value === 'A';
    const outgoing = document.getElementById(isA ? 'modelBParams' : 'modelAParams');
    const incoming = document.getElementById(isA ? 'modelAParams' : 'modelBParams');
    const wasOpen = outgoing.querySelector('.formula-details')?.open;
    outgoing.style.display = 'none';
    incoming.style.display = 'block';
    if (wasOpen) {
      const incomingDetails = incoming.querySelector('.formula-details');
      if (incomingDetails) incomingDetails.open = true;
    }
  });
});

["pvInstalledCostPerW","thermalInstalledCostPerW","etaPv","autoCapexFromWatts"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", syncInstalledCostInputs);
  el.addEventListener("change", syncInstalledCostInputs);
});
syncInstalledCostInputs();
warmHostedTMYService();

document.getElementById("btnLoadTMY").addEventListener("click", async () => {
  const btn = document.getElementById("btnLoadTMY");
  btn.disabled = true;
  btn.innerHTML = `<span class="cs-spinner"></span>Loading…`;
  try { await loadTMYFromUI(); }
  catch(e){
    console.error(e);
    setOutput(`Error: ${escapeHtml(e.message)} <a href="#" style="font-weight:700;" onclick="document.getElementById('btnLoadTMY').click(); return false;">Retry</a>`, true);
  }
  finally {
    btn.disabled = false;
    btn.textContent = "Geocode & Load TMY";
  }
});

document.getElementById("btnAnnual").addEventListener("click", calcAnnualPVT);
document.getElementById("btnGeneratePdf").addEventListener("click", generatePdfTemplate);

document.getElementById("industrySelect").addEventListener("change", function(){
  syncIndustrySelectionUI(this.value, true);
});

document.getElementById("btnOpenProcessDiagram").addEventListener("click", openProcessDiagram);
document.getElementById("btnHowItWorks").addEventListener("click", openHowItWorks);
document.getElementById("btnCloseMainsChart").addEventListener("click", closeMainsChart);
document.getElementById("btnCloseProcessDiagram").addEventListener("click", closeProcessDiagram);
document.getElementById("btnCloseProcessUsage").addEventListener("click", closeProcessUsage);
document.getElementById("showMonthlySupply").addEventListener("change", updateSupplySectionVisibility);
document.getElementById("showDailyDetail").addEventListener("change", updateSupplySectionVisibility);
document.getElementById("showOutletTemperature").addEventListener("change", updateSupplySectionVisibility);

document.getElementById("mainsChartModal").addEventListener("click", ev => { if (ev.target === ev.currentTarget) closeMainsChart(); });
document.getElementById("processDiagramModal").addEventListener("click", ev => { if (ev.target === ev.currentTarget) closeProcessDiagram(); });
document.getElementById("processUsageModal").addEventListener("click", ev => { if (ev.target === ev.currentTarget) closeProcessUsage(); });
document.getElementById("howItWorksStepModal").addEventListener("click", ev => { if (ev.target === ev.currentTarget) closeHowItWorksStep(); });
document.getElementById("btnCloseHowItWorksStep").addEventListener("click", closeHowItWorksStep);
document.addEventListener("keydown", ev => { if (ev.key === "Escape"){ closeHowItWorksStep(); closeMainsChart(); closeProcessDiagram(); closeProcessUsage(); } });
updateSupplySectionVisibility();
syncIndustrySelectionUI(document.getElementById("industrySelect").value, false);
