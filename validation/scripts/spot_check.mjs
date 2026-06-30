class T {
  toRadians(d){return d*Math.PI/180;} toDegrees(r){return r*180/Math.PI;}
  constructor(lat,tilt,az){this.latitude=lat;this.tiltAngle=tilt;this.surfaceAzimuth=az;this.albedo=0.2;}
  declinationAngle(n){return 23.45*Math.sin(this.toRadians((360/365)*(n+284)));}
  hourAngle(h){return 15*(h-12);}
  zenithAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,Math.sin(d)*Math.sin(L)+Math.cos(d)*Math.cos(L)*Math.cos(w)))));}
  incidenceAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude),s=this.toRadians(this.tiltAngle),g=this.toRadians(this.surfaceAzimuth-180);
    const i1=Math.sin(d)*Math.sin(L)*Math.cos(s),i2=Math.sin(d)*Math.cos(L)*Math.sin(s)*Math.cos(g),i3=Math.cos(d)*Math.cos(L)*Math.cos(s)*Math.cos(w),i4=Math.cos(d)*Math.sin(L)*Math.sin(s)*Math.cos(g)*Math.cos(w),i5=Math.cos(d)*Math.sin(s)*Math.sin(g)*Math.sin(w);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,i1-i2+i3+i4+i5))));}
}
const lat=-33.8698;
const t=new T(lat,30,0);
console.log("=== DECLINATION (Cooper) vs known ===");
console.log("Jun21 (n=172):", t.declinationAngle(172).toFixed(2), " expect ~ +23.45 (S-hemi winter solstice, sun north)");
console.log("Dec21 (n=355):", t.declinationAngle(355).toFixed(2), " expect ~ -23.45 (S-hemi summer solstice)");
console.log("Mar21 (n=80): ", t.declinationAngle(80).toFixed(2),  " expect ~ 0 (equinox)");
console.log("\n=== SOLAR-NOON ZENITH at Sydney lat -33.87 ===");
const noonDec = t.zenithAngle(355,12), expDec = Math.abs(lat-(-23.45));
const noonJun = t.zenithAngle(172,12), expJun = Math.abs(lat-(23.45));
console.log("Dec21 noon zenith:", noonDec.toFixed(2), " expect |lat-decl| =", expDec.toFixed(2));
console.log("Jun21 noon zenith:", noonJun.toFixed(2), " expect |lat-decl| =", expJun.toFixed(2));
console.log("\n=== AZIMUTH FIX: clear-sky day, beam-on-tilt sum (relative) ===");
// crude: integrate cos(incidence) over daylight on Dec21 for N vs S facing
function dayBeam(az){const c=new T(lat,30,az);let s=0;for(let h=5;h<=19;h+=0.25){const z=c.zenithAngle(355,h);if(z<90){const it=c.incidenceAngle(355,h);s+=Math.max(0,Math.cos(c.toRadians(it)));}}return s;}
console.log("North-facing (az=0)  beam sum:", dayBeam(0).toFixed(2));
console.log("South-facing (az=180) beam sum:", dayBeam(180).toFixed(2));
console.log("East-facing  (az=90)  beam sum:", dayBeam(90).toFixed(2));
console.log("West-facing  (az=-90) beam sum:", dayBeam(-90).toFixed(2));
console.log("=> North should be largest for Australia. E and W should be ~equal.");
