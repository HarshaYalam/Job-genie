const $ = id => document.getElementById(id);
const Q = Object.fromEntries(new URLSearchParams(location.search));
let p = {t:"", l:"", y:"5", c:"in", a:"7", smin:"", smax:"", hide:false}, qry = "", yrs = 5, CV = null, PREF = null;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.js");

const formParams = () => ({title:$("title").value, loc:$("loc").value, lvl:$("lvl").value, cty:$("cty").value, age:$("age").value,
  smin:$("smin").value, smax:$("smax").value, hide:$("hide").checked ? "1" : ""});
$("f").onsubmit = ev => { ev.preventDefault(); location.search = new URLSearchParams(formParams()).toString(); };
const unitLabel = () => { const u = UNITS[$("cty").value]; $("sunit").textContent = u ? u.l : "n/a for this country"; };
$("cty").addEventListener("change", unitLabel);

/* ---------- helpers ---------- */
const strip = s => (new DOMParser().parseFromString(s || "", "text/html").body.textContent || "").trim();
function get(url, opt = {}){
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  return fetch(url, {credentials:"include", cache:"no-store", ...opt, signal:c.signal}).finally(() => clearTimeout(t));
}
function parseRel(s){
  if (!s) return 0;
  if (/just|today|few (hours|minutes)|now/i.test(s)) return Date.now();
  const m = s.match(/(\d+)\+?\s*(minute|min|hour|day|week|month)/i); if (!m) return 0;
  const u = {min:6e4,minute:6e4,hour:36e5,day:864e5,week:6048e5,month:2592e6}[m[2].toLowerCase()];
  return Date.now() - (+m[1]) * u;
}
function ago(ts){
  if (!ts) return "";
  const m = Math.max(0, (Date.now() - ts) / 6e4);
  if (m < 60) return m < 2 ? "Just now" : Math.round(m) + " min ago";
  if (m < 1440) return Math.round(m / 60) + " hr ago";
  const d = m / 1440;
  if (d < 14) return Math.round(d) + (Math.round(d) === 1 ? " day ago" : " days ago");
  if (d < 60) return Math.round(d / 7) + " weeks ago";
  return Math.round(d / 30) + " months ago";
}
const J = o => ({...o});
const A = () => +p.a || 0;
const withSal = (o, txt) => { o.salTxt = txt || ""; o.sal = parseSalary(txt, p.c); return o; };

