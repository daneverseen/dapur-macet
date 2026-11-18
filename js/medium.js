"use strict";
/* ============================================================
   Gameplay Medium: simulasi deadlock 3 koki, 3 alat (circular wait)
   Hanya ditonton, gaya sama seperti Easy. Memakai $, stage, Sfx, load,
   puffTex, rnd, AMP, setMode dari main.js.
   Koordinat desain 1280x720 (y ke bawah). Semua sprite dari medium-atlas.png
   ============================================================ */
(() => {
const GW = 1280, GH = 720, AW = 1400, AH = 705;
const ATLAS = {"manC":{"r":[839,341,127,146],"a":[62.0,144.0]},"pairC":{"r":[968,341,179,144],"a":[86.5,142.0]},"manP":{"r":[706,341,131,149],"a":[65.0,147.0]},"pairP":{"r":[0,341,224,157],"a":[120.5,155.0]},"c1":{"r":[1149,341,91,133],"a":[45.5,133.0]},"c2":{"r":[0,500,90,131],"a":[45.0,131.0]},"c3":{"r":[1242,341,94,133],"a":[47.0,133.0]},"curry":{"r":[0,633,92,70],"a":[46.0,35.0]},"frontB":{"r":[260,500,74,125],"a":[37.0,125.0]},"frontC":{"r":[336,500,71,121],"a":[35.5,121.0]},"cycle":{"r":[0,0,330,339],"a":[165.0,169.5]},"hourglass":{"r":[378,341,162,150],"a":[81.0,75.0]},"warning":{"r":[542,341,162,150],"a":[81.0,75.0]},"bubble":{"r":[409,500,167,118],"a":[83.5,59.0]},"boom":{"r":[578,500,114,112],"a":[57.0,56.0]},"debris":{"r":[1100,500,177,93],"a":[88.5,46.5]},"spark":{"r":[230,633,47,47],"a":[23.5,23.5]},"arrowT":{"r":[94,633,66,51],"a":[33.0,25.5]},"arrowO":{"r":[162,633,66,51],"a":[33.0,25.5]},"wok":{"r":[694,500,144,104],"a":[72.0,52.0]},"stove":{"r":[840,500,144,104],"a":[72.0,52.0]},"pot":{"r":[226,341,150,151],"a":[75.0,75.5]},"ramen":{"r":[986,500,112,102],"a":[56.0,51.0]},"chicken":{"r":[1279,500,103,93],"a":[51.5,46.5]},"cloudA":{"r":[630,0,266,198],"a":[133.0,99.0]},"cloudB":{"r":[332,0,296,221],"a":[148.0,110.5]},"cloudC":{"r":[898,0,266,198],"a":[133.0,99.0]},"frontA":{"r":[92,500,166,131],"a":[83.0,65.5]},"tile":{"r":[1166,0,169,175],"a":[84.5,87.5]}};   // k: { r:[x,y,w,h] di atlas, a:[ax,ay] titik tumpu dalam sprite }

const game = $("game2"), cap = $("game2-cap"), ana = $("ana2"), gcv = $("game2-canvas");
let gr, gscene, gcam, atlasTex, bgMat, built = false, running = false, raf = 0;
let T = 0, ei = 0, dotsOn = false, fxOn = false, fxT = 0, rumble = 0, angry = 0;
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

/* ---------- sprite dari atlas (titik tumpu = ATLAS[name].a) ---------- */
function uvQuad(name) {
  const { r: [x, y, w, h], a: [ax, ay] } = ATLAS[name], g = new THREE.PlaneGeometry(1, 1);
  const u0 = x / AW, u1 = (x + w) / AW, v1 = 1 - y / AH, v0 = 1 - (y + h) / AH;
  g.attributes.uv.set([u0, v1, u1, v1, u0, v0, u1, v0]);
  g.translate(.5 - ax / w, ay / h - .5, 0);          // titik tumpu jadi origin
  return g;
}
function mk(key, name, x, y, s = 1, o = {}) {        // x,y desain; o.rel = relatif ke parent (y ke atas)
  const [, , w, h] = ATLAS[name].r;
  const m = new THREE.Mesh(uvQuad(name), new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false }));
  m.renderOrder = o.z || 1; m.position.z = o.z || 1;
  Object.assign(m.userData, { bx: x, by: o.rel ? y : GH - y, w: w * s, h: h * s, fx: o.flip ? -1 : 1, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  (o.parent || gscene).add(m); S[key] = m; return m;
}
function pivot(key, x, y, z = 2) {
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
function sync() {
  for (const k in S) {
    const o = S[k], u = o.userData, sx = u.k * u.sx, sy = u.k * u.sy;
    o.position.x = u.bx + u.ox + u.jx; o.position.y = u.by + u.oy + u.jy; o.rotation.z = u.r;
    if (u.group) o.scale.set(sx, sy, 1);
    else { o.scale.set(u.w * u.fx * sx, u.h * sy, 1); o.material.opacity = u.a; }
  }
}

/* ---------- posisi hasil mencocokkan dengan frame Medium_x ---------- */
const P = {
  man: [123, 632], pair: [954.5, 657],
  cust: [[372.5, 345], [640, 345], [957, 345]],
  bub: [[436, 185, .97], [688, 189, .93], [1021, 184, 1]],
  food: [["ramen", 439, 176, .75], ["curry", 694, 177, 1], ["chicken", 1023, 171, .9]],
  wok: [261, 476, .79], pot: [1008, 458, .75], stove: [857, 488],
  cld: [["cloudA", 180, 445, .7, 0, "stove", 115, 510], ["cloudB", 810, 445, .62, 1, "pot", 890, 510], ["cloudC", 1090, 445, .65, 0, "wok", 1010, 510]],
  badge: [604, 650], cycle: [530, 465, .9]
};
// jalur titik "menunggu": A->kompor, B->panci, C->wajan (kurva bezier kuadrat)
const PATHS = [[[300, 440], [560, 335], [800, 440], 0xf08a2e], [[900, 435], [955, 380], [1005, 420], 0x27c4c9], [[1010, 400], [640, 250], [262, 420], 0xe0507a]];

/* ---------- bangun scene (sekali) ---------- */
async function build() {
  const [bg, atlas] = await Promise.all([load("assets/medium-bg.webp"), load("assets/medium-atlas.png")]);
  atlas.magFilter = THREE.NearestFilter;
  atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.needsUpdate = true;
  atlasTex = atlas;
  gr = new THREE.WebGLRenderer({ canvas: gcv, antialias: true });
  gr.setPixelRatio(Math.min(devicePixelRatio, 2)); gr.setClearColor(0x2a1a14);
  gscene = new THREE.Scene();
  gcam = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 20); gcam.position.z = 10;
  addEventListener("resize", fit);

  bgMat = new THREE.MeshBasicMaterial({ map: bg });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), bgMat);
  Object.assign(b.userData, { bx: GW / 2, by: GH / 2, group: true, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0, tint: 0 });
  gscene.add(b); S.bg = b;
  fit();

  mk("manC", "manC", ...P.man, 1, { z: 1.5 }); mk("manP", "manP", ...P.man, 1, { z: 1.5 });
  mk("pairC", "pairC", ...P.pair, 1, { z: 1.5 }); mk("pairP", "pairP", ...P.pair, 1, { z: 1.5 });
  P.cust.forEach((c, i) => mk("cust" + i, "c" + (i + 1), c[0], c[1], 1, { z: 1 }));
  mk("wok", "wok", ...P.wok, { z: 1.4 }); mk("pot", "pot", ...P.pot, { z: 1.4 });
  glow("gA", P.wok[0], P.wok[1], 240, 0xf08a2e); glow("gB", P.stove[0], P.stove[1], 290, 0x27c4c9); glow("gC", P.pot[0], P.pot[1], 230, 0xe0507a);

  P.bub.forEach((c, i) => {                          // bubble pesanan, pop dari ujung ekor
    const gx = c[0] - 27, gy = c[1] + 58, g = pivot("ord" + i, gx, gy), f = P.food[i];
    mk("ord" + i + "B", "bubble", c[0] - gx, gy - c[1], c[2], { parent: g, rel: 1, z: 2 });
    mk("ord" + i + "F", f[0], f[1] - gx, gy - f[2], f[3], { parent: g, rel: 1, z: 2.1 });
  });
  P.cld.forEach((c, i) => {                          // awan pikiran: butuh alat apa
    const g = pivot("cld" + i, c[6], c[7]), ip = .55;
    const [ix, iy] = [[7, 1], [-8, 9], [7, 5]][i]; // panci tepat di tengah bubble; lainnya koreksi pusat transparansi
    mk("cld" + i + "C", c[0], c[1] - c[6], c[7] - c[2], c[3], { parent: g, rel: 1, flip: c[4], z: 2 });
    mk("cld" + i + "I", c[5], c[1] - c[6] + ix, c[7] - c[2] + iy, ip, { parent: g, rel: 1, z: 2.1 });
  });

  const counterY = 330, counterH = 60, counterGeometry = new THREE.PlaneGeometry(GW, counterH);
  counterGeometry.attributes.uv.set([0, 1 - counterY / GH, 1, 1 - counterY / GH, 0, 1 - (counterY + counterH) / GH, 1, 1 - (counterY + counterH) / GH]);
  const counter = new THREE.Mesh(counterGeometry, bgMat);
  counter.position.set(GW / 2, GH - counterY - counterH / 2, 1.8);
  counter.renderOrder = 1.8;
  gscene.add(counter);

  mk("hg", "hourglass", ...P.badge, 1, { z: 3 });
  mk("wn", "warning", ...P.badge, 1, { z: 3 });
  mk("cyc", "cycle", ...P.cycle, { z: 3 });
  for (let i = 0; i < 27; i++) {                     // 3 jalur x 9 titik menunggu
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, color: PATHS[(i / 9) | 0][3], transparent: true, depthWrite: false }));
    m.renderOrder = 3; m.visible = false; gscene.add(m); dots.push(m);
  }
  ["boom", "boom", "boom", "boom", "spark", "spark", "spark", "debris", "debris"].forEach((n, i) => {
    fx.push({ m: mk("fx" + i, n, 0, 0, 1, { z: 5 }), n, age: 0, life: 1, on: false });
  });
  game.querySelectorAll("[data-ico]").forEach((el) => {   // ikon layar analisis (CSS sprite)
    const [x, y, w, h] = ATLAS[el.dataset.ico].r;
    el.classList.add("ico", "ico2"); el.style.cssText = `--x:${x};--y:${y};--w:${w};--h:${h}`;
  });
  built = true;
}
function fit() {                                     // "contain": seluruh adegan selalu terlihat
  const w = innerWidth, h = innerHeight, s = Math.min(w / GW, h / GH), hw = w / s / 2, hh = h / s / 2;
  gr.setSize(w, h, false);
  Object.assign(gcam, { left: GW / 2 - hw, right: GW / 2 + hw, top: GH / 2 + hh, bottom: GH / 2 - hh });
  gcam.updateProjectionMatrix();
  if (S.bg) { S.bg.userData.sx = (gcam.right - gcam.left) / GW; S.bg.userData.sy = (gcam.top - gcam.bottom) / GH; }
}

