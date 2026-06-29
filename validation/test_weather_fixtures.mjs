// Offline checks for locked PVGIS TMY weather fixtures.
// Run: node validation/test_weather_fixtures.mjs
import fs from "node:fs";

const FIXTURE_DIR = new URL("./fixtures/weather/", import.meta.url);
const REQUIRED = ["sydney","melbourne","brisbane","perth","adelaide","darwin","hobart"];
const NUMERIC_FIELDS = ["dayN","hourN","solarHour","dni","dhi","ghi","ta","vwind"];
const sum = (records, key) => records.reduce((acc, rec) => acc + (Number(rec[key]) || 0), 0) / 1000;
const avg = (records, key) => records.reduce((acc, rec) => acc + (Number(rec[key]) || 0), 0) / Math.max(1, records.length);
const near = (a, b, tol=1e-6) => Math.abs(a - b) <= tol;

let pass = 0;
let fail = 0;
function ok(name, cond, detail=""){
  if (cond){ pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
}

console.log("\n# LOCKED WEATHER FIXTURES");
for (const slug of REQUIRED){
  const path = new URL(`${slug}.json`, FIXTURE_DIR);
  ok(`${slug}: fixture exists`, fs.existsSync(path));
  if (!fs.existsSync(path)) continue;
  const fixture = JSON.parse(fs.readFileSync(path, "utf8"));
  const records = fixture.records || [];
  ok(`${slug}: schema version`, fixture.schemaVersion === 1, `schema=${fixture.schemaVersion}`);
  ok(`${slug}: source documents PVGIS/pvlib`, /PVGIS/.test(fixture.source || "") && /pvlib/.test(fixture.source || ""));
  ok(`${slug}: location metadata present`, fixture.slug === slug && fixture.city && fixture.state);
  ok(`${slug}: coordinates finite`, Number.isFinite(Number(fixture.lat)) && Number.isFinite(Number(fixture.lon)));
  ok(`${slug}: timezone metadata present`, typeof fixture.tz === "string" && fixture.tz.length > 0);
  ok(`${slug}: lock date present`, /^\d{4}-\d{2}-\d{2}$/.test(fixture.lockedAt || ""));
  ok(`${slug}: 8760 hourly records`, records.length === 8760, `got ${records.length}`);
  ok(`${slug}: recordCount metadata matches`, fixture.recordCount === records.length, `meta=${fixture.recordCount}`);
  ok(`${slug}: all required fields finite`, records.every(rec => NUMERIC_FIELDS.every(key => Number.isFinite(Number(rec[key])))));
  ok(`${slug}: solarHour on every row`, records.every(rec => Number.isFinite(Number(rec.solarHour))));
  ok(`${slug}: solarHour range 0..24`, records.every(rec => Number(rec.solarHour) >= 0 && Number(rec.solarHour) < 24));
  ok(`${slug}: hourN range 1..24 from backend fixture`, records.every(rec => Number(rec.hourN) >= 1 && Number(rec.hourN) <= 24));
  ok(`${slug}: annual DNI checksum`, near(sum(records, "dni"), fixture.annualDniKWhM2), `got ${sum(records, "dni")} meta ${fixture.annualDniKWhM2}`);
  ok(`${slug}: annual DHI checksum`, near(sum(records, "dhi"), fixture.annualDhiKWhM2), `got ${sum(records, "dhi")} meta ${fixture.annualDhiKWhM2}`);
  ok(`${slug}: annual GHI checksum`, near(sum(records, "ghi"), fixture.annualGhiKWhM2), `got ${sum(records, "ghi")} meta ${fixture.annualGhiKWhM2}`);
  ok(`${slug}: annual ambient checksum`, near(avg(records, "ta"), fixture.annualAmbientAvgC), `got ${avg(records, "ta")} meta ${fixture.annualAmbientAvgC}`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