/* ---------- portal fetchers ---------- */
async function fLinkedIn(){
  const r = await get(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${enc(p.t)}&location=${enc(p.l)}&f_E=${LI_E[p.y]}&sortBy=DD&start=0${A() ? "&f_TPR=r" + A() * 86400 : ""}&_=${Date.now()}`, {credentials:"omit"});
  if (!r.ok) throw new Error("HTTP " + r.status);
  const doc = new DOMParser().parseFromString(await r.text(), "text/html");
  return [...doc.querySelectorAll("li")].map(li => {
    const card = li.querySelector(".base-card"); if (!card) return null;
    const id = (card.getAttribute("data-entity-urn") || "").split(":").pop();
    const tx = s => ((li.querySelector(s) || {}).textContent || "").trim();
    const tm = li.querySelector("time"), dt = tm && tm.getAttribute("datetime");
    const a = li.querySelector("a.base-card__full-link");
    const j = J({title:tx(".base-search-card__title"), company:tx(".base-search-card__subtitle"), loc:tx(".job-search-card__location"),
      ts: dt ? Date.parse(dt) : parseRel(tm && tm.textContent), age: tm ? tm.textContent.trim() : "",
      url: a ? a.getAttribute("href").split("?")[0] : `https://www.linkedin.com/jobs/view/${id}`});
    withSal(j, tx(".job-search-card__salary-info"));
    j.detail = async () => {
      const r2 = await get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, {credentials:"omit"});
      const d = new DOMParser().parseFromString(await r2.text(), "text/html");
      const md = d.querySelector(".show-more-less-html__markup");
      const desc = md ? md.innerHTML.replace(/<(br|\/p|\/li)\s*\/?>/gi, "\n") : "";
      const crit = [...d.querySelectorAll(".description__job-criteria-item")].map(x =>
        ((x.querySelector("h3") || {}).textContent || "").trim() + ": " + ((x.querySelector("span") || {}).textContent || "").trim());
      const sal = ((d.querySelector(".compensation__salary") || {}).textContent || "").trim();
      return {desc: strip(desc), crit, sal};
    };
    return j;
  }).filter(Boolean);
}
async function fIndeed(){
  const a = A();
  const r = await get(`https://${IN_DOM[p.c]}/jobs?q=${enc(qry)}&l=${enc(p.l)}&sort=date${[1,3,7,14].includes(a) ? "&fromage=" + a : ""}&_=${Date.now()}`);
  if (r.status === 403 || r.status === 429) throw new Error("Indeed blocked the request");
  const h = await r.text();
  const m = h.match(/mosaic-provider-jobcards"\]\s*=\s*(\{.*?\});?\s*\n/s);
  if (!m) throw new Error("Indeed asked for a check; open it once on the site");
  const res = (JSON.parse(m[1]).metaData || {}).mosaicProviderJobCardsModel.results || [];
  return res.map(x => withSal(J({title:x.displayTitle || x.title, company:x.company, loc:x.formattedLocation,
    ts:x.pubDate || parseRel(x.formattedRelativeTime), age:x.formattedRelativeTime || "",
    url:`https://${IN_DOM[p.c]}/viewjob?jk=${x.jobkey}`, desc:strip(x.snippet), extra:(x.jobTypes || []).slice(0, 3)}), (x.salarySnippet || {}).text));
}
async function fNaukri(){
  const r = await get(`https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_key_loc&searchType=adv&keyword=${enc(p.t)}&location=${enc(p.l)}&k=${enc(p.t)}&l=${enc(p.l)}&experience=${yrs}&pageNo=1&sort=f&src=jobsearchDesk${A() ? "&jobAge=" + A() : ""}&_=${Date.now()}`,
    {credentials:"omit", headers:{appid:"109", systemid:"109", clientid:"d3skt0p", Accept:"application/json"}});
  if (!r.ok) throw new Error("Naukri blocked the request (HTTP " + r.status + ")");
  return ((await r.json()).jobDetails || []).map(d => {
    const ph = t => ((d.placeholders || []).find(x => x.type === t) || {}).label || "";
    return withSal(J({title:d.title, company:d.companyName, loc:ph("location"),
      ts:Number(d.createdDate) || parseRel(d.footerPlaceholderLabel), age:d.footerPlaceholderLabel || "",
      url:d.jdURL && d.jdURL[0] === "/" ? "https://www.naukri.com" + d.jdURL : d.jdURL,
      desc:strip(d.jobDescription), extra:[ph("experience") && ph("experience") + " exp", ...(d.tagsAndSkills || "").split(",").slice(0,10)].filter(Boolean)}), ph("salary"));
  });
}
async function fFoundit(){
  if (p.c !== "in") throw new Error("No live feed outside India");
  const r = await get(`https://www.foundit.in/middleware/jobsearch?start=0&limit=20&query=${enc(qry)}&locations=${enc(p.l)}&queryDerived=true&_=${Date.now()}`, {credentials:"omit", headers:{Accept:"application/json"}});
  if (!r.ok) throw new Error("foundit blocked the request (HTTP " + r.status + ")");
  const data = ((await r.json()).jobSearchResponse || {}).data || [];
  return data.map(d => withSal(J({title:d.title, company:d.companyName || (d.company || {}).name, loc:[].concat(d.locations || []).map(x => x.city || x).join(", "),
    ts:Number(d.updatedAt || d.postedAt) || 0, url:d.seoJdUrl ? "https://www.foundit.in" + d.seoJdUrl : `https://www.foundit.in/srp/results?query=${enc(qry)}&locations=${enc(p.l)}`,
    desc:strip(d.summary || d.description), extra:[].concat(d.skills || []).map(x => x.text || x).slice(0,10)}), typeof d.salary === "string" ? d.salary : (d.salary || {}).text));
}
async function fJobStreet(){
  const dom = JS_DOM[p.c]; if (!dom) throw new Error("Not available in this country");
  const dr = A() ? "&daterange=" + (A() >= 30 ? 31 : A()) : "";
  const r = await get(`https://${dom}/api/jobsearch/v5/search?siteKey=${JS_SITE[p.c]}&sourcesystem=houston&page=1&pageSize=20&keywords=${enc(qry)}&where=${enc(p.l)}&sortmode=ListedDate${dr}&_=${Date.now()}`, {credentials:"omit", headers:{Accept:"application/json"}});
  if (!r.ok) throw new Error("JobStreet blocked the request (HTTP " + r.status + ")");
  return ((await r.json()).data || []).map(d => withSal(J({title:d.title, company:d.companyName || (d.advertiser || {}).description,
    loc:((d.locations || [])[0] || {}).label || "", ts:Date.parse(d.listingDate) || 0, url:`https://${dom}/job/${d.id}`,
    desc:[d.teaser, ...(d.bulletPoints || [])].filter(Boolean).join("\n"), extra:(d.workTypes || [])}), d.salaryLabel));
}
const PORTALS = [
  {n:"LinkedIn", c:"#0a66c2", f:fLinkedIn}, {n:"Indeed", c:"#2557a7", f:fIndeed}, {n:"Naukri", c:"#4a90e2", f:fNaukri},
  {n:"Monster", c:"#6e46ae", f:fFoundit}, {n:"JobStreet", c:"#0d3880", f:fJobStreet}
];
const siteLink = n => (links(p).find(x => x.n === n) || {}).u;

/* ---------- matching ---------- */
const words = s => (s.toLowerCase().match(/[a-z#+.]{2,}/g) || []).filter(w => !["and","the","for","with","senior","junior","jr","sr","executive","lead"].includes(w));
function salFit(j){
  if (!PREF || !j.sal) return null;
  if (PREF.min && j.sal.max < PREF.min * 0.97) return "below";
  if (PREF.max && j.sal.min > PREF.max) return "above";
  return "ok";
}
function score(j){
  if (!CV) return null;
  const text = [j.title, j.desc, ...(j.extra || []), ...(j.crit || [])].join(" ");
  const jobSk = skillsIn(text), have = new Set(CV.profile.skills);
  const matched = jobSk.filter(s => have.has(s)), missing = jobSk.filter(s => !have.has(s));
  const wanted = new Set([...words(p.t), ...CV.profile.titles.flatMap(words), ...CV.profile.roles.slice(0, 2).flatMap(r => words(r.n))]);
  const tw = words(j.title).slice(0, 4);
  const titleScore = tw.length ? Math.min(1, tw.filter(w => wanted.has(w)).length / Math.min(tw.length, 2)) : 0;
  const skillScore = jobSk.length ? matched.length / jobSk.length : 0.45;
  let expScore = 0.7;
  const em = text.match(/(\d{1,2})\s*(?:\+|-|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years|yrs)/i);
  if (em) { const lo = +em[1], y = CV.profile.years; expScore = y >= lo ? 1 : Math.max(0, 1 - (lo - y) / 5); }
  const cl = SEL2LVL[p.y] === undefined ? CV.profile.level : SEL2LVL[p.y], jl = titleLevel(j.title);
  const senScore = jl === null ? (Math.abs(cl - 2) <= 1 ? 0.8 : 0.5) : jl === cl ? 1 : Math.abs(jl - cl) === 1 ? 0.6 : 0.15;
  const sf = salFit(j), salScore = !PREF ? 1 : sf === "below" ? 0 : sf ? 1 : 0.7;
  const pct = Math.round(100 * (0.48 * skillScore + 0.30 * titleScore + 0.12 * (0.5 * expScore + 0.5 * senScore) + 0.10 * salScore));
  return {pct, matched, missing, jl, mismatch: jl !== null && Math.abs(jl - cl) >= 2, sf};
}

/* ---------- state + rendering ---------- */
const LOADER = '<div class="loader"><img src="images/genie-opening.gif" alt="The genie is searching"><p>The genie is searching LinkedIn, Indeed, Naukri, Monster and JobStreet for fresh postings…</p></div>';
let jobs = [], status = {}, active = new Set(PORTALS.map(x => x.n)), view = [], timer = 0;
const later = () => { clearTimeout(timer); timer = setTimeout(renderJobs, 250); };

function renderStatus(){
  $("status").innerHTML = PORTALS.map(x => {
    const s = status[x.n] || {s:"loading"};
    const txt = s.s === "loading" ? "searching…" : s.s === "ok" ? s.n + " jobs" : esc(s.m);
    const link = s.s === "err" ? ` <a href="${siteLink(x.n)}" target="_blank">Open on site</a>` : "";
    return `<span class="st ${s.s} ${active.has(x.n) ? "" : "off"}" data-n="${x.n}" style="--c:${x.c}"><span class="dot"></span><b>${x.n}</b> ${txt}${link}</span>`;
  }).join("");
}
$("status").onclick = e => {
  if (e.target.tagName === "A") return;
  const el = e.target.closest(".st"); if (!el) return;
  const n = el.dataset.n; active.has(n) ? active.delete(n) : active.add(n);
  renderStatus(); renderJobs();
};
["q","sort"].forEach(k => $(k).addEventListener("input", renderJobs));

function salChip(j, m){
  const sf = m ? m.sf : salFit(j);
  if (j.sal) return `<span class="sal-chip ${sf || "nd"}">💰 ${esc(fmtSalary(j.sal, p.c))}${sf === "ok" ? " ✓ in range" : sf === "below" ? " ↓ below yours" : sf === "above" ? " ↑ above yours" : ""}</span>`;
  if (j.salTxt) return `<span class="sal-chip nd">💰 ${esc(j.salTxt.slice(0, 40))}</span>`;
  return `<span class="sal-chip nd">💰 Not disclosed</span>`;
}
function detHTML(j){
  const text = [j.title, j.desc, ...(j.extra || []), ...(j.crit || [])].join("\n");
  return (j.crit && j.crit.length ? `<h2>Job details</h2><ul>${j.crit.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "") +
    (j.m ? `<h2>Your CV vs this job</h2><div class="lbl">You have</div>${chipsHTML(j.m.matched, "good")}<div class="lbl">Gaps</div>${chipsHTML(j.m.missing, "gap")}` : "") +
    reqHTML(text) + (j.desc ? `<h2>Description</h2><div class="full">${esc(j.desc)}</div>` : `<p class="none">Open the posting for the full description.</p>`);
}
function renderJobs(){
  jobs.forEach(j => { j.m = score(j); });
  const f = $("q").value.toLowerCase();
  view = jobs.filter(j => active.has(j.portal) && !(p.hide && salFit(j) === "below") &&
    (!f || (j.title + " " + j.company + " " + j.loc + " " + (j.desc || "")).toLowerCase().includes(f)));
  const s = $("sort").value, t = j => j.ts || 0;
  if (s === "match" && CV) view.sort((a, b) => b.m.pct - a.m.pct || t(b) - t(a));
  else if (s === "salary") view.sort((a, b) => ((b.sal && b.sal.max) || 0) - ((a.sal && a.sal.max) || 0) || t(b) - t(a));
  else if (s === "portal") view.sort((a, b) => a.portal.localeCompare(b.portal) || t(b) - t(a));
  else view.sort((a, b) => t(b) - t(a));
  $("count").textContent = view.length + " jobs";
  $("jobs").innerHTML = view.map((j, i) => {
    const d = j.ts ? (Date.now() - j.ts) / 864e5 : 99, cls = d <= 3 ? "fresh" : d <= 14 ? "mid" : "old";
    const age = j.age || ago(j.ts) || "Date n/a";
    const mc = j.m ? (j.m.pct >= 65 ? "hi" : j.m.pct >= 40 ? "md" : "lo") : "";
    const lv = j.m && j.m.jl !== null && j.m.jl !== undefined ? `<span class="chip ${j.m.mismatch ? "warn" : ""}">${j.m.mismatch ? "⚠ " : ""}${LEVELS[j.m.jl]}</span>` : "";
    return `<div class="card" style="--c:${j.color}" data-i="${i}">
      <div class="top"><div><h3>${esc(j.title)}</h3><div class="meta">${esc(j.company)}${j.loc ? " · " + esc(j.loc) : ""}</div></div>
      <div style="text-align:right">${j.m ? `<span class="match ${mc}">${j.m.pct}% match</span><br>` : ""}<span class="badge">${j.portal}</span> <span class="age ${cls}" title="Posting age">🕒 ${esc(age)}</span></div></div>
      <div class="chips">${salChip(j, j.m)}${lv}</div>
      ${j.m && j.m.matched.length ? `<div class="chips">${j.m.matched.slice(0, 6).map(x => `<span class="chip good">✓ ${esc(x)}</span>`).join("")}${j.m.missing.slice(0, 3).map(x => `<span class="chip gap">${esc(x)}</span>`).join("")}</div>` : ""}
      ${j.extra && j.extra.length ? `<div class="chips">${j.extra.slice(0, 6).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
      ${j.desc ? `<div class="snip">${esc(j.desc.slice(0, 200))}${j.desc.length > 200 ? "…" : ""}</div>` : ""}
      <div class="acts"><button data-act="det">Details &amp; requirements ▾</button><a href="${esc(j.url)}" target="_blank" rel="noopener">Open &amp; apply ↗</a></div>
      <div class="det ${j.open ? "open" : ""}">${j.open ? detHTML(j) : ""}</div></div>`;
  }).join("") || `<p class="muted">${PORTALS.every(x => status[x.n] && status[x.n].s !== "loading") ? "No jobs found. Try a broader title, 'Any time', or untick the salary filter." : "Searching…"}</p>`;
  if (!jobs.length && p.t && PORTALS.some(x => !status[x.n] || status[x.n].s === "loading")) $("jobs").innerHTML = LOADER;
}
async function loadDetail(j){
  const d = await j.detail(); j.desc = d.desc || j.desc; j.crit = d.crit;
  if (d.sal && !j.salTxt) { j.salTxt = d.sal; j.sal = parseSalary(d.sal, p.c); }
}
$("jobs").onclick = async e => {
  const b = e.target.closest("[data-act=det]"); if (!b) return;
  const j = view[+b.closest(".card").dataset.i];
  j.open = !j.open; renderJobs();
  if (j.open && !j.loaded && j.detail) { try { await loadDetail(j); } catch (err) {} j.loaded = true; renderJobs(); }
};
$("copy").onclick = () => {
  const txt = view.slice(0, 10).map((j, i) => `${i + 1}. ${j.title} - ${j.company} (${j.portal}, ${j.age || ago(j.ts) || "date n/a"})${j.m ? " " + j.m.pct + "% match" : ""}${j.sal ? " | " + fmtSalary(j.sal, p.c) : ""}\n   ${j.url}`).join("\n");
  navigator.clipboard.writeText(txt).then(() => { $("copy").textContent = "Copied ✓"; setTimeout(() => $("copy").textContent = "Copy top 10", 1500); });
};
async function prefetch(list){
  const q = list.filter(j => j.detail).slice(0, 12); let i = 0;
  await Promise.all([0, 1, 2].map(async () => {
    while (i < q.length) { const j = q[i++]; try { await loadDetail(j); j.loaded = true; } catch (e) {} later(); }
  }));
}

/* ---------- CV upload ---------- */
async function readCV(file){
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt" || ext === "md") return file.text();
  if (ext === "pdf") {
    const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise; let t = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      t += c.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return t;
  }
  if (ext === "docx") {
    const z = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await z.file("word/document.xml").async("string");
    return xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  throw new Error("Please upload a PDF, DOCX or TXT file.");
}
async function handleFile(file){
  if (!file) return;
  $("cvinfo").textContent = "Reading " + file.name + "…"; $("cvinfo").classList.remove("err");
  try {
    const text = await readCV(file);
    if (text.trim().length < 50) throw new Error("Couldn't read text from this file (scanned image?). Try a DOCX or TXT version.");
    await chrome.storage.local.set({cv:{file:file.name, name:analyzeCV(text).name, text:text.slice(0, 30000), ts:Date.now()}});
    const keep = new URLSearchParams({cv:"1", age:$("age").value || "7"});
    if ($("smin").value) keep.set("smin", $("smin").value);
    if ($("smax").value) keep.set("smax", $("smax").value);
    if ($("hide").checked) keep.set("hide", "1");
    location.search = keep.toString();
  } catch (err) { $("cvinfo").textContent = err.message || "Could not read the file."; $("cvinfo").classList.add("err"); }
}
$("up").onclick = () => $("file").click();
$("file").onchange = e => handleFile(e.target.files[0]);
const box = $("cvbox");
["dragover","dragenter"].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add("drag"); }));
["dragleave","drop"].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove("drag"); }));
box.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));

