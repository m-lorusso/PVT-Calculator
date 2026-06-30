// Assertion-based unit tests for CoolSheet's solar-geometry formulas.
// Verbatim copy of app.js TiltedSurfaceRadiation (lines 608-665). Run:
//   node validation/unit/test_geometry.mjs    (exit code 0 = all pass)
class TiltedSurfaceRadiation {
  constructor(latitude, longitude, tiltAngle, surfaceAzimuth, albedo = 0.2){
    this.latitude=latitude; this.longitude=longitude; this.tiltAngle=tiltAngle;
    this.surfaceAzimuth=surfaceAzimuth; this.albedo=albedo;
  }
  toRadians(d){return d*Math.PI/180;} toDegrees(r){return r*180/Math.PI;}
  declinationAngle(n){return 23.45*Math.sin(this.toRadians((360/365)*(n+284)));}
  hourAngle(h){return 15*(h-12);}
  zenithAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,Math.sin(d)*Math.sin(L)+Math.cos(d)*Math.cos(L)*Math.cos(w)))));}
  incidenceAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude),s=this.toRadians(this.tiltAngle),g=this.toRadians(this.surfaceAzimuth-180);
    const i1=Math.sin(d)*Math.sin(L)*Math.cos(s),i2=Math.sin(d)*Math.cos(L)*Math.sin(s)*Math.cos(g),i3=Math.cos(d)*Math.cos(L)*Math.cos(s)*Math.cos(w),i4=Math.cos(d)*Math.sin(L)*Math.sin(s)*Math.cos(g)*Math.cos(w),i5=Math.cos(d)*Math.sin(s)*Math.sin(g)*Math.sin(w);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,i1-i2+i3+i4+i5))));}
  calculate(n,h,dni,dhi){
    const z=this.zenithAngle(n,h),cz=Math.cos(this.toRadians(z)),eps=1e-6;
    const DNI=Math.max(0,dni||0),DHI=Math.max(0,dhi||0);
    const BHI=(cz>eps)?DNI*Math.max(0,cz):0,ghi=BHI+DHI;
    const t=this.incidenceAngle(n,h),ct=Math.cos(this.toRadians(t));
    const beam=(cz>eps)?DNI*Math.max(0,ct):0;
    const diff=DHI*((1+Math.cos(this.toRadians(this.tiltAngle)))/2);
    const grnd=ghi*this.albedo*((1-Math.cos(this.toRadians(this.tiltAngle)))/2);
    return {totalIrradiance:Math.max(0,beam+diff+grnd),ghi,bhi:BHI};
  }
}

let pass=0, fail=0;
function ok(name, cond, detail=""){ if(cond){pass++; console.log(`  PASS  ${name}`);} else {fail++; console.log(`  FAIL  ${name}  ${detail}`);} }
function near(name, got, exp, tol){ ok(name, Math.abs(got-exp)<=tol, `got ${got.toFixed(3)} expected ${exp}±${tol}`); }

console.log("\n# Declination (Cooper) — known solstice/equinox values");
const c = new TiltedSurfaceRadiation(-33.87, 151.2, 30, 0);
near("Jun solstice +23.45 (n=172)", c.declinationAngle(172), 23.45, 0.1);
near("Dec solstice -23.45 (n=355)", c.declinationAngle(355), -23.45, 0.1);
near("Sep equinox ~0 (n=266), within Cooper's known +-1.5deg error", c.declinationAngle(266), 0, 1.5);

console.log("\n# Solar-noon zenith = |lat - decl|  (Sydney lat -33.87)");
near("Dec21 noon zenith 10.42", c.zenithAngle(355,12), Math.abs(-33.87-(-23.45)), 0.1);
near("Jun21 noon zenith 57.32", c.zenithAngle(172,12), Math.abs(-33.87-(23.45)), 0.1);

console.log("\n# Zenith symmetry about solar noon (±3h, equinox)");
near("zenith(9h)==zenith(15h)", c.zenithAngle(266,9)-c.zenithAngle(266,15), 0, 1e-6);

console.log("\n# Azimuth convention (south hemisphere): 0=N best, E/W symmetric");
function dayBeam(az,n){const k=new TiltedSurfaceRadiation(-33.87,151.2,30,az);let s=0;for(let h=4;h<=20;h+=0.1){if(k.zenithAngle(n,h)<90)s+=Math.max(0,Math.cos(k.toRadians(k.incidenceAngle(n,h))));}return s;}
ok("North beats South (winter)", dayBeam(0,172) > dayBeam(180,172)*5, `N=${dayBeam(0,172).toFixed(1)} S=${dayBeam(180,172).toFixed(1)}`);
near("East == West (symmetry)", dayBeam(90,266)-dayBeam(-90,266), 0, 1e-6);

console.log("\n# Transposition energy balance & guards");
const r1 = c.calculate(266,12, 800, 100);
ok("POA positive at noon", r1.totalIrradiance > 0, `${r1.totalIrradiance}`);
ok("GHI reconstructed = DNI*cosZ+DHI", Math.abs(r1.ghi-(800*Math.cos(c.toRadians(c.zenithAngle(266,12)))+100))<1e-6);
const night = c.calculate(266, 0, 0, 0);   // midnight, no radiation
ok("Night => 0 irradiance", night.totalIrradiance===0, `${night.totalIrradiance}`);
const noBeamBehind = c.calculate(172, 7, 600, 50); // winter early AM, sun low/behind
ok("No negative components", noBeamBehind.totalIrradiance>=0);
const horiz = new TiltedSurfaceRadiation(-33.87,151.2, 0, 0);  // flat plate
ok("Flat plate diffuse = full DHI", Math.abs(horiz.calculate(266,12,0,200).totalIrradiance - 200) < 1e-6, "tilt0 should pass DHI through");

console.log("\n# Edge cases — formulas must not NaN/throw");
for (const [lat,name] of [[0,"equator"],[-90,"south pole"],[66.5,"arctic circle"],[-33.87,"sydney"]]){
  const k = new TiltedSurfaceRadiation(lat,0,30,0);
  let bad=false;
  for (let n=1;n<=365;n+=30) for (let h=0;h<24;h++){ const v=k.calculate(n,h,500,80).totalIrradiance; if(!Number.isFinite(v)||v<0) bad=true; }
  ok(`No NaN/neg across year @ ${name}`, !bad);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);
