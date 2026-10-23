/* Leaflet map shared by the experimental versions. Tiles: Mapbox (MAP_BLOCK_KEY) or Longdo (LONGDO_MAP_KEY) with a switch, else OSM/CARTO. */
const DayMap=(()=>{
  const ENV=window.DAYOFF_ENV||{}, MK=ENV.MAP_BLOCK_KEY||"", LK=ENV.LONGDO_MAP_KEY||"";
  const OSM='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  let map=null, group=null, routeLayer=null, TL=null, kind="", errs=0, el=null, onPin=()=>{}; const dead=new Set(), markers={}, cache=new Map(); let pref="mapbox", token=0, meLayer=null;
  try{ pref=localStorage.getItem("dayoff-map")==="longdo"?"longdo":"mapbox"; }catch(e){}
  const want=()=>{
    if(LK&&pref==="longdo"&&!dead.has("longdo")) return "longdo";
    if(MK&&!dead.has("mapbox")) return document.documentElement.dataset.theme==="dark"?"mapbox-dark":"mapbox-light";
    return location.protocol==="file:"||dead.has("osm")?"carto":"osm";
  };
  const spec=k=>{
    if(k==="longdo") return {url:`https://ms.longdo.com/mmmap/tile.php?zoom={z}&x={x}&y={y}&key=${LK}&proj=epsg3857&HD=true`,opt:{maxZoom:19,attribution:'&copy; <a href="https://map.longdo.com/">Longdo Map</a> '+OSM}};
    if(k.startsWith("mapbox")) return {url:`https://api.mapbox.com/styles/v1/mapbox/${k==="mapbox-dark"?"dark-v11":"streets-v12"}/tiles/512/{z}/{x}/{y}@2x?access_token=${MK}`,opt:{tileSize:512,zoomOffset:-1,maxZoom:19,attribution:'&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> '+OSM}};
    if(k==="carto") return {url:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",opt:{maxZoom:19,subdomains:"abcd",attribution:OSM+' &copy; <a href="https://carto.com/attributions">CARTO</a>'}};
    return {url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",opt:{maxZoom:19,attribution:OSM}};
  };
  function sync(){
    if(!map) return; const k=want(); if(k===kind) return;
    if(TL) map.removeLayer(TL); const s=spec(k); TL=L.tileLayer(s.url,s.opt).addTo(map); kind=k; errs=0;
    el.dataset.tiles=k.startsWith("mapbox")?"mapbox":k;
    TL.on("tileerror",()=>{ if(++errs>=3){ dead.add(k.startsWith("mapbox")?"mapbox":k); sync(); } });
  }
  function switcher(){
    let sw=el.parentElement.querySelector(".mapsw");
    if(!(MK&&LK)){ if(sw) sw.hidden=true; return; }
    if(!sw){ sw=document.createElement("div"); sw.className="mapsw"; sw.setAttribute("role","group"); sw.setAttribute("aria-label","Map provider"); el.parentElement.appendChild(sw);
      sw.addEventListener("click",e=>{ const b=e.target.closest("button[data-prov]"); if(!b) return; pref=b.dataset.prov; try{ localStorage.setItem("dayoff-map",pref); }catch(x){} dead.delete(pref); switcher(); sync(); }); }
    sw.hidden=false; sw.innerHTML=["mapbox","longdo"].map(k=>`<button type="button" data-prov="${k}" aria-pressed="${k===pref}">${k==="mapbox"?"Mapbox":"Longdo"}</button>`).join("");
  }
  function pinIcon(k,n,best){
    const dot=k==="num"||k==="done"?26:k==="faint"?9:16, size=k==="faint"?14:Math.max(dot,30);
    return L.divIcon({className:"",html:`<div class="pinbox"><div class="pin ${k==="done"?"num done":k}${best?" best":""}">${n||""}</div></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
  }
  async function walkGeometry(pts){
    const key=pts.map(p=>p.lng.toFixed(5)+","+p.lat.toFixed(5)).join(";"); if(cache.has(key)) return cache.get(key);
    try{ const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),6000);
      const r=await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${key}?overview=full&geometries=geojson`,{signal:ctl.signal}); clearTimeout(to);
      if(!r.ok) throw 0; const j=await r.json(); const g=j.routes&&j.routes[0]&&j.routes[0].geometry.coordinates.map(([x,y])=>[y,x]); cache.set(key,g||null); return g||null;
    }catch(e){ cache.set(key,null); return null; }
  }
  return {
    init(target,{onPin:cb,zoom="bottomright"}={}){
      el=typeof target==="string"?$(target):target; el.classList.add("mapbox"); onPin=cb||(()=>{});
      if(!window.L){ el.innerHTML='<p style="padding:24px">Map could not load.</p>'; return; }
      map=L.map(el,{zoomControl:false,attributionControl:false,scrollWheelZoom:true,keyboard:true}).setView([13.7385,100.5105],15);
      L.control.attribution({position:"topright"}).addTo(map); if(zoom) L.control.zoom({position:zoom}).addTo(map);
      group=L.layerGroup().addTo(map); sync(); switcher();
      new ResizeObserver(()=>map.invalidateSize()).observe(el);
    },
    refresh(){ sync(); },
    /* list: [{id,kind,n,best}] ; kind = res | tray | num | done | faint */
    pins(list,{fit=true}={}){
      if(!map) return; sync(); group.clearLayers(); if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; } token++;
      Object.keys(markers).forEach(k=>delete markers[k]);
      list.forEach(it=>{ const p=P[it.id]; const m=L.marker([p.lat,p.lng],{icon:pinIcon(it.kind,it.n,it.best),keyboard:true,title:nm(p),riseOnHover:true}).addTo(group); m.on("click",()=>onPin(it.id)); markers[it.id]=m; });
      if(fit&&list.length) this.fit(list.map(i=>i.id));
    },
    fit(ids){ if(!map||!ids.length) return; const b=L.latLngBounds(ids.map(id=>[P[id].lat,P[id].lng])); if(ids.length===1) map.setView(b.getCenter(),17,{animate:!reducedMotion()}); else map.fitBounds(b,{padding:[36,36],maxZoom:17,animate:!reducedMotion()}); },
    focus(id){ if(!map||!P[id]) return; map.setView([P[id].lat,P[id].lng],Math.max(map.getZoom(),17),{animate:!reducedMotion()}); },
    me(on=true){ if(!map) return; if(meLayer){ map.removeLayer(meLayer); meLayer=null; } if(on){ meLayer=L.marker([ME.lat,ME.lng],{icon:pinIcon("me"),interactive:false}).addTo(map); } },
    async route(items,color){
      if(!map) return; const my=++token, pts=items.map(i=>P[i.id]); if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }
      if(pts.length<2) return;
      const style={color:color||(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#C93520"),weight:4,opacity:.9};
      routeLayer=L.polyline(pts.map(p=>[p.lat,p.lng]),{...style,dashArray:"6 8"}).addTo(map);
      const g=await walkGeometry(pts); if(my!==token||!g) return;
      map.removeLayer(routeLayer); routeLayer=L.polyline(g,style).addTo(map);
    },
    invalidate(){ map&&map.invalidateSize(); }
  };
})();
