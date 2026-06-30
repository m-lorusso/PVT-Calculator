class T {
  toRadians(d){return d*Math.PI/180;} toDegrees(r){return r*180/Math.PI;}
  constructor(lat,tilt,az){this.latitude=lat;this.tiltAngle=tilt;this.surfaceAzimuth=az;}
  declinationAngle(n){return 23.45*Math.sin(this.toRadians((360/365)*(n+284)));}
  hourAngle(h){return 15*(h-12);}
  zenithAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,Math.sin(d)*Math.sin(L)+Math.cos(d)*Math.cos(L)*Math.cos(w)))));}
  incidenceAngle(n,h){const d=this.toRadians(this.declinationAngle(n)),w=this.toRadians(this.hourAngle(h)),L=this.toRadians(this.latitude),s=this.toRadians(this.tiltAngle),g=this.toRadians(this.surfaceAzimuth-180);
    const i1=Math.sin(d)*Math.sin(L)*Math.cos(s),i2=Math.sin(d)*Math.cos(L)*Math.sin(s)*Math.cos(g),i3=Math.cos(d)*Math.cos(L)*Math.cos(s)*Math.cos(w),i4=Math.cos(d)*Math.sin(L)*Math.sin(s)*Math.cos(g)*Math.cos(w),i5=Math.cos(d)*Math.sin(s)*Math.sin(g)*Math.sin(w);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,i1-i2+i3+i4+i5))));}
}
const lat=-33.8698;
function dayBeam(n,az){const c=new T(lat,30,az);let s=0;for(let h=4;h<=20;h+=0.1){const z=c.zenithAngle(n,h);if(z<90){const it=c.incidenceAngle(n,h);s+=Math.max(0,Math.cos(c.toRadians(it)));}}return s;}
for (const [name,n] of [["Winter solstice Jun21",172],["Equinox Sep23",266],["Annual avg (12 days)",-1]]){
  if(n>0){
    console.log(`${name}: N=${dayBeam(n,0).toFixed(2)}  S=${dayBeam(n,180).toFixed(2)}  E=${dayBeam(n,90).toFixed(2)}  W=${dayBeam(n,-90).toFixed(2)}`);
  } else {
    let N=0,S=0;for(let d=15;d<365;d+=30){N+=dayBeam(d,0);S+=dayBeam(d,180);}
    console.log(`${name}: N=${N.toFixed(1)}  S=${S.toFixed(1)}  ratio N/S=${(N/S).toFixed(2)}`);
  }
}
console.log("\n=> Winter & equinox: North must clearly beat South. Annual N/S ratio should be >1.");
