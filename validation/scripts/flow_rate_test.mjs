// Flow-rate sweep: does slowing the coolant flow raise the outlet water temperature?
// Exercises the REAL supply loop (Model A linear + Model B ISO 9806) copied VERBATIM
// from app.js. Read/test only — the thermal models are not modified.
// Run: node validation/scripts/flow_rate_test.mjs
import fs from "node:fs";

// ---- VERBATIM TiltedSurfaceRadiation (app.js 608-665) ----
class TiltedSurfaceRadiation {
  constructor(latitude, longitude, tiltAngle, surfaceAzimuth, albedo = 0.2){
    this.latitude = latitude; this.longitude = longitude;
    this.tiltAngle = tiltAngle; this.surfaceAzimuth = surfaceAzimuth; this.albedo = albedo;
  }
  toRadians(d){ return d*(Math.PI/180); }
  toDegrees(r){ return r*(180/Math.PI); }
  declinationAngle(n){ return 23.45*Math.sin(this.toRadians((360/365)*(n+284))); }
  hourAngle(h){ return 15*(h-12); }
  zenithAngle(dayN,hourN){
    const dR=this.toRadians(this.declinationAngle(dayN)), oR=this.toRadians(this.hourAngle(hourN)), lR=this.toRadians(this.latitude);
    const c=Math.sin(dR)*Math.sin(lR)+Math.cos(dR)*Math.cos(lR)*Math.cos(oR);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,c))));
  }
  incidenceAngle(dayN,hourN){
    const dR=this.toRadians(this.declinationAngle(dayN)), oR=this.toRadians(this.hourAngle(hourN)), lR=this.toRadians(this.latitude),
          sR=this.toRadians(this.tiltAngle), gR=this.toRadians(this.surfaceAzimuth-180);
    const i1=Math.sin(dR)*Math.sin(lR)*Math.cos(sR), i2=Math.sin(dR)*Math.cos(lR)*Math.sin(sR)*Math.cos(gR),
          i3=Math.cos(dR)*Math.cos(lR)*Math.cos(sR)*Math.cos(oR), i4=Math.cos(dR)*Math.sin(lR)*Math.sin(sR)*Math.cos(gR)*Math.cos(oR),
          i5=Math.cos(dR)*Math.sin(sR)*Math.sin(gR)*Math.sin(oR);
    return this.toDegrees(Math.acos(Math.min(1,Math.max(-1,i1-i2+i3+i4+i5))));
  }
  calculate(dayN,hourN,dni,dhi){
    const tZ=this.zenithAngle(dayN,hourN), cZ=Math.cos(this.toRadians(tZ)), eps=1e-6;
    const DNI=Math.max(0,dni||0), DHI=Math.max(0,dhi||0);
    const BHI=(cZ>eps)?(DNI*Math.max(0,cZ)):0, ghi=BHI+DHI;
    const tT=this.incidenceAngle(dayN,hourN), cT=Math.cos(this.toRadians(tT));
    const beam=(cZ>eps)?(DNI*Math.max(0,cT)):0;
    const diff=DHI*((1+Math.cos(this.toRadians(this.tiltAngle)))/2);
    const grnd=ghi*this.albedo*((1-Math.cos(this.toRadians(this.tiltAngle)))/2);
    return { totalIrradiance: Math.max(0,beam+diff+grnd) };
  }
}

const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const cToF=c=>c*9/5+32, fToC=f=>(f-32)*5/9;
const MONTH_DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
function monthFromDayN(d){ let s=0; for(let m=0;m<12;m++){ s+=MONTH_DAYS[m]; if(d<=s) return m+1; } return 12; }

// ---- mains model (app.js calculateLocalTMains), zone3 (Sydney) constants ----
const Z3={offsetF:-0.37705119,ratioC0:0.80057423,ratioC1:0.01158591,lagC0:39.97591642,lagC1:-1.98585011};
function mainsByDay(met,lat){
  const ta=met.map(r=>r.ta).filter(Number.isFinite);
  const avgC=ta.reduce((a,b)=>a+b,0)/ta.length;
  const mb=Array.from({length:12},()=>[]);
  for(const r of met){ if(Number.isFinite(r.dayN)&&Number.isFinite(r.ta)) mb[monthFromDayN(r.dayN)-1].push(r.ta); }
  const mAvg=mb.map(a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:avgC);
  const dMonthC=Math.max(...mAvg)-Math.min(...mAvg);
  const avgF=cToF(avgC), dMonthF=dMonthC*9/5;
  const ratio=Z3.ratioC0+Z3.ratioC1*(avgF-44), lag=Z3.lagC0+Z3.lagC1*(avgF-44);
  const byDay={};
  for(let day=1;day<=365;day++){
    const md=lat>=0?day:(((day+182-1)%365)+1);
    const ang=(0.986*(md-15-lag)-90)*Math.PI/180;
    byDay[day]=fToC((avgF+Z3.offsetF)+ratio*(dMonthF/2)*Math.sin(ang));
  }
  return { byDay, annualAvgC: Object.values(byDay).reduce((a,b)=>a+b,0)/365 };
}

