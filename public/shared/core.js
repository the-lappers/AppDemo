/* Day-Off shared core for the experimental versions: real OSM places, demo vibe scores, opening-hours reader, ranking, route solver.
   Copied from day-off-demo.html so every version plans with the same rules. */
const STRX={en:{},th:{}};
function addStrings(en,th){ Object.assign(STRX.en,en); Object.assign(STRX.th,th); }
addStrings({durH:"{h} h {m} min",durHo:"{h} h",dur:"{n} min",priceFree:"Free",live:"{d} {t} in Bangkok",walk:"{n} min walk"},
           {durH:"{h} ชม. {m} นาที",durHo:"{h} ชม.",dur:"{n} นาที",priceFree:"ฟรี",live:"{d} {t} เวลากรุงเทพฯ",walk:"เดิน {n} นาที"});
const TAGNAME = {
  en:{calm:"Calm", oldtown:"Old town", street:"Street food", art:"Art", river:"Riverside", lively:"Lively"},
  th:{calm:"สงบ", oldtown:"ย่านเก่า", street:"สตรีทฟู้ด", art:"อาร์ต", river:"ริมน้ำ", lively:"คึกคัก"}
};
const TYPENAME = {
  en:{cafe:"Café", food:"Food", art:"Gallery", shrine:"Shrine", temple:"Temple", market:"Market"},
  th:{cafe:"คาเฟ่", food:"อาหาร", art:"แกลเลอรี", shrine:"ศาลเจ้า", temple:"วัด", market:"ตลาด"}
};
const AREA = {en:{songwat:"Song Wat", yaowarat:"Yaowarat", talatnoi:"Talat Noi"}, th:{songwat:"ซองวัด", yaowarat:"เยาวราช", talatnoi:"ตลาดน้อย"}};
const DAYS = {en:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], th:["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."]};
const CHIPS = [
  {tag:"calm",   en:"quiet and slow",  th:"เงียบ ๆ ชิล ๆ"},
  {tag:"oldtown",en:"old shophouses",  th:"ตึกเก่าย้อนยุค"},
  {tag:"street", en:"street eats",     th:"ของกินริมทาง"},
  {tag:"art",    en:"arty corners",    th:"มุมอาร์ต ๆ"}
];
const EXAMPLES = [
  {en:"quiet cafe, old walls",   th:"คาเฟ่เงียบ ๆ ตึกเก่า"},
  {en:"street food at night",    th:"ของกินริมทางยามค่ำ"},
  {en:"art alleys and murals",   th:"ซอยอาร์ต ภาพมูรัล"},
  {en:"riverside, golden hour",  th:"ริมน้ำ พระอาทิตย์ตก"}
];
const KEYWORDS = {
  calm:["quiet","calm","chill","slow","peace","relax","cozy","เงียบ","สงบ","ชิล","สบาย","ผ่อนคลาย"],
  oldtown:["old","vintage","heritage","retro","shophouse","wall","histor","ตึกเก่า","เก่า","ย้อนยุค","วินเทจ","ตึกแถว","กำแพง"],
  street:["street","food","eat","noodle","snack","cheap","อาหาร","กิน","สตรีท","ริมทาง","ก๋วยเตี๋ยว","ขนม"],
  art:["art","mural","gallery","creative","graffiti","อาร์ต","ศิลปะ","มูรัล","แกลเลอรี","ภาพวาด"],
  river:["river","water","pier","sunset","แม่น้ำ","ริมน้ำ","ท่าเรือ","พระอาทิตย์ตก"],
  lively:["lively","busy","buzz","crowd","night","vibrant","คึกคัก","ตลาด","ยามค่ำ","คนเยอะ","สนุก"]
};
const FRIENDS = [
  {id:"mint", en:"Mint", th:"มิ้นต์"},
  {id:"beam", en:"Beam", th:"บีม"},
  {id:"ploy", en:"Ploy", th:"พลอย"}
];
/* sample votes: +1 like, -1 skip, 0 no vote */
const VOTES = {
  mint:{hongsieng:1,soheng:1,eiahsae:1,hoytod:1,tk:1,yoofish:1,gulongbao:1,naam:0,influence:1,fishball:0,walkst:1,traimit:1,mangkon:-1,chowsue:1,sampeng:-1},
  beam:{hongsieng:1,soheng:1,eiahsae:-1,hoytod:1,tk:1,yoofish:1,gulongbao:1,naam:0,influence:-1,fishball:1,walkst:1,traimit:1,mangkon:1,chowsue:-1,sampeng:1},
  ploy:{hongsieng:-1,soheng:1,eiahsae:1,hoytod:-1,tk:-1,yoofish:1,gulongbao:-1,naam:1,influence:1,fishball:0,walkst:0,traimit:1,mangkon:-1,chowsue:-1,sampeng:-1}
};
const SUGGESTS = [{by:"beam", id:"yoofish"},{by:"mint", id:"hoytod"}];

