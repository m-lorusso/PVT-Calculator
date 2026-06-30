// Group E: economics formula tests. Mirrors the finance math in app.js
// (calcAnnualPVT, ~lines 4475-4500): CRF, NPV annuity, LCOE split, payback,
// and the heat-saving unit conversion. Verifies correctness + self-consistency.
// Run: node validation/unit/test_economics.mjs

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tol)=>ok(n, Math.abs(g-e)<=tol, `got ${g} exp ${e} (+-${tol})`);

// --- formulas exactly as used in app.js ---
const CRF = (i,N) => i>1e-9 ? i*Math.pow(1+i,N)/(Math.pow(1+i,N)-1) : 1/N;
const NPV = (capex,benefit,i,N) => i>1e-9 ? -capex + benefit*(1-Math.pow(1+i,-N))/i : -capex + benefit*N;
const annualSavingHeat = (th_kWh,boilerEff,gasPricePerMJ) => (th_kWh*3.6/boilerEff)*gasPricePerMJ;

console.log("\n# CAPITAL RECOVERY FACTOR");
near("CRF(6%,25yr) = 0.078227 (textbook)", CRF(0.06,25), 0.078227, 1e-5);
near("CRF(0%,25yr) -> 1/N = 0.04 (limit)", CRF(0,25), 0.04, 1e-9);
ok("CRF rises with discount rate", CRF(0.10,25) > CRF(0.06,25));

console.log("\n# NPV (annuity)");
{
  const capex=10000, benefit=1500, i=0.06, N=25;
  const npv=NPV(capex,benefit,i,N);
  near("NPV(10k capex, 1.5k/yr, 6%, 25yr)", npv, -10000+1500*(1-Math.pow(1.06,-25))/0.06, 1e-6);
  // annuity factor is the reciprocal of CRF -> key consistency check
  const annuityFactor=(1-Math.pow(1+i,-N))/i;
  near("annuity factor x CRF = 1 (self-consistent)", annuityFactor*CRF(i,N), 1, 1e-9);
  near("NPV at i->0 = -capex + benefit*N", NPV(capex,benefit,0,N), -capex+benefit*N, 1e-9);
  ok("Negative net benefit => negative NPV", NPV(10000,-200,0.06,25) < 0);
}

console.log("\n# LCOE energy-weighted split (pv + thermal reconcile to combined)");
{
  const capex=20000, opex=400, i=0.06, N=25, crf=CRF(i,N);
  const E_pv=7000, E_th=4000, f_th2e=1.0;
  const eqTotal=E_pv+E_th*f_th2e;
  const pvShare=E_pv/eqTotal, thShare=(E_th*f_th2e)/eqTotal;
  const lcoe=(capex*pvShare*crf+opex*pvShare)/E_pv;
  const lcoh=(capex*thShare*crf+opex*thShare)/E_th;
  const combo=(capex*crf+opex)/eqTotal;
  // annual cost split across the two streams must equal the total annual cost
  const annualCost=capex*crf+opex;
  near("pv + thermal annual cost = total", lcoe*E_pv+lcoh*E_th, annualCost, 1e-6);
  ok("combined LCOE between pv and thermal LCOE", combo>=Math.min(lcoe,lcoh)-1e-9 && combo<=Math.max(lcoe,lcoh)+1e-9, `combo=${combo.toFixed(4)} lcoe=${lcoe.toFixed(4)} lcoh=${lcoh.toFixed(4)}`);
}

console.log("\n# HEAT SAVING unit conversion (kWh -> MJ / boiler eff x $/MJ)");
near("1000 kWh th, 85% boiler, $0.03/MJ = $127.06", annualSavingHeat(1000,0.85,0.03), 1000*3.6/0.85*0.03, 1e-6);
ok("Lower boiler efficiency => more gas displaced (more saving)", annualSavingHeat(1000,0.7,0.03) > annualSavingHeat(1000,0.9,0.03));

console.log("\n# SIMPLE PAYBACK");
near("payback = capex / net annual benefit", 16000/2000, 8, 1e-9);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);