// ---- defaults from index.html / app.js ----
const A=20, etaPv=0.20;
const a0=0.279952866, a1=-10.52839866, a2=-0.008135537;                 // Model A
const isoEta0=0.762, isoA1=3.93, isoA2=0.0095, isoA3=0, isoA4=0, isoA6=0, isoA8=0, isoTout0=40, isoIterMax=5; // Model B
const SIGMA=5.67e-8;
const U_WIND=0; // fixture has no wind; Model B defaults a3=a6=0 so this is irrelevant there

const data=JSON.parse(fs.readFileSync("validation/fixtures/tmy/tmy_sydney.json","utf8"));
const met=data.records.map(r=>({...r, hourN:(r.hourN>=1&&r.hourN<=24)?r.hourN-1:r.hourN}));
const mains=mainsByDay(met,data.lat);
const calc=new TiltedSurfaceRadiation(data.lat,data.lon,data.tilt,0,data.albedo);

function runYear(model, flowRate){
  const totalFlow_kg_hr = flowRate*A*3600;
  let E_th=0, E_pv=0, opHours=0, sumTout=0, maxTout=-Infinity;
  let over60=0, over90=0, over100=0;
  for(const r of met){
    if(![r.dayN,r.hourN,r.dni,r.dhi,r.ta].every(Number.isFinite)) continue;
    const G=Math.max(0,calc.calculate(r.dayN,r.hourN,r.dni,r.dhi).totalIrradiance);
    const Tin=mains.byDay[r.dayN] ?? mains.annualAvgC;
    const pv_kWh=(etaPv*G*A)/1000; E_pv+=pv_kWh;
    let th_W=0;
    if(model==="A"){
      let eta=0;
      if(G>1e-6){ eta=a0+a1*((Tin-r.ta)/G)+a2*U_WIND; eta=clamp(eta,0,1); }
      th_W=eta*G*A;
    } else {
      const Ta_K=r.ta+273.15, Ta4=SIGMA*Math.pow(Ta_K,4), EL=5.31e-13*Math.pow(Ta_K,6), u=U_WIND;
      if(G>1e-6 && totalFlow_kg_hr>1e-12){
        const mdot_cp=(totalFlow_kg_hr/3600)*4184;
        let Tout=isoTout0;
        for(let it=0;it<isoIterMax;it++){
          const Tm=(Tin+Tout)/2, dT=Tm-r.ta;
          const Qm=A*(isoEta0*G-isoA1*dT-isoA2*dT*dT-isoA3*u*dT+isoA4*(EL-Ta4)-isoA6*u*G-isoA8*Math.pow(dT,4));
          const Qf=mdot_cp*(Tout-Tin);
          const dQm=A*(-isoA1*0.5-isoA2*dT-isoA3*u*0.5-isoA8*2*Math.pow(dT,3));
          const step=(Qf-Qm)/(mdot_cp-dQm); Tout-=step; if(Math.abs(step)<1e-4) break;
        }
        const Tm=(Tin+Tout)/2, dT=Tm-r.ta;
        th_W=Math.max(0,A*(isoEta0*G-isoA1*dT-isoA2*dT*dT-isoA3*u*dT+isoA4*(EL-Ta4)-isoA6*u*G-isoA8*Math.pow(dT,4)));
      }
    }
    const th_kWh=th_W/1000; E_th+=th_kWh;
    if(th_kWh>1e-12 && totalFlow_kg_hr>1e-12){
      const Tout=Tin+(th_kWh*3600)/(totalFlow_kg_hr*4.184);
      opHours++; sumTout+=Tout; if(Tout>maxTout) maxTout=Tout;
      if(Tout>60) over60++; if(Tout>90) over90++; if(Tout>100) over100++;
    }
  }
  return { E_th, E_pv, opHours, meanTout: opHours?sumTout/opHours:0, maxTout, over60, over90, over100, totalFlow_kg_hr };
}

const flows=[0.005,0.0075,0.01,0.02,0.04,0.08];
const pad=(s,n)=>String(s).padStart(n);
for(const model of ["A","B"]){
  console.log(`\n=== Model ${model} ${model==="A"?"(simple linear)":"(ISO 9806)"} — Sydney, A=${A} m2, tilt 30 N ===`);
  console.log("flow(L/s/m2)  E_th(kWh)  E_pv(kWh)  meanTout  maxTout  hrs>60  hrs>90  hrs>100");
  for(const f of flows){
    const x=runYear(model,f);
    console.log(
      pad(f.toFixed(4),11), pad(x.E_th.toFixed(0),10), pad(x.E_pv.toFixed(0),10),
      pad(x.meanTout.toFixed(1),9), pad(x.maxTout.toFixed(1),8),
      pad(x.over60,7), pad(x.over90,7), pad(x.over100,8),
      f===0.02?"  <- default":"");
  }
}
console.log(`\nMains annual avg Tin = ${mains.annualAvgC.toFixed(1)} C (BC-Aus zone3 Sydney)`);
