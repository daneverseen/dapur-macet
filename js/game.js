"use strict";
/* ============================================================
   Gameplay Easy: simulasi deadlock (hanya ditonton, tanpa input)
   Memakai $, stage, Sfx, load, puffTex, rnd, AMP, setMode dari main.js
   Koordinat desain 1280x720 (y ke bawah), semua sprite dari game-atlas.png
   ============================================================ */
(() => {
const GW = 1280, GH = 720, AW = 1024, AH = 1024;
const ATLAS = {"cycle":[2,2,330,339],"chefA0":[334,2,231,285],"chefA1":[567,2,231,285],"chefB0":[2,343,231,250],"chefB1":[235,343,231,250],"cloud":[468,343,252,208],"hourglass":[722,343,162,150],"warning":[2,595,162,150],"frontA":[166,595,68,137],"frontB":[236,595,76,136],"custA0":[314,595,134,128],"custB0":[450,595,134,128],"custA1":[586,595,134,128],"custB1":[722,595,134,128],"bubble":[2,747,167,118],"boom":[171,747,114,112],"stove":[287,747,144,104],"wok":[433,747,144,104],"debris":[579,747,177,93],"hotdog":[758,747,149,85],"waffle":[2,867,135,77],"arrowT":[139,867,66,51],"arrowO":[207,867,66,51],"spark":[275,867,47,47]};
// posisi hasil mencocokkan ikon dengan frame Easy_x: [x, y, skala]  (b = titik bawah-tengah, lainnya titik tengah)
const POS = {"chefA":[187,691,1.009],"chefB":[986,692,0.988],"custA":[370,329,1.037],"custB":[863,330,1.089],"wok":[320,465,1.021],"cloudL":[126,329,0.997],"cloudR":[1093,318,1.216],"stoveC":[97,324,1.029],"wokC":[1128,305,0.96],"hourglass":[607,645,0.992],"warning":[607,646,0.996],"cycle":[635,366,0.923],"hotdog":[494,179,0.998],"waffle":[989,181,0.87],"bubbleR":[986,190],"bubbleL":[490,190]};

const game = $("game"), cap = $("game-cap"), ana = $("ana"), gcv = $("game-canvas");
let gr, gscene, gcam, atlasTex, bgMat, built = false, running = false, raf = 0;
let T = 0, ei = 0, dotsOn = false, fxOn = false, fxT = 0, rumble = 0;
const S = {}, tweens = [], dots = [], fx = [], clock = new THREE.Clock();
const U = (k) => S[k].userData;

/* ---------- tween mini ---------- */
const E = { out: (p) => 1 - (1 - p) ** 3, io: (p) => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2,
            back: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2 };
const tw = (o, k, to, dur, e = "out", delay = 0) => tweens.push({ o, k, to, dur, e, t: -delay });
const stepTweens = (dt) => {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt;
    if (w.t < 0) continue;
    if (w.from === undefined) w.from = w.o[w.k];
    const p = Math.min(1, w.t / w.dur);
    w.o[w.k] = w.from + (w.to - w.from) * E[w.e](p);
    if (p >= 1) tweens.splice(i, 1);
  }
};

/* ---------- pembuat sprite dari atlas ---------- */
function uvQuad(name, bottom) {
  const [x, y, w, h] = ATLAS[name], g = new THREE.PlaneGeometry(1, 1);
  const u0 = x / AW, u1 = (x + w) / AW, v1 = 1 - y / AH, v0 = 1 - (y + h) / AH;
  g.attributes.uv.set([u0, v1, u1, v1, u0, v0, u1, v0]);
  if (bottom) g.translate(0, .5, 0);                 // titik tumpu di kaki
  return g;
}
function mk(key, name, x, y, s = 1, o = {}) {        // x,y koordinat desain; o.rel = koordinat relatif ke parent (y ke atas)
  const [, , w, h] = ATLAS[name];
  const m = new THREE.Mesh(uvQuad(name, o.bottom), new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false }));
  m.renderOrder = o.z || 1; m.position.z = o.z || 1;
  Object.assign(m.userData, { bx: x, by: o.rel ? y : GH - y, w: w * s, h: h * s, fx: o.flip ? -1 : 1, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  (o.parent || gscene).add(m); S[key] = m; return m;
}
function pivot(key, x, y, z = 2) {                   // Object3D sebagai titik tumpu animasi pop
  const g = new THREE.Object3D(); g.position.z = z;
  Object.assign(g.userData, { bx: x, by: GH - y, group: true, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  gscene.add(g); S[key] = g; return g;
}
function glow(key, x, y, size, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.renderOrder = m.position.z = 1.2;
  Object.assign(m.userData, { bx: x, by: GH - y, w: size, h: size, fx: 1, ox: 0, oy: 0, k: 1, a: 0, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  gscene.add(m); S[key] = m;
}
function sync() {                                    // salin state animasi (userData) ke objek three
  for (const k in S) {
    const o = S[k], u = o.userData, sx = u.k * u.sx, sy = u.k * u.sy;
    o.position.x = u.bx + u.ox + u.jx; o.position.y = u.by + u.oy + u.jy; o.rotation.z = u.r;
    if (u.group) o.scale.set(sx, sy, 1);
    else { o.scale.set(u.w * u.fx * sx, u.h * sy, 1); o.material.opacity = u.a; }
  }
}

/* ---------- bangun scene (sekali) ---------- */
async function build() {
  const [bg, atlas] = await Promise.all([load("assets/game-bg.webp"), load("assets/game-atlas.png")]);
  atlasTex = atlas;
  gr = new THREE.WebGLRenderer({ canvas: gcv, antialias: true });
  gr.setPixelRatio(Math.min(devicePixelRatio, 2)); gr.setClearColor(0x12303a);
  gscene = new THREE.Scene();
  gcam = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 20); gcam.position.z = 10;
  addEventListener("resize", fit); fit();

  bgMat = new THREE.MeshBasicMaterial({ map: bg });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), bgMat);
  Object.assign(b.userData, { bx: GW / 2, by: GH / 2, group: true, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0, tint: 0 });
  gscene.add(b); S.bg = b;
  fit();

  const P = POS;
  ["chefA", "chefB"].forEach((c) => { mk(c + "0", c + "0", P[c][0], P[c][1], P[c][2], { bottom: 1, z: 1.5 }); mk(c + "1", c + "1", P[c][0], P[c][1], P[c][2], { bottom: 1, z: 1.5 }); });
  ["custA", "custB"].forEach((c) => { mk(c + "0", c + "0", P[c][0], P[c][1], P[c][2], { bottom: 1, z: 1 }); mk(c + "1", c + "1", P[c][0], P[c][1], P[c][2], { bottom: 1, z: 1 }); });
  mk("wok", "wok", P.wok[0], P.wok[1], P.wok[2], { z: 1.4 });
  glow("gA", P.wok[0], P.wok[1], 240, 0xf08a2e); glow("gB", 882, 512, 270, 0x27c4c9);

  const order = (key, c, food, id) => {              // bubble pesanan, pop dari ujung ekor
    const gx = c[0] - 83, gy = c[1] + 59, g = pivot(key, gx, gy);
    mk(key + "B", "bubble", c[0] - gx, gy - c[1], 1, { parent: g, rel: 1, z: 2 });
    mk(key + "F", id, food[0] - gx, gy - food[1], food[2], { parent: g, rel: 1, z: 2.1 });
  };
  order("ordL", P.bubbleL, P.hotdog, "hotdog"); order("ordR", P.bubbleR, P.waffle, "waffle");

  const cloud = (key, c, pv, flip, item, ip) => {    // awan pikiran, pop dari ujung ekor
    const g = pivot(key, pv[0], pv[1]);
    mk(key + "C", "cloud", c[0] - pv[0], pv[1] - c[1], c[2], { parent: g, rel: 1, flip, z: 2 });
    mk(key + "I", item, ip[0] - pv[0], pv[1] - ip[1], ip[2], { parent: g, rel: 1, z: 2.1 });
  };
  cloud("cldL", P.cloudL, [186, 391], 0, "stove", P.stoveC); cloud("cldR", P.cloudR, [1033, 380], 1, "wok", P.wokC);

  mk("hg", "hourglass", ...P.hourglass.slice(0, 2), P.hourglass[2], { z: 3 });
  mk("wn", "warning", P.warning[0], P.warning[1], P.warning[2], { z: 3 });
  mk("cyc", "cycle", P.cycle[0], P.cycle[1], P.cycle[2], { z: 3 });
  mk("arA", "arrowO", 800, 394, .8, { z: 3 }); mk("arB", "arrowT", 388, 418, .8, { flip: 1, z: 3 });
  for (let i = 0; i < 18; i++) {                     // titik "menunggu" yang tidak pernah sampai
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, color: i < 9 ? 0xf08a2e : 0x27c4c9, transparent: true, depthWrite: false }));
    m.renderOrder = 3; m.visible = false; gscene.add(m); dots.push(m);
  }
  ["boom", "boom", "boom", "spark", "spark", "spark", "debris", "debris"].forEach((n, i) => {
    fx.push({ m: mk("fx" + i, n, 0, 0, 1, { z: 5 }), n, age: 0, life: 1, on: false });
  });

  game.querySelectorAll("[data-ico]").forEach((el) => {   // ikon layar analisis (CSS sprite)
    const [x, y, w, h] = ATLAS[el.dataset.ico];
    el.classList.add("ico"); el.style.cssText = `--x:${x};--y:${y};--w:${w};--h:${h}`;
  });
  built = true;
}
function fit() {                                     // "contain": seluruh adegan selalu terlihat
  const w = innerWidth, h = innerHeight, s = Math.min(w / GW, h / GH), hw = w / s / 2, hh = h / s / 2;
  gr.setSize(w, h, false);
  Object.assign(gcam, { left: GW / 2 - hw, right: GW / 2 + hw, top: GH / 2 + hh, bottom: GH / 2 - hh });
  gcam.updateProjectionMatrix();
  if (S.bg) {
    S.bg.userData.sx = (gcam.right - gcam.left) / GW;
    S.bg.userData.sy = (gcam.top - gcam.bottom) / GH;
  }
}

