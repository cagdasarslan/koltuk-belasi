/* Koltuk Belası: Şehir Senin — ses. Efektler: Kenney "Interface Sounds" (CC0). Müzik ve alarm/zafer sesleri kodla üretilir. */
window.Ses = (function () {
  const FILES = ["tik", "sec", "onay", "insa", "hata", "ac", "kapat", "ay", "olay", "anahtar", "bitti"];
  const MODES = [
    { efekt: true, muzik: true, ad: "Ses ve müzik açık", ico: "volume-2" },
    { efekt: true, muzik: false, ad: "Yalnız efektler", ico: "volume-2" },
    { efekt: false, muzik: false, ad: "Sessiz", ico: "volume-x" },
  ];
  let mode = 0;
  try { mode = Math.min(2, Math.max(0, +localStorage.getItem("kb-ses") || 0)); } catch (e) { /* kayıt kapalı */ }
  let ctx = null, fx = null, mus = null, wet = null, timer = null, lastPlay = 0;
  const buf = {};
  const buttons = [];

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    fx = ctx.createGain(); fx.gain.value = 0.7; fx.connect(ctx.destination);
    mus = ctx.createGain(); mus.gain.value = 0; mus.connect(ctx.destination);
    // müzik için hafif yankı
    const delay = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    delay.delayTime.value = 0.68; fb.gain.value = 0.34; lp.type = "lowpass"; lp.frequency.value = 1800;
    wet = ctx.createGain(); wet.gain.value = 0.5;
    wet.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(mus);
    for (const n of FILES) {
      fetch(`ses/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => (buf[n] = b)).catch(() => {});
    }
    return true;
  }

  /* ---------- efektler ---------- */
  function tone(freq, t, dur, type, vol, dest, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  const SYNTH = {
    afet(t) { for (let i = 0; i < 3; i++) tone(520, t + i * 0.5, 0.42, "sawtooth", 0.16, fx, 760); tone(70, t, 1.6, "sine", 0.3, fx, 45); },
    zafer(t) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.14, 0.5, "triangle", 0.22, fx)); tone(1318.5, t + 0.6, 0.9, "triangle", 0.16, fx); },
    yenilgi(t) { [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, t + i * 0.22, 0.6, "triangle", 0.2, fx)); },
  };
  function play(name) {
    lastPlay = performance.now();
    if (!MODES[mode].efekt || !ctx || ctx.state !== "running") return;
    if (SYNTH[name]) return SYNTH[name](ctx.currentTime + 0.02);
    if (!buf[name]) return;
    const s = ctx.createBufferSource();
    s.buffer = buf[name]; s.connect(fx); s.start();
  }

  /* ---------- kodla üretilen müzik: sakin, döngüsel ---------- */
  const BPM = 64, STEP = 60 / BPM / 2; // sekizlik nota
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  // Re dorian çevresinde dört akor; her biri iki ölçü sürer
  const CHORDS = [
    { bass: 38, pad: [57, 60, 64, 65], arp: [62, 65, 69, 72, 76] },
    { bass: 34, pad: [58, 62, 65, 69], arp: [62, 65, 70, 74, 77] },
    { bass: 41, pad: [57, 60, 64, 67], arp: [60, 64, 69, 72, 76] },
    { bass: 36, pad: [55, 60, 64, 67], arp: [60, 64, 67, 72, 74] },
  ];
  let step = 0, nextT = 0, seed = 12345;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function pad(m, t, dur) {
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = hz(m); o.detune.value = det;
      f.type = "lowpass"; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 1.6);
      g.gain.setValueAtTime(0.05, t + dur - 1.2);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.4);
      o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + 1.5);
    }
  }
  function pluck(m, t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(mus); g.connect(wet); o.start(t); o.stop(t + 1.2);
  }
  function schedule() {
    if (!ctx || ctx.state !== "running") return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.1;
    while (nextT < ctx.currentTime + 0.6) {
      const c = CHORDS[Math.floor(step / 16) % CHORDS.length], s = step % 16;
      if (s === 0) {
        for (const m of c.pad) pad(m, nextT, STEP * 16);
        tone(hz(c.bass), nextT, STEP * 14, "sine", 0.12, mus);
      }
      if (s === 8) tone(hz(c.bass + 7), nextT, STEP * 6, "sine", 0.06, mus);
      if (s % 2 === 0 ? rand() < 0.5 : rand() < 0.18) pluck(c.arp[Math.floor(rand() * c.arp.length)], nextT, 0.05 + rand() * 0.04);
      nextT += STEP; step += 1;
    }
  }
  function music(on) {
    if (!ctx) return;
    mus.gain.cancelScheduledValues(ctx.currentTime);
    mus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, on ? 0.8 : 0.15);
    if (on && !timer) { nextT = 0; timer = setInterval(schedule, 150); schedule(); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  }

  /* ---------- açma / kapama ---------- */
  function apply() {
    try { localStorage.setItem("kb-ses", mode); } catch (e) { /* kayıt kapalı */ }
    for (const b of buttons) {
      b.innerHTML = `<i class="ico" style="--i:url(icons/${MODES[mode].ico}.svg)"></i>${mode === 1 ? "<small>FX</small>" : ""}`;
      b.setAttribute("aria-label", "Ses: " + MODES[mode].ad);
      b.title = MODES[mode].ad;
    }
    if (ctx) music(MODES[mode].muzik);
  }
  // tarayıcılar sesi ancak ilk dokunuştan sonra başlatır
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume().then(() => music(MODES[mode].muzik));
    else if (!timer) music(MODES[mode].muzik);
  }
  ["pointerdown", "keydown"].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  // özel sesi olmayan her düğme için genel dokunma sesi
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("button") && performance.now() - lastPlay > 40) play("tik");
  });

  function button(el) {
    buttons.push(el);
    el.addEventListener("click", () => { mode = (mode + 1) % MODES.length; unlock(); apply(); lastPlay = 0; play("anahtar"); });
    apply();
  }
  return { play, button, get mode() { return MODES[mode]; }, get state() { return ctx ? ctx.state : "yok"; }, get loaded() { return Object.keys(buf); } };
})();
