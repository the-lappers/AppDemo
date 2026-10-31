/* Shared chrome for the experimental versions: theme, language, header with the version menu, toast, live region. */
const VERSIONS=[
  {id:"classic", file:"day-off-demo.html", n:"A", en:"Classic", th:"คลาสสิก", de:"Tabs and a map", dt:"แท็บและแผนที่"},
  {id:"chat",    file:"day-off-chat.html", n:"B", en:"Chat", th:"แชท", de:"Ask in words or voice", dt:"ถามด้วยข้อความหรือเสียง"},
  {id:"swipe",   file:"day-off-swipe.html", n:"1", en:"Swipe deck", th:"สไลด์เลือก", de:"Swipe places, the day builds itself", dt:"ปัดเลือกที่ แล้วแผนสร้างเอง"},
  {id:"mixer",   file:"day-off-mixer.html", n:"2", en:"Mood mixer", th:"มิกเซอร์วาย", de:"Shape the vibe on a radar", dt:"ปั้นวายบนเรดาร์"},
  {id:"line",    file:"day-off-line.html", n:"3", en:"Day line", th:"เส้นทางวัน", de:"Your day as a metro line", dt:"วันของคุณเป็นสายรถไฟฟ้า"},
  {id:"room",    file:"day-off-room.html", n:"4", en:"Friends room", th:"ห้องเพื่อน", de:"Plan together and vote", dt:"วางแผนกับเพื่อน โหวต"},
  {id:"gonow",   file:"day-off-gonow.html", n:"5", en:"Go now", th:"ไปเลย", de:"One next step at a time", dt:"ทีละก้าวถัดไป"},
  {id:"home",    file:"day-off-home.html", n:"6", en:"Home", th:"หน้าแรก", de:"One screen, chat plans", dt:"หน้าเดียว แชทวางแผน"}
];
addStrings({goHome:"Home",versions:"Versions",allVersions:"Compare all versions",themeGroup:"Theme",themeSystem:"System",themeLight:"Light",themeDark:"Dark",themeCycle:"Theme: {cur}. Switch to {next}",langGroup:"Language",undo:"Undo",demoNote:"Demo data: places and hours from OpenStreetMap; vibe scores and prices are estimates.",open:"Open",closed:"Closed",closedToday:"Closed today",hoursUnknown:"Hours unknown",until:"Open until {t}",opens:"Opens {t}"},
 {goHome:"หน้าแรก",versions:"เวอร์ชัน",allVersions:"เปรียบเทียบทุกเวอร์ชัน",themeGroup:"ธีม",themeSystem:"ตามระบบ",themeLight:"สว่าง",themeDark:"มืด",themeCycle:"ธีม: {cur} สลับเป็น {next}",langGroup:"ภาษา",undo:"เลิกทำ",demoNote:"ข้อมูลตัวอย่าง: สถานที่และเวลาเปิดจาก OpenStreetMap ส่วนคะแนนวายและราคาเป็นค่าประมาณ",open:"เปิด",closed:"ปิด",closedToday:"วันนี้ปิด",hoursUnknown:"ไม่ทราบเวลา",until:"เปิดถึง {t}",opens:"เปิด {t}"});

