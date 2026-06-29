// Group F: reference-link integrity. Extracts every http(s) URL cited in js/app.js
// and checks each resolves. Browser-like UA; 2xx/3xx = OK. Some sites block bots
// (403/405) even when the link is fine, so those are reported as REVIEW, not fail.
// Run: node validation/check_links.mjs
import fs from "node:fs";

const APP_JS_PATH = new URL("../js/app.js", import.meta.url);
const SRC = fs.readFileSync(APP_JS_PATH, "utf8");
const urls = [...new Set((SRC.match(/https?:\/\/[^\s"'`)]+/g) || [])
  .map(u => u.replace(/[.,);]+$/, "")))]
  .filter(u => !u.includes("${"))
  .filter(u => !/onrender\.com|localhost|example\.com/.test(u)); // skip API/dev hosts

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function check(url){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    let r = await fetch(url, { method:"GET", redirect:"follow", signal:ctrl.signal, headers:{ "User-Agent":UA, "Accept":"*/*" } });
    clearTimeout(t);
    return { url, status:r.status, ok:r.ok };
  } catch(e){ clearTimeout(t); return { url, status:0, ok:false, err:String(e.name||e.message) }; }
}

const out = [];
for (let i=0; i<urls.length; i+=5){
  const batch = await Promise.all(urls.slice(i,i+5).map(check));
  out.push(...batch);
}

let okN=0, reviewN=0, badN=0;
console.log(`\nChecked ${out.length} cited URLs in js/app.js\n`);
for (const r of out.sort((a,b)=>a.status-b.status)){
  const tag = r.ok ? "OK    " : ([401,403,405,429].includes(r.status) ? "REVIEW" : "BAD   ");
  if (r.ok) okN++; else if (tag==="REVIEW") reviewN++; else badN++;
  if (!r.ok) console.log(`  ${tag} ${r.status||r.err||"ERR"}  ${r.url}`);
}
console.log(`\n=== ${okN} OK · ${reviewN} review (bot-blocked, likely fine) · ${badN} broken ===`);
console.log(badN ? "Investigate BAD links above." : "No broken links.");
