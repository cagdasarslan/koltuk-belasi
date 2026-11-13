/* Koltuk Belası: Şehir Senin — il seçim ekranı */
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const data = await fetch("data/iller.json").then((r) => r.json());
  const sheet = $("sheet"), svg = $("svg"), card = $("card"), ring = $("ring");
  sheet.style.setProperty("--ar", data.w / data.h);
  document.documentElement.style.setProperty("--ar", data.w / data.h);
  svg.setAttribute("viewBox", `0 0 ${data.w} ${data.h}`);

  const NS = "http://www.w3.org/2000/svg";
  const byPlaka = new Map(), byName = new Map();
  const fold = (s) => s.toLocaleLowerCase("tr").replace(/â/g, "a").trim();
  // küçük iller üstte kalsın ki büyük komşuları dokunmayı kapmasın
  for (const il of [...data.iller].sort((a, b) => b.km2 - a.km2)) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", il.d);
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "button");
    p.setAttribute("aria-label", il.ad);
    if (il.hazir) p.classList.add("ready");
    p.addEventListener("click", () => select(il));
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(il); } });
    const t = document.createElementNS(NS, "title");
    t.textContent = il.ad;
    p.appendChild(t);
    svg.appendChild(p);
    il.el = p;
    byPlaka.set(il.plaka, il);
    byName.set(fold(il.ad), il);
  }
  $("iller").innerHTML = data.iller.map((i) => `<option value="${esc(i.ad)}">`).join("");

  const money = (m) => (m >= 1000 ? `₺${(m / 1000).toFixed(2).replace(".", ",")} Mr` : `₺${m} Mn`);
  const zClass = { Kolay: "good", Orta: "warn", Zor: "bad" };
  let current = null;

  function place() {
    if (!current) return;
    const k = sheet.clientWidth / data.w;
    const [cx, cy] = current.c.map((v) => v * k);
    ring.style.left = cx + "px"; ring.style.top = cy + "px";
    const w = card.offsetWidth, h = card.offsetHeight, W = sheet.clientWidth, H = sheet.clientHeight;
    const top = current.box[1] * k, bottom = current.box[3] * k;
    // kart ilin üstüne sığıyorsa üste, sığmıyorsa alta; o da olmazsa yana
    let y = top - h - 14;
    let x = cx - w / 2;
    if (y < -30) y = bottom + 14;
    if (y + h > H + 30) {
      y = Math.min(Math.max(cy - h / 2, -20), H - h + 20);
      x = cx > W / 2 ? current.box[0] * k - w - 16 : current.box[2] * k + 16;
    }
    card.style.left = Math.min(Math.max(x, 6), W - w - 6) + "px";
    card.style.top = y + "px";
  }

  function select(il) {
    if (current && window.Ses) Ses.play("sec");
    if (current) current.el.classList.remove("on");
    current = il;
    il.el.classList.add("on");
    svg.appendChild(il.el); // seçili il en üste
    const risks = Object.entries(il.riskler).sort((a, b) => b[1] - a[1]);
    card.innerHTML = `<header><h1>${esc(il.ad)}</h1><small>${esc(il.bolge)}</small><b>${il.plaka}</b></header>
      <dl>
        <dt>Nüfus</dt><dd>${il.nufus.toLocaleString("tr-TR")}</dd>
        <dt>Başlangıç bütçesi</dt><dd>${money(il.butce)}</dd>
        <dt>Afet direnci</dt><dd class="${il.direnc >= 50 ? "good" : il.direnc >= 38 ? "warn" : "bad"}">%${il.direnc}</dd>
        <dt>Zorluk</dt><dd class="${zClass[il.zorluk]}">${il.zorluk}</dd>
      </dl>
      <div class="risks">${risks.map(([n, v]) => `<span class="risk r${v}">${esc(n)}: ${v === 3 ? "yüksek" : "orta"}</span>`).join("")}</div>
      <button class="go" type="button"${il.hazir ? "" : " disabled"}>${il.hazir ? "Başla" : "Yakında"}</button>`;
    card.hidden = false; ring.hidden = false;
    card.querySelector(".go").onclick = () => { if (!il.hazir) return; Ses.play("onay"); setTimeout(() => (location.href = `sehir.html?il=${il.plaka}`), 220); };
    $("q").value = "";
    place();
  }

  $("q").addEventListener("input", (e) => {
    const il = byName.get(fold(e.target.value));
    if (il) { select(il); e.target.blur(); }
  });
  $("q").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const v = fold(e.target.value);
    const il = byName.get(v) || (v && data.iller.find((i) => fold(i.ad).startsWith(v)));
    if (il) { select(il); e.target.blur(); }
  });
  window.addEventListener("resize", place);
  $("sheet").querySelector("img").addEventListener("load", place);

  Ses.button($("sesb"));
  select(byPlaka.get("34"));
  window.__secim = { data, select, byPlaka };
})();