/* ---------- real places: names, coordinates and opening_hours are copied from OpenStreetMap (osm = element id).
   Vibe scores (tags) are demo estimates, NOT measured; there are no review quotes, mention counts or prices for real venues. ---------- */
const PLACES = [
  {id:"hongsieng", osm:"node/9329112618", en:"Hong Sieng Kong", th:"ฮงเซียงกง", area:"talatnoi", type:"cafe", cat:"cafe · coffee_shop", icon:"coffee", tone:"ink", lat:13.73474, lng:100.51159, h:"Tu-Su 10:00-18:00", dur:50, tags:{calm:4,oldtown:5,street:1,art:4,river:3,lively:2}},
  {id:"soheng", osm:"node/4411212890", en:"So Heng Tai Café", th:"โซวเฮงไถ่", area:"talatnoi", type:"cafe", cat:"cafe · coffee_shop", icon:"coffee", tone:"ink", lat:13.73363, lng:100.51198, h:"Mo-Su 09:00-18:00", dur:50, tags:{calm:4,oldtown:5,street:0,art:3,river:3,lively:2}},
  {id:"eiahsae", osm:"node/3096836173", en:"Eiah Sae", th:"Eiah Sae", area:"yaowarat", type:"cafe", cat:"cafe · coffee_shop", icon:"coffee", tone:"slate", lat:13.73931, lng:100.51063, h:"Mo-Su 09:00-18:00", dur:40, tags:{calm:3,oldtown:5,street:2,art:1,river:0,lively:3}},
  {id:"gulongbao", osm:"way/12164752827", en:"Gu Long Bao Bun Shop", th:"กู่ หลง เปา ซาลาเปาโบราณ", area:"songwat", type:"food", cat:"restaurant · dumplings", icon:"food", tone:"red", lat:13.73793, lng:100.50798, h:"10:00-19:00", dur:30, tags:{calm:3,oldtown:4,street:4,art:1,river:1,lively:2}},
  {id:"naam", osm:"way/1487597298", en:"NAAM 1608", th:"น้ำ หนึ่งหกศูนย์แปด", area:"songwat", type:"food", cat:"restaurant · thai", icon:"food", tone:"red", lat:13.73594, lng:100.50997, h:"Tu-Su 11:00-22:00", dur:60, tags:{calm:3,oldtown:3,street:1,art:2,river:2,lively:3}},
  {id:"hoytod", osm:"node/4148053090", en:"Nai Mong Hoy Tod", th:"Nai Mong Hoy Tod", area:"yaowarat", type:"food", cat:"restaurant · asian", icon:"food", tone:"red", lat:13.74204, lng:100.51065, h:"Mo-Su 10:30-21:30", dur:40, tags:{calm:1,oldtown:3,street:5,art:0,river:0,lively:4}},
  {id:"yoofish", osm:"node/4789519436", en:"Yoo Fishball Noodles", th:"ยู้ ลูกชิ้นปลาเยาวราช", area:"yaowarat", type:"food", cat:"restaurant · noodles", icon:"food", tone:"red", lat:13.7403, lng:100.51014, h:"Mo-Su 10:00-23:00", dur:40, tags:{calm:1,oldtown:4,street:5,art:0,river:0,lively:4}},
  {id:"fishball", osm:"node/4548714689", en:"Fish Ball Noodles (Pae Tiang)", th:"แปะเตียง", area:"yaowarat", type:"food", cat:"restaurant · noodles", icon:"food", tone:"red", lat:13.74385, lng:100.5072, h:"Mo-Su 08:00-15:00", dur:35, tags:{calm:2,oldtown:3,street:5,art:0,river:0,lively:3}},
  {id:"tk", osm:"node/3096836189", en:"T&K Seafood", th:"T&K Seafood", area:"yaowarat", type:"food", cat:"restaurant · chinese, thai", icon:"food", tone:"red", lat:13.74012, lng:100.51067, h:"Mo-Su 16:30-02:00", dur:75, tags:{calm:0,oldtown:3,street:5,art:0,river:0,lively:5}},
  {id:"walkst", osm:"way/950315091", en:"Khlong Ong Ang Walking Street", th:"ถนนคนเดินคลองโอ่งอ่าง", area:"yaowarat", type:"market", cat:"marketplace", icon:"market", tone:"gold", lat:13.74469, lng:100.50278, h:"Fr-Su 16:00-22:00", dur:60, tags:{calm:1,oldtown:2,street:4,art:3,river:2,lively:5}},
  {id:"influence", osm:"node/11063201970", en:"Over the Influence", th:"โอเวอร์ ดิอินฟลูเอนซ์", area:"talatnoi", type:"art", cat:"gallery", icon:"palette", tone:"ink", lat:13.73717, lng:100.51269, h:"We-Su 11:00-20:00", dur:45, tags:{calm:4,oldtown:3,street:0,art:5,river:2,lively:1}},
  {id:"traimit", osm:"way/241879483", en:"Wat Traimit", th:"วัดไตรมิตรวิทยารามวรวิหาร", area:"yaowarat", type:"temple", cat:"place_of_worship", icon:"shrine", tone:"gold", lat:13.73809, lng:100.51363, h:null, dur:40, wiki:"Wat_Traimit", tags:{calm:4,oldtown:5,street:0,art:3,river:1,lively:2}},
  {id:"mangkon", osm:"way/301157259", en:"Wat Mangkon Kamalawat", th:"วัดมังกรกมลาวาส", area:"yaowarat", type:"temple", cat:"place_of_worship", icon:"shrine", tone:"gold", lat:13.74353, lng:100.50958, h:null, dur:40, wiki:"Wat_Mangkon_Kamalawat", tags:{calm:3,oldtown:5,street:1,art:3,river:0,lively:3}},
  {id:"chowsue", osm:"node/3265832103", en:"Chow Sue Kong Shrine", th:"ศาลเจ้าโจวซือกง", area:"talatnoi", type:"shrine", cat:"place_of_worship", icon:"shrine", tone:"slate", lat:13.73442, lng:100.51171, h:null, dur:20, tags:{calm:4,oldtown:5,street:0,art:2,river:3,lively:1}},
  {id:"sampeng", osm:"relation/20440796", en:"Sampeng Lane Market", th:"ตลาดสำเพ็ง", area:"yaowarat", type:"market", cat:"marketplace", icon:"market", tone:"gold", lat:13.7412, lng:100.50605, h:null, dur:45, tags:{calm:0,oldtown:4,street:4,art:1,river:0,lively:5}}
];
const P = Object.fromEntries(PLACES.map(p=>[p.id,p]));
/* price bands are category-level ESTIMATES (OpenStreetMap carries no prices): 0 free, 1 ฿ street/market, 2 ฿฿ café, 3 ฿฿฿ sit-down */
const PRICE={hongsieng:2,soheng:2,eiahsae:1,gulongbao:1,naam:3,hoytod:1,yoofish:1,fishball:1,tk:3,walkst:1,influence:1,traimit:1,mangkon:0,chowsue:0,sampeng:1};
PLACES.forEach(p=>{ p.price=PRICE[p.id]; });
const DIST_MAX = 25;   /* distance slider is in 100 m steps: 25 = "any" */
const MAX_STOPS = 6, ME = {lat:13.7384, lng:100.5170}, DETOUR = 1.25, WALK_M_PER_MIN = 80, WALK_MAX = 30;
/* ---------- live clock (Bangkok). ?at=Sat-11:00 pins it for demos and tests ---------- */
const params = new URLSearchParams(location.search);
function bangkokNow(){
  const m=(params.get("at")||"").match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[ -](\d\d):(\d\d)$/);
  if(m) return {dow:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(m[1]), min:+m[2]*60+ +m[3]};
  const f=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const g=k=>f.find(x=>x.type===k).value;
  return {dow:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(g("weekday")), min:(+g("hour")%24)*60+ +g("minute")};
}
const DAYIDX = {Mo:0,Tu:1,We:2,Th:3,Fr:4,Sa:5,Su:6};
/* minimal opening_hours reader for the shapes used above: "Mo-Su 09:00-18:00", "Tu-Su ...", "10:00-19:00" */
function hoursFor(h,dow){
  if(!h) return {status:"unknown"};
  const m=h.match(/^(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))? )?(\d\d):(\d\d)-(\d\d):(\d\d)$/);
  if(!m) return {status:"unknown"};
  const a=m[1]?DAYIDX[m[1]]:0, b=m[1]?(m[2]?DAYIDX[m[2]]:a):6;
  if(dow<a||dow>b) return {status:"closed"};
  const o=+m[3]*60+ +m[4]; let c=+m[5]*60+ +m[6]; if(c<=o) c+=1440;
  return {status:"ok", open:o, close:c};
}

