const LI_E = {0:"1,2",2:"3",5:"4",8:"4",12:"5,6"};
const LVW = {0:"fresher entry level",2:"junior",5:"",8:"senior",12:"director"};
const IN_DOM = {in:"in.indeed.com",sg:"sg.indeed.com",my:"malaysia.indeed.com",ph:"ph.indeed.com",id:"id.indeed.com",us:"www.indeed.com"};
const JS_DOM = {my:"my.jobstreet.com",sg:"sg.jobstreet.com",ph:"ph.jobstreet.com",id:"id.jobstreet.com"};
const JS_SITE = {my:"MY-Main",sg:"SG-Main",ph:"PH-Main",id:"ID-Main"};
const enc = encodeURIComponent;
const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const titleCase = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());

// p = {t: title, l: location, y: level, c: country, a: max age in days (0 = any)}
function links(p){
  const {t,l,y,c} = p, a = +p.a || 0, q = (t + " " + LVW[y]).trim(), yrs = y === "12" ? 15 : y, js = JS_DOM[c];
  return [
    {n:"LinkedIn", c:"#0a66c2", d:"level filter", u:`https://www.linkedin.com/jobs/search/?keywords=${enc(t)}&location=${enc(l)}&f_E=${LI_E[y]}&sortBy=DD${a ? "&f_TPR=r" + a * 86400 : ""}`},
    {n:"Indeed", c:"#2557a7", d:IN_DOM[c], u:`https://${IN_DOM[c]}/jobs?q=${enc(q)}&l=${enc(l)}&sort=date${[1,3,7,14].includes(a) ? "&fromage=" + a : ""}`},
    {n:"Naukri", c:"#4a90e2", d:`${yrs} yrs`, u:`https://www.naukri.com/${slug(t)}-jobs${l ? "-in-" + slug(l) : ""}?k=${enc(t)}${l ? "&l=" + enc(l) : ""}&experience=${yrs}${a ? "&jobAge=" + a : ""}`},
    {n:"Monster", c:"#6e46ae", d:c === "in" ? "foundit.in" : "monster.com",
      u: c === "in" ? `https://www.foundit.in/srp/results?query=${enc(q)}&locations=${enc(l)}` : `https://www.monster.com/jobs/search?q=${enc(q)}&where=${enc(l)}`},
    {n:"JobStreet", c:"#0d3880", d:js ? js.replace("www.","") : "not in this country", off:!js,
      u: js ? `https://${js}/${slug(q)}-jobs${l ? "/in-" + slug(l) : ""}` : "#"}
  ];
}

