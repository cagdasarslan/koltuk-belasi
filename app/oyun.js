/* Koltuk Belası: Şehir Senin — oyun kuralları, sürüm 3 (mahalle temelli).
   Arayüzden bağımsızdır: tarayıcıda window.Oyun, Node'da module.exports. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Oyun = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TERM = 18;
  const DOMAINS = {
    park: { ad: "Park", ico: "trees" },
    saglik: { ad: "Sağlık", ico: "cross" },
    guvenlik: { ad: "Güvenlik", ico: "shield" },
    ulasim: { ad: "Ulaşım", ico: "bus" },
  };
  const DK = Object.keys(DOMAINS);
  const SERVICES = {
    yesil: { ad: "Park ve bahçeler", alan: "park", ico: "trees" },
    saglik: { ad: "Sağlık hizmetleri", alan: "saglik", ico: "cross" },
    zabita: { ad: "Zabıta ve güvenlik", alan: "guvenlik", ico: "shield" },
    ulasim: { ad: "Toplu taşıma", alan: "ulasim", ico: "bus" },
    itfaiye: { ad: "İtfaiye ve afet ekipleri", alan: null, ico: "shield-alert" },
  };
  const TIPLER = { yogun: "Yoğun kent", konut: "Konut mahallesi", sanayi: "Sanayi bölgesi", orman: "Orman köyü", kirsal: "Kırsal mahalle" };
  const MAX_PRIO = 5;
  // yapılar: haritada bir mahalleye yerleştirilir, yarıçapı içindeki bütün mahallelere hizmet eder
  const BUILDINGS = {
    park: { ad: "Semt parkı", ico: "trees", cost: 60, months: 2, alan: "park", guc: 40, r: 1.5, bilgi: "Yakın çevredeki mahallelerin park ihtiyacını karşılar." },
    poliklinik: { ad: "Semt polikliniği", ico: "cross", cost: 140, months: 4, alan: "saglik", guc: 44, r: 3, bilgi: "Geniş bir çevrenin sağlık ihtiyacını karşılar." },
    guvenlik: { ad: "Güvenlik merkezi", ico: "shield", cost: 90, months: 3, alan: "guvenlik", guc: 40, r: 2.5, bilgi: "Çevresindeki mahallelerde güvenliği artırır." },
    metro: { ad: "Metro istasyonu", ico: "bus", cost: 320, months: 6, alan: "ulasim", guc: 50, r: 2.5, bilgi: "Pahalı ve uzun sürer; çevresinde ulaşımı büyük ölçüde çözer." },
    itfaiye: { ad: "Afet ve itfaiye merkezi", ico: "shield-alert", cost: 110, months: 3, resil: 12, r: 4, bilgi: "Geniş bir alanda afet direncini artırır." },
    donusum: { ad: "Kentsel dönüşüm", ico: "building-2", cost: 260, months: 5, resil: 35, r: 1.2, bilgi: "Yerleştirildiği mahallenin afet direncini çok, komşularınınkini biraz artırır." },
  };
  // mahalle istekleri: mahallenin tipine özel havuzlardan çıkar
  const REQS = {
    otopark: { ad: "Katlı otopark", alan: "ulasim", cost: 55, metin: "sokaklar park etmiş araçtan geçilmiyor; katlı otopark istiyor" },
    cep_parki: { ad: "Cep parkı", alan: "park", cost: 35, metin: "binaların arasında çocuklara küçük bir park istiyor" },
    asm: { ad: "Aile sağlığı merkezi", alan: "saglik", cost: 60, metin: "en yakın sağlık ocağına yürüyerek ulaşamıyor" },
    aydinlatma: { ad: "Sokak aydınlatması", alan: "guvenlik", cost: 30, metin: "karanlık sokakların aydınlatılmasını istiyor" },
    tarama: { ad: "Riskli bina taraması", alan: "afet", cost: 50, metin: "eski binaların depreme karşı taranmasını istiyor" },
    cocuk_parki: { ad: "Çocuk parkı", alan: "park", cost: 35, metin: "sitelerin arasına bir çocuk parkı istiyor" },
    pazar: { ad: "Kapalı semt pazarı", alan: "genel", cost: 45, metin: "çamurda kurulan pazarın kapalı alana taşınmasını istiyor" },
    otobus: { ad: "Yeni otobüs hattı", alan: "ulasim", cost: 40, metin: "metroya bağlanan bir otobüs hattı istiyor" },
    spor: { ad: "Spor sahası", alan: "park", cost: 45, metin: "gençler için halı saha ve basketbol sahası istiyor" },
    kres: { ad: "Mahalle kreşi", alan: "genel", cost: 50, metin: "çalışan aileler için belediye kreşi istiyor" },
    ring: { ad: "İşçi ring seferi", alan: "ulasim", cost: 40, metin: "vardiya saatlerine uygun ring seferi istiyor" },
    atik: { ad: "Atık toplama merkezi", alan: "genel", cost: 45, metin: "sanayi atıkları için toplama merkezi istiyor" },
    itfaiye_noktasi: { ad: "İtfaiye müfrezesi", alan: "afet", cost: 55, metin: "fabrika yangınlarına karşı yakın bir itfaiye noktası istiyor" },
    asfalt: { ad: "Yol yenileme", alan: "ulasim", cost: 45, metin: "TIR'ların bozduğu yolların yenilenmesini istiyor" },
    yangin_kulesi: { ad: "Yangın gözetleme kulesi", alan: "afet", cost: 40, metin: "orman yangınlarına karşı gözetleme kulesi istiyor" },
    koy_yolu: { ad: "Köy yolu", alan: "ulasim", cost: 45, metin: "kışın kapanan yolunun asfaltlanmasını istiyor" },
    mesire: { ad: "Mesire alanı", alan: "park", cost: 35, metin: "orman kenarına düzenli bir mesire alanı istiyor" },
    mobil_saglik: { ad: "Gezici sağlık aracı", alan: "saglik", cost: 35, metin: "haftada bir gelecek gezici sağlık aracı istiyor" },
    sulama: { ad: "Sulama kanalı", alan: "genel", cost: 50, metin: "tarlaları için sulama kanalının onarılmasını istiyor" },
    konak: { ad: "Köy konağı", alan: "genel", cost: 40, metin: "düğün ve toplantılar için köy konağı istiyor" },
    sahil: { ad: "Sahil düzenlemesi", alan: "park", cost: 55, metin: "bakımsız sahil şeridinin yürüyüş yoluna çevrilmesini istiyor" },
    iskele: { ad: "Deniz otobüsü iskelesi", alan: "ulasim", cost: 60, metin: "karşı yakaya vapur seferi için iskele istiyor" },
    taskin: { ad: "Taşkın bariyeri", alan: "afet", cost: 50, metin: "fırtınada sahili basan dalgalara karşı bariyer istiyor" },
  };
  const POOL = {
    yogun: ["otopark", "cep_parki", "asm", "aydinlatma", "tarama"],
    konut: ["cocuk_parki", "pazar", "otobus", "spor", "kres", "asm"],
    sanayi: ["ring", "atik", "itfaiye_noktasi", "asfalt"],
    orman: ["yangin_kulesi", "koy_yolu", "mesire", "mobil_saglik"],
    kirsal: ["koy_yolu", "sulama", "mobil_saglik", "konak"],
    kiyi: ["sahil", "iskele", "taskin"],
  };
  const TAX = [
    { ad: "Düşük", mul: 0.8, happy: 0.6, press: -0.5 },
    { ad: "Normal", mul: 1, happy: 0, press: 0 },
    { ad: "Yüksek", mul: 1.25, happy: -1.0, press: 1.2 },
  ];
  // mod: mecliste teklifin ne kadar kolay kabul gördüğü (+ popüler, − tartışmalı)
  const POLICIES = {
    ulasim: { ad: "Öğrenciye ücretsiz ulaşım", cost: 18, mod: 8, bilgi: "Her ay mutluluk +0,4." },
    ekmek: { ad: "Halk ekmek büfeleri", cost: 12, mod: 10, bilgi: "Her ay mutluluk +0,5." },
    gece: { ad: "Gece otobüsleri", cost: 15, mod: 3, bilgi: "Tüm şehirde ulaşım hizmeti +6." },
    katilimci: { ad: "Katılımcı mahalle bütçesi", cost: 14, mod: 6, bilgi: "Mahalle isteklerinin maliyeti %20 düşer, her ay +1 siyasi sermaye." },
    egitim: { ad: "Afet bilinci eğitimleri", cost: 8, mod: 4, bilgi: "Her ay afet direnci +0,4." },
    imar: { ad: "Sıkı imar denetimi", cost: 0, mod: -10, bilgi: "Afet direnci +0,35; müteahhit tepkisiyle mutluluk −0,3, gelir −%2." },
    tanitim: { ad: "Halkla ilişkiler kampanyası", cost: 25, mod: -6, bilgi: "Her ay muhalefet baskısı −2, mutluluk +0,3." },
  };
  const DISASTERS = {
    "Deprem": { p: { 3: 0.022, 2: 0.01 }, wide: true, happy: 15, money: 2.2, text: "Şiddetli bir deprem şehri sarstı." },
    "Sel": { p: { 3: 0.06, 2: 0.04 }, happy: 9, money: 0.5, text: "Sağanak yağış sele dönüştü." },
    "Sel ve heyelan": { p: { 3: 0.06, 2: 0.04 }, happy: 10, money: 0.6, text: "Günlerdir süren yağış sel ve heyelana yol açtı." },
    "Orman yangını": { p: { 3: 0.05, 2: 0.03 }, happy: 8, money: 0.6, text: "Orman yangını yerleşim yerlerine dayandı." },
    "Kuraklık": { p: { 3: 0.05, 2: 0.03 }, wide: true, happy: 5, money: 0.8, text: "Barajlar kritik seviyeye indi, su kesintileri başladı." },
    "Çığ": { p: { 3: 0.04, 2: 0.025 }, happy: 8, money: 0.4, text: "Çığ, yolları ve yerleşimleri kapattı." },
  };

  // Türkçe ek uyumu: ek("Beşiktaş","de") -> "Beşiktaş'ta", ek("Fatih","e") -> "Fatih'e", ek("Şile","in") -> "Şile'nin"
  function ek(name, tur) {
    const low = name.toLocaleLowerCase("tr").replace(/â/g, "a");
    const v = (low.match(/[aeıioöuü]/g) || ["e"]).pop(), last = low[low.length - 1];
    const back = "aıou".includes(v), vowelEnd = "aeıioöuü".includes(last);
    if (tur === "de") return `${name}'${"fstkçşhp".includes(last) ? "t" : "d"}${back ? "a" : "e"}`;
    if (tur === "e") return `${name}'${vowelEnd ? "y" : ""}${back ? "a" : "e"}`;
    const i = "aı".includes(v) ? "ı" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "ü";
    return `${name}'${vowelEnd ? "n" : ""}${i}n`;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  function rnd(s) {
    let a = (s.seed = (s.seed + 0x6d2b79f5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const list = (s) => Object.values(s.d);
  const mahs = (s) => Object.values(s.m);
  const mahOf = (s, did) => s.d[did].mah.map((id) => s.m[id]);
  const km = (a, b) => Math.hypot((a.lon - b.lon) * 84.0, (a.lat - b.lat) * 111.2);
  const stars = (dev) => clamp(1 + Math.floor(dev / 20), 1, 5);
  const scale = (s) => clamp(s.baseIncome / 245, 0.05, 1.5); // şehir büyüklüğü (İstanbul = 1)
  const money5 = (v) => Math.max(1, Math.round(v / 5) * 5);

  /* ---------- kurulum ---------- */
  function create(il, districts, mahalleler, seed) {
    const s = {
      v: 3, plaka: il.plaka, ad: il.ad, risks: il.riskler, term: 1, month: 0, monthsLeft: TERM,
      budget: il.butce, baseIncome: Math.max(4, Math.round(il.butce * 0.07)), tax: 1,
      alloc: { yesil: 100, saglik: 100, zabita: 100, ulasim: 100, itfaiye: 100 },
      prio: { yesil: [], saglik: [], zabita: [], ulasim: [], itfaiye: [] },
      policies: {}, cooldown: {}, capital: 15, pressure: 20,
      seed: seed == null ? (Number(il.plaka) * 7919 + 13) | 0 : seed | 0,
      d: {}, m: {}, fac: [], nextFac: 1, history: [], event: null, election: null, quakeThisTerm: false, last: null, city: {},
    };
    for (const x of districts) s.d[x.id] = { id: x.id, name: x.name, pop: 0, mah: [] };
    const DEV0 = { yogun: 40, konut: 46, sanayi: 36, orman: 30, kirsal: 28 }, RES0 = { yogun: -6, konut: 0, sanayi: -2, orman: 4, kirsal: 2 };
    for (const x of mahalleler) {
      if (!s.d[x.ilce]) continue;
      const m = { id: x.id, ilce: x.ilce, name: x.name, tip: x.tip, kiyi: !!x.kiyi, pop: Math.max(100, x.pop), lon: x.lon, lat: x.lat,
        local: { park: 0, saglik: 0, guvenlik: 0, ulasim: 0 }, cov: { park: 0, saglik: 0, guvenlik: 0, ulasim: 0 }, req: null, done: [] };
      m.dev = clamp(Math.round(DEV0[m.tip] + (rnd(s) - 0.5) * 30), 4, 92);
      m.resil = clamp(Math.round(il.direnc + RES0[m.tip] + (rnd(s) - 0.5) * 26), 4, 95);
      m.bias = Math.round((rnd(s) - 0.5) * 12);
      s.m[m.id] = m;
      s.d[m.ilce].mah.push(m.id);
      s.d[m.ilce].pop += m.pop;
    }
    for (const id of Object.keys(s.d)) if (!s.d[id].mah.length) delete s.d[id];
    for (const m of mahs(s)) m.happy = clamp(target(s, m) + (rnd(s) - 0.5) * 10, 5, 98);
    for (let i = 0; i < 8; i++) spawnReq(s);
    derive(s);
    snapshot(s);
    return s;
  }

  /* ---------- hizmet düzeyi ve hedef mutluluk ---------- */
  // bütçe payı (0-150) -> hizmet kalitesi; %100'ün altı hızla bozar, üstü azalan verimle iyileştirir
  const quality = (a) => (a <= 100 ? a * 0.5 : 50 + (a - 100) * 0.2);
  function prioMult(s, key, did) {
    const sel = s.prio[key];
    if (!sel.length) return 1;
    if (sel.includes(did)) return 1.35;
    let pin = 0, pout = 0;
    for (const d of list(s)) (sel.includes(d.id) ? (pin += d.pop) : (pout += d.pop));
    return pout ? Math.max(0.6, 1 - (0.35 * pin) / pout) : 1;
  }
  function svcTable(s) {
    const t = {};
    for (const d of list(s)) {
      t[d.id] = {};
      for (const [key, v] of Object.entries(SERVICES)) {
        const q = quality(s.alloc[key]) * prioMult(s, key, d.id);
        if (v.alan) t[d.id][v.alan] = q + (v.alan === "ulasim" && s.policies.gece ? 6 : 0);
        else t[d.id].afet = q;
      }
    }
    return t;
  }
  const score = (m, q, k) => clamp(q[k] + m.cov[k] + m.local[k], 0, 100);
  function target(s, m, q, pending) {
    q = q || svcTable(s)[m.ilce];
    const mean = (score(m, q, "park") + score(m, q, "saglik") + score(m, q, "guvenlik") + score(m, q, "ulasim")) / 4;
    return clamp(18 + 0.5 * mean + 0.32 * m.dev + m.bias - (m.req ? 6 : 0) - Math.min(4, pending || 0), 0, 100);
  }
  // yapıların kapsama etkisini ve ilçe/şehir özetlerini yeniden hesapla
  function derive(s) {
    const done = s.fac.filter((f) => f.left <= 0 && BUILDINGS[f.type].alan);
    for (const m of mahs(s)) {
      m.cov.park = m.cov.saglik = m.cov.guvenlik = m.cov.ulasim = 0;
      for (const f of done) {
        const b = BUILDINGS[f.type], dist = km(m, f);
        if (dist <= b.r) m.cov[b.alan] = Math.min(55, m.cov[b.alan] + b.guc * (1 - (0.5 * dist) / b.r));
      }
    }
    let P = 0, H = 0, R = 0, D = 0;
    for (const d of list(s)) {
      let p = 0, h = 0, r = 0, v = 0, n = 0;
      for (const id of d.mah) { const m = s.m[id]; p += m.pop; h += m.happy * m.pop; r += m.resil * m.pop; v += m.dev * m.pop; if (m.req) n++; }
      const prev = d.happy;
      d.pop = p; d.happy = h / p; d.resil = r / p; d.dev = v / p; d.reqs = n;
      if (prev != null && Math.abs(d.happy - prev) > 0.05) d.trend = d.happy > prev ? 1 : -1;
      if (d.trend == null) d.trend = 0;
      P += p; H += h; R += r; D += v;
    }
    s.city = { happy: H / P, resil: R / P, dev: D / P, pop: P };
    return s;
  }
  const cityHappy = (s) => s.city.happy;
  const cityResil = (s) => s.city.resil;
  function snapshot(s) {
    s.history.push({ m: s.history.length, happy: r1(s.city.happy), budget: Math.round(s.budget), resil: r1(s.city.resil), dev: r1(s.city.dev), pressure: r1(s.pressure) });
  }

  /* ---------- bütçe ---------- */
  const allocCost = (a) => (a <= 100 ? a / 100 : 1 + ((a - 100) / 100) * 1.6);
  function monthly(s) {
    const unit = s.baseIncome * 0.14; // %100 düzeyde beş hizmet gelirin %70'ini götürür
    const income = s.baseIncome * TAX[s.tax].mul * (s.policies.imar ? 0.98 : 1);
    const services = Object.values(s.alloc).reduce((a, b) => a + allocCost(b), 0) * unit;
    const policies = Object.keys(POLICIES).reduce((a, k) => a + (s.policies[k] ? policyCost(s, k) : 0), 0);
    const interest = s.budget < 0 ? -s.budget * 0.05 : 0;
    return { income, services, policies, interest, net: income - services - policies - interest, unit };
  }
  const serviceCost = (s, key) => allocCost(s.alloc[key]) * s.baseIncome * 0.14;
  const policyCost = (s, k) => (POLICIES[k].cost ? Math.max(1, Math.round(POLICIES[k].cost * scale(s))) : 0);
  const buildCost = (s, type) => money5(BUILDINGS[type].cost * clamp(scale(s), 0.25, 1.2));
  const reqCost = (s, m, key) => money5(REQS[key].cost * clamp(0.75 + m.pop / 60000, 0.75, 1.5) * clamp(scale(s), 0.2, 1.2) * (s.policies.katilimci ? 0.8 : 1));

  /* ---------- mahalle istekleri ---------- */
  function spawnReq(s) {
    const all = mahs(s);
    for (let tries = 0; tries < 12; tries++) {
      // nüfusu kalabalık ve gelişimi düşük mahalleler daha sık ister
      let best = null, bw = -1;
      for (let i = 0; i < 6; i++) {
        const m = all[Math.floor(rnd(s) * all.length)];
        const w = Math.sqrt(m.pop) * (1.4 - m.dev / 100);
        if (!m.req && w > bw) { best = m; bw = w; }
      }
      if (!best) continue;
      let pool = best.kiyi && rnd(s) < 0.4 ? POOL.kiyi : POOL[best.tip];
      const fresh = pool.filter((k) => !best.done.includes(k));
      pool = fresh.length ? fresh : pool;
      const key = pool[Math.floor(rnd(s) * pool.length)];
      best.req = { key, age: 0 };
      return best;
    }
    return null;
  }
  function busy(s) { return !!(s.event || s.election); }
  function meet(s, mid) {
    const m = s.m[mid];
    if (!m || !m.req || busy(s)) return false;
    const def = REQS[m.req.key], cost = reqCost(s, m, m.req.key);
    if (s.budget < cost) return false;
    s.budget -= cost;
    if (def.alan === "afet") m.resil = clamp(m.resil + 12, 0, 100);
    else if (def.alan === "genel") m.dev = clamp(m.dev + 6, 0, 100);
    else m.local[def.alan] = Math.min(30, m.local[def.alan] + 15);
    m.dev = clamp(m.dev + 14, 0, 100);
    m.happy = clamp(m.happy + 8, 0, 100);
    m.done.push(m.req.key);
    m.req = null;
    for (const x of mahOf(s, m.ilce)) { x.dev = clamp(x.dev + 2, 0, 100); x.happy = clamp(x.happy + 1.5, 0, 100); if (def.alan === "afet") x.resil = clamp(x.resil + 1, 0, 100); }
    s.capital = clamp(s.capital + 0.5, 0, 100);
    derive(s);
    return true;
  }

  // isteğin önem derecesi (1-5 yıldız): kalabalık mahalle, yaklaşan süre, geri kalmış mahalle ve mutsuz ilçe önemi artırır
  function importance(s, m) {
    if (!m.req) return 0;
    const d = s.d[m.ilce];
    const x = Math.min(1.5, m.pop / 30000) + m.req.age * 0.7 + (m.dev < 30 ? 0.7 : m.dev < 45 ? 0.35 : 0) + (d.happy < 51 ? 0.7 : d.happy < 56 ? 0.35 : 0);
    return clamp(Math.floor(x) + 1, 1, 5);
  }
  // seçilen istekleri önem sırasıyla, bütçe yettiği sürece karşılar
  function meetMany(s, ids) {
    const order = ids.map((id) => s.m[id]).filter((m) => m && m.req).sort((a, b) => importance(s, b) - importance(s, a) || b.pop - a.pop);
    const out = { done: 0, skipped: 0, spent: 0 };
    for (const m of order) {
      const c = reqCost(s, m, m.req.key);
      if (s.budget >= c && meet(s, m.id)) { out.done++; out.spent += c; } else out.skipped++;
    }
    return out;
  }

  /* ---------- yapı yerleştirme ---------- */
  function coverage(s, type, mid) {
    const b = BUILDINGS[type], c = s.m[mid];
    if (!b || !c) return null;
    const ids = [];
    let pop = 0;
    for (const m of mahs(s)) if (km(m, c) <= b.r) { ids.push(m.id); pop += m.pop; }
    return { ids, pop, r: b.r, lon: c.lon, lat: c.lat };
  }
  function canPlace(s, type, mid) {
    if (!BUILDINGS[type] || !s.m[mid] || busy(s)) return "olmaz";
    if (s.budget < buildCost(s, type)) return "Bütçe yetersiz";
    if (s.fac.some((f) => f.m === mid && f.type === type)) return "Bu mahallede aynı yapıdan var";
    return "";
  }
  function place(s, type, mid) {
    if (canPlace(s, type, mid)) return false;
    const b = BUILDINGS[type], m = s.m[mid];
    s.budget -= buildCost(s, type);
    s.fac.push({ id: s.nextFac++, type, m: mid, ilce: m.ilce, lon: m.lon, lat: m.lat, left: b.months, total: b.months });
    return true;
  }
  function finish(s, f) {
    const b = BUILDINGS[f.type];
    for (const m of mahs(s)) {
      const dist = km(m, f);
      if (dist > b.r) continue;
      const fall = 1 - (0.5 * dist) / b.r;
      if (b.alan) { m.dev = clamp(m.dev + 8 * fall, 0, 100); m.happy = clamp(m.happy + 3 * fall, 0, 100); }
      if (b.resil) m.resil = clamp(m.resil + (f.type === "donusum" ? (m.id === f.m ? b.resil : 10) : b.resil * fall), 0, 100);
      if (f.type === "donusum" && m.id === f.m) { m.dev = clamp(m.dev + 16, 0, 100); m.happy = clamp(m.happy + 6, 0, 100); }
    }
    s.capital = clamp(s.capital + 2, 0, 100);
  }

  /* ---------- hizmet bütçesi ---------- */
  function setAlloc(s, key, v) { if (key in s.alloc) s.alloc[key] = clamp(Math.round(v / 5) * 5, 0, 150); }
  function togglePrio(s, key, did) {
    const a = s.prio[key];
    if (!a || !s.d[did]) return false;
    const i = a.indexOf(did);
    if (i >= 0) a.splice(i, 1);
    else if (a.length < MAX_PRIO) a.push(did);
    else return false;
    return true;
  }

  /* ---------- meclis ---------- */
  // mecliste başkanı destekleyen sandalye oranı: halk memnunsa artar, muhalefet güçlüyse azalır
  const bloc = (s) => clamp(40 + (s.city.happy - 50) * 0.8 - s.pressure * 0.15, 20, 75);
  function estimate(s, mod) {
    const est = bloc(s) + mod;
    return { est: r1(est), lo: Math.round(est - 4), hi: Math.round(est + 4), need: Math.max(0, Math.ceil(54 - est)) };
  }
  function vote(s, mod, bargain) {
    const e = estimate(s, mod);
    const spent = bargain ? e.need : 0;
    if (spent > s.capital) return null;
    s.capital -= spent;
    const evet = clamp(Math.round(e.est + spent + (rnd(s) - 0.5) * 8), 0, 100);
    return { evet, hayir: 100 - evet, pass: evet >= 50, spent };
  }
  function propose(s, key, bargain) {
    if (!POLICIES[key] || s.policies[key] || s.cooldown[key] || busy(s)) return null;
    const r = vote(s, POLICIES[key].mod, bargain);
    if (!r) return null;
    if (r.pass) s.policies[key] = true;
    else { s.cooldown[key] = 3; s.pressure = clamp(s.pressure + 3, 0, 100); }
    return { ...r, ad: POLICIES[key].ad };
  }
  function repeal(s, key) {
    if (!s.policies[key] || busy(s)) return false;
    s.policies[key] = false;
    if (POLICIES[key].mod > 0) for (const m of mahs(s)) m.happy = clamp(m.happy - 1, 0, 100); // sevilen uygulamayı kaldırmak tepki çeker
    derive(s);
    return true;
  }
  const taxMod = (s, level) => (level > s.tax ? -14 : 14) * Math.abs(level - s.tax);
  function proposeTax(s, level, bargain) {
    if (level === s.tax || !TAX[level] || s.cooldown.vergi || busy(s)) return null;
    const r = vote(s, taxMod(s, level), bargain);
    if (!r) return null;
    if (r.pass) s.tax = level;
    else { s.cooldown.vergi = 3; s.pressure = clamp(s.pressure + 3, 0, 100); }
    return { ...r, ad: `Vergi düzeyi: ${TAX[level].ad}` };
  }

  /* ---------- gündem olayları ---------- */
  const dHappy = (s, d, x) => mahOf(s, d.id).forEach((m) => (m.happy = clamp(m.happy + x, 0, 100)));
  const dDev = (s, d, x) => mahOf(s, d.id).forEach((m) => (m.dev = clamp(m.dev + x, 0, 100)));
  const allHappy = (s, x) => mahs(s).forEach((m) => (m.happy = clamp(m.happy + x, 0, 100)));
  const cost = (s, base) => money5(base * clamp(scale(s), 0.1, 1.2));
  const EVENTS = {
    su_baskini: {
      kim: "afet", baslik: "Su baskını", metin: (s, d) => `${ek(d.name, "de")} sağanak sonrası alt geçitleri ve bodrum katlarını su bastı.`,
      secenek: [
        { ad: "Acil ekip gönder", ipucu: (s) => `−₺${cost(s, 40)} Mn`, uygula: (s, d) => { s.budget -= cost(s, 40); dHappy(s, d, 2); return `${d.name} halkı hızlı müdahaleden memnun.`; } },
        { ad: "Yağışın dinmesini bekle", ipucu: () => "ilçede mutluluk düşer", uygula: (s, d) => { const k = d.resil > 60 ? 0.5 : 1; dHappy(s, d, -6 * k); s.pressure += 4; return k < 1 ? `${ek(d.name, "in")} altyapısı dayandı, hasar sınırlı kaldı.` : `${ek(d.name, "de")} tepkiler büyüdü, muhalefet konuyu gündeme taşıdı.`; } },
      ],
    },
    grev: {
      kim: "sendika", baslik: "Toplu taşıma grevi", metin: () => "Otobüs şoförleri zam talebiyle iş bırakma kararı aldı.",
      secenek: [
        { ad: "Zam talebini kabul et", ipucu: (s) => `−₺${cost(s, 60)} Mn`, uygula: (s) => { s.budget -= cost(s, 60); return "Grev başlamadan sona erdi, seferler aksamadı."; } },
        { ad: "Talebi reddet", ipucu: () => "şehir genelinde mutluluk düşer", uygula: (s) => { allHappy(s, -2.5); return "Seferler günlerce aksadı, duraklarda kuyruklar oluştu."; } },
      ],
    },
    su_kesintisi: {
      kim: "muhtar", baslik: "Ana boru patladı", metin: (s, d) => `${d.name} ve çevresinde iki gündür sular akmıyor.`,
      secenek: [
        { ad: "Tankerle su dağıt", ipucu: (s) => `−₺${cost(s, 30)} Mn`, uygula: (s, d) => { s.budget -= cost(s, 30); dHappy(s, d, 1); return "Tankerler mahallelere ulaştı, onarım sürüyor."; } },
        { ad: "Yalnızca açıklama yap", ipucu: () => "ilçede mutluluk düşer", uygula: (s, d) => { dHappy(s, d, -5); s.pressure += 2; return `${ek(d.name, "de")} bidon kuyrukları haberlere çıktı.`; } },
      ],
    },
    basin: {
      kim: "muhalefet", baslik: "Muhalefet basın toplantısı", metin: () => "Muhalefet lideri bütçe harcamalarınızı sert sözlerle eleştirdi.",
      secenek: [
        { ad: "Canlı yayında yanıt ver", ipucu: () => "riskli: işe yarayabilir de ters tepebilir", uygula: (s) => { if (rnd(s) < 0.55) { s.pressure -= 8; s.capital = clamp(s.capital + 4, 0, 100); return "Rakamlarla verdiğiniz yanıt beğenildi."; } s.pressure += 6; return "Yayında zor anlar yaşadınız, görüntüler sosyal medyada dolaşıyor."; } },
        { ad: "Görmezden gel", ipucu: () => "baskı biraz artar", uygula: (s) => { s.pressure += 4; return "Sessizliğiniz 'cevap veremedi' diye yorumlandı."; } },
      ],
    },
    bagis: {
      kim: "ozelkalem", baslik: "Hayırsever bağışı", metin: (s, d) => `Bir iş insanı ${ek(d.name, "e")} harcanmak üzere bağış yapmak istiyor.`,
      secenek: [
        { ad: "İlçeye harca", ipucu: () => "ilçenin gelişimi artar", uygula: (s, d) => { dDev(s, d, 3); dHappy(s, d, 2); return `${ek(d.name, "de")} sokaklar ve parklar elden geçirildi.`; } },
        { ad: "Genel bütçeye aktar", ipucu: (s) => `+₺${cost(s, 50)} Mn`, uygula: (s) => { s.budget += cost(s, 50); s.pressure += 1; return "Bağış genel bütçeye eklendi."; } },
      ],
    },
    festival: {
      kim: "genclik", baslik: "Gençlik festivali", metin: () => "Gençlik meclisi, şehir genelinde ücretsiz bir festival düzenlenmesini istiyor.",
      secenek: [
        { ad: "Festivali düzenle", ipucu: (s) => `−₺${cost(s, 35)} Mn`, uygula: (s) => { s.budget -= cost(s, 35); allHappy(s, 2); return "Festival büyük ilgi gördü."; } },
        { ad: "Bu yıl olmaz", ipucu: () => "hafif hoşnutsuzluk", uygula: (s) => { allHappy(s, -1); return "Gençler kararı sosyal medyada eleştirdi."; } },
      ],
    },
    cop: {
      kim: "muhtar", baslik: "Çöp toplama aksıyor", metin: (s, d) => `Araç arızaları yüzünden ${ek(d.name, "de")} çöpler üç gündür alınmadı.`,
      secenek: [
        { ad: "Ek araç kirala", ipucu: (s) => `−₺${cost(s, 25)} Mn`, uygula: (s) => { s.budget -= cost(s, 25); return "Ek seferlerle sokaklar temizlendi."; } },
        { ad: "Tamiri bekle", ipucu: () => "ilçede mutluluk düşer", uygula: (s, d) => { dHappy(s, d, -5); return `${ek(d.name, "de")} koku şikâyetleri arttı.`; } },
      ],
    },
    hibe: {
      kim: "mali", baslik: "Altyapı hibesi", metin: () => "Bir kalkınma fonundan şehrinize hibe çıktı. Nasıl kullanacaksınız?",
      secenek: [
        { ad: "Riskli binaları güçlendir", ipucu: () => "afet direnci artar", uygula: (s) => { mahs(s).forEach((m) => (m.resil = clamp(m.resil + 3, 0, 100))); return "Güçlendirme çalışmaları tüm ilçelerde başladı."; } },
        { ad: "Bütçe açığını kapat", ipucu: (s) => `+₺${cost(s, 80)} Mn`, uygula: (s) => { s.budget += cost(s, 80); s.pressure += 3; return "Hibe bütçeye aktarıldı; muhalefet 'gelecek satıldı' dedi."; } },
      ],
    },
    barinak: {
      kim: "muhtar", baslik: "Barınak talebi", metin: () => "Hayvanseverler yeni bir sokak hayvanları barınağı için imza topluyor.",
      secenek: [
        { ad: "Barınağı yap", ipucu: (s) => `−₺${cost(s, 30)} Mn`, uygula: (s) => { s.budget -= cost(s, 30); allHappy(s, 1.5); return "Barınak projesi alkış aldı."; } },
        { ad: "Seneye ertele", ipucu: () => "hafif tepki", uygula: (s) => { allHappy(s, -1); s.pressure += 2; return "İmza kampanyası büyüyor."; } },
      ],
    },
    iddia: {
      kim: "gazeteci", baslik: "İhale iddiası", metin: () => "Bir gazete, belediye ihalelerinden birinde usulsüzlük olduğunu öne sürdü.",
      secenek: [
        { ad: "Bağımsız denetim başlat", ipucu: (s) => `−₺${cost(s, 20)} Mn, baskı azalır`, uygula: (s) => { s.budget -= cost(s, 20); s.pressure -= 6; return "Şeffaflık adımınız güven kazandırdı."; } },
        { ad: "İddiayı reddet", ipucu: () => "baskı artar", uygula: (s) => { s.pressure += 8; allHappy(s, -2); return "Konu günlerce gündemden düşmedi."; } },
      ],
    },
  };
  function rollDisaster(s) {
    for (const [name, lvl] of Object.entries(s.risks || {})) {
      const def = DISASTERS[name];
      if (!def || (name === "Deprem" && s.quakeThisTerm)) continue;
      if (rnd(s) >= (def.p[lvl] || 0)) continue;
      if (name === "Deprem") s.quakeThisTerm = true;
      const ds = def.wide ? list(s) : list(s).sort((a, b) => a.resil - b.resil).slice(0, Math.max(2, Math.round(list(s).length * 0.1)));
      const before = s.city.happy;
      let dmg = 0, pop = 0;
      for (const d of ds) for (const m of mahOf(s, d.id)) {
        const k = (100 - m.resil) / 100;
        dmg += k * m.pop; pop += m.pop;
        m.happy = clamp(m.happy - def.happy * k, 0, 100);
        if (name === "Deprem") m.dev = clamp(m.dev - 4 * k, 0, 100);
      }
      dmg /= pop;
      const bill = Math.round(s.baseIncome * def.money * dmg);
      s.budget -= bill;
      s.pressure = clamp(s.pressure + 5 * dmg, 0, 100);
      derive(s);
      return { afet: true, kim: "afet", id: name, baslik: name, metin: def.text, ilceler: def.wide ? null : ds.map((d) => d.name),
        sonuc: `Acil harcama ₺${bill} Mn. Genel mutluluk ${String(r1(before - s.city.happy)).replace(".", ",")} puan düştü. Afet direnciniz %${Math.round(s.city.resil)}; direnç yükseldikçe hasar azalır.` };
    }
    return null;
  }
  function rollEvent(s) {
    if (rnd(s) > 0.5) return null;
    const keys = Object.keys(EVENTS).filter((k) => k !== s.lastEvent);
    const id = keys[Math.floor(rnd(s) * keys.length)];
    const ds = list(s);
    let d;
    if (id === "su_baskini") d = ds.sort((a, b) => a.resil - b.resil)[Math.floor(rnd(s) * Math.min(6, ds.length))];
    else { let x = rnd(s) * s.city.pop; d = ds[0]; for (const c of ds) { x -= c.pop; if (x <= 0) { d = c; break; } } }
    s.lastEvent = id;
    return { id, ilce: d.id };
  }
  function eventView(s) {
    const e = s.event;
    if (!e) return null;
    if (e.afet) return e;
    const def = EVENTS[e.id], d = s.d[e.ilce];
    return { id: e.id, kim: def.kim, baslik: def.baslik, metin: def.metin(s, d), ilce: d.id, sonuc: e.sonuc || null,
      secenek: def.secenek.map((o) => ({ ad: o.ad, ipucu: o.ipucu(s, d) })) };
  }
  function resolveEvent(s, i) {
    const e = s.event;
    if (!e) return null;
    if (e.afet || e.sonuc) { s.event = null; return null; }
    e.sonuc = EVENTS[e.id].secenek[i].uygula(s, s.d[e.ilce]);
    s.pressure = clamp(s.pressure, 0, 100);
    derive(s);
    return e.sonuc;
  }

  /* ---------- ay sonu ---------- */
  // sim: tahmin modunda rastgele olaylar ve yeni istekler işletilmez
  function endMonth(s, sim) {
    if (busy(s)) return null;
    const mo = monthly(s), out = { finished: [], expired: [] };
    s.budget += mo.net;
    // borç sınırı aşılırsa maaşlar ödenemez: hizmetler kısılır, halk tepki gösterir
    const crisis = s.budget < -3 * s.baseIncome;
    if (crisis) for (const k in s.alloc) s.alloc[k] = Math.min(s.alloc[k], 60);
    for (const f of s.fac) {
      if (f.left <= 0) continue;
      f.left -= 1;
      if (f.left <= 0) { finish(s, f); out.finished.push(`${s.m[f.m].name}: ${BUILDINGS[f.type].ad}`); }
    }
    derive(s);
    const tax = TAX[s.tax], pol = s.policies, q = svcTable(s);
    const drift = tax.happy + (pol.ulasim ? 0.4 : 0) + (pol.ekmek ? 0.5 : 0) + (pol.tanitim ? 0.3 : 0) - (pol.imar ? 0.3 : 0) - (s.budget < 0 ? 1 : 0) - (crisis ? 3 : 0);
    const rdrift = (pol.egitim ? 0.4 : 0) + (pol.imar ? 0.35 : 0) - 0.12;
    for (const d of list(s)) {
      const qd = q[d.id], pending = d.reqs;
      for (const id of d.mah) {
        const m = s.m[id];
        m.dev = clamp(m.dev - 0.5, 0, 100); // bakım yapılmayan mahalle yavaş yavaş eskir
        m.resil = clamp(m.resil + (qd.afet - 50) * 0.03 + rdrift, 0, 100);
        if (m.req && !sim) {
          m.req.age += 1;
          if (m.req.age >= 4) {
            m.req = null; m.dev = clamp(m.dev - 8, 0, 100); m.happy = clamp(m.happy - 4, 0, 100);
            for (const x of mahOf(s, d.id)) x.dev = clamp(x.dev - 1.5, 0, 100);
            s.pressure += 0.25; out.expired.push(`${m.name} (${d.name})`);
          }
        }
        m.happy = clamp(m.happy + (target(s, m, qd, pending) - m.happy) * 0.25 + drift, 0, 100);
      }
    }
    if (!sim) { const n = 5 + (rnd(s) < 0.5 ? 1 : 0) + (rnd(s) < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) spawnReq(s); }
    derive(s);
    const h = s.city.happy;
    s.pressure = clamp(s.pressure + 0.3 + tax.press + (s.budget < 0 ? 2 : 0) - (pol.tanitim ? 2 : 0) + (h < 50 ? 1 : h > 65 ? -1 : 0), 0, 100);
    s.capital = clamp(s.capital + (h >= 58 ? 1 : 0) + (pol.katilimci ? 1 : 0), 0, 100);
    for (const k of Object.keys(s.cooldown)) if (--s.cooldown[k] <= 0) delete s.cooldown[k];
    s.month += 1; s.monthsLeft -= 1;
    snapshot(s);
    s.last = { income: Math.round(mo.income), net: Math.round(mo.net), finished: out.finished, expired: out.expired, crisis };
    if (sim) return s.last;
    if (s.monthsLeft <= 0) {
      const vote = clamp(h - s.pressure * 0.1 + (rnd(s) - 0.5) * 3, 0, 100);
      s.election = { vote: r1(vote), happy: r1(h), pressure: r1(s.pressure), win: vote >= 51, term: s.term };
    } else s.event = rollDisaster(s) || rollEvent(s);
    return s.last;
  }
  // "bu ayarlarla N ay sonra ne olur" tahmini: durumun kopyası üzerinde, rastgelelik olmadan
  function forecast(s, months, tweak) {
    const c = JSON.parse(JSON.stringify(s));
    c.event = null; c.election = null; c.monthsLeft = 99;
    if (tweak) tweak(c);
    derive(c);
    for (let i = 0; i < months; i++) endMonth(c, true);
    return { happy: c.city.happy, resil: c.city.resil, budget: c.budget, net: monthly(c).net };
  }
  function newTerm(s) {
    if (!s.election || !s.election.win) return false;
    s.term += 1; s.monthsLeft = TERM; s.election = null; s.quakeThisTerm = false;
    s.pressure = clamp(s.pressure + 10, 0, 100); // ikinci dönemde beklenti yükselir
    return true;
  }
  // anket: seçim günü oy oranının gürültülü tahmini (ay içinde sabit kalır)
  function poll(s) {
    const x = Math.sin((s.month + 1) * 12.9898 + Number(s.plaka) * 78.233) * 43758.5453;
    return r1(clamp(s.city.happy - s.pressure * 0.1 + ((x - Math.floor(x)) - 0.5) * 5, 0, 100));
  }
  // bir mahallenin dört alandaki güncel puanı (arayüz çubukları için)
  function scores(s, m) { const q = svcTable(s)[m.ilce]; const o = {}; for (const k of DK) o[k] = score(m, q, k); return o; }
  function districtScores(s, d) {
    const q = svcTable(s)[d.id], o = { park: 0, saglik: 0, guvenlik: 0, ulasim: 0 };
    for (const m of mahOf(s, d.id)) for (const k of DK) o[k] += score(m, q, k) * m.pop;
    for (const k of DK) o[k] /= d.pop;
    return o;
  }

  return { ek, TERM, DOMAINS, SERVICES, TIPLER, BUILDINGS, REQS, TAX, POLICIES, MAX_PRIO, create, derive, monthly, serviceCost, policyCost, buildCost, reqCost,
    meet, meetMany, importance, coverage, canPlace, place, setAlloc, togglePrio, bloc, estimate, taxMod, propose, repeal, proposeTax, endMonth, forecast, eventView, resolveEvent,
    newTerm, poll, cityHappy, cityResil, stars, scores, districtScores, list, mahs, mahOf, km, quality };
});