/* ---------- helper timeline ---------- */
const say = (t) => { cap.textContent = t; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); };
const pop = (k, delay = 0, from = 0) => { const o = S[k]; o.visible = true; o.userData.k = from; tw(o.userData, "k", 1, .5, "back", delay); };
const swap = (a, b) => { S[a].visible = false; pop(b, 0, .6); };
const drop = (k) => { const o = S[k], u = o.userData; o.visible = true; u.oy = 250; u.a = 0; tw(u, "oy", 0, .8, "back"); tw(u, "a", 1, .25); };
const lit = (k) => { const o = S[k]; o.visible = true; o.userData.a = 0; tw(o.userData, "a", .8, .6); };

const TL = [
  [.3,   () => say("Mode Medium: tiga koki, tiga alat. Perhatikan siapa menunggu siapa.")],
  [1.2,  () => { pop("manC"); pop("pairC", .15); Sfx.beep(440, "triangle", .1); say("Tiga koki siap bekerja di dapur.")}],
  [3.0,  () => { [0, 1, 2].forEach((i) => pop("cust" + i, i * .15)); Sfx.confirm(); say("Tiga pelanggan datang dan memesan makanan.")}],
  [4.2,  () => { pop("ord0"); Sfx.beep(660, "square", .08); }],
  [4.8,  () => { pop("ord1"); Sfx.beep(700, "square", .08); }],
  [5.4,  () => { pop("ord2"); Sfx.beep(740, "square", .08); }],
  [7.0,  () => { drop("wok"); lit("gA"); Sfx.beep(220, "square", .12); say("Koki A mengambil Wajan dan memegangnya."); }],
  [9.0,  () => { lit("gB"); Sfx.beep(180, "square", .12); say("Koki B sudah memegang Kompor."); }],
  [11.0, () => { drop("pot"); lit("gC"); Sfx.beep(200, "square", .12); say("Koki C mengambil Panci dan memegangnya."); }],
  [13.2, () => { swap("manC", "manP"); swap("pairC", "pairP"); pop("cld0"); pop("cld1", .3); pop("cld2", .6); Sfx.beep(330, "sawtooth", .25); say("A butuh Kompor, B butuh Panci, C butuh Wajan. Tak ada yang mau melepas."); }],
  [16.5, () => { dotsOn = true; say("A menunggu B, B menunggu C, C menunggu A... berputar tanpa ujung."); }],
  [20.0, () => { pop("hg"); say("Waktu berjalan, ketiga pesanan tak kunjung jadi."); }],
  [24.0, () => { S.hg.visible = false; pop("wn"); angry = 1; tw(U("bg"), "tint", .35, 1.2, "io"); Sfx.alarm(); say("Pelanggan mulai kesal!"); }],
  [27.0, () => { S.wn.visible = false; pop("cyc"); tw(U("bg"), "tint", 1, 1, "io"); rumble = 2.5; fxOn = true; game.classList.add("dead"); Sfx.alarm(); say("DEADLOCK! Circular wait: tiga koki saling menunggu tanpa akhir."); }],
  [34.0, () => { ana.hidden = false; game.classList.add("done"); cap.classList.remove("show"); Sfx.confirm(); }]
];

