/* Vibe search through the dayoff-search service (server.mjs forwards /api/search to SEARCH_API_URL).
   On only when the server served that service's places: places.js then sets window.DAYOFF_AREA {id, start, startName, vibes, search}.
   DAYOFF_SEARCH.search(q) resolves to {mode, list, vibes, notice, degraded} or null when the service does not answer.
   list items: {id, m: score 0-1, weak, vibe: {matched, not_matched} | null, mentions: {vibe: review count}} */
(function(){
  const AREA = window.DAYOFF_AREA || null, on = !!(AREA && AREA.search);
  const label = (id, lang) => { const v = on && AREA.vibes.find(x => x.id === id); return v ? v[lang] || v.en : id; };
  async function search(q, {lat, lng, top_k = 20} = {}){
    try{
      const r = await fetch("api/search", {method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({query: q, lat, lng, top_k}), signal: AbortSignal.timeout(20000)});
      if(!r.ok) return null;
      const j = await r.json(); if(!j || !Array.isArray(j.results)) return null;
      const vibes = Object.keys((j.parsed && j.parsed.atmosphere_weights) || {});
      const cats = ((j.parsed && j.parsed.hard_constraints && j.parsed.hard_constraints.categories) || []);
      const list = j.results.map(x => ({id: String(x.venue_id), m: Math.max(0, Math.min(1, x.score || 0)),
        weak: vibes.length ? !(x.vibe_match && x.vibe_match.matched.length) : false,     /* a searched vibe no review mentions */
        vibe: x.vibe_match || null,
        mentions: Object.fromEntries(Object.entries(x.atmosphere_evidence || {}).map(([k, e]) => [k, e.review_mentions || 0]))}));
      return {mode: !q.trim() ? "empty" : vibes.length || cats.length ? "match" : "none", list, vibes,
              notice: j.notice || null, degraded: !!j.degraded};
    }catch(e){ return null; }
  }
  window.DAYOFF_SEARCH = {on, area: AREA, label, search};
})();
