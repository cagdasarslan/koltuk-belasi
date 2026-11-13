// Denge sınaması: aynı kurallarla farklı oyun tarzlarını çok kez oynatır.
const O = require("../app/oyun.js");
const fs = require("fs");
const il = JSON.parse(fs.readFileSync("app/data/iller.json", "utf8")).iller.find((i) => i.plaka === "34");
const dg = JSON.parse(fs.readFileSync("app/data/ilceler.geojson", "utf8"));
const mg = JSON.parse(fs.readFileSync("app/data/mahalleler.geojson", "utf8"));
const districts = dg.features.map((f) => ({ id: f.properties.id, name: f.properties.name }));
const mah = mg.features.map((f) => { const p = f.properties; return { id: p.id, ilce: p.ilce, name: p.name, tip: p.tip, kiyi: p.kiyi, pop: p.pop, lon: p.label[0], lat: p.label[1] }; });
const meetAll = (s, reserve) => { for (const m of O.mahs(s).filter((m) => m.req).sort((a, b) => b.pop - a.pop)) if (s.budget - O.reqCost(s, m, m.req.key) > reserve) O.meet(s, m.id); };
// en çok nüfusu kapsayan yere, o alanda puanı en düşük olan yapıyı koy
function smartBuild(s, reserve) {
  const types = ["park", "poliklinik", "guvenlik", "metro"];
  const cand = O.mahs(s).filter((m) => m.pop > 15000).sort(() => 0.5 - Math.random()).slice(0, 40);
  let best = null;
  for (const m of cand) for (const t of types) {
    if (O.canPlace(s, t, m.id) || s.budget - O.buildCost(s, t) < reserve) continue;
    const b = O.BUILDINGS[t], c = O.coverage(s, t, m.id);
    const need = c.ids.reduce((a, id) => a + s.m[id].pop * Math.max(0, 55 - s.m[id].cov[b.alan]), 0);
    const v = need / O.buildCost(s, t);
    if (!best || v > best.v) best = { v, t, id: m.id };
  }
  if (best) O.place(s, best.t, best.id);
}
const styles = {
  pasif: () => {},
  yalnizIstek: (s) => meetAll(s, 150),
  yalnizYapi: (s) => { smartBuild(s, 300); smartBuild(s, 300); },
  dengeli: (s) => { meetAll(s, 400); smartBuild(s, 600); if (s.month === 0) { O.propose(s, "ekmek", true); O.propose(s, "katilimci", true); } },
  savurgan: (s) => { for (const k in s.alloc) O.setAlloc(s, k, 150); meetAll(s, 0); },
  cimri: (s) => { for (const k in s.alloc) O.setAlloc(s, k, 50); if (s.tax < 2) O.proposeTax(s, 2, true); },
};
const N = +process.argv[2] || 60;
for (const [name, play] of Object.entries(styles)) {
  const out = [];
  for (let seed = 1; seed <= N; seed++) {
    const s = O.create(il, districts, mah, seed * 7717);
    while (!s.election) {
      play(s);
      O.endMonth(s);
      if (s.event) { if (!s.event.afet) O.resolveEvent(s, name === "pasif" || name === "cimri" ? 1 : 0); O.resolveEvent(s, 0); }
    }
    out.push({ vote: s.election.vote, win: s.election.win, budget: s.budget, resil: s.city.resil, dev: s.city.dev, press: s.pressure, cap: s.capital, fac: s.fac.length });
  }
  const avg = (f) => (out.reduce((a, o) => a + f(o), 0) / out.length).toFixed(1);
  console.log(name.padEnd(12), "kazanma %" + avg((o) => (o.win ? 100 : 0)).padStart(5), "oy", avg((o) => o.vote), "bütçe", avg((o) => o.budget), "direnç", avg((o) => o.resil), "gelişim", avg((o) => o.dev), "baskı", avg((o) => o.press), "sermaye", avg((o) => o.cap), "yapı", avg((o) => o.fac));
}
const s = O.create(il, districts, mah, 1);
const t0 = Date.now(); const f = O.forecast(s, 6); const dt = Date.now() - t0;
console.log("başlangıç mutluluk", s.city.happy.toFixed(1), "direnç", s.city.resil.toFixed(1), "gelişim", s.city.dev.toFixed(1), "istek", O.mahs(s).filter((m) => m.req).length, "| 6 ay tahmini", f.happy.toFixed(1), `(${dt} ms)`, "| kayıt", (JSON.stringify(s).length / 1024).toFixed(0), "KB", "| meclis", O.bloc(s).toFixed(1));