/* ---------- helper timeline ---------- */
const say = (t) => { cap.textContent = t; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); };
const pop = (k, delay = 0, from = 0) => { const o = S[k]; o.visible = true; o.userData.k = from; tw(o.userData, "k", 1, .5, "back", delay); };
const swap = (a, b) => { S[a].visible = false; pop(b, 0, .6); };
const drop = (k) => { const o = S[k], u = o.userData; o.visible = true; u.oy = 250; u.a = 0; tw(u, "oy", 0, .8, "back"); tw(u, "a", 1, .25); };
const lit = (k) => { const o = S[k]; o.visible = true; o.userData.a = 0; tw(o.userData, "a", .8, .6); };

const TL = [
  [.3,   () => say("Mode Easy: tonton bagaimana deadlock terjadi.")],
  [1.2,  () => { pop("chefA0"); pop("chefB0", .15); Sfx.beep(440, "triangle", .1); say("Dua koki siap bekerja di dapur."); }],
  [3.2,  () => { pop("custA0"); pop("custB0", .15); Sfx.confirm(); say("Pelanggan datang dan memesan makanan."); }],
  [4.4,  () => { pop("ordL"); Sfx.beep(660, "square", .08); }],
  [5.0,  () => { pop("ordR"); Sfx.beep(740, "square", .08); }],
  [6.6,  () => { drop("wok"); lit("gA"); Sfx.beep(220, "square", .12); say("Koki A mengambil Wajan dan memegangnya."); }],
  [8.6,  () => { lit("gB"); Sfx.beep(180, "square", .12); say("Koki B sudah lebih dulu memegang Kompor."); }],
  [10.6, () => { swap("chefA0", "chefA1"); swap("chefB0", "chefB1"); pop("cldL"); pop("cldR", .35); Sfx.beep(330, "sawtooth", .2); say("Koki A butuh Kompor. Koki B butuh Wajan. Tak ada yang mau melepas."); }],
  [13.0, () => { dotsOn = true; pop("arA"); pop("arB"); say("Keduanya saling menunggu satu sama lain..."); }],
  [15.6, () => { pop("hg"); say("Waktu berjalan, pesanan tak kunjung jadi."); }],
  [19.6, () => { swap("custA0", "custA1"); swap("custB0", "custB1"); S.hg.visible = false; pop("wn"); tw(U("bg"), "tint", .35, 1.2, "io"); Sfx.alarm(); say("Pelanggan mulai marah!"); }],
  [22.5, () => { S.wn.visible = false; pop("cyc"); tw(U("bg"), "tint", 1, 1, "io"); rumble = 2.5; fxOn = true; game.classList.add("dead"); Sfx.alarm(); say("DEADLOCK! Saling menunggu tanpa akhir, tak ada yang bisa lanjut."); }],
  [29.5, () => { ana.hidden = false; game.classList.add("done"); cap.classList.remove("show"); Sfx.confirm(); }]
];

