// Runs the EXACT TiltedSurfaceRadiation class from app.js against the same PVGIS
// TMY data pvlib used, to confirm the app code reproduces pvlib's isotropic POA
// and to measure the clock-vs-solar-time approximation error.
import fs from "node:fs";

// ---- VERBATIM copy of app.js lines 608-665 (TiltedSurfaceRadiation) ----
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
// ---- end verbatim ----

// Equation of Time (minutes) + longitude correction -> solar hour for a given record.
function solarHour(dayN, clockHour0, lon, stdMeridian){
  const B = (360/364) * (dayN - 81) * Math.PI/180;
  const EoT = 9.87*Math.sin(2*B) - 7.53*Math.cos(B) - 1.5*Math.sin(B); // minutes
  // solar time = clock time + 4*(stdMeridian - (-lon))? Use standard convention:
  // solar = clock + (4*(Lst - Lloc) + EoT)/60 ; Lst, Lloc measured west-positive.
  // For east longitudes use signs accordingly: minutes offset = 4*(lon - stdMeridian) + EoT
  const offsetMin = 4*(lon - stdMeridian) + EoT;
  return clockHour0 + offsetMin/60;
}

const cities = ["sydney","melbourne","perth"];
const out = {};
for (const c of cities){
  const path = `validation/fixtures/tmy/tmy_${c}.json`;
  if (!fs.existsSync(path)){ console.error("missing", path); continue; }
  const data = JSON.parse(fs.readFileSync(path,"utf8"));
  const { lat, lon, tilt, albedo, eta, area, records } = data;
  // Approx standard meridian from tz: round(lon/15)*15 won't match DST; use AEST/AWST.
  const stdMeridian = c==="perth" ? 120 : 150; // AWST=+8 ->120E, AEST=+10 ->150E

  const calc = new TiltedSurfaceRadiation(lat, lon, tilt, 0 /*north*/, albedo);
  let sumApp = 0, sumSolar = 0;
  for (const r of records){
    let hourN = r.hourN;
    if (Number.isFinite(hourN) && hourN >= 1 && hourN <= 24) hourN = hourN - 1; // app.js normalization
    // App path: uses clock hour directly as if it were solar time
    sumApp   += Math.max(0, calc.calculate(r.dayN, hourN, r.dni, r.dhi).totalIrradiance);
    // Solar-time-corrected path: feed proper solar hour
    const sh = solarHour(r.dayN, hourN, lon, stdMeridian);
    sumSolar += Math.max(0, calc.calculate(r.dayN, sh, r.dni, r.dhi).totalIrradiance);
  }
  out[c] = {
    app_annual_poa_kwh_m2:   +(sumApp/1000).toFixed(1),
    app_annual_kwh:          +(sumApp/1000*eta*area).toFixed(1),
    solar_corrected_poa_kwh_m2: +(sumSolar/1000).toFixed(1),
    solar_corrected_kwh:     +(sumSolar/1000*eta*area).toFixed(1),
  };
}
console.log(JSON.stringify(out, null, 2));
