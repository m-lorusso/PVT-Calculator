// Broad no-NaN/no-Infinity scan for locked validation outputs and fixtures.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_PATHS = [
  path.join(ROOT, "validation", "reference_summary.json"),
  path.join(ROOT, "validation", "deep_results.json"),
  path.join(ROOT, "validation", "backend_sydney.json"),
  path.join(ROOT, "validation", "backend_melbourne.json"),
  path.join(ROOT, "validation", "backend_perth.json"),
  path.join(ROOT, "validation", "fixtures", "weather"),
];

let pass = 0, fail = 0;
function ok(name, cond, detail=""){
  if (cond){ pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
}

function jsonFiles(target){
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile() && target.endsWith(".json")) return [target];
  if (!stat.isDirectory()) return [];
  return fs.readdirSync(target, { withFileTypes:true }).flatMap(entry => jsonFiles(path.join(target, entry.name)));
}

function scan(value, trail, problems){
  if (typeof value === "number" && !Number.isFinite(value)) problems.push(`${trail}=${value}`);
  if (typeof value === "string" && /\b(?:NaN|Infinity|-Infinity)\b/.test(value)) problems.push(`${trail}=${value}`);
  if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${trail}[${i}]`, problems));
  if (value && typeof value === "object" && !Array.isArray(value)){
    for (const [key, child] of Object.entries(value)) scan(child, `${trail}.${key}`, problems);
  }
}

console.log("\n# NO-NAN OUTPUT SCAN");
const files = CHECK_PATHS.flatMap(jsonFiles);
ok("JSON validation files discovered", files.length >= 12, `found ${files.length}`);
for (const file of files){
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const problems = [];
  scan(parsed, path.basename(file), problems);
  ok(`${path.relative(ROOT, file)} has finite JSON values`, problems.length === 0, problems.slice(0, 3).join("; "));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
