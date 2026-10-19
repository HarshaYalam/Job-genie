const $ = id => document.getElementById(id);
document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab,.pane").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); $(b.dataset.tab).classList.add("active");
});
const FIELDS = ["title","loc","lvl","cty"];
chrome.storage.local.get(FIELDS.concat("cv"), v => {
  FIELDS.forEach(k => { if (v[k] !== undefined) $(k).value = v[k]; });
  if (v.cv) $("cv").textContent = "📄 Match jobs to my CV" + (v.cv.name ? " (" + v.cv.name + ")" : "");
});
function save(){ const o = {}; FIELDS.forEach(k => o[k] = $(k).value); chrome.storage.local.set(o); return o; }
FIELDS.forEach(k => { $(k).addEventListener("change", save); $(k).addEventListener("input", save); });
const params = () => ({t:$("title").value.trim(), l:$("loc").value.trim(), y:$("lvl").value, c:$("cty").value});
function need(){ const p = params(); if (!p.t) { $("title").focus(); return null; } save(); return p; }
const open = qs => chrome.tabs.create({url: chrome.runtime.getURL("results.html") + qs});

$("cv").onclick = () => open("?cv=1");
$("go").onclick = () => { const p = need(); if (p) open("?" + new URLSearchParams({title:p.t, loc:p.l, lvl:p.y, cty:p.c, age:"7"})); };
$("tabs").onclick = () => {
  const p = need(); if (!p) return;
  const list = links(p);
  $("boards").innerHTML = list.map(b => `<a href="${b.u}" target="_blank" style="--c:${b.c}" class="${b.off ? "off" : ""}">${b.n}<span>${b.d}</span></a>`).join("");
  list.filter(b => !b.off).forEach(b => chrome.tabs.create({url:b.u, active:false}));
};
$("an").onclick = () => { const t = $("jd").value; if (t.trim()) $("req").innerHTML = reqHTML(t); };
$("page").onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    const [res] = await chrome.scripting.executeScript({target:{tabId:tab.id},
      func:() => (window.getSelection().toString().trim() || document.body.innerText).slice(0,30000)});
    const text = (res && res.result) || "";
    $("jd").value = text.slice(0,4000); $("req").innerHTML = reqHTML(text);
  } catch (err) {
    $("req").innerHTML = `<p class="none">Couldn't read this page (Chrome blocks some pages). Paste the description instead.</p>`;
  }
};
