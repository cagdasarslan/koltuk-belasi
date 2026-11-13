/* Koltuk Belası: Şehir Senin — kurgusal karakterler ve kodla çizilen vektör portreleri.
   Karakterlerin hepsi hayal ürünüdür; gerçek kişilere benzetilmemiştir. */
window.Portre = (function () {
  const SKIN = { a: ["#f3cfae", "#dcae88"], b: ["#e2b48c", "#c79468"], c: ["#c98f62", "#a87148"], d: ["#f0c4a0", "#d6a27c"] };
  const KISILER = {
    ozelkalem: { ad: "Selin Aksoy", rol: "Özel Kalem Müdürü", bg: "#2f6f8f", skin: "a", hair: "topuz", hc: "#3a2a20", top: "#e9e4dc", jacket: "#27384a", mouth: "smile", glasses: true },
    mali: { ad: "Cemal Tunç", rol: "Mali İşler Müdürü", bg: "#5a6b3c", skin: "b", hair: "kel", hc: "#8a8780", top: "#f1eee8", jacket: "#3d3f45", tie: "#7a2f2f", mouth: "flat", glasses: true, mustache: "#8a8780" },
    muhalefet: { ad: "Nevzat Karabey", rol: "Muhalefet Lideri", bg: "#7d2f3a", skin: "d", hair: "yan", hc: "#4a4744", top: "#f1eee8", jacket: "#1f2937", tie: "#b98a2a", mouth: "smirk", brow: "angry" },
    muhtar: { ad: "Hatice Yıldız", rol: "Mahalle Muhtarı", bg: "#8a5a2b", skin: "b", hair: "basortu", hc: "#7b3f5c", top: "#c9b79a", jacket: "#5d4a3a", mouth: "smile" },
    gazeteci: { ad: "Deniz Erkmen", rol: "Gazeteci", bg: "#4a4f8a", skin: "a", hair: "uzun", hc: "#6b3a22", top: "#2f2f35", jacket: "#8b8f98", mouth: "flat", badge: true },
    afet: { ad: "Baran Demir", rol: "Afet Koordinatörü", bg: "#a8521c", skin: "c", hair: "baret", hc: "#1f1a17", top: "#f08a24", jacket: "#f08a24", vest: true, mouth: "flat", beard: "#2a211c" },
    sendika: { ad: "Yusuf Öztaş", rol: "Sendika Temsilcisi", bg: "#35607a", skin: "c", hair: "kisa", hc: "#2a2420", top: "#3f6ea3", jacket: "#3f6ea3", mouth: "flat", mustache: "#2a2420", brow: "angry" },
    genclik: { ad: "Elif Güneş", rol: "Gençlik Meclisi Başkanı", bg: "#2f8a6a", skin: "d", hair: "kivircik", hc: "#241a16", top: "#f2c94c", jacket: "#f2c94c", mouth: "smile" },
  };

  function hairBack(k) {
    const c = k.hc;
    if (k.hair === "uzun") return `<path d="M30,60C26,18 94,18 90,60L93,100C80,106 40,106 27,100Z" fill="${c}"/>`;
    if (k.hair === "basortu") return `<path d="M29,62C24,14 96,14 91,62C94,90 82,108 60,110C38,108 26,90 29,62Z" fill="${c}"/>`;
    if (k.hair === "topuz") return `<circle cx="60" cy="22" r="11" fill="${c}"/>`;
    if (k.hair === "kivircik") return [[38, 40, 13], [50, 28, 14], [68, 27, 14], [82, 40, 13], [34, 56, 10], [86, 56, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join("");
    return "";
  }
  function hairFront(k) {
    const c = k.hc;
    switch (k.hair) {
      case "kisa": return `<path d="M35,56C31,24 89,24 85,56C82,48 72,43 60,43C48,43 38,48 35,56Z" fill="${c}"/>`;
      case "yan": return `<path d="M35,58C30,22 92,20 85,58C83,49 76,42 58,45C46,46 39,50 35,58Z" fill="${c}"/>`;
      case "uzun": return `<path d="M35,60C30,24 90,22 85,60C82,50 74,42 60,43C48,44 38,50 35,60Z" fill="${c}"/>`;
      case "topuz": return `<path d="M35,56C31,24 89,24 85,56C80,47 70,43 60,43C50,43 40,47 35,56Z" fill="${c}"/>`;
      case "kel": return `<path d="M35,62C33,52 35,46 38,44C37,52 38,58 39,64Z" fill="${c}"/><path d="M85,62C87,52 85,46 82,44C83,52 82,58 81,64Z" fill="${c}"/>`;
      case "kivircik": return `<path d="M36,54C36,30 84,30 84,54C78,48 68,45 60,45C52,45 42,48 36,54Z" fill="${c}"/>`;
      case "basortu": return `<path d="M34,60C30,22 90,22 86,60C83,44 74,36 60,36C46,36 37,44 34,60Z" fill="${c}"/><path d="M40,82C48,96 72,96 80,82C80,98 72,106 60,106C48,106 40,98 40,82Z" fill="${c}"/>`;
      case "baret": return `<path d="M36,56C36,50 38,48 40,48L80,48C82,48 84,50 84,56C80,52 40,52 36,56Z" fill="${c}"/><path d="M33,47C33,18 87,18 87,47Z" fill="#f6c21a"/><rect x="28" y="45" width="64" height="6" rx="3" fill="#dba90f"/><rect x="56" y="22" width="8" height="24" rx="3" fill="#dba90f"/>`;
    }
    return "";
  }
  function mouth(k) {
    const m = { smile: "M51,74Q60,82 69,74", flat: "M52,76L68,76", smirk: "M52,77Q62,78 69,72", sad: "M52,78Q60,72 68,78" }[k.mouth] || "M52,76L68,76";
    return `<path d="${m}" fill="none" stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  function svg(id) {
    const k = KISILER[id];
    if (!k) return "";
    const [skin, shade] = SKIN[k.skin];
    const scarf = k.hair === "basortu";
    const brows = k.brow === "angry" ? `<path d="M45,51L55,54M75,51L65,54"` : `<path d="M45,52Q50,49 55,52M65,52Q70,49 75,52"`;
    return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k.ad}, ${k.rol}">
      <rect width="120" height="140" fill="${k.bg}"/><circle cx="60" cy="62" r="52" fill="#fff" opacity=".1"/>
      ${hairBack(k)}
      <path d="M8,140C10,110 36,100 60,100C84,100 110,110 112,140Z" fill="${k.jacket}"/>
      ${k.vest ? `<path d="M30,140L36,106L48,102L50,140ZM90,140L84,106L72,102L70,140Z" fill="#ffe14d"/><rect x="32" y="122" width="17" height="5" fill="#d9dde2"/><rect x="71" y="122" width="17" height="5" fill="#d9dde2"/>`
        : `<path d="M44,101L60,124L76,101L70,98L50,98Z" fill="${k.top}"/>`}
      ${k.tie ? `<path d="M57,104L63,104L65,128L60,134L55,128Z" fill="${k.tie}"/>` : ""}
      ${k.badge ? `<path d="M48,100L60,118L72,100" fill="none" stroke="#d94a4a" stroke-width="2.5"/><rect x="52" y="116" width="16" height="20" rx="2" fill="#f4f1ea"/><rect x="55" y="120" width="10" height="3" fill="#d94a4a"/><rect x="55" y="126" width="10" height="2" fill="#9aa3ad"/><rect x="55" y="130" width="7" height="2" fill="#9aa3ad"/>` : ""}
      ${scarf ? "" : `<rect x="51" y="78" width="18" height="24" rx="6" fill="${shade}"/>`}
      ${scarf ? "" : `<ellipse cx="35" cy="60" rx="4.5" ry="7" fill="${shade}"/><ellipse cx="85" cy="60" rx="4.5" ry="7" fill="${shade}"/>`}
      <ellipse cx="60" cy="59" rx="${scarf ? 22 : 25}" ry="${scarf ? 27 : 30}" fill="${skin}"/>
      ${k.beard ? `<path d="M36,62C38,86 50,92 60,92C70,92 82,86 84,62C80,74 72,70 60,70C48,70 40,74 36,62Z" fill="${k.beard}"/>` : ""}
      ${hairFront(k)}
      ${brows} fill="none" stroke="${k.hair === "kel" ? "#6b6862" : "#2a211c"}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="50" cy="59" r="2.6" fill="#1d1714"/><circle cx="70" cy="59" r="2.6" fill="#1d1714"/>
      <path d="M60,60Q64,68 59,70" fill="none" stroke="${shade}" stroke-width="2.4" stroke-linecap="round"/>
      ${k.mustache ? `<path d="M49,72Q54,68 60,71Q66,68 71,72Q66,75 60,73Q54,75 49,72Z" fill="${k.mustache}"/>` : ""}
      ${mouth(k)}
      ${k.glasses ? `<g fill="rgba(255,255,255,.18)" stroke="#20242a" stroke-width="2.2"><circle cx="50" cy="59" r="8"/><circle cx="70" cy="59" r="8"/></g><path d="M58,59L62,59M42,58L35,55M78,58L85,55" stroke="#20242a" stroke-width="2.2" fill="none"/>` : ""}
    </svg>`;
  }
  const kart = (id) => (KISILER[id] ? `<div class="kisi"><div class="portre">${svg(id)}</div><div><b>${KISILER[id].ad}</b><span>${KISILER[id].rol}</span></div></div>` : "");
  return { KISILER, svg, kart };
})();