const SKILLS = ["python","java","javascript","typescript","react","angular","vue","node","express","sql","mysql","postgresql","mongodb","oracle","excel","power bi","tableau","aws","azure","gcp","docker","kubernetes","jenkins","terraform","ci/cd","git","linux","machine learning","deep learning","nlp","tensorflow","pytorch","pandas","numpy","statistics","data analysis","data science","etl","spark","hadoop","kafka","agile","scrum","jira","sales","marketing","seo","content writing","accounting","finance","tally","gst","html","css","php","laravel","django","flask","spring boot","microservices","rest api","golang","kotlin","swift","android","ios","flutter","c++","c#",".net","selenium","testing","automation","devops","figma","photoshop","ui/ux","communication","leadership","project management","customer service","recruitment","payroll","autocad","embedded","networking","cybersecurity","salesforce","sap"];
function skillsIn(t){
  return SKILLS.filter(k => new RegExp("(^|[^a-z0-9])" + k.replace(/[.+*?\/]/g,"\\$&") + "([^a-z0-9]|$)","i").test(t));
}
function extractReqs(t){
  const lo = t.toLowerCase();
  const yrs = [...t.matchAll(/\d+\s*(?:\+|-|to)?\s*\d*\s*\+?\s*(?:years|yrs)/gi)].map(m => m[0].trim());
  const edu = ["b.tech","btech","b.e","bachelor","master","mba","m.tech","phd","diploma","graduate","b.sc","bca","mca"].filter(k => lo.includes(k));
  const lines = t.split(/\n|•|●|·/).map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 220 && /(experience|proficien|knowledge|ability|skill|must|required|degree|familiar)/i.test(s)).slice(0,8);
  return {yrs, edu, sk:skillsIn(t), lines};
}
function chipsHTML(a, cls){
  a = [...new Set(a)];
  return a.length ? `<div class="chips">${a.map(x => `<span class="chip ${cls || ""}">${esc(x)}</span>`).join("")}</div>` : `<p class="none">Nothing detected.</p>`;
}
function reqHTML(text){
  const r = extractReqs(text);
  return `<h2>Experience</h2>${chipsHTML(r.yrs)}<h2>Education</h2>${chipsHTML(r.edu)}<h2>Skills &amp; tools</h2>${chipsHTML(r.sk)}<h2>Key requirement lines</h2>` +
    (r.lines.length ? `<ul>${r.lines.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : `<p class="none">No requirement lines detected.</p>`);
}

/* ---------- salary ---------- */
const UNITS = {
  in:{l:"LPA (₹ lakh per year)", a:v => v*1e5, f:a => "₹" + (a/1e5).toFixed(1).replace(/\.0$/,"") + " L/yr"},
  us:{l:"USD thousand per year", a:v => v*1e3, f:a => "$" + Math.round(a/1e3) + "k/yr"},
  sg:{l:"SGD per month", a:v => v*12, f:a => "S$" + Math.round(a/12).toLocaleString() + "/mo"},
  my:{l:"MYR per month", a:v => v*12, f:a => "RM" + Math.round(a/12).toLocaleString() + "/mo"},
  ph:{l:"PHP thousand per month", a:v => v*1e3*12, f:a => "₱" + Math.round(a/12/1e3) + "k/mo"},
  id:{l:"IDR million per month", a:v => v*1e6*12, f:a => "Rp" + (a/12/1e6).toFixed(1) + "jt/mo"}
};
function parseSalary(text, c){
  if (!text) return null;
  const t = String(text).replace(/,/g,"").toLowerCase();
  const ms = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|lpa|crores?|cr\b|k\b|million|mn\b)?/g)];
  if (!ms.length) return null;
  const mult = u => !u ? 1 : /lakh|lac|lpa/.test(u) ? 1e5 : /crore|cr/.test(u) ? 1e7 : u === "k" ? 1e3 : 1e6;
  const lastU = [...ms].reverse().find(m => m[2]);
  const period = /month|\/mo\b|per mo|monthly/.test(t) ? 12 : /week/.test(t) ? 52 : /hour|\/hr|hourly/.test(t) ? 2080
    : /year|annum|\bpa\b|\/yr|yearly|lpa|lacs?|lakh|annual/.test(t) ? 1 : (["sg","my","ph","id"].includes(c) ? 12 : 1);
  const a = ms.slice(0,2).map(m => +m[1] * mult(m[2] || (lastU && lastU[2])) * period).filter(v => v >= 1000);
  return a.length ? {min:Math.min(...a), max:Math.max(...a)} : null;
}
function fmtSalary(sal, c){
  const U = UNITS[c]; if (!sal || !U) return "";
  return sal.min === sal.max ? U.f(sal.min) : U.f(sal.min) + " – " + U.f(sal.max);
}

/* ---------- CV analysis ---------- */
const TITLES = ["software engineer","software developer","full stack developer","frontend developer","front end developer","backend developer","web developer","java developer","python developer","react developer","angular developer","node js developer",".net developer","android developer","ios developer","mobile app developer","data analyst","data scientist","data engineer","machine learning engineer","business analyst","devops engineer","cloud engineer","qa engineer","test engineer","automation engineer","system administrator","network engineer","cybersecurity analyst","database administrator","project manager","product manager","scrum master","ui/ux designer","graphic designer","digital marketing executive","seo specialist","content writer","sales executive","business development executive","customer support executive","hr executive","recruiter","accountant","finance analyst","mechanical engineer","civil engineer","electrical engineer","teacher"];
const CITIES = [["hyderabad","in"],["bengaluru","in"],["bangalore","in"],["chennai","in"],["mumbai","in"],["pune","in"],["delhi","in"],["gurgaon","in"],["gurugram","in"],["noida","in"],["kolkata","in"],["ahmedabad","in"],["vijayawada","in"],["visakhapatnam","in"],["guntur","in"],["kochi","in"],["coimbatore","in"],["singapore","sg"],["kuala lumpur","my"],["penang","my"],["manila","ph"],["jakarta","id"],["new york","us"],["san francisco","us"]];
const LEVELS = ["Fresher / Intern","Junior","Mid-level","Senior","Lead / Manager"];
const LVL2SEL = [0,2,5,8,12], SEL2LVL = {0:0,2:1,5:2,8:3,12:4};
const LEAD_RE = /\b(led|leading|managed|managing|mentored|mentoring|supervised|headed|spearheaded|architected|owned|coached)\b/gi;
function titleLevel(s){
  s = s.toLowerCase();
  if (/\b(intern|trainee|fresher|entry|graduate)\b/.test(s)) return 0;
  if (/\b(junior|jr\.?|associate)\b/.test(s)) return 1;
  if (/\b(manager|head|director|vp|chief|lead|principal)\b/.test(s)) return 4;
  if (/\b(senior|sr\.?|staff|architect)\b/.test(s)) return 3;
  return null;
}
const ROLES = [
  ["Software Engineer",["java","python","javascript","sql","git","rest api","microservices","spring boot","docker"]],
  ["Full Stack Developer",["javascript","react","node","html","css","sql","rest api","git","typescript","mongodb"]],
  ["Frontend Developer",["javascript","react","angular","vue","html","css","typescript","figma"]],
  ["Backend Developer",["java","python","node","sql","rest api","microservices","docker","postgresql","spring boot","django"]],
  ["Data Analyst",["sql","excel","power bi","tableau","python","data analysis","statistics"]],
  ["Data Scientist",["python","machine learning","statistics","pandas","numpy","sql","tensorflow","pytorch","data science"]],
  ["Data Engineer",["sql","python","etl","spark","kafka","aws","hadoop","azure","postgresql"]],
  ["Machine Learning Engineer",["python","machine learning","deep learning","tensorflow","pytorch","docker","aws","nlp"]],
  ["DevOps Engineer",["aws","docker","kubernetes","jenkins","terraform","ci/cd","linux","git","azure"]],
  ["Cloud Engineer",["aws","azure","gcp","terraform","kubernetes","linux","networking","docker"]],
  ["QA Automation Engineer",["selenium","testing","automation","java","python","jira","ci/cd"]],
  ["Mobile App Developer",["android","kotlin","ios","swift","flutter","rest api","git"]],
  ["Business Analyst",["sql","excel","jira","agile","communication","data analysis","power bi","project management"]],
  ["Project Manager",["project management","agile","scrum","jira","leadership","communication"]],
  ["Product Manager",["agile","jira","communication","leadership","data analysis","figma","sql"]],
  ["UI/UX Designer",["figma","ui/ux","photoshop","communication"]],
  ["Digital Marketing Specialist",["seo","marketing","content writing","communication","excel"]],
  ["Sales Executive",["sales","communication","customer service","salesforce","marketing"]],
  ["HR / Recruiter",["recruitment","payroll","communication","excel","leadership"]],
  ["Accountant / Finance Analyst",["accounting","finance","tally","gst","excel","sap"]],
  ["Network / Security Engineer",["networking","cybersecurity","linux","aws","azure"]],
  ["SAP / Salesforce Consultant",["sap","salesforce","sql","communication","project management"]],
  ["Customer Support Executive",["customer service","communication","excel","salesforce"]]
];
function suitableRoles(skills, lo, level){
  const have = new Set(skills);
  const pre = level === 3 ? "Senior " : level === 4 ? "Lead " : level === 1 ? "Junior " : "";
  return ROLES.map(([n, core]) => {
    const matched = core.filter(s => have.has(s)), gaps = core.filter(s => !have.has(s));
    const titleHit = lo.includes(n.toLowerCase().split(" / ")[0]);
    const fit = Math.min(1, 0.75 * matched.length / core.length + (titleHit ? 0.25 : 0));
    const label = (level === 4 && /manager/i.test(n) ? "Senior " : pre) + n;
    return {n, label, fit:Math.round(fit * 100), matched, gaps:gaps.slice(0, 4)};
  }).filter(r => r.matched.length >= 2).sort((a, b) => b.fit - a.fit).slice(0, 5);
}

const SCAN = [["India","in"],["Singapore","sg"],["United Arab Emirates",""],["Malaysia","my"],["United Kingdom",""],["Canada",""],["Australia",""],["Germany",""],["Netherlands",""],["United States","us"],["Philippines","ph"],["Indonesia","id"]];

const MON = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const RANGE = /(?:([A-Za-z]{3,9})\.?,?\s+)?((?:19|20)\d\d)\s*(?:-|–|—|to)\s*(?:(present|current|now|till date|ongoing)|(?:([A-Za-z]{3,9})\.?,?\s+)?((?:19|20)\d\d))/gi;
function rangeOf(m){
  const now = new Date(), sy = +m[2], sm = MON[(m[1] || "").slice(0,3).toLowerCase()];
  const a = sy*12 + (sm === undefined ? 0 : sm);
  let b;
  if (m[3]) b = now.getFullYear()*12 + now.getMonth();
  else { const ey = +m[5], x = MON[(m[4] || "").slice(0,3).toLowerCase()]; b = ey*12 + (x === undefined ? 0 : x); }
  if (b < a || b - a > 480 || b > now.getFullYear()*12 + 24) return null;
  if (b - a < 6) b = a + 6;
  return {a, b, months:b - a};
}
function sectionize(text){
  const H = [["summary",/^(professional |career )?(summary|profile|objective)s?$|^about me$/i],
    ["experience",/^(work |professional |relevant )?(experience|employment( history)?|work history|career history)$/i],
    ["education",/^(education(al)?( qualifications?| background)?|academics?|qualifications?)$/i],
    ["skills",/^(technical |key |core )?(skills|competencies|technologies|tools( & technologies)?)$/i],
    ["certs",/^(certifications?|courses|licen[sc]es|training|certifications? (&|and) courses)$/i],
    ["projects",/^(academic |personal |key )?projects?$/i]];
  const sec = {}; let cur = "head";
  for (const raw of text.split(/\n/)) {
    const line = raw.trim(); if (!line) continue;
    const key = line.replace(/[:\-–_|]+$/,"").trim();
    const h = key.length <= 40 && H.find(([n, re]) => re.test(key));
    if (h) { cur = h[0]; sec[cur] = sec[cur] || []; continue; }
    (sec[cur] = sec[cur] || []).push(line);
  }
  return sec;
}
function analyzeCV(text){
  const t = text.replace(/\s+/g," "), lo = t.toLowerCase(), sec = sectionize(text);
  const email = (t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
  const phone = (t.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) || []).find(x => x.replace(/\D/g,"").length >= 10) || "";
  const linkedin = (t.match(/linkedin\.com\/in\/[\w%-]+/i) || [""])[0], github = (t.match(/github\.com\/[\w-]+/i) || [""])[0];
  // experience entries
  const eduRe = /b\.?tech|b\.?e\b|bachelor|degree|school|college|university|mba|diploma|class|hsc|ssc|intermediate|cgpa|gpa|m\.?tech|master/i;
  const lines = (sec.experience && sec.experience.length) ? sec.experience : text.split(/\n/).map(s => s.trim()).filter(s => s && !eduRe.test(s));
  const exp = [], iv = [];
  lines.forEach((line, i) => {
    RANGE.lastIndex = 0; const m = RANGE.exec(line); if (!m) return;
    const r = rangeOf(m); if (!r) return;
    const rest = line.replace(m[0], "").replace(/[()|,–-]+/g, " ").trim();
    const entry = (rest.length < 12 && i > 0 ? lines[i-1] + " · " : "") + line;
    exp.push({line:entry.slice(0, 150), months:r.months}); iv.push([r.a, r.b]);
  });
  iv.sort((x, y) => x[0] - y[0]);
  let months = 0, end = -1;
  iv.forEach(([a, b]) => { if (a > end) { months += b - a; end = b; } else if (b > end) { months += b - end; end = b; } });
  let years = Math.round(months / 12 * 10) / 10;
  [...t.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)/gi)].forEach(m => { if (+m[1] <= 35) years = Math.max(years, +m[1]); });
  const skills = skillsIn(text);
  let titles = TITLES.map(x => ({x, n:lo.split(x).length - 1, i:lo.indexOf(x)})).filter(o => o.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i).map(o => titleCase(o.x)).slice(0, 4);
  // seniority
  const leadN = (text.match(LEAD_RE) || []).length;
  const team = +((t.match(/team of (\d+)/i) || [])[1] || 0);
  const roleNoun = /(engineer|developer|analyst|manager|designer|scientist|architect|consultant|administrator|executive|specialist|officer|tester|accountant|recruiter|lead|programmer|director)/i;
  const phrases = [...new Set((t.match(/\b(?:senior|sr\.?|lead|principal|staff|head of|junior|associate)\s+[A-Za-z/.]+(?:\s+[A-Za-z/.]+){0,2}/gi) || [])
    .map(s => s.trim().split(/\s+(?:with|in|at|and|for|of|who|having|using|on)\s+/i)[0]).filter(s => roleNoun.test(s)))].slice(0, 3);
  const tl = phrases.map(titleLevel).filter(x => x !== null);
  const titleLv = tl.length ? Math.max(...tl) : -1;
  let level = years <= 1 ? 0 : years < 4 ? 1 : years < 7 ? 2 : 3;
  if (titleLv > level) level = titleLv;
  if (level === 3 && years >= 10 && (leadN >= 4 || team >= 5)) level = 4;
  const eligible = years >= 6 || level >= 3 || (years >= 5 && leadN >= 2);
  const evidence = [`${years} year${years === 1 ? "" : "s"} of experience found in your CV`];
  if (phrases.length) evidence.push("Titles in CV: " + phrases.join(", "));
  evidence.push(leadN ? `Leadership words found ${leadN} time${leadN === 1 ? "" : "s"} (led, managed, mentored…)` : "No leadership words found (led, managed, mentored…)");
  if (team) evidence.push(`Mentions a team of ${team}`);
  const seniority = {label:LEVELS[level], eligible, evidence,
    reason: eligible ? "You meet the usual bar for senior roles." : "Senior roles usually want ~6+ years or clear team/lead experience. Add leadership achievements to your CV or target mid-level roles."};
  // location
  let loc = "", cty = "";
  const head = lo.slice(0, 700);
  const hit = CITIES.find(c => head.includes(c[0])) || CITIES.find(c => lo.includes(c[0]));
  if (hit) { loc = titleCase(hit[0]); cty = hit[1]; }
  const first = (text.split(/\n/).map(s => s.trim()).find(s => s) || "");
  const name = first.length <= 40 && !/[\d@]/.test(first) ? first : "";
  // education / certs / projects / summary
  const degRe = /(b\.?tech|b\.?e\b|b\.?sc|bca|bcom|b\.?com|bachelor|m\.?tech|m\.?sc|mca|mba|master|ph\.?d|diploma|degree)/i;
  let edu = (sec.education || []).slice(0, 8);
  if (!edu.length) edu = text.split(/\n/).map(s => s.trim()).filter(s => degRe.test(s)).slice(0, 4);
  let certs = (sec.certs || []).filter(s => s.length > 3 && s.length < 110).slice(0, 8);
  if (!certs.length) certs = [...new Set((t.match(/aws certified[^,.;]*|azure [a-z-]+ (?:associate|fundamentals|expert)|google [a-z ]+ certificate|pmp\b|cissp|ccna|scrum master[^,.;]*|oracle certified[^,.;]*/gi) || []).map(s => s.trim()))].slice(0, 6);
  const projects = (sec.projects || []).filter(s => s.length > 5 && s.length < 110).slice(0, 5);
  const summary = (sec.summary || []).join(" ").slice(0, 350);
  if (!titles.length) { const r = suitableRoles(skills, lo, level); titles = r.length ? [r[0].n] : (skills.length ? [titleCase(skills[0]) + " Developer"] : []); }
  const roles = suitableRoles(skills, lo, level);
  return {name, email, phone, linkedin, github, loc, cty, summary, skills, years, months, titles, exp, edu, certs, projects,
    level, lvl:LVL2SEL[level], seniority, roles, leadN};
}