/* ---------- animasi yang selalu jalan ---------- */
const SPOTS = [[1190, 135], [1105, 142], [70, 160], [40, 300], [1235, 330], [640, 70], [330, 95], [520, 470], [900, 330]];
const bez = (p, t) => { const a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; return [a * p[0][0] + b * p[1][0] + c * p[2][0], a * p[0][1] + b * p[1][1] + c * p[2][1]]; };
function animate(t, dt) {
  const A = AMP;
  [["manC", 0], ["pairC", 1]].forEach(([k, i]) => { const a = U(k); a.sy = 1 + Math.sin(t * 2.2 + i) * .01 * A; a.jx = Math.sin(t * 1.4 + i) * 1.2 * A; a.r = Math.sin(t * 1.4 + i) * .008 * A; });
  [["manP", 0], ["pairP", 1]].forEach(([k, i]) => { const p = U(k); p.sy = 1 + Math.sin(t * 9 + i) * .014 * A; p.jx = Math.sin(t * 38 + i * 2) * 1.8 * A; p.r = Math.sin(t * 7 + i) * .022 * A; });
  [0, 1, 2].forEach((i) => {
    const c = U("cust" + i); c.sy = 1 + Math.sin(t * 2.4 + i) * .012 * A;
    c.jx = angry ? Math.sin(t * 31 + i) * 1.6 * A : 0; if (angry) c.sy += Math.sin(t * 6 + i) * .02 * A;
    S["cust" + i].material.color.setRGB(1, 1 - .35 * angry * U("bg").tint, 1 - .4 * angry * U("bg").tint);     // wajah memerah saat kesal
    U("ord" + i).r = Math.sin(t * 3 + i * 2) * (angry ? .05 : .018) * A;
    U("cld" + i).jy = Math.sin(t * 2 + i * 1.7) * 4 * A;
  });
  const h = U("hg"), f = Math.min(1, (t % 2.4) / .6);                       // jam pasir terbalik tiap 2,4 dtk
  h.r = Math.PI * (Math.floor(t / 2.4) + E.io(f)); h.sx = h.sy = 1 + Math.sin(t * 4) * .04;
  const w = U("wn"); w.r = Math.sin(t * 10) * .06 * A; w.sx = w.sy = 1 + Math.abs(Math.sin(t * 5)) * .1;
  const c = U("cyc"); c.r = -t * .7; c.sx = c.sy = 1 + Math.sin(t * 3) * .05;
  ["gA", "gB", "gC"].forEach((k, i) => { U(k).sx = U(k).sy = 1 + Math.sin(t * 3 + i) * .1; });

  dots.forEach((m, i) => {                           // 3 garis titik berputar, memudar sebelum sampai
    m.visible = dotsOn; if (!dotsOn) return;
    const pa = PATHS[(i / 9) | 0], fr = (t * .32 + (i % 9) / 9) % 1, [x, y] = bez(pa, fr);
    m.position.set(x, GH - y + Math.sin(t * 5 + i) * 2, 3);
    m.scale.setScalar(Math.max(2, 20 * (1 - Math.max(0, (fr - .8) / .2))));
    m.material.opacity = Math.min(1, fr * 6);
  });

  if (fxOn && (fxT -= dt) <= 0) {                    // ledakan acak setelah deadlock
    fxT = rnd(.2, .5);
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

  const tn = U("bg").tint; bgMat.color.setRGB(1 - .38 * tn, 1 - .55 * tn, 1 - .55 * tn);                    // latar memerah
  const amp = rumble * A; gcam.position.set(rnd(-1, 1) * amp, rnd(-1, 1) * amp, 10);                        // layar bergetar
}

/* ---------- kontrol ---------- */
function reset() {
  tweens.length = 0; T = 0; ei = 0; dotsOn = false; fxOn = false; fxT = 0; rumble = 0; angry = 0;
  game.classList.remove("dead", "done"); ana.hidden = true; cap.classList.remove("show");
  for (const k in S) {
    const o = S[k]; Object.assign(o.userData, { ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
    if (k !== "bg" && o.parent === gscene) o.visible = false;   // anak (bubble/awan) ikut grup induknya
  }
  U("bg").tint = 0; ["gA", "gB", "gC"].forEach((k) => { U(k).a = 0; }); fx.forEach((q) => { q.on = false; });
  clock.getDelta(); fit();
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
  running = false; cancelAnimationFrame(raf); game.hidden = true; setMode("level");
}
window.startGame2 = start;

$("game2-exit").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game2-menu").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game2-replay").addEventListener("click", () => { Sfx.confirm(); reset(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !game.hidden) stop(); });
})();