/* ---------- CV insight cards ---------- */
const li = a => a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="none">Not found in your CV.</p>`;
const fmtM = m => Math.floor(m / 12) + " yr " + (m % 12) + " mo";
function renderProfile(){
  if (!CV) { $("profile").innerHTML = ""; return; }
  const pr = CV.profile, sn = pr.seniority, best = pr.roles[0];
  $("up").textContent = "📄 Replace CV";
  $("cvinfo").textContent = `Using: ${CV.file} (uploaded ${new Date(CV.ts).toLocaleDateString()})`;
  const contact = [pr.email && "✉ " + pr.email, pr.phone && "☎ " + pr.phone, pr.loc && "📍 " + pr.loc, pr.linkedin && "in/" + pr.linkedin.split("/in/")[1], pr.github && pr.github].filter(Boolean);
  const card1 = `<div class="ic wide"><h2>📄 CV details I captured${pr.name ? " — " + esc(pr.name) : ""}</h2>
    <div class="kv">${contact.map(x => `<span>${esc(x)}</span>`).join("") || "<span>No contact details found</span>"}<span>🕒 ${pr.years} yrs experience</span></div>
    ${pr.summary ? `<h3>Summary</h3><p style="margin:0;font-size:13px">${esc(pr.summary)}</p>` : ""}
    <h3>Skills found (${pr.skills.length})</h3>${chipsHTML(pr.skills, "good")}
    <details><summary>Experience (${pr.exp.length}) · total ${fmtM(pr.months)}</summary>${li(pr.exp.map(x => x.line + "  (" + fmtM(x.months) + ")"))}</details>
    <details><summary>Education (${pr.edu.length})</summary>${li(pr.edu)}</details>
    <details><summary>Certifications (${pr.certs.length})</summary>${li(pr.certs)}</details>
    ${pr.projects.length ? `<details><summary>Projects (${pr.projects.length})</summary>${li(pr.projects)}</details>` : ""}
    <details><summary>Raw text read from your CV</summary><div class="full">${esc(CV.text.slice(0, 6000))}</div></details></div>`;
  const dots = LEVELS.map((_, i) => `<i class="${i <= pr.level ? "on" : ""}"></i>`).join("");
  const card2 = `<div class="ic"><h2>📊 Seniority check</h2><b>${esc(sn.label)}</b><div class="dots">${dots}</div>
    <div class="verdict ${sn.eligible ? "ok" : "no"}">${sn.eligible ? "✅ Eligible for senior roles" : "⚠ Not yet clearly senior"}</div>
    <p style="margin:0 0 6px;font-size:13px">${esc(sn.reason)}</p>${li(sn.evidence)}
    <button class="sm" data-lvl="${pr.lvl}">Search as ${esc(sn.label)}</button> ${sn.eligible && pr.level < 3 ? `<button class="sm" data-lvl="8">Try Senior roles</button>` : ""}</div>`;
  const fitOK = best && best.fit >= 40;
  const card3 = `<div class="ic"><h2>🎯 Positions suitable for you</h2>
    ${best ? `<div class="verdict ${fitOK ? "ok" : "no"}">${fitOK ? "✅ Best fit: " : "⚠ Closest fit: "}${esc(best.label)} (${best.fit}%)</div>` : `<p class="none">Not enough skills found to suggest roles.</p>`}
    ${pr.roles.map(r => `<div class="role"><div class="rt"><b>${esc(r.label)}</b><button class="sm" data-t="${esc(r.label)}">Search</button></div>
      <div class="bar2"><i style="width:${r.fit}%"></i></div><span class="muted">${r.fit}% fit</span>${chipsHTML(r.matched.slice(0, 6), "good")}${r.gaps.length ? `<div class="lbl">Add to improve</div>${chipsHTML(r.gaps, "gap")}` : ""}</div>`).join("")}</div>`;
  const card4 = `<div class="ic wide"><h2>🌍 Which country can I apply to?</h2>
    <p class="muted" style="margin:0 0 8px">${fitOK ? "Your CV is a good fit for <b>" + esc(best.label) + "</b>. Scan where it is being hired right now." : "Your best fit is below 40%. You can still scan, but adding the suggested skills first will help."}</p>
    <button class="primary" id="scan" style="width:auto">🌍 Scan countries for “<span id="scant">${esc($("title").value || (best ? best.label : ""))}</span>”</button>
    <div id="countries"></div></div>`;
  $("profile").innerHTML = `<div class="insights">${card1}${card2}${card3}${card4}</div>`;
}
const goSearch = (t, lvl) => { if (t) $("title").value = t; if (lvl !== undefined) $("lvl").value = lvl; $("f").requestSubmit(); };
$("profile").onclick = async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.t) return goSearch(b.dataset.t, CV.profile.lvl);
  if (b.dataset.lvl !== undefined) return goSearch(null, b.dataset.lvl);
  if (b.dataset.c) { $("cty").value = b.dataset.c; $("loc").value = b.dataset.loc; return $("f").requestSubmit(); }
  if (b.id === "scan") scanCountries(b);
};
async function scanCountries(btn){
  const title = $("title").value.trim() || (CV.profile.roles[0] || {}).label || "", lvl = $("lvl").value;
  btn.disabled = true; btn.textContent = "Scanning 12 countries…";
  const rows = []; let i = 0;
  const one = async ([name, code]) => {
    try {
      const r = await get(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${enc(title)}&location=${enc(name)}&f_E=${LI_E[lvl]}&sortBy=DD&f_TPR=r1209600&start=0&_=${Date.now()}`, {credentials:"omit"});
      if (!r.ok) throw 0;
      const doc = new DOMParser().parseFromString(await r.text(), "text/html");
      const cards = [...doc.querySelectorAll("li .base-card")];
      const fresh = cards.filter(c => { const t = c.parentElement.querySelector("time"); const d = t && Date.parse(t.getAttribute("datetime")); return d && Date.now() - d < 3 * 864e5 + 864e5; }).length;
      rows.push({name, code, n:cards.length, fresh});
    } catch (e) { rows.push({name, code, n:-1, fresh:0}); }
  };
  await Promise.all([0, 1, 2, 3].map(async () => { while (i < SCAN.length) await one(SCAN[i++]); }));
  rows.sort((a, b) => b.n - a.n || b.fresh - a.fresh);
  const max = Math.max(1, ...rows.map(r => r.n));
  const best3 = rows.filter(r => r.n > 0).slice(0, 3).map(r => r.name).join(", ");
  const lk = r => `https://www.linkedin.com/jobs/search/?keywords=${enc(title)}&location=${enc(r.name)}&f_E=${LI_E[lvl]}&sortBy=DD&f_TPR=r1209600`;
  $("countries").innerHTML = (best3 ? `<div class="verdict ok" style="margin-top:10px">Best countries for “${esc(title)}”: ${esc(best3)}</div>` : `<p class="muted">LinkedIn didn't return results (it may need a login). Try again later.</p>`) +
    rows.map(r => `<div class="crow"><b>${esc(r.name)}</b><div><div class="bar2"><i style="width:${r.n > 0 ? Math.max(4, r.n / max * 100) : 0}%"></i></div><span class="muted">${r.n < 0 ? "couldn't check" : r.n + " openings found" + (r.fresh ? ", " + r.fresh + " in last 3 days" : "")}</span></div>
      ${r.code && UNITS[r.code] ? `<button class="sm" data-c="${r.code}" data-loc="${esc(r.name)}">Search all portals</button>` : `<a class="sm" href="${lk(r)}" target="_blank" rel="noopener">Open on LinkedIn ↗</a>`}</div>`).join("") +
    `<p class="muted note" style="margin-top:8px">Counts are LinkedIn openings on the first results page for the last 14 days at your selected level. They show demand, not your eligibility. Check visa and work-permit rules, and whether the employer sponsors, before applying.</p>`;
  btn.disabled = false; btn.innerHTML = "🌍 Scan again";
}