/* ---------- animasi yang selalu jalan ---------- */
const SPOTS = [[1190, 135], [1105, 142], [70, 160], [40, 300], [1235, 330], [640, 70], [330, 95]];
function animate(t, dt) {
  const A = AMP;
  ["chefA", "chefB"].forEach((c, i) => {
    const a = U(c + "0"), p = U(c + "1");
    a.sy = 1 + Math.sin(t * 2.2 + i) * .01 * A; a.jx = Math.sin(t * 1.4 + i) * 1.2 * A; a.r = Math.sin(t * 1.4 + i) * .008 * A;       // napas santai
    p.sy = 1 + Math.sin(t * 9 + i) * .014 * A; p.jx = Math.sin(t * 38 + i * 2) * 1.8 * A; p.r = Math.sin(t * 7 + i) * .028 * A;         // panik gemetar
  });
  ["custA", "custB"].forEach((c, i) => {
    U(c + "0").sy = 1 + Math.sin(t * 2.4 + i) * .012 * A;
    const g = U(c + "1"); g.jx = Math.sin(t * 31 + i) * 1.5 * A; g.sy = 1 + Math.sin(t * 6 + i) * .02 * A;                               // marah gemetar
  });
  ["ordL", "ordR"].forEach((k, i) => { U(k).r = Math.sin(t * 3 + i * 2) * (S.custA1.visible ? .05 : .018) * A; });
  ["cldL", "cldR"].forEach((k, i) => { U(k).jy = Math.sin(t * 2 + i * 1.7) * 4 * A; });
  const h = U("hg"), f = Math.min(1, (t % 2.4) / .6);                                                                                    // jam pasir terbalik tiap 2,4 dtk
  h.r = Math.PI * (Math.floor(t / 2.4) + E.io(f)); h.sx = h.sy = 1 + Math.sin(t * 4) * .04;
  const w = U("wn"); w.r = Math.sin(t * 10) * .06 * A; w.sx = w.sy = 1 + Math.abs(Math.sin(t * 5)) * .1;
  const c = U("cyc"); c.r = -t * .7; c.sx = c.sy = 1 + Math.sin(t * 3) * .05;
  U("gA").sx = U("gA").sy = 1 + Math.sin(t * 3) * .1; U("gB").sx = U("gB").sy = 1 + Math.sin(t * 3 + 1) * .1;
  U("arA").jx = Math.sin(t * 6) * 5 * A; U("arB").jx = -Math.sin(t * 6) * 5 * A;

  dots.forEach((m, i) => {                           // dua garis titik berlawanan arah, memudar sebelum sampai
    m.visible = dotsOn; if (!dotsOn) return;
    const a = i < 9, fr = (t * .35 + (i % 9) / 9) % 1, x0 = a ? 250 : 1000, x1 = a ? 790 : 400, y = a ? 394 : 418;
    m.position.set(x0 + (x1 - x0) * fr, GH - y + Math.sin(t * 5 + i) * 2, 3);
    m.scale.setScalar(Math.max(2, 20 * (1 - Math.max(0, (fr - .8) / .2))));
    m.material.opacity = Math.min(1, fr * 6);
  });

  if (fxOn && (fxT -= dt) <= 0) {                    // ledakan acak setelah deadlock
    fxT = rnd(.25, .6);
    const [x, y] = SPOTS[Math.floor(rnd(0, SPOTS.length))], n = ["boom", "spark", "debris"][Math.floor(rnd(0, 3))];
    const q = fx.find((v) => !v.on && v.n === n);
    if (q) { Object.assign(q, { on: true, age: 0, life: rnd(.6, 1) }); Object.assign(q.m.userData, { bx: x, by: GH - y }); q.m.visible = true; if (Math.random() < .5) Sfx.beep(rnd(60, 110), "sawtooth", .2); }
  }
  fx.forEach((q) => {
    if (!q.on) return;
    q.age += dt; const p = q.age / q.life, u = q.m.userData;
    if (p >= 1) { q.on = false; q.m.visible = false; return; }
    u.k = .4 + .9 * E.out(Math.min(1, p * 3)); u.a = p < .55 ? 1 : 1 - (p - .55) / .45; u.oy = q.n === "debris" ? -p * 50 : 0;
  });

  const tn = U("bg").tint; bgMat.color.setRGB(1 - .38 * tn, 1 - .55 * tn, 1 - .55 * tn);                                                  // latar memerah
  const amp = rumble * A; gcam.position.set(rnd(-1, 1) * amp, rnd(-1, 1) * amp, 10);                                                   // layar bergetar
}

/* ---------- kontrol ---------- */
function reset() {
  tweens.length = 0; T = 0; ei = 0; dotsOn = false; fxOn = false; fxT = 0; rumble = 0;
  game.classList.remove("dead", "done"); ana.hidden = true; cap.classList.remove("show");
  for (const k in S) {
    const o = S[k]; Object.assign(o.userData, { ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
    if (k !== "bg") o.visible = false;
  }
  U("bg").tint = 0; U("gA").a = 0; U("gB").a = 0; fx.forEach((q) => { q.on = false; });
  clock.getDelta();
  fit();
}
function frame() {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05); T += dt;
  while (ei < TL.length && T >= TL[ei][0]) TL[ei++][1]();
  stepTweens(dt); animate(T, dt); sync(); gr.render(gscene, gcam);
}
async function start() {
  game.hidden = false; stage.dataset.mode = "game";
  if (!built) await build();
  reset(); running = true; frame();
}
function stop() {
  running = false; cancelAnimationFrame(raf); game.hidden = true; setMode("menu");
}
window.startGame = start;

$("game-exit").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game-menu").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game-replay").addEventListener("click", () => { Sfx.confirm(); reset(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !game.hidden) stop(); });
})();