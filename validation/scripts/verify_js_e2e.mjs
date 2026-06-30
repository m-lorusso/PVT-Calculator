// End-to-end front-end check: runs the EXACT app.js TiltedSurfaceRadiation class +
// normalization + solar-hour fallback on the REAL backend output (backend_*.json),
// comparing annual POA before (clock hourN) vs after (solarHour) against pvlib.
import fs from "node:fs";

// ---- VERBATIM app.js TiltedSurfaceRadiation (lines 608-665) ----
class TiltedSurfaceRadiation {
  constructor(latitude, longitude, tiltAngle, surfaceAzimuth, albedo = 0.2){
    this.latitude = latitude; this.longitude = longitude;
    this.tiltAngle = tiltAngle; this.surfaceAzimuth = surfaceAzimuth; this.albedo = albedo;
  }
  toRadians(deg){ return deg * (Math.PI / 180); }
  toDegrees(rad){ return rad * (180 / Math.PI); }
  declinationAngle(dayN){ return 23.45 * Math.sin(this.toRadians((360 / 365) * (dayN + 284))); }
  hourAngle(hourN){ return 15 * (hourN - 12); }
  zenithAngle(dayN, hourN){
    const d = this.toRadians(this.declinationAngle(dayN)), w = this.toRadians(this.hourAngle(hourN)), L = this.toRadians(this.latitude);
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, Math.sin(d)*Math.sin(L)+Math.cos(d)*Math.cos(L)*Math.cos(w)))));
  }
  incidenceAngle(dayN, hourN){
    const d=this.toRadians(this.declinationAngle(dayN)),w=this.toRadians(this.hourAngle(hourN)),L=this.toRadians(this.latitude),s=this.toRadians(this.tiltAngle),g=this.toRadians(this.surfaceAzimuth-180);
    const i1=Math.sin(d)*Math.sin(L)*Math.cos(s),i2=Math.sin(d)*Math.cos(L)*Math.sin(s)*Math.cos(g),i3=Math.cos(d)*Math.cos(L)*Math.cos(s)*Math.cos(w),i4=Math.cos(d)*Math.sin(L)*Math.sin(s)*Math.cos(g)*Math.cos(w),i5=Math.cos(d)*Math.sin(s)*Math.sin(g)*Math.sin(w);
    return this.toDegrees(Math.acos(Math.min(1, Math.max(-1, i1-i2+i3+i4+i5))));
  }
  calculate(dayN, hourN, dni, dhi){
    const thetaZ=this.zenithAngle(dayN,hourN), cosThetaZ=Math.cos(this.toRadians(thetaZ)), eps=1e-6;
    const DNI=Math.max(0,(dni||0)), DHI=Math.max(0,(dhi||0));
    const BHI=(cosThetaZ>eps)?(DNI*Math.max(0,cosThetaZ)):0, ghi=BHI+DHI;
    const thetaT=this.incidenceAngle(dayN,hourN), cosThetaT=Math.cos(this.toRadians(thetaT));
    const beam=(cosThetaZ>eps)?(DNI*Math.max(0,cosThetaT)):0;
    const diffuse=DHI*((1+Math.cos(this.toRadians(this.tiltAngle)))/2);
    const ground=ghi*this.albedo*((1-Math.cos(this.toRadians(this.tiltAngle)))/2);
    return { totalIrradiance: Math.max(0, beam+diffuse+ground) };
  }
}
const isFiniteNumber = (x) => typeof x === "number" && Number.isFinite(x);

const PVLIB_ISO = { sydney: 7288.6, melbourne: 7356.3, perth: 8506.8 }; // reference annual kWh
const rows = [];
for (const c of ["sydney","melbourne","perth"]){
  const d = JSON.parse(fs.readFileSync(`validation/fixtures/backend/backend_${c}.json`,"utf8"));
  const calc = new TiltedSurfaceRadiation(d.lat, d.lon, d.tilt, 0, d.albedo);
  let sumOld=0, sumNew=0;
  for (const raw of d.records){
    // replicate normalizeWeatherRecords
    let hourN = raw.hourN;
    if (isFiniteNumber(hourN) && hourN>=1 && hourN<=24) hourN -= 1;
    const solarHour = +raw.solarHour;
    if (![raw.dayN,hourN,raw.dni,raw.dhi,raw.ta,raw.vwind].every(isFiniteNumber)) continue;
    // OLD path (clock hourN) vs NEW path (solarHour fallback)
    sumOld += Math.max(0, calc.calculate(raw.dayN, hourN, raw.dni, raw.dhi).totalIrradiance);
    const solarH = isFiniteNumber(solarHour) ? solarHour : hourN;
    sumNew += Math.max(0, calc.calculate(raw.dayN, solarH, raw.dni, raw.dhi).totalIrradiance);
  }
  const kOld=sumOld/1000*d.eta*d.area, kNew=sumNew/1000*d.eta*d.area, ref=PVLIB_ISO[c];
  rows.push({ city:c,
    before_kwh:+kOld.toFixed(1), after_kwh:+kNew.toFixed(1), pvlib_kwh:ref,
    before_err_pct:+((kOld/ref-1)*100).toFixed(2), after_err_pct:+((kNew/ref-1)*100).toFixed(2) });
}
console.table(rows);
