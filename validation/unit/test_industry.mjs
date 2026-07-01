// Industry demand-model tests (groups B, C, E).
// Extracts the REAL functions/constants from js/app.js (no copy-paste) and checks
// that each model reproduces its stated Australian benchmark and the documented
// Q = m c_p dT thermal formula. Run: node validation/unit/test_industry.mjs
import fs from "node:fs";

const APP_JS_PATH = new URL("../../js/app.js", import.meta.url);
const SRC = fs.readFileSync(APP_JS_PATH, "utf8");

// --- robust extractor: pull a named `function` or top-level `const` from source ---
function extract(name, kind){
  const re = kind === "func"
    ? new RegExp(`function\\s+${name}\\s*\\(`)
    : new RegExp(`const\\s+${name}\\s*=`);
  const m = re.exec(SRC);
  if (!m) throw new Error(`not found: ${name}`);
  let i = m.index;
  if (kind === "func"){
    // brace-match the body
    let bi = SRC.indexOf("{", i), depth = 0, j = bi;
    for (; j < SRC.length; j++){ const c = SRC[j]; if (c==="{")depth++; else if (c==="}"){depth--; if(depth===0){j++;break;}} }
    return SRC.slice(i, j);
  }
  // const: scan to the `;` at bracket-depth 0 (handles multi-line arrays/objects)
  let depth = 0, inStr = null, j = i;
  for (; j < SRC.length; j++){
    const c = SRC[j];
    if (inStr){ if (c === inStr && SRC[j-1] !== "\\") inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") inStr = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0){ j++; break; }
  }
  return SRC.slice(i, j);
}

const SYMBOLS = [
  ["isFiniteNumber","func"],["clamp","func"],["monthFromDayN","func"],["isMonToFriDay","func"],
  ["hourIndexFromHourN","func"],["_normW","func"],["normalizeSeasonalFactors","func"],
  ["MONTH_DAYS","const"],
  ["DAIRY_SEASONAL","const"],["DAIRY_PROCESS_PARAMS","const"],["DAIRY_ELEC_PARAMS","const"],
  ["BREWERY_SEASONAL","const"],["BREWERY_PROCESS_PARAMS","const"],["BREWERY_ELEC_PARAMS","const"],
  ["AQUATIC_PROCESS_PARAMS","const"],["AQUATIC_DEFAULT_HOURS","const"],["AQUATIC_WEEKDAY_HOURS","const"],
  ["AQUATIC_COVER_REDUCTION","const"],["AQUATIC_ELEC_KWH_PER_M2_PER_YEAR","const"],
  ["EVAP_LATENT_KWH_PER_KG","const"],["WATER_CP_KWH_PER_KG_C","const"],
  ["HOTEL_PROCESS_PARAMS","const"],["HOTEL_ELECTRICAL_KWH_PER_UNIT","const"],
  ["HOTEL_ELECTRICAL_HOURLY","const"],["HOTEL_ELECTRICAL_MONTHLY","const"],["HOTEL_ELECTRICAL_WEATHER_PARAMS","const"],
  ["LAUNDRY_DEFAULTS","const"],["LAUNDRY_PROCESS_STACK_ORDER","const"],
  ["getAnnualAmbientAverage","func"],["getAquaticSchedule","func"],["saturationVaporPressureKPa","func"],
  ["getAquaticRelativeHumidity","func"],
  ["calcHotelElectricalWeatherFactor","func"],["calcHotelElectricalHourlyDemand","func"],
  ["calcDairyHourlyDemand","func"],["calcBreweryHourlyDemand","func"],["calcAquaticHourlyDemand","func"],
  ["laundryOperatingDayWeight","func"],["calcCommercialLaundryHourlyDemand","func"],
];
const code = SYMBOLS.map(([n,k]) => extract(n,k)).join("\n");
const mod = new Function(code + "\nreturn {calcDairyHourlyDemand,calcBreweryHourlyDemand,calcAquaticHourlyDemand,calcCommercialLaundryHourlyDemand,calcHotelElectricalHourlyDemand,calcHotelElectricalWeatherFactor,DAIRY_PROCESS_PARAMS,BREWERY_PROCESS_PARAMS,DAIRY_ELEC_PARAMS,BREWERY_ELEC_PARAMS,HOTEL_PROCESS_PARAMS,HOTEL_ELECTRICAL_KWH_PER_UNIT,LAUNDRY_DEFAULTS,LAUNDRY_PROCESS_STACK_ORDER,normalizeSeasonalFactors,DAIRY_SEASONAL,MONTH_DAYS,WATER_CP_KWH_PER_KG_C};")();

// --- synthetic full-year weather + constant mains so thermal totals are predictable ---
const MAINS_C = 18;
const met = [];
for (let d=1; d<=365; d++) for (let h=0; h<24; h++) met.push({dayN:d, hourN:h});
const mains = { annualAvgC: MAINS_C, byDay: Object.fromEntries(Array.from({length:365},(_,i)=>[i+1,MAINS_C])) };
const sum = a => a.reduce((x,y)=>x+y,0);

let pass=0, fail=0;
const ok=(n,c,d="")=>{ c?pass++:fail++; console.log(`  ${c?"PASS":"FAIL"}  ${n}${c?"":"  "+d}`); };
const near=(n,g,e,tolPct)=>ok(n, Math.abs(g-e)<=Math.abs(e)*tolPct/100, `got ${g.toFixed(0)} exp ${e.toFixed(0)} (>${tolPct}%)`);

console.log("\n# DAIRY  (throughput 5,000,000 L milk; mains "+MAINS_C+"C)");
{
  const T=5_000_000;
  const keys=["fatty_film_rinse","cip_preheating","boiler_preheat"];
  const r=mod.calcDairyHourlyDemand(T,"continuous",keys,met,mains);
  const elec=sum(r.electricHourly), th=sum(r.thermalHourly);
  near("Electrical = 51.7 kWh/kL benchmark", elec, 51.7*(T/1000), 0.5);
  const kW=keys.reduce((a,k)=>a+mod.DAIRY_PROCESS_PARAMS[k].kWater,0); // 1.37
  const expTh=T*kW*4.184*(35-MAINS_C)/3600;
  near("Thermal = V*cp*dT  (1.37 L/L milk -> 35C)", th, expTh, 1);
  ok("Total heated water = 1.37 L/L", Math.abs(kW-1.37)<1e-9, `kW=${kW}`);
}

console.log("\n# BREWERY  (throughput 500,000 L beer; mains "+MAINS_C+"C)");
{
  const T=500_000;
  const keys=["cip_prerinse","bottle_keg_rinse","boiler_preheat"];
  const r=mod.calcBreweryHourlyDemand(T,"continuous",keys,met,mains);
  const elec=sum(r.electricHourly), th=sum(r.thermalHourly);
  near("Electrical = 11.50 kWh/hL benchmark", elec, 0.115*T, 0.5);
  const P=mod.BREWERY_PROCESS_PARAMS;
  let expTh=0; for(const k of keys) expTh += T*P[k].kWater*4.184*(P[k].T_target-MAINS_C)/3600;
  near("Thermal = sum V*cp*dT  (per-process targets 40-45C)", th, expTh, 1);
  const kW=keys.reduce((a,k)=>a+P[k].kWater,0);
  ok("Total warm water = 1.85 L/L beer", Math.abs(kW-1.85)<1e-9, `kW=${kW}`);
}

console.log("\n# AQUATIC  (indoor pool 500 m2; physics heat-loss model)");
{
  // synthetic year: seasonal + diurnal ambient temperature, light wind
  const amet = [];
  for (let d=1; d<=365; d++) for (let h=0; h<24; h++){
    const ta = 20 + 6*Math.cos(2*Math.PI*(d-15)/365) + 3*Math.sin(2*Math.PI*(h-6)/24);
    amet.push({ dayN:d, hourN:h, ta, vwind:2 });
  }
  const r = mod.calcAquaticHourlyDemand({
    met:amet, activeProcesses:["indoor_pool"], profileType:"continuous",
    processAreas:{indoor_pool:500}, coverEnabled:false, mainsTempC:18
  });
  const b = r.processBreakdownAnnuals.indoor_pool;
  const total = sum(r.thermalHourly);
  const perM2 = total/500;
  ok("Model runs, finite positive demand", Number.isFinite(total) && total>0, `total=${total}`);
  ok("Evaporation is the dominant loss (~ASHRAE 56%)", b.evaporation>b.makeup && b.evaporation>b.sensible,
     `evap=${b.evaporation.toFixed(0)} makeup=${b.makeup.toFixed(0)} sens=${b.sensible.toFixed(0)}`);
  ok("Annual pool-heat per m2 in sane band 300-6000 kWh/m2", perM2>300 && perM2<6000, `perM2=${perM2.toFixed(0)}`);
  console.log(`        (info) indoor pool heating = ${perM2.toFixed(0)} kWh/m2 surface; split evap ${(b.evaporation/total*100).toFixed(0)}% / makeup ${(b.makeup/total*100).toFixed(0)}% / sensible ${(b.sensible/total*100).toFixed(0)}%`);
}

console.log("\n# HOTEL  (60,000 occupied room-nights; energy per room-night)");
{
  const RN = 60_000;
  const H = mod.HOTEL_PROCESS_PARAMS;
  const dhw = H.domestic_hot_water.kWhPerUnit;
  ok("DHW tuned to Australian benchmark (3-5 kWh/room-night)", dhw>=3 && dhw<=5, `dhw=${dhw}`);
  ok("DHW = 4.5 kWh/room-night", Math.abs(dhw-4.5)<1e-9, `dhw=${dhw}`);
  near("Annual DHW thermal = room-nights x kWh/unit", RN*dhw, 60000*4.5, 0.01);
  near("Annual electrical = 15 kWh/room-night", RN*mod.HOTEL_ELECTRICAL_KWH_PER_UNIT, 60000*15, 0.01);
  const hotelMet = [];
  const monthlyTa = [29,28,25,21,16,13,12,15,18,22,25,28];
  let dayN = 1;
  for (let m=0; m<12; m++){
    for (let d=0; d<mod.MONTH_DAYS[m]; d++, dayN++){
      for (let h=0; h<24; h++){
        const diurnal = 3 * Math.sin(2 * Math.PI * (h - 6) / 24);
        hotelMet.push({dayN, hourN:h, ta: monthlyTa[m] + diurnal});
      }
    }
  }
  const hotelElec = mod.calcHotelElectricalHourlyDemand(RN, hotelMet);
  near("Weather-shaped hotel electrical still preserves annual benchmark", sum(hotelElec), RN*mod.HOTEL_ELECTRICAL_KWH_PER_UNIT, 0.01);
  ok("Hot hotel hours get higher electrical weighting than neutral", mod.calcHotelElectricalWeatherFactor(32) > mod.calcHotelElectricalWeatherFactor(20),
     `hot=${mod.calcHotelElectricalWeatherFactor(32)} neutral=${mod.calcHotelElectricalWeatherFactor(20)}`);
  ok("Cold hotel hours get higher electrical weighting than neutral", mod.calcHotelElectricalWeatherFactor(10) > mod.calcHotelElectricalWeatherFactor(20),
     `cold=${mod.calcHotelElectricalWeatherFactor(10)} neutral=${mod.calcHotelElectricalWeatherFactor(20)}`);
  const totalTh = (dhw+H.kitchen_dishwashing.kWhPerUnit+H.laundry.kWhPerUnit)*RN;
  console.log(`        (info) thermal (DHW+kitchen+laundry) = ${totalTh.toFixed(0)} kWh/yr; was ${((5.5+1.6+1.2)*RN).toFixed(0)} before DHW tune`);
}

console.log("\n# COMMERCIAL LAUNDRY  (hot-water washing demand only)");
{
  const inputs = {
    kgPerDay: 1500,
    operatingDaysPerWeek: 6,
    washTempC: 60,
    waterUseLPerKg: 10,
    hotWaterFraction: 0.65,
    warmRinseFraction: 0.20,
    warmRinseTempC: 35,
    systemLossFraction: 0,
    selectedKeys: ["wash_water","rinse_preheat","boiler_preheat"],
    met,
    mains
  };
  const r = mod.calcCommercialLaundryHourlyDemand(inputs);
  const annualKg = inputs.kgPerDay * inputs.operatingDaysPerWeek * 52;
  const expWash = annualKg * inputs.waterUseLPerKg * inputs.hotWaterFraction * mod.WATER_CP_KWH_PER_KG_C * (inputs.washTempC - MAINS_C);
  const expRinse = annualKg * inputs.waterUseLPerKg * inputs.warmRinseFraction * mod.WATER_CP_KWH_PER_KG_C * (inputs.warmRinseTempC - MAINS_C);
  near("Annual kg = kg/day x days/week x 52", r.annualKg, annualKg, 0.01);
  near("Wash hot water = m cp dT", sum(r.processByHour.wash_water), expWash, 0.01);
  near("Warm rinse = m cp dT", sum(r.processByHour.rinse_preheat), expRinse, 0.01);
  near("System loss default = 0", sum(r.processByHour.boiler_preheat), 0, 0.01);
  near("Total laundry thermal = wash + rinse + loss", sum(r.thermalHourly), expWash + expRinse, 0.01);
  const doubled = mod.calcCommercialLaundryHourlyDemand({...inputs, kgPerDay: inputs.kgPerDay * 2});
  near("Laundry demand scales linearly with kg/day", sum(doubled.thermalHourly), 2 * sum(r.thermalHourly), 0.01);
  const withLoss = mod.calcCommercialLaundryHourlyDemand({...inputs, systemLossFraction:0.10});
  near("System loss = 10% of selected wash+rinse heat", sum(withLoss.processByHour.boiler_preheat), 0.10 * (expWash + expRinse), 0.01);
  const washOnly = mod.calcCommercialLaundryHourlyDemand({...inputs, selectedKeys:["wash_water"]});
  near("Selecting only wash excludes rinse and losses", sum(washOnly.thermalHourly), expWash, 0.01);
  const washLossOnly = mod.calcCommercialLaundryHourlyDemand({...inputs, selectedKeys:["wash_water","boiler_preheat"], systemLossFraction:0.10});
  near("System loss follows selected heat terms only", sum(washLossOnly.processByHour.boiler_preheat), 0.10 * expWash, 0.01);
  const idle = mod.calcCommercialLaundryHourlyDemand({...inputs, operatingDaysPerWeek:0});
  near("Zero operating days gives zero thermal demand", sum(idle.thermalHourly), 0, 0.01);
  const noProcesses = mod.calcCommercialLaundryHourlyDemand({...inputs, selectedKeys:[]});
  near("No selected laundry processes gives zero thermal demand", sum(noProcesses.thermalHourly), 0, 0.01);
  const hotMains = { annualAvgC: 30, byDay: Object.fromEntries(Array.from({length:365},(_,i)=>[i+1,30])) };
  const lower = mod.calcCommercialLaundryHourlyDemand({...inputs, mains: hotMains});
  ok("Higher mains temperature lowers laundry heat", sum(lower.thermalHourly) < sum(r.thermalHourly), `hot=${sum(lower.thermalHourly)} base=${sum(r.thermalHourly)}`);
  ok("Laundry electric demand is explicitly out of scope", sum(r.electricHourly) === 0, `electric=${sum(r.electricHourly)}`);
}

console.log("\n# SEASONAL NORMALISATION (annual total preserved)");
{
  const s=mod.normalizeSeasonalFactors(mod.DAIRY_SEASONAL);
  const daySum=s.reduce((a,v,i)=>a+v*mod.MONTH_DAYS[i],0);
  near("Day-weighted seasonal sum = 365", daySum, 365, 0.01);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);