/* ---------- run ---------- */
function start(){
  qry = (p.t + " " + LVW[p.y]).trim(); yrs = p.y === "12" ? 15 : +p.y;
  const U = UNITS[p.c];
  PREF = U && (p.smin !== "" || p.smax !== "") ? {min:p.smin !== "" ? U.a(+p.smin) : 0, max:p.smax !== "" ? U.a(+p.smax) : 0} : null;
  chrome.storage.local.set({prefs:{smin:p.smin, smax:p.smax, hide:p.hide}});
  document.title = "Job Genie - " + p.t;
  renderStatus(); renderJobs();
  PORTALS.forEach(x => {
    status[x.n] = {s:"loading"};
    x.f().then(list => {
      list.forEach(j => { j.portal = x.n; j.color = x.c; });
      const a = A(); if (a) list = list.filter(j => !j.ts || (Date.now() - j.ts) / 864e5 <= a + 1);
      jobs.push(...list); status[x.n] = {s:"ok", n:list.length};
      prefetch(list);
    }).catch(err => { status[x.n] = {s:"err", m:(err && err.name === "AbortError") ? "timed out" : (err.message || "failed")}; })
      .finally(() => { renderStatus(); renderJobs(); });
  });
}
(async () => {
  const st = await chrome.storage.local.get(["cv","loc","cty","prefs"]);
  CV = st.cv || null;
  if (CV) CV.profile = analyzeCV(CV.text);
  renderProfile();
  $("sort").value = CV ? "match" : "new";
  if (!CV) $("sort").querySelector("[value=match]").disabled = true;
  const pf = st.prefs || {};
  p = {t:(Q.title || "").trim(), l:(Q.loc || "").trim(), y:Q.lvl || "5", c:Q.cty || "in", a:Q.age !== undefined ? Q.age : "7",
    smin:Q.smin !== undefined ? Q.smin : (Q.title === undefined ? pf.smin || "" : ""), smax:Q.smax !== undefined ? Q.smax : (Q.title === undefined ? pf.smax || "" : ""),
    hide:Q.hide !== undefined ? !!Q.hide : (Q.title === undefined ? !!pf.hide : false)};
  if (!p.t && CV) {
    const pr = CV.profile;
    let t = pr.titles[0] || (pr.roles[0] && pr.roles[0].n) || "";
    if (t && pr.level >= 3 && titleLevel(t) === null) t = "Senior " + t;
    p.t = t; p.l = pr.loc || st.loc || ""; p.y = String(pr.lvl); p.c = pr.cty || st.cty || "in";
  }
  $("title").value = p.t; $("loc").value = p.l; $("lvl").value = p.y; $("cty").value = p.c; $("age").value = p.a;
  $("smin").value = p.smin; $("smax").value = p.smax; $("hide").checked = p.hide; unitLabel();
  const sc = document.getElementById("scant"); if (sc) sc.textContent = p.t;
  if (p.t) start();
  else $("jobs").innerHTML = '<div class="loader"><img src="images/genie-opening.gif" alt="Job Genie"><p>Make a wish: upload your CV with the button above, or type a job title and press Search.</p></div>';
})();
