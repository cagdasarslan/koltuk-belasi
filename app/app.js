/* Koltuk Belası: Şehir Senin — şehir ekranı (harita + arayüz). Kurallar oyun.js içinde. */
(async function () {
  const O = window.Oyun, Ses = window.Ses, Portre = window.Portre;
  const PLAKA = "34";
  const KEY = "kb-kayit-" + PLAKA;
  const BBOX = L.latLngBounds([40.75, 27.9], [41.65, 30.0]);
  const ALT_MAX = 150, ALT_MIN = 15;      // km: en uzak ve en yakın kamera
  const ALT_K = 0.85;                     // kamera yüksekliği / ekrandaki yer genişliği
  const MAHALLE_ALT = 45;                 // bu yüksekliğin altında seçili ilçenin mahalleleri açılır
  const LAT = 41.05;
  const STAR_COLORS = ["#ff5468", "#ff9a4a", "#ffd23f", "#9be36a", "#39ff8e"];
  const ALAN_ICO = { park: "trees", saglik: "cross", guvenlik: "shield", ulasim: "bus", afet: "shield-alert", genel: "landmark" };
  const $ = (id) => document.getElementById(id);
  const ico = (n) => `<i class="ico" style="--i:url(icons/${n}.svg)"></i>`;
  const tone = (h) => (h >= 70 ? "good" : h >= 50 ? "warn" : "bad");
  const face = (h) => ico(h >= 70 ? "smile" : h >= 50 ? "meh" : "frown");
  const css = getComputedStyle(document.documentElement);
  const color = (h) => css.getPropertyValue("--" + tone(h)).trim();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (v) => Math.round(v);
  const dec = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
  const nf = (v) => Math.round(v).toLocaleString("tr-TR");
  const money = (m) => {
    const a = Math.abs(m), sign = m < 0 ? "−" : "";
    return a >= 1000 ? `${sign}₺${(a / 1000).toFixed(2).replace(".", ",")} Mr` : `${sign}₺${Math.round(a)} Mn`;
  };
  const signed = (m) => (m >= 0 ? "+" : "") + money(m);
  const onemHtml = (n) => `<span class="onem o${n}" title="Önem: ${n}/5">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>`;
  const starsHtml = (dev) => { const n = O.stars(dev); return `<span class="stars" title="Gelişim ${pct(dev)}/100">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>`; };

  /* ---------- harita ---------- */
  const retina = (window.devicePixelRatio || 1) > 1.5;
  const map = L.map("map", {
    zoomControl: false, attributionControl: false, zoomSnap: 0, zoomDelta: 0.6, wheelPxPerZoomLevel: 110,
    maxBounds: BBOX, maxBoundsViscosity: 1, bounceAtZoomLimits: false, preferCanvas: true, inertiaDeceleration: 2400,
  });
  L.tileLayer("tiles/{z}/{x}/{y}.webp", retina
    ? { tileSize: 128, zoomOffset: 1, minNativeZoom: 7, maxNativeZoom: 13, bounds: BBOX, keepBuffer: 3 }
    : { tileSize: 256, minNativeZoom: 8, maxNativeZoom: 14, bounds: BBOX, keepBuffer: 3 }).addTo(map);
  const mPerPx = (z) => (156543.03392 * Math.cos((LAT * Math.PI) / 180)) / 2 ** z;
  const altOf = (z) => (mPerPx(z) * map.getSize().x * ALT_K) / 1000;
  const zoomOf = (alt) => Math.log2((156543.03392 * Math.cos((LAT * Math.PI) / 180)) / ((alt * 1000) / ALT_K / map.getSize().x));
  function setLimits() {
    map.invalidateSize();
    map.setMinZoom(Math.max(zoomOf(ALT_MAX), map.getBoundsZoom(BBOX, true))); // veri alanının dışı görünmesin
    map.setMaxZoom(zoomOf(ALT_MIN));
  }
  map.setView([41.06, 28.98], 10, { animate: false });
  setLimits();
  map.setZoom(map.getMinZoom(), { animate: false });
  window.addEventListener("resize", () => { setLimits(); layout(); });
  $("zin").onclick = () => map.zoomIn(0.8);
  $("zout").onclick = () => map.zoomOut(0.8);
  // vektör katmanların hepsi aynı tuvalde kalır: ayrı tuval panelleri birbirinin dokunuşunu yutar
  for (const [name, z] of [["labels", 650], ["pins", 660]]) map.createPane(name).style.zIndex = z;

  /* ---------- veri ve kayıt ---------- */
  const [ilceGeo, mahGeo, iller] = await Promise.all(["data/ilceler.geojson", "data/mahalleler.geojson", "data/iller.json"].map((u) => fetch(u).then((r) => r.json())));
  const il = iller.iller.find((i) => i.plaka === PLAKA);
  const districts = ilceGeo.features.map((f) => ({ id: f.properties.id, name: f.properties.name }));
  const MF = new Map(mahGeo.features.map((f) => [f.properties.id, f])); // mahalle id -> geometri
  const mahList = mahGeo.features.map((f) => { const p = f.properties; return { id: p.id, ilce: p.ilce, name: p.name, tip: p.tip, kiyi: p.kiyi, pop: p.pop, lon: p.label[0], lat: p.label[1] }; });
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && s.v === 3 && districts.every((d) => s.d[d.id]) && Object.keys(s.m).length === mahList.length ? O.derive(s) : null;
    } catch (e) { return null; }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* kayıt kapalıysa oyun yine çalışır */ } };
  const fresh = () => O.create(il, districts, mahList, (Math.random() * 2 ** 31) | 0);
  let S = load() || fresh();
  let sel = null, selM = null, tab = null;
  let mode = null;          // null | {t:"build", type, pick} | {t:"prio", key}
  let baseline = null;      // Hizmetler sayfası açıldığındaki 6 aylık tahmin
  let voteView = null;      // son oylamanın sonucu
  const picked = new Set(); // İstekler panelinde işaretlenen mahalleler
  let reqSort = "ilce";     // İstekler paneli sıralaması: "ilce" | "onem"
  const V = new Map();      // ilçe id -> harita nesneleri

  /* ---------- ilçe katmanı ---------- */
  function styleOf(d) {
    if (mode && mode.t === "prio") {
      const on = S.prio[mode.key].includes(d.id);
      return { color: on ? "#4fd8ff" : "#9fb0bf", weight: on ? 3 : 1, opacity: on ? 1 : 0.6, fillColor: "#4fd8ff", fillOpacity: on ? 0.32 : 0.02 };
    }
    const s = sel === d.id;
    return { color: color(d.happy), weight: s ? 3 : 1.4, opacity: s ? 1 : 0.8, fillColor: color(d.happy), fillOpacity: s ? 0.06 : 0.015 };
  }
  L.geoJSON(ilceGeo, {
    style: (f) => styleOf(S.d[f.properties.id]),
    onEachFeature: (f, l) => { V.set(f.properties.id, { layer: l, label: f.properties.label }); l.on("click", () => clickDistrict(f.properties.id)); },
  }).addTo(map);
  const mk = (ll, html, pane) => L.marker(ll, { pane: pane || "labels", icon: L.divIcon({ className: "lab", html, iconSize: [0, 0] }), keyboard: false });
  V.forEach((v, id) => {
    v.marker = mk([v.label[1], v.label[0]], "").addTo(map);
    v.marker.on("click", () => clickDistrict(id));
  });
  function drawLabel(d) {
    const v = V.get(d.id), el = v.marker.getElement();
    if (!el) return;
    el.innerHTML = `<div class="dlabel ${tone(d.happy)}${sel === d.id ? " sel" : ""}">
      <div class="row">${face(d.happy)}<span>${esc(d.name)}</span><span class="pct">%${pct(d.happy)} ${d.trend < 0 ? "↓" : "↑"}</span>${d.reqs ? `<span class="badge">${d.reqs}</span>` : ""}</div>
      <div class="bar"><i style="width:${pct(d.happy)}%"></i></div></div>`;
    v.w = 0;
  }
  function clickDistrict(id) {
    if (mode && mode.t === "prio") {
      if (O.togglePrio(S, mode.key, id)) { Ses.play("anahtar"); save(); V.get(id).layer.setStyle(styleOf(S.d[id])); banner(); }
      else { Ses.play("hata"); toast(`En çok ${O.MAX_PRIO} öncelikli ilçe seçilebilir`); }
      return;
    }
    if (mode) return;
    select(id);
  }

  /* ---------- istek iğneleri ve yapı işaretleri ---------- */
  let pins = [], facMarks = [];
  function drawPins() {
    pins.forEach((p) => map.removeLayer(p));
    pins = [];
    for (const m of O.mahs(S)) {
      if (!m.req) continue;
      const def = O.REQS[m.req.key];
      const p = mk([m.lat, m.lon], `<div class="pin${m.req.age >= 2 ? " late" : ""}${selM === m.id ? " on" : ""}" title="${esc(m.name)}: ${esc(def.ad)}">${ico(ALAN_ICO[def.alan])}</div>`, "pins").addTo(map);
      p.on("click", () => { if (!mode) openMahalle(m.id, true); });
      pins.push(p);
    }
  }
  function drawFac() {
    facMarks.forEach((p) => map.removeLayer(p));
    facMarks = [];
    for (const f of S.fac) {
      const b = O.BUILDINGS[f.type], doing = f.left > 0;
      const p = mk([f.lat, f.lon], `<div class="fac${doing ? " doing" : ""}" title="${esc(S.m[f.m].name)}: ${esc(b.ad)}${doing ? ` (${f.left} ay kaldı)` : ""}">${ico(b.ico)}${doing ? `<small>${f.left}</small>` : ""}</div>`, "labels").addTo(map);
      p.on("click", () => { if (!mode) openMahalle(f.m, false); });
      facMarks.push(p);
    }
  }

  /* ---------- mahalle katmanı (yakın görünüm, seçili ilçe) ---------- */
  let mahLayer = null, mahMarkers = [], mahFor = null;
  const mahStyle = (m) => ({ color: selM === m.id ? "#fff" : "rgba(255,255,255,.75)", weight: selM === m.id ? 3 : 1.2, fillColor: STAR_COLORS[O.stars(m.dev) - 1], fillOpacity: selM === m.id ? 0.34 : 0.2 });
  function showMahalle(id) {
    if (mahFor === id) return;
    if (mahLayer) { map.removeLayer(mahLayer); mahMarkers.forEach((x) => map.removeLayer(x.marker)); }
    mahLayer = null; mahMarkers = []; mahFor = id;
    if (id == null) return;
    const ms = O.mahOf(S, id);
    mahLayer = L.geoJSON({ type: "FeatureCollection", features: ms.map((m) => MF.get(m.id)) }, {
      style: (f) => mahStyle(S.m[f.properties.id]),
      onEachFeature: (f, l) => l.on("click", (e) => { L.DomEvent.stopPropagation(e); if (!mode) openMahalle(f.properties.id, false); }),
    }).addTo(map);
    for (const m of ms) {
      const marker = mk([m.lat, m.lon], `<div class="mlabel"><span>${esc(m.name)}</span> <b style="color:${STAR_COLORS[O.stars(m.dev) - 1]}">${"★".repeat(O.stars(m.dev))}</b></div>`).addTo(map);
      mahMarkers.push({ marker, pri: m.pop + (m.req ? 1e7 : 0) + (m.id === selM ? 1e8 : 0), w: m.name.length * 6.6 + 14 * O.stars(m.dev) + 8, h: 16, ll: marker.getLatLng() });
    }
  }

  /* ---------- yapı yerleştirme kipi ---------- */
  let allMah = null, coverLayer = null;
  function buildLayers(on) {
    if (on && !allMah) {
      allMah = L.geoJSON(mahGeo, {
        style: { color: "rgba(255,255,255,.5)", weight: 0.7, fillColor: "#fff", fillOpacity: 0.02 },
        onEachFeature: (f, l) => l.on("click", (e) => { L.DomEvent.stopPropagation(e); if (mode && mode.t === "build") pickSpot(f.properties.id); }),
      });
    }
    if (allMah) (on ? allMah.addTo(map) : map.removeLayer(allMah));
    if (!on && coverLayer) { map.removeLayer(coverLayer); coverLayer = null; }
  }
  function startBuild(type, at) {
    tab = null; selM = null;
    mode = { t: "build", type, pick: null };
    showMahalle(null);
    buildLayers(true);
    refresh();
    if (at) pickSpot(at);
    else if (altOf(map.getZoom()) > 60) toast("Yakınlaş ve yapının kurulacağı mahalleye dokun");
  }
  function pickSpot(mid) {
    mode.pick = mid;
    const b = O.BUILDINGS[mode.type], c = O.coverage(S, mode.type, mid);
    if (coverLayer) map.removeLayer(coverLayer);
    coverLayer = L.layerGroup([
      L.geoJSON({ type: "FeatureCollection", features: c.ids.map((id) => MF.get(id)) }, { interactive: false, style: { color: "#4fd8ff", weight: 1, fillColor: "#4fd8ff", fillOpacity: 0.3 } }),
      L.circle([c.lat, c.lon], { radius: b.r * 1000, interactive: false, color: "#fff", weight: 2, dashArray: "6 5", fill: false }),
      // aynı türden mevcut yapıların alanı: üst üste bindirmemek için
      ...S.fac.filter((f) => f.type === mode.type).map((f) => L.circle([f.lat, f.lon], { radius: b.r * 1000, interactive: false, color: "#ffb648", weight: 1.5, fill: false })),
    ]).addTo(map);
    mode.cov = c;
    Ses.play("sec");
    banner();
    const need = zoomOf(Math.min(60, Math.max(18, b.r * 9)));
    // seçilen yer ekran dışındaysa ya da çok uzaktan bakılıyorsa oraya git
    if (map.getZoom() < need - 0.4 || !map.getBounds().pad(-0.25).contains([c.lat, c.lon])) map.flyTo([c.lat, c.lon], Math.max(map.getZoom(), need), { duration: 0.7 });
  }
  function endMode(reopen) {
    const was = mode;
    mode = null;
    buildLayers(false);
    if (was && was.t === "prio") baseline = null;
    tab = reopen || null;
    refresh();
  }
  function banner() {
    const el = $("banner");
    el.hidden = !mode;
    document.body.classList.toggle("moded", !!mode);
    if (!mode) return;
    if (mode.t === "build") {
      const b = O.BUILDINGS[mode.type], cost = O.buildCost(S, mode.type), m = S.m[mode.pick];
      const why = m ? O.canPlace(S, mode.type, m.id) : "";
      el.innerHTML = `<div class="btxt">${ico(b.ico)}<div><b>${b.ad}</b> · ${money(cost)} · ${b.months} ay · etki yarıçapı ${String(b.r).replace(".", ",")} km<br>
        ${m ? `<span class="hl">${esc(m.name)} (${esc(S.d[m.ilce].name)})</span> · ${mode.cov.ids.length} mahalle, yaklaşık ${nf(mode.cov.pop)} kişi kapsanıyor` : "Haritada yapının kurulacağı mahalleye dokun"}</div></div>
        <div class="bbtn">${m ? `<button class="mini ok" id="bok" type="button"${why ? " disabled" : ""}>${why || "Onayla"}</button>` : ""}<button class="mini" id="bno" type="button">Vazgeç</button></div>`;
      const ok = el.querySelector("#bok");
      if (ok) ok.onclick = () => {
        const name = m.name, months = b.months;
        if (!O.place(S, mode.type, m.id)) return Ses.play("hata");
        Ses.play("insa"); save(); endMode(null);
        toast(`${name}: ${b.ad} inşaatı başladı, ${months} ay sürecek`);
      };
      el.querySelector("#bno").onclick = () => endMode("yapilar");
    } else {
      const v = O.SERVICES[mode.key], n = S.prio[mode.key].length;
      el.innerHTML = `<div class="btxt">${ico(v.ico)}<div><b>${v.ad}: öncelikli ilçeler (${n}/${O.MAX_PRIO})</b><br>Haritada ilçelere dokun. Öncelikli ilçe %35 fazla hizmet alır, diğerlerinin payı biraz azalır.</div></div>
        <div class="bbtn"><button class="mini ok" id="bno" type="button">Bitti</button></div>`;
      el.querySelector("#bno").onclick = () => endMode("hizmetler");
    }
  }

  /* ---------- etiket yerleşimi: çakışanları öncelik sırasına göre gizle ---------- */
  function layout() {
    const alt = altOf(map.getZoom()), far = alt > 70;
    $("alt").textContent = `Kamera: ${alt.toFixed(alt < 30 ? 1 : 0).replace(".", ",")} km`;
    document.body.classList.toggle("far", far);
    document.body.classList.toggle("vfar", alt > 100);
    const near = alt <= MAHALLE_ALT && sel != null && !mode;
    showMahalle(near ? sel : null);
    const size = map.getSize(), placed = [];
    const fits = (pt, w, h) => {
      const b = [pt.x - w / 2 - 3, pt.y - h / 2 - 3, pt.x + w / 2 + 3, pt.y + h / 2 + 3];
      if (b[2] < 0 || b[0] > size.x || b[3] < 0 || b[1] > size.y) return false;
      if (placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1])) return false;
      placed.push(b);
      return true;
    };
    const items = O.list(S).sort((a, b) => (b.id === sel) - (a.id === sel) || b.reqs - a.reqs || b.pop - a.pop);
    for (const d of items) {
      const v = V.get(d.id), el = v.marker.getElement();
      if (!el || !el.firstElementChild) continue;
      const box = el.firstElementChild;
      box.classList.remove("hide");
      if (!v.w || v.far !== far) { v.w = box.offsetWidth; v.h = box.offsetHeight; v.far = far; }
      const hideAll = near || (mode && mode.t === "build" && alt < 60);
      box.classList.toggle("hide", hideAll || !fits(map.latLngToContainerPoint(v.marker.getLatLng()), v.w, v.h));
    }
    for (const x of mahMarkers.sort((a, b) => b.pri - a.pri)) {
      const el = x.marker.getElement();
      if (el) el.firstElementChild.classList.toggle("hide", !fits(map.latLngToContainerPoint(x.ll), x.w, x.h));
    }
  }
  map.on("zoom move", layout);

  /* ---------- gösterge ---------- */
  function hud() {
    const h = S.city.happy, net = O.monthly(S).net, r = S.city.resil;
    $("budget").textContent = money(S.budget);
    $("budget").className = S.budget >= 0 ? "good" : "bad";
    $("net").textContent = `${signed(net)}/ay`;
    $("net").className = net >= 0 ? "good" : "bad";
    $("happy").textContent = `%${pct(h)}`;
    $("happy").className = h >= 51 ? "good" : "bad";
    $("resil").textContent = `%${pct(r)}`;
    $("resil").className = r >= 60 ? "good" : r >= 40 ? "warn" : "bad";
    $("capital").textContent = pct(S.capital);
    $("reqcnt").textContent = O.mahs(S).filter((m) => m.req).length || "";
    $("months").textContent = `${S.monthsLeft} ay`;
    $("term").textContent = S.term > 1 ? `${S.term}. dönem` : "";
  }

  /* ---------- sol panel: ilçe ya da mahalle ---------- */
  const bars = (sc, act) => `<div class="needs">${Object.entries(O.DOMAINS).map(([k, v]) => `<div class="need-t ${k}${act === k ? " act" : ""}">${ico(v.ico)}${v.ad}<div class="lv"><i style="width:${pct(sc[k])}%"></i></div></div>`).join("")}</div>`;
  function reqRow(m) {
    const def = O.REQS[m.req.key], cost = O.reqCost(S, m, m.req.key);
    return `<div class="rq${m.req.age >= 2 ? " late" : ""}"><button type="button" class="rqn" data-go="${m.id}">${ico(ALAN_ICO[def.alan])}<span><b>${esc(m.name)}</b>${esc(def.ad)} · ${money(cost)} · ${4 - m.req.age} ay ${onemHtml(O.importance(S, m))}</span></button>
      <button type="button" class="mini ok" data-meet="${m.id}"${S.budget < cost ? " disabled" : ""}>Karşıla</button></div>`;
  }
  function doMeet(mid) {
    const m = S.m[mid], def = O.REQS[m.req.key];
    if (!O.meet(S, mid)) return Ses.play("hata");
    Ses.play("onay"); save(); refresh();
    toast(`${m.name}: ${def.ad.toLocaleLowerCase("tr")} yapıldı. Gelişim ${"★".repeat(O.stars(m.dev))}`);
  }
  function panel() {
    const el = $("panel"), d = S.d[sel], m = S.m[selM];
    el.hidden = !d || !!mode;
    if (el.hidden) return;
    if (m) {
      const sc = O.scores(S, m), q = m.req, def = q && O.REQS[q.key], cost = q && O.reqCost(S, m, q.key);
      const near = S.fac.filter((f) => f.left <= 0 && O.km(m, f) <= O.BUILDINGS[f.type].r).map((f) => O.BUILDINGS[f.type].ad);
      el.innerHTML = `<button class="close" type="button" aria-label="Kapat">${ico("x")}</button>
        <button class="back" type="button">‹ ${esc(d.name)}</button>
        <h2 class="${tone(m.happy)}">${face(m.happy)}<span style="color:var(--text)">${esc(m.name)}</span><span class="pct">%${pct(m.happy)}</span></h2>
        <div class="chips"><span>${O.TIPLER[m.tip]}</span>${m.kiyi ? "<span>Kıyı</span>" : ""}<span>~${nf(m.pop)} kişi</span></div>
        <div class="devrow">${starsHtml(m.dev)}<span>Gelişim ${pct(m.dev)}/100 · Afet direnci %${pct(m.resil)}</span></div>
        ${bars(sc, def && def.alan)}
        ${q ? `<div class="req"><h3>${esc(def.ad)}</h3>${esc(m.name)} halkı ${def.metin}.<br><span class="cost">Maliyet: ${money(cost)} · ${4 - q.age} ay içinde karşılanmazsa mahalle geriler</span></div>
          <button class="btn" type="button" data-meet="${m.id}"${S.budget < cost ? " disabled" : ""}>${S.budget < cost ? "Bütçe yetersiz" : "Karşıla"}</button>`
          : `<div class="req"><h3>Bekleyen istek yok</h3>${esc(m.name)} halkının şu an bir talebi yok.</div>`}
        ${m.done.length ? `<div class="meta built">Yapılanlar: ${m.done.map((k) => esc(O.REQS[k].ad)).join(", ")}</div>` : ""}
        ${near.length ? `<div class="meta built">Kapsayan yapılar: ${[...new Set(near)].map(esc).join(", ")}</div>` : ""}
        <button class="btn ghost" type="button" id="buildhere">Buraya yapı yerleştir</button>`;
      el.querySelector(".back").onclick = () => { selM = null; refresh(); };
      el.querySelector("#buildhere").onclick = () => { openSheet("yapilar"); };
    } else {
      const sc = O.districtScores(S, d), reqs = O.mahOf(S, d.id).filter((x) => x.req).sort((a, b) => b.req.age - a.req.age);
      const nfac = S.fac.filter((f) => f.ilce === d.id).length;
      el.innerHTML = `<button class="close" type="button" aria-label="Kapat">${ico("x")}</button>
        <h2 class="${tone(d.happy)}">${face(d.happy)}<span style="color:var(--text)">${esc(d.name)}</span><span class="pct">%${pct(d.happy)} ${d.trend < 0 ? "↓" : "↑"}</span></h2>
        <div class="meta">Nüfus yaklaşık ${nf(d.pop)} · ${d.mah.length} mahalle${nfac ? ` · ${nfac} yapı` : ""}</div>
        <div class="devrow">${starsHtml(d.dev)}<span>Ortalama gelişim ${pct(d.dev)}/100 · Afet direnci %${pct(d.resil)}</span></div>
        ${bars(sc)}
        <h3 class="sub">Mahalle istekleri${reqs.length ? ` (${reqs.length})` : ""}</h3>
        ${reqs.length ? reqs.map(reqRow).join("") : `<p class="hint">Bu ilçede bekleyen mahalle isteği yok.</p>`}
        <div class="two"><button class="btn ghost" type="button" id="buildb">Yapı yerleştir</button><button class="btn ghost" type="button" id="goto">Mahalleleri gör</button></div>`;
      el.querySelector("#goto").onclick = () => focus(d, true);
      el.querySelector("#buildb").onclick = () => openSheet("yapilar");
    }
    el.querySelector(".close").onclick = () => select(null);
    el.querySelectorAll("[data-meet]").forEach((b) => (b.onclick = () => doMeet(+b.dataset.meet)));
    el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => openMahalle(+b.dataset.go, true)));
  }

  /* ---------- menü sayfası ---------- */
  const TABS = { istekler: "İstekler", yapilar: "Yapılar", hizmetler: "Hizmetler", politikalar: "Meclis", raporlar: "Raporlar" };
  function openSheet(t) {
    if (t !== tab) Ses.play(t ? "ac" : "kapat");
    if (t === "hizmetler" && tab !== "hizmetler") baseline = null;
    tab = t; sheet();
  }
  function sheet() {
    const el = $("sheet");
    el.hidden = !tab || !!mode;
    if (el.hidden) return;
    const body = { istekler: tIstekler, yapilar: tYapilar, hizmetler: tHizmetler, politikalar: tMeclis, raporlar: tRaporlar }[tab]();
    const keep = el.querySelector(".sbody") ? el.querySelector(".sbody").scrollTop : 0;
    el.innerHTML = `<div class="sbox"><div class="tabs">${Object.entries(TABS).map(([k, v]) => `<button type="button" data-t="${k}" class="${k === tab ? "on" : ""}">${v}</button>`).join("")}
      <button type="button" class="sclose" aria-label="Kapat">${ico("x")}</button></div><div class="sbody">${body}</div></div>`;
    el.querySelector(".sbody").scrollTop = keep;
    el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => openSheet(b.dataset.t)));
    el.querySelector(".sclose").onclick = () => openSheet(null);
    el.onclick = (e) => { if (e.target === el) openSheet(null); };
    wire[tab](el);
  }
  const wire = {
    istekler(el) {
      el.querySelectorAll("[data-pick]").forEach((c) => (c.onchange = () => { const id = +c.dataset.pick; c.checked ? picked.add(id) : picked.delete(id); Ses.play("sec"); sheet(); }));
      el.querySelectorAll("[data-sort]").forEach((b) => (b.onclick = () => { reqSort = b.dataset.sort; sheet(); }));
      el.querySelectorAll("[data-see]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); tab = null; openMahalle(+b.dataset.see, true); }));
      el.querySelectorAll("[data-group]").forEach((b) => (b.onclick = () => {
        const ids = O.mahOf(S, +b.dataset.group).filter((m) => m.req).map((m) => m.id), all = ids.every((id) => picked.has(id));
        ids.forEach((id) => (all ? picked.delete(id) : picked.add(id))); Ses.play("sec"); sheet();
      }));
      el.querySelectorAll("[data-quick]").forEach((b) => (b.onclick = () => {
        const q = b.dataset.quick;
        if (q === "none") picked.clear();
        else for (const m of O.mahs(S)) if (m.req && (q === "all" || O.importance(S, m) >= 4)) picked.add(m.id);
        Ses.play("sec"); sheet();
      }));
      const go = el.querySelector("#meetsel");
      if (go) go.onclick = () => {
        const r = O.meetMany(S, [...picked]);
        if (!r.done) return Ses.play("hata");
        Ses.play("onay"); save(); refresh();
        toast(`${r.done} istek karşılandı (${money(r.spent)})${r.skipped ? ` · ${r.skipped} isteğe bütçe yetmedi` : ""}`);
      };
    },
    yapilar(el) {
      el.querySelectorAll("[data-build]").forEach((b) => (b.onclick = () => { Ses.play("sec"); startBuild(b.dataset.build, selM); }));
      el.querySelectorAll("[data-fac]").forEach((b) => (b.onclick = () => { const f = S.fac.find((x) => x.id === +b.dataset.fac); tab = null; openMahalle(f.m, true); }));
    },
    hizmetler(el) {
      el.querySelectorAll("input[type=range]").forEach((r) => {
        r.oninput = () => { O.setAlloc(S, r.dataset.key, +r.value); svcLive(el); hud(); };
        r.onchange = () => { Ses.play("anahtar"); save(); };
      });
      el.querySelectorAll("[data-prio]").forEach((b) => (b.onclick = () => { Ses.play("sec"); tab = null; mode = { t: "prio", key: b.dataset.prio }; select(null); refresh(); map.flyToBounds(BBOX, { duration: 0.6 }); }));
      svcLive(el);
    },
    politikalar(el) {
      const go = (fn) => { const r = fn(); if (!r) return Ses.play("hata"); voteView = r; Ses.play(r.pass ? "zafer" : "yenilgi"); save(); refresh(); };
      el.querySelectorAll("[data-vote]").forEach((b) => (b.onclick = () => go(() => O.propose(S, b.dataset.vote, b.dataset.b === "1"))));
      el.querySelectorAll("[data-taxv]").forEach((b) => (b.onclick = () => go(() => O.proposeTax(S, +b.dataset.taxv, b.dataset.b === "1"))));
      el.querySelectorAll("[data-repeal]").forEach((b) => (b.onclick = () => { if (O.repeal(S, b.dataset.repeal)) { Ses.play("anahtar"); save(); refresh(); } }));
    },
    raporlar(el) {
      const ng = el.querySelector("#newgame");
      ng.onclick = () => {
        if (ng.dataset.sure) { S = fresh(); sel = selM = tab = null; save(); refresh(); toast("Yeni oyun başladı"); }
        else { ng.dataset.sure = 1; ng.textContent = "Emin misin? Kayıt silinecek, tekrar dokun"; }
      };
    },
  };

  function tIstekler() {
    const rows = O.mahs(S).filter((m) => m.req).map((m) => ({ m, n: O.importance(S, m), cost: O.reqCost(S, m, m.req.key), def: O.REQS[m.req.key] }));
    for (const id of [...picked]) if (!S.m[id] || !S.m[id].req) picked.delete(id);
    const byImp = (a, b) => b.n - a.n || b.m.req.age - a.m.req.age || b.m.pop - a.m.pop;
    const row = (r, withIlce) => {
      const left = 4 - r.m.req.age, on = picked.has(r.m.id);
      return `<label class="rqrow${on ? " on" : ""}"><input type="checkbox" data-pick="${r.m.id}"${on ? " checked" : ""}><span class="box">${ico("check")}</span>
        ${onemHtml(r.n)}<span class="who"><b>${esc(r.m.name)}${withIlce ? ` <em style="font-weight:400;color:var(--dim)">· ${esc(S.d[r.m.ilce].name)}</em>` : ""} · ${esc(r.def.ad)}</b>
        <small class="${left <= 2 ? "late" : ""}">${O.TIPLER[r.m.tip]}${r.m.kiyi ? ", kıyı" : ""} · ~${nf(r.m.pop)} kişi · ${left} ay kaldı</small></span>
        <span class="cst">${money(r.cost)}</span><button type="button" class="see" data-see="${r.m.id}" aria-label="${esc(r.m.name)} mahallesini haritada göster">${ico("map-pin")}</button></label>`;
    };
    let body;
    if (!rows.length) body = `<p class="hint">Şu an bekleyen mahalle isteği yok. Yeni istekler ay sonunda gelir.</p>`;
    else if (reqSort === "onem") body = rows.sort(byImp).map((r) => row(r, true)).join("");
    else {
      const groups = new Map();
      for (const r of rows) { if (!groups.has(r.m.ilce)) groups.set(r.m.ilce, []); groups.get(r.m.ilce).push(r); }
      const top = (g) => Math.max(...g.map((r) => r.n));
      body = [...groups.entries()].sort((a, b) => top(b[1]) - top(a[1]) || b[1].length - a[1].length).map(([did, g]) => {
        const d = S.d[did], total = g.reduce((a, r) => a + r.cost, 0);
        return `<div class="rqg"><h3>${esc(d.name)}</h3><span class="${tone(d.happy)}">%${pct(d.happy)}</span><span>${g.length} istek · ${money(total)}</span><button type="button" data-group="${did}">Hepsini işaretle</button></div>${g.sort(byImp).map((r) => row(r, false)).join("")}`;
      }).join("");
    }
    const sel = rows.filter((r) => picked.has(r.m.id)), sum = sel.reduce((a, r) => a + r.cost, 0), over = sum > S.budget;
    return `<div class="rqbar"><button type="button" class="mini${reqSort === "ilce" ? " on" : ""}" data-sort="ilce">İlçeye göre</button><button type="button" class="mini${reqSort === "onem" ? " on" : ""}" data-sort="onem">Öneme göre</button>
        <span class="gap"></span><button type="button" class="mini" data-quick="top">4-5 yıldızlıları seç</button><button type="button" class="mini" data-quick="all">Hepsini seç</button><button type="button" class="mini" data-quick="none">Temizle</button></div>
      <p class="hint">Yıldızlar isteğin önemini gösterir: kalabalık mahalle, süresi dolmak üzere olan istek, geri kalmış mahalle ve mutsuz ilçe önemi artırır. İstediklerini işaretle, alttan topluca karşıla.</p>
      ${body}
      ${rows.length ? `<div class="rqfoot"><div><b>${sel.length} istek seçildi · ${money(sum)}</b>${over ? `<span class="bad">Bütçe ${money(S.budget)}: en önemlilerden başlanır, yetmeyenler kalır</span>` : `Kalan bütçe ${money(S.budget - sum)}`}</div>
        <button type="button" class="btn" id="meetsel"${sel.length ? "" : " disabled"}>Seçilenleri karşıla</button></div>` : ""}`;
  }

  function tYapilar() {
    const at = S.m[selM];
    const cards = Object.entries(O.BUILDINGS).map(([k, b]) => {
      const cost = O.buildCost(S, k), n = S.fac.filter((f) => f.type === k).length;
      return `<div class="card">${ico(b.ico)}<div><b>${b.ad}${n ? ` <em>(${n} var)</em>` : ""}</b><p>${b.bilgi}</p><small>${money(cost)} · ${b.months} ay · yarıçap ${String(b.r).replace(".", ",")} km</small></div>
        <button type="button" class="mini" data-build="${k}"${S.budget < cost ? " disabled" : ""}>${S.budget < cost ? "Bütçe yok" : "Yerleştir"}</button></div>`;
    }).join("");
    const doing = S.fac.filter((f) => f.left > 0), done = S.fac.filter((f) => f.left <= 0);
    const row = (f) => `<button type="button" class="line linkrow" data-fac="${f.id}"><span>${esc(S.m[f.m].name)} (${esc(S.d[f.ilce].name)}) · ${O.BUILDINGS[f.type].ad}</span><span>${f.left > 0 ? f.left + " ay kaldı" : "hizmette"}</span></button>`;
    return `<p class="hint">Bir yapı seç, sonra haritada kurulacağı mahalleye dokun. Yapı, yarıçapı içindeki bütün mahallelere hizmet eder; kalabalık mahallelerin ortasına kurmak daha çok kişiye ulaşır.${at ? ` Seçili mahalle: <b>${esc(at.name)}</b>.` : ""}</p>
      ${cards}<h3>Süren inşaatlar</h3>${doing.length ? doing.map(row).join("") : `<p class="hint">Şu an süren inşaat yok.</p>`}
      ${done.length ? `<h3>Hizmetteki yapılar (${done.length})</h3>${done.map(row).join("")}` : ""}`;
  }

  function tHizmetler() {
    if (!baseline) baseline = O.forecast(S, 6);
    return `<div class="fc" id="fc"></div>
      <p class="hint">Kaydırıcılar aylık hizmet bütçesini dağıtır. %100'ün altı hizmeti hızla bozar; üstü pahalıdır ve getirisi azalır.</p>
      ${Object.entries(O.SERVICES).map(([k, v]) => {
        const names = S.prio[k].map((id) => S.d[id].name);
        return `<div class="svc"><div class="svh">${ico(v.ico)}<b>${v.ad}</b><span class="sval" data-val="${k}"></span></div>
          <input type="range" min="0" max="150" step="5" value="${S.alloc[k]}" data-key="${k}" aria-label="${v.ad} bütçe payı">
          <div class="svf"><span data-eff="${k}"></span><span data-cost="${k}"></span></div>
          <div class="svp"><span>${names.length ? "Öncelikli: " + names.map(esc).join(", ") : "Öncelikli ilçe yok: hizmet eşit dağılıyor"}</span><button type="button" class="mini" data-prio="${k}">Haritadan seç (${names.length}/${O.MAX_PRIO})</button></div></div>`;
      }).join("")}
      <div class="line total"><span class="k">Toplam hizmet gideri</span><span id="svtotal"></span></div>`;
  }
  function svcLive(el) {
    const mo = O.monthly(S), f = O.forecast(S, 6);
    for (const [k, v] of Object.entries(O.SERVICES)) {
      const a = S.alloc[k], q = O.quality(a);
      el.querySelector(`[data-val="${k}"]`).textContent = `%${a}`;
      el.querySelector(`[data-val="${k}"]`).className = "sval " + (a < 100 ? "bad" : a > 100 ? "good" : "");
      el.querySelector(`[data-cost="${k}"]`).textContent = `${money(O.serviceCost(S, k))}/ay`;
      el.querySelector(`[data-eff="${k}"]`).textContent = v.alan ? `${O.DOMAINS[v.alan].ad} hizmet puanı ${pct(q)}/100` : `Afet direnci ayda ${(q - 50) * 0.03 - 0.12 >= 0 ? "+" : "−"}${Math.abs((q - 50) * 0.03 - 0.12).toFixed(2).replace(".", ",")}`;
    }
    el.querySelector("#svtotal").textContent = `${money(mo.services)}/ay`;
    const dh = f.happy - baseline.happy, dr = f.resil - baseline.resil;
    const delta = (v) => (Math.abs(v) < 0.05 ? "" : ` <em class="${v > 0 ? "good" : "bad"}">${v > 0 ? "+" : "−"}${dec(Math.abs(v))}</em>`);
    el.querySelector("#fc").innerHTML = `<small>Bu ayarlarla 6 ay sonra (olaylar hariç tahmin)</small>
      <div><span>Genel mutluluk</span><b class="${f.happy >= 51 ? "good" : "bad"}">%${dec(f.happy)}${delta(dh)}</b></div>
      <div><span>Afet direnci</span><b>%${dec(f.resil)}${delta(dr)}</b></div>
      <div><span>Aylık net</span><b class="${mo.net >= 0 ? "good" : "bad"}">${signed(mo.net)}</b></div>`;
  }

  function tMeclis() {
    const bloc = O.bloc(S), nb = Math.round(bloc);
    const seats = Array.from({ length: 100 }, (_, i) => `<i class="${i < nb ? "y" : "n"}"></i>`).join("");
    const offer = (mod, attrs, locked) => {
      if (locked) return `<small class="bad">Meclis reddetti · ${locked} ay sonra yeniden sunulabilir</small>`;
      const e = O.estimate(S, mod), sure = e.need === 0;
      return `<small class="${e.lo >= 50 ? "good" : e.hi < 50 ? "bad" : "warn"}">Tahmini evet oyu %${e.lo}–${e.hi}${sure ? " · geçmesi kesin" : ""}</small>
        <div class="vbtn"><button type="button" class="mini" ${attrs} data-b="0">Oylamaya sun</button>${sure ? "" : `<button type="button" class="mini ok" ${attrs} data-b="1"${S.capital < e.need ? " disabled" : ""}>Pazarlıkla geçir · −${e.need} sermaye</button>`}</div>`;
    };
    return `<div class="meclis"><div class="seats">${seats}</div>
        <div class="mrow"><span><i class="dot y"></i>Sizi destekleyen %${nb}</span><span><i class="dot n"></i>Muhalefet %${100 - nb}</span><span>Siyasi sermaye <b>${pct(S.capital)}</b></span></div></div>
      <p class="hint">Her uygulama meclisten geçmek zorunda; 50 oy gerekir. Desteğiniz halkın mutluluğuyla artar, muhalefet baskısıyla azalır. Oy yetmiyorsa siyasi sermaye harcayıp pazarlık edebilirsiniz. Sermaye, mahalle isteklerini karşıladıkça ve yapılar bittikçe birikir. Reddedilen teklif 3 ay yeniden sunulamaz.</p>
      <h3>Vergi düzeyi</h3>${O.TAX.map((t, i) => `<div class="card${S.tax === i ? " active" : ""}"><div><b>${t.ad} vergi</b><p>Gelir ${t.mul === 1 ? "değişmez" : (t.mul > 1 ? "+" : "−") + "%" + Math.round(Math.abs(t.mul - 1) * 100)}${t.happy ? `, her ay mutluluk ${t.happy > 0 ? "+" : "−"}${String(Math.abs(t.happy)).replace(".", ",")}` : ""}.</p>
        ${S.tax === i ? `<small class="good">Yürürlükte</small>` : offer(O.taxMod(S, i), `data-taxv="${i}"`, S.cooldown.vergi)}</div></div>`).join("")}
      <h3>Uygulamalar</h3>${Object.entries(O.POLICIES).map(([k, p]) => `<div class="card${S.policies[k] ? " active" : ""}"><div><b>${p.ad}</b><p>${p.bilgi} ${p.cost ? money(O.policyCost(S, k)) + "/ay." : "Ücretsiz."}</p>
        ${S.policies[k] ? `<small class="good">Yürürlükte</small>` : offer(p.mod, `data-vote="${k}"`, S.cooldown[k])}</div>
        ${S.policies[k] ? `<button type="button" class="mini" data-repeal="${k}">Kaldır</button>` : ""}</div>`).join("")}`;
  }

  function tRaporlar() {
    const m = O.monthly(S), poll = O.poll(S), hist = S.history, sorted = O.list(S).sort((a, b) => b.happy - a.happy);
    const W = 300, H = 70, n = Math.max(1, hist.length - 1);
    // dikey eksen veriye göre daralır ki küçük değişimler de görünsün
    const lo = Math.min(45, ...hist.map((p) => p.happy - 4)), hi = Math.max(68, ...hist.map((p) => p.happy + 4));
    const yOf = (v) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
    const pts = hist.map((p, i) => `${((i / n) * W).toFixed(1)},${yOf(p.happy)}`).join(" ");
    const row = (a, v, c = "") => `<div class="line"><span class="k">${a}</span><span class="${c}">${v}</span></div>`;
    const starCount = [0, 0, 0, 0, 0];
    for (const x of O.mahs(S)) starCount[O.stars(x.dev) - 1]++;
    return `<h3>Seçim anketi</h3><div class="big ${poll >= 51 ? "good" : "bad"}">%${String(poll).replace(".", ",")}<small>bugün seçim olsa · baraj %51 · hata payı ±2,5</small></div>
      <div class="line"><span class="k">Muhalefet baskısı</span><span>%${pct(S.pressure)}</span></div><div class="meter"><i style="width:${pct(S.pressure)}%"></i></div>
      <p class="hint">Baskının her 10 puanı seçimde 1 puan oy götürür.</p>
      <h3>Genel mutluluk</h3><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Aylara göre genel mutluluk">
        <line x1="0" x2="${W}" y1="${yOf(51)}" y2="${yOf(51)}" class="base"/><polyline points="${pts}"/></svg>
      <div class="axis"><span>Başlangıç · %${pct(hist[0].happy)}</span><span>kesik çizgi: %51 barajı</span><span>${hist.length - 1}. ay · %${pct(hist[hist.length - 1].happy)}</span></div>
      <h3>Mahalle gelişimi</h3><div class="starbar">${starCount.map((c, i) => `<i style="flex:${c};background:${STAR_COLORS[i]}" title="${i + 1} yıldız: ${c} mahalle"></i>`).join("")}</div>
      <div class="axis">${starCount.map((c, i) => `<span>${"★".repeat(i + 1)} ${c}</span>`).join("")}</div>
      ${row("Karşılanan mahalle isteği", O.mahs(S).reduce((a, x) => a + x.done.length, 0))}${row("Bekleyen istek", O.mahs(S).filter((x) => x.req).length)}${row("Yapı", `${S.fac.filter((f) => f.left <= 0).length} hizmette, ${S.fac.filter((f) => f.left > 0).length} inşaatta`)}
      <h3>Aylık bütçe</h3>${row("Vergi ve gelirler", signed(m.income), "good")}${row("Hizmetler", money(-m.services))}${row("Uygulamalar", money(-m.policies))}${m.interest ? row("Borç faizi", money(-m.interest), "bad") : ""}
      <div class="line total"><span class="k">Aylık net</span><span class="${m.net >= 0 ? "good" : "bad"}">${signed(m.net)}</span></div>
      <h3>İlçeler</h3>${row("En mutlu", sorted.slice(0, 3).map((d) => `${esc(d.name)} %${pct(d.happy)}`).join(" · "), "good")}${row("En mutsuz", sorted.slice(-3).reverse().map((d) => `${esc(d.name)} %${pct(d.happy)}`).join(" · "), "bad")}
      <button type="button" class="btn ghost" id="newgame">Yeni oyun</button>`;
  }

  /* ---------- oylama sonucu, olay kartı ve seçim sonucu ---------- */
  function voteOverlay() {
    const el = $("vote"), r = voteView;
    el.hidden = !r;
    if (!r) return;
    const dots = Array.from({ length: 100 }, (_, i) => `<i class="${i < r.evet ? "y" : "n"}" style="animation-delay:${(i * 12)}ms"></i>`).join("");
    el.innerHTML = `<div class="oylama">${Portre.kart(r.pass ? "ozelkalem" : "muhalefet")}<small>Meclis oylaması</small><h1 class="${r.pass ? "good" : "bad"}">${r.pass ? "Kabul edildi" : "Reddedildi"}</h1>
      <p class="txt">${esc(r.ad)}</p><div class="seats big">${dots}</div>
      <p class="out">Evet ${r.evet} · Hayır ${r.hayir}${r.spent ? ` · pazarlık için ${r.spent} siyasi sermaye harcandı` : ""}${r.pass ? "" : ". Teklif 3 ay yeniden sunulamaz, muhalefet baskısı arttı."}</p>
      <button class="btn" type="button">Tamam</button></div>`;
    el.querySelector("button").onclick = () => { voteView = null; voteOverlay(); };
  }
  function overlay() {
    const el = $("result"), e = O.eventView(S);
    if (S.election) {
      const x = S.election;
      el.hidden = false;
      el.innerHTML = `<div>${Portre.kart("ozelkalem")}<h1 class="${x.win ? "good" : "bad"}">${x.win ? "Yeniden seçildiniz" : "Seçimi kaybettiniz"}</h1>
        <p>Oy oranınız %${String(x.vote).replace(".", ",")} · baraj %51</p><p>Genel mutluluk %${pct(x.happy)}, muhalefet baskısı %${pct(x.pressure)}</p>
        <button class="btn" type="button" id="ok">${x.win ? `${x.term + 1}. döneme başla` : "Yeniden dene"}</button></div>`;
      el.querySelector("#ok").onclick = () => { if (x.win) O.newTerm(S); else { S = fresh(); sel = selM = null; } save(); refresh(); };
      return;
    }
    el.hidden = !e;
    if (!e) return;
    const where = e.ilceler ? `<p class="where">En çok etkilenen: ${e.ilceler.map(esc).join(", ")}</p>` : "";
    el.innerHTML = `<div class="${e.afet ? "afet" : ""}">${Portre.kart(e.kim)}<small>${e.afet ? "Afet" : "Gündem"}</small><h1>${esc(e.baslik)}</h1><p class="txt">${esc(e.metin)}</p>${where}
      ${e.sonuc ? `<p class="out">${esc(e.sonuc)}</p><button class="btn" type="button" data-o="0">${e.afet ? "Kriz masasını topla" : "Devam"}</button>`
        : e.secenek.map((o, i) => `<button class="btn opt" type="button" data-o="${i}">${esc(o.ad)}<small>${esc(o.ipucu)}</small></button>`).join("")}</div>`;
    el.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => { O.resolveEvent(S, +b.dataset.o); save(); refresh(); }));
    if (e.ilce && !e.sonuc && V.get(e.ilce)) map.panTo(V.get(e.ilce).layer.getBounds().getCenter(), { duration: 0.6 });
  }

  /* ---------- ortak ---------- */
  function refresh() {
    for (const d of O.list(S)) { V.get(d.id).layer.setStyle(styleOf(d)); drawLabel(d); }
    mahFor = undefined; // mahalle katmanını yeniden çiz
    drawPins(); drawFac();
    hud(); panel(); sheet(); banner(); overlay(); voteOverlay(); layout();
  }
  function focus(d, close) {
    const v = V.get(d.id);
    const pad = window.innerWidth > 760 ? { paddingTopLeft: [370, 90], paddingBottomRight: [80, 110] } : { padding: [30, 70] };
    const z = Math.min(map.getBoundsZoom(v.layer.getBounds(), false, L.point(pad.padding || [450, 200])), map.getMaxZoom());
    const target = close ? Math.max(z, zoomOf(MAHALLE_ALT - 5)) : Math.max(map.getZoom(), Math.min(z, zoomOf(MAHALLE_ALT + 12)));
    map.flyToBounds(v.layer.getBounds(), { ...pad, maxZoom: target, duration: 0.9 });
    if (close) map.once("moveend", () => { if (altOf(map.getZoom()) > MAHALLE_ALT) map.flyTo(v.layer.getBounds().getCenter(), zoomOf(MAHALLE_ALT - 5), { duration: 0.5 }); });
  }
  function select(id) {
    sel = id; selM = null;
    const d = S.d[id];
    if (d) { Ses.play("sec"); V.get(id).layer.bringToFront(); focus(d, false); }
    refresh();
  }
  function openMahalle(mid, fly) {
    const m = S.m[mid];
    if (!m) return;
    Ses.play("sec");
    sel = m.ilce; selM = mid;
    V.get(sel).layer.bringToFront();
    refresh();
    if (fly || altOf(map.getZoom()) > MAHALLE_ALT) {
      const off = window.innerWidth > 760 ? 0.012 * (altOf(zoomOf(26)) / 26) : 0;
      map.flyTo([m.lat, m.lon - off], Math.max(map.getZoom(), zoomOf(26)), { duration: 0.8 });
    }
  }
  let toastT;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3400);
  }
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { if (mode) endMode(null); openSheet(tab === b.dataset.tab ? null : b.dataset.tab); }));
  $("next").onclick = () => {
    if (mode) endMode(null);
    const r = O.endMonth(S);
    if (!r) return;
    tab = null; save(); refresh();
    Ses.play(S.election ? (S.election.win ? "zafer" : "yenilgi") : S.event ? (S.event.afet ? "afet" : "olay") : r.finished.length ? "bitti" : "ay");
    const parts = [`Ay sonu: net ${signed(r.net)}`];
    if (r.finished.length) parts.push(`Tamamlandı: ${r.finished.join(", ")}`);
    if (r.expired.length) parts.push(`Karşılanmayan istek: ${r.expired.slice(0, 3).join(", ")}${r.expired.length > 3 ? " ve " + (r.expired.length - 3) + " mahalle daha" : ""}`);
    if (r.crisis) parts.push("Borç sınırı aşıldı, hizmetler kısıldı");
    toast(parts.join(" · "));
  };

  Ses.button($("sesb"));
  refresh();
  window.__game = { map, O, get S() { return S; }, get mode() { return mode; }, altOf, zoomOf, select, openMahalle, openSheet, startBuild, pickSpot, refresh };
})();