/* ---------- state ---------- */
const state = {
  lang: params.get("lang")==="en" ? "en" : "th",
  theme: document.documentElement.dataset.themePref || "system",
  now: bangkokNow(),
  view:"describe", query:"", loading:false, searched:false,
  parsed:{tags:[],cafe:false}, results:[], mode:"match", filters:{price:3, dist:DIST_MAX, open:false},
  tray:[], startMin:600, endMin:1080, delay:0,
  visits:[], skipped:[], pins:{}, rejected:[], suggest:false, routeDown:false,
  prev:null, expanded:new Set(), animate:false, photos:{}, durs:{}, sheet:"half", manual:false
};
function applyHours(){ PLACES.forEach(p=>{ const r=hoursFor(p.h,state.now.dow); p.status=r.status; p.open=r.open??null; p.close=r.close??null; }); }
applyHours();

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const t = (k,v={}) => (STRX[state.lang][k] ?? STRX.en[k] ?? k).replace(/\{(\w+)\}/g,(_,n)=>v[n] ?? "");
const nm = p => p[state.lang];
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const fmt = m => pad(Math.floor(m/60)%24)+":"+pad(m%60);
const icon = (n,cls="") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function meters(a,b){ const R=6371000, r=Math.PI/180, dx=(b.lng-a.lng)*r*Math.cos((a.lat+b.lat)/2*r), dy=(b.lat-a.lat)*r; return R*Math.hypot(dx,dy); }
const walkMin = (a,b) => Math.max(2, Math.round(meters(a,b)*(state.routeDown?1:DETOUR)/WALK_M_PER_MIN));
const hit = (s,k) => /^[a-z]/.test(k) ? new RegExp("\\b"+k).test(s) : s.includes(k);
const durText = m => { const h=Math.floor(m/60), r=m%60; return h ? (r ? t("durH",{h,m:r}) : t("durHo",{h})) : t("dur",{n:r}); };
const allTags = Object.keys(TAGNAME.en);
const visited = id => state.visits.some(v=>v.id===id);
const durOf = p => state.durs[p.id] ?? p.dur;
const priceBand = n => n===0 ? t("priceFree") : "฿".repeat(n);
const isOpen = p => p.status==="ok" && state.now.min>=p.open && state.now.min<p.close;
const dayName = () => DAYS[state.lang][state.now.dow];
const clockText = () => t("live",{d:dayName(), t:fmt(state.now.min)});
const hoursText = p => p.status==="unknown" ? "" : p.status==="closed" ? "" : fmt(p.open)+"–"+fmt(p.close);
function parseQuery(q){
  const s = q.toLowerCase();
  const tags = Object.keys(KEYWORDS).filter(tag => KEYWORDS[tag].some(k=>hit(s,k)));
  return {tags, cafe:/cafe|café|coffee|คาเฟ่|กาแฟ/.test(s)};
}
/* score a place against weights {tag: 0..1}; the mixer and swipe versions use this */
function scoreWeights(p,w){
  const keys=Object.keys(w).filter(k=>w[k]>0); if(!keys.length) return .5;
  let num=0,den=0; keys.forEach(k=>{ num+=w[k]*p.tags[k]/5; den+=w[k]; });
  return Math.min(1,num/den);
}
/* ---------- vibe matching (mock of the precomputed score matrix) ---------- */
function parseQuery(q){
  const s = q.toLowerCase();
  const tags = Object.keys(KEYWORDS).filter(tag => KEYWORDS[tag].some(k=>hit(s,k)));
  return {tags, cafe:/cafe|café|coffee|คาเฟ่|กาแฟ/.test(s)};
}
const baseTags = () => state.parsed.tags.length ? state.parsed.tags : allTags;
function rank(q,parsed){
  const base=parsed.tags.length?parsed.tags:allTags;
  const mode = !q ? "empty" : !parsed.tags.length ? "none" : "match";
  const list = PLACES.map(p=>{
    const m = base.reduce((a,x)=>a+p.tags[x],0)/base.length/5 + (parsed.cafe&&p.type==="cafe"?.2:0);
    return {id:p.id, m:Math.min(1,m)};
  }).sort((a,b)=>b.m-a.m);
  return {mode, list};
}
const matchPct = r => Math.round(r.m*100);
function visibleResults(){
  const f=state.filters;
  return state.results.filter(r=>{
    const p=P[r.id];
    if(p.price>f.price) return false;
    if(f.open && !isOpen(p)) return false;
    if(f.dist<DIST_MAX && meters(ME,p)>f.dist*100) return false;
    return true;
  }).slice(0,10);
}
const isWeak = r => state.mode==="match" && r.m<.6;

