"use strict";
/* Pengaturan: Suara (musik + SFX) dan Tentang. Memakai $, stage, Sfx dari main.js */

/* --- Musik placeholder (arpeggio 8-bit). Ganti dengan <audio> mp3 kalau lagunya sudah ada --- */
const Music = (() => {
  let ctx, master, timer, step = 0, vol = .5;
  const LEAD = [262,330,392,330, 294,370,440,370, 262,330,392,523, 392,330,294,330];
  const BASS = [131,131,147,147];
  const note = (f, type, t, d, a) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(a * .25, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d);
  };
  const tick = () => {
    const t = ctx.currentTime + .05, i = step++ % 16;
    note(LEAD[i], "triangle", t, .22, .5);
    if (i % 4 === 0) note(BASS[i / 4], "square", t, .5, .25);
  };
  return {
    get volume() { return vol; },
    set(v) { vol = v; if (master) master.gain.value = v * .5; },
    start() {
      if (timer) return;
      ctx = Sfx.ctx(); master = ctx.createGain(); master.gain.value = vol * .5; master.connect(ctx.destination);
      timer = setInterval(tick, 260);
    }
  };
})();

/* --- simpan & muat volume --- */
const AUDIO_KEY = "dapurMacet.audio";
const saved = (() => { try { return JSON.parse(localStorage.getItem(AUDIO_KEY)) || {}; } catch (e) { return {}; } })();
const saveAudio = () => { try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ music: Music.volume, sfx: Sfx.volume })); } catch (e) {} };
Music.set(saved.music ?? .5);
Sfx.setVolume(saved.sfx ?? .5);

const chip = $("sfx");                               // tombol SFX di footer ikut sinkron
const syncChip = () => {
  const on = Sfx.volume > 0;
  chip.textContent = on ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  chip.setAttribute("aria-pressed", on);
};
syncChip();
chip.addEventListener("click", () => setTimeout(() => { syncChip(); saveAudio(); }, 0));
addEventListener("pointerdown", () => { if (Music.volume > 0) Music.start(); }, { once: true });   // musik mulai setelah interaksi pertama

/* --- slider --- */
const vm = $("vol-music"), vs = $("vol-sfx");
const paint = (el) => el.style.setProperty("--p", el.value + "%");
const syncSliders = () => {
  vm.value = Math.round(Music.volume * 100); vs.value = Math.round(Sfx.volume * 100);
  paint(vm); paint(vs);
};
vm.addEventListener("input", () => { Music.set(vm.value / 100); Music.start(); paint(vm); saveAudio(); });
vs.addEventListener("input", () => { Sfx.setVolume(vs.value / 100); paint(vs); syncChip(); });
vs.addEventListener("change", () => { Sfx.beep(660, "square", .08); saveAudio(); });   // bunyi contoh saat slider dilepas

/* --- navigasi layar pengaturan --- */
const settings = $("settings"), VIEWS = ["menu", "sound", "about"];
let closeTimer;
const showView = (v) => {
  VIEWS.forEach((n) => { $("set-" + n).hidden = n !== v; });
  if (v === "sound") syncSliders();
  const first = $("set-" + v).querySelector(".btn, input");
  if (first) first.focus({ preventScroll: true });
};
const openSettings = () => {
  clearTimeout(closeTimer);
  settings.classList.remove("closing"); settings.hidden = false;
  stage.dataset.mode = "settings"; showView("menu");
};
const closeSettings = () => {
  settings.classList.add("closing");
  closeTimer = setTimeout(() => { settings.hidden = true; settings.classList.remove("closing"); stage.dataset.mode = "menu"; }, 250);
};

document.querySelectorAll('[data-go="settings"]').forEach((b) => b.addEventListener("click", () => { Sfx.confirm(); openSettings(); }));
settings.addEventListener("click", (e) => {
  const b = e.target.closest("[data-set]");
  if (!b) return;
  Sfx.confirm();
  if (b.dataset.set === "back") closeSettings(); else showView(b.dataset.set);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || settings.hidden) return;
  if (!$("set-menu").hidden) closeSettings(); else showView("menu");
});