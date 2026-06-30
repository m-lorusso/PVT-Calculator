// Locked equation tests for PVT Thermal Model A and Model B.
// These tests verify and protect the current approved equations; they do not
// propose or apply coefficient changes.
import fs from "node:fs";

const APP = fs.readFileSync(new URL("../../js/app.js", import.meta.url), "utf8");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let pass = 0, fail = 0;
function ok(name, cond, detail=""){
  if (cond){ pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
}
function near(name, got, exp, tol){
  ok(name, Math.abs(got - exp) <= tol, `got ${got}, expected ${exp} +/- ${tol}`);
}

function modelA({G, A, Tin, ta, vwind, a0, a1, a2}){
  let etaTh = 0;
  if (G > 1e-6) etaTh = clamp(a0 + a1 * ((Tin - ta) / G) + a2 * vwind, 0, 1);
  return { etaTh, th_W: etaTh * G * A };
}

function modelB(opts){
  const {
    G, A, Tin, ta, vwind, totalFlow_kg_hr,
    isoEta0, isoA1, isoA2, isoA3, isoA4, isoA6, isoA8, isoTout0, isoIterMax
  } = opts;
  const SIGMA = 5.67e-8;
  let etaTh = 0, th_W = 0;
  const Ta_K = ta + 273.15;
  const Ta4 = SIGMA * Math.pow(Ta_K, 4);
  const EL = 5.31e-13 * Math.pow(Ta_K, 6);
  const u = vwind || 0;
  if (G > 1e-6 && totalFlow_kg_hr > 1e-12){
    const mdot_cp = (totalFlow_kg_hr / 3600) * 4184;
    let Tout_iter = isoTout0;
    for (let iter = 0; iter < isoIterMax; iter++){
      const Tm = (Tin + Tout_iter) / 2;
      const dT = Tm - ta;
      const Q_model = A * (isoEta0 * G
        - isoA1 * dT
        - isoA2 * dT * dT
        - isoA3 * u * dT
        + isoA4 * (EL - Ta4)
        - isoA6 * u * G
        - isoA8 * Math.pow(dT, 4));
      const Q_flow = mdot_cp * (Tout_iter - Tin);
      const dQm_dTout = A * (-isoA1 * 0.5 - isoA2 * dT - isoA3 * u * 0.5 - isoA8 * 2 * Math.pow(dT, 3));
      const step = (Q_flow - Q_model) / (mdot_cp - dQm_dTout);
      Tout_iter -= step;
      if (Math.abs(step) < 1e-4) break;
    }
    const Tm_f = (Tin + Tout_iter) / 2;
    const dT_f = Tm_f - ta;
    th_W = Math.max(0, A * (isoEta0 * G
      - isoA1 * dT_f
      - isoA2 * dT_f * dT_f
      - isoA3 * u * dT_f
      + isoA4 * (EL - Ta4)
      - isoA6 * u * G
      - isoA8 * Math.pow(dT_f, 4)));
    etaTh = (G * A > 1e-6) ? clamp(th_W / (G * A), 0, 1) : 0;
  }
  return { etaTh, th_W };
}

console.log("\n# PVT MODEL EQUATION LOCKS");
ok("Model A source equation is present", APP.includes("etaTh = a0 + a1 * ((Tin - r.ta) / G) + a2 * r.vwind"));
ok("Model B source keeps ISO 9806 Eq.12 Newton branch", APP.includes("Model B: ISO 9806 Eq.12 with Newton iteration"));
ok("Model B source keeps Swinbank long-wave constant", APP.includes("5.31e-13 * Math.pow(Ta_K, 6)"));

console.log("\n# MODEL A NUMERIC CASE");
{
  const got = modelA({ G:800, A:20, Tin:25, ta:20, vwind:3, a0:0.70, a1:-4.0, a2:-0.01 });
  near("eta_th = 0.645 by hand", got.etaTh, 0.645, 1e-12);
  near("thermal power = eta*G*A", got.th_W, 10320, 1e-9);
  near("zero irradiance gives zero heat", modelA({ G:0, A:20, Tin:25, ta:20, vwind:3, a0:0.7, a1:-4, a2:-0.01 }).th_W, 0, 1e-12);
}

console.log("\n# MODEL B NUMERIC CASE");
{
  const got = modelB({
    G:800, A:20, Tin:25, ta:20, vwind:3, totalFlow_kg_hr:0.02 * 20 * 3600,
    isoEta0:0.762, isoA1:3.93, isoA2:0.0095, isoA3:0, isoA4:0, isoA6:0, isoA8:0,
    isoTout0:40, isoIterMax:5
  });
  near("Model B locked thermal power", got.th_W, 11515.064590968854, 1e-9);
  near("Model B locked eta_th", got.etaTh, 0.7196915369355533, 1e-12);
  near("zero irradiance gives zero heat", modelB({ G:0, A:20, Tin:25, ta:20, vwind:3, totalFlow_kg_hr:1440, isoEta0:0.762, isoA1:3.93, isoA2:0.0095, isoA3:0, isoA4:0, isoA6:0, isoA8:0, isoTout0:40, isoIterMax:5 }).th_W, 0, 1e-12);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