/* ---------- route solver (mock of the OR-Tools step) ---------- */
function simulate(order,start,prevPlace,endMin,manual=false){
  let now=start, prev=prevPlace||null, walk=0; const items=[], dropped=[];
  for(const id of order){
    const p=P[id];
    if(p.status==="unknown"){ dropped.push({id, reason:"unknown"}); continue; }
    if(p.status==="closed"){ dropped.push({id, reason:"closedday"}); continue; }
    const w=prev?walkMin(prev,p):0, arr=now+w, s=Math.max(arr,p.open), end=s+durOf(p);
    let conflict=null;
    /* automatic mode drops what cannot fit; manual mode keeps the user's order and flags the conflict instead */
    if(end>p.close){ if(!manual){ dropped.push({id, reason: arr<p.open ? "late" : "early"}); continue; } conflict="close"; }
    else if(end>endMin){ if(!manual){ dropped.push({id, reason:"window"}); continue; } conflict="window"; }
    items.push({id, walk:w, wait:s-arr, start:s, end, conflict});
    walk+=w; now=end; prev=p;
  }
  return {items,dropped,finish:now,walk};
}
const fitsIn=(pl,id)=>pl.items.some(i=>i.id===id&&!i.conflict);
function solve(ids,start,prevPlace,endMin,pins,base){
  if(!ids.length) return {items:[],dropped:[],finish:start,walk:0};
  const pinned=Object.keys(pins).filter(id=>ids.includes(id));
  const run=useP=>{
    let best=null;
    (function perm(rest,cur){
      if(!rest.length){
        if(useP && pinned.some(id=>cur.indexOf(id)+base!==pins[id])) return;
        const r=simulate(cur,start,prevPlace,endMin), cost=r.dropped.length*1e5+r.finish+r.walk*0.01;
        if(!best||cost<best.cost) best={...r,cost};
        return;
      }
      rest.forEach((id,i)=>perm([...rest.slice(0,i),...rest.slice(i+1)],[...cur,id]));
    })(ids,[]);
    return best;
  };
  return (pinned.length && run(true)) || run(false);   /* pins are respected when any order allows them */
}
function plan(tray=state.tray, delay=state.delay, start=state.startMin, end=state.endMin){
  const vs=state.visits.filter(v=>tray.includes(v.id));   /* visited stops stay fixed (FR-706) */
  const items=[]; let prev=null, walk=0;
  vs.forEach(v=>{ const p=P[v.id], w=prev?walkMin(prev,p):0; items.push({id:v.id,walk:w,wait:0,start:v.start,end:v.end,done:true}); walk+=w; prev=p; });
  const rest=tray.filter(id=>!vs.some(v=>v.id===id));
  const t0=vs.length ? vs[vs.length-1].end+delay : start+delay;
  const r=state.manual ? simulate(rest,t0,prev,end,true) : solve(rest,t0,prev,end,state.pins,vs.length);
  const all=[...items,...r.items];
  return {items:all, dropped:r.dropped, finish:all.length?all[all.length-1].end:t0, walk:walk+r.walk};
}
function plainState(){ return {tray:state.tray}; }