const THEME_ORDER=["system","light","dark"];
function applyTheme(pref,persist){
  state.theme=pref;
  const dark=pref==="dark"||(pref==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  const r=document.documentElement; r.dataset.theme=dark?"dark":"light"; r.dataset.themePref=pref;
  const m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content",dark?"#111418":"#ffffff");
  if(persist){ try{ localStorage.setItem("dayoff-theme",pref); }catch(e){} }
}
const themeLabel=k=>t({system:"themeSystem",light:"themeLight",dark:"themeDark"}[k]);
let currentVersion="classic", onChrome=()=>{};
function nextQuery(){ const q=new URLSearchParams({lang:state.lang}); if(params.get("at")) q.set("at",params.get("at")); return "?"+q; }
function chromeHTML(){
  const ic={system:"auto",light:"sun",dark:"moon"}, cur=VERSIONS.find(v=>v.id===currentVersion)||{en:"All versions",th:"ทุกเวอร์ชัน"};
  const next=THEME_ORDER[(THEME_ORDER.indexOf(state.theme)+1)%3], q=nextQuery();
  return `<div class="hleft"><a class="brand" href="versions.html${q}" aria-label="Day-Off, ${esc(t("allVersions"))}"><svg class="brand-mark" width="26" height="26" viewBox="0 0 30 30" aria-hidden="true"><rect class="f" x="3" y="4" width="24" height="22" rx="5"/><g><rect x="6" y="8" width="18" height="2.5" rx="1"/><rect x="6" y="12.5" width="18" height="2.5" rx="1"/><rect x="6" y="17" width="18" height="2.5" rx="1"/></g><circle cx="22.5" cy="22" r="3.6"/></svg><span>Day-Off</span></a><a class="backhome" href="day-off-home.html${q}" data-testid="to-home">${icon("chev")}<span>${esc(t("goHome"))}</span></a></div>
  <div class="hctl"><span class="live" id="liveClock">${esc(clockText())}</span>
    <div class="seg seg-full" role="group" aria-label="${esc(t("themeGroup"))}">${THEME_ORDER.map(k=>`<button type="button" data-theme="${k}" aria-pressed="${k===state.theme}" aria-label="${esc(themeLabel(k))}" title="${esc(themeLabel(k))}">${icon(ic[k])}</button>`).join("")}</div>
    <button type="button" class="theme-cycle" data-theme-cycle aria-label="${esc(t("themeCycle",{cur:themeLabel(state.theme),next:themeLabel(next)}))}">${icon(ic[state.theme])}</button>
    <div class="seg" role="group" aria-label="${esc(t("langGroup"))}"><button type="button" data-lang="th" aria-pressed="${state.lang==="th"}">ไทย</button><button type="button" data-lang="en" aria-pressed="${state.lang==="en"}">EN</button></div>
    <button type="button" class="vbtn" id="vbtn" aria-expanded="false" aria-controls="vmenu"><span>${esc(cur[state.lang])}</span>${icon("chev")}</button></div>
  <nav class="vmenu" id="vmenu" hidden aria-label="${esc(t("versions"))}">${VERSIONS.map(v=>`<a href="${v.file}${q}"${v.id===currentVersion?' aria-current="page"':""}><span class="vn">${v.n}</span><span><b>${esc(v[state.lang])}</b><small>${esc(state.lang==="th"?v.dt:v.de)}</small></span></a>`).join("")}<hr><a href="versions.html${q}"><span class="vn">≡</span><span><b>${esc(t("allVersions"))}</b></span></a></nav>`;
}
function renderChrome(){
  document.documentElement.lang=state.lang;
  const h=$("#hdr"); const open=!!$("#vmenu") && !$("#vmenu").hidden; h.innerHTML=chromeHTML();
  if(open){ $("#vmenu").hidden=false; $("#vbtn").setAttribute("aria-expanded","true"); }
}
function initChrome(id,hook){
  currentVersion=id; onChrome=hook||(()=>{});
  document.body.insertAdjacentHTML("beforeend",`<div class="toasts" id="toasts"></div><div class="sr" id="live" role="status" aria-live="polite"></div>`);
  renderChrome();
  $("#hdr").addEventListener("click",e=>{
    const th=e.target.closest("button[data-theme]"), cy=e.target.closest("[data-theme-cycle]"), lg=e.target.closest("[data-lang]"), vb=e.target.closest("#vbtn");
    if(th){ applyTheme(th.dataset.theme,true); renderChrome(); onChrome("theme"); }
    else if(cy){ applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(state.theme)+1)%3],true); renderChrome(); onChrome("theme"); }
    else if(lg){ state.lang=lg.dataset.lang; renderChrome(); onChrome("lang"); }
    else if(vb){ const m=$("#vmenu"); m.hidden=!m.hidden; vb.setAttribute("aria-expanded",String(!m.hidden)); }
  });
  document.addEventListener("click",e=>{ const m=$("#vmenu"); if(m&&!m.hidden&&!e.target.closest("#vmenu,#vbtn")){ m.hidden=true; $("#vbtn").setAttribute("aria-expanded","false"); } });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ const m=$("#vmenu"); if(m&&!m.hidden){ m.hidden=true; $("#vbtn").setAttribute("aria-expanded","false"); $("#vbtn").focus(); } } });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ if(state.theme==="system"){ applyTheme("system",false); onChrome("theme"); } });
  setInterval(()=>{ const c=$("#liveClock"); if(c) c.textContent=clockText(); },30000);
}
let toastTimer=null;
function say(msg){ const l=$("#live"); l.textContent=""; setTimeout(()=>{l.textContent=msg;},30); }
function clearToast(){ clearTimeout(toastTimer); $("#toasts").innerHTML=""; }
function toast(msg,undoFn){
  clearToast();
  const el=document.createElement("div"); el.className="toast";
  el.innerHTML=`<span>${esc(msg)}</span>${undoFn?`<button type="button">${icon("undo")}&nbsp;${esc(t("undo"))}</button>`:""}`;
  if(undoFn) el.querySelector("button").addEventListener("click",()=>{ undoFn(); clearToast(); });
  $("#toasts").appendChild(el); toastTimer=setTimeout(clearToast,undoFn?8000:4000);
  if(!undoFn) say(msg);
}
const reducedMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
/* shared small renderers */
function slats(score){ return `<span class="slats" aria-hidden="true">${[1,2,3,4,5].map(i=>`<i class="${i<=score?"on":""}"></i>`).join("")}</span>`; }
function statusText(p){
  if(p.status==="unknown") return t("hoursUnknown");
  if(p.status==="closed") return t("closedToday");
  if(isOpen(p)) return t("until",{t:fmt(p.close)});
  return state.now.min<p.open ? t("opens",{t:fmt(p.open)}) : t("closed");
}
function thumb(p,size=56,r=12){ return `<div class="thumb tone-${p.tone}" style="width:${size}px;height:${size}px;border-radius:${r}px" aria-hidden="true">${icon(p.icon,"")}</div>`; }
const topTags=(p,n=2)=>Object.entries(p.tags).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({k,v}));
