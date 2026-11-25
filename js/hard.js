"use strict";
/* ============================================================
   Gameplay Hard: 4 koki, 4 alat dapur + pop-up keputusan
   ("Apakah kamu akan memberikan barang ini ke koki lain?" -> Berikan / Tunda)
   Memakai $, stage, Sfx, load, puffTex, rnd, AMP, setMode dari main.js
   ============================================================ */
(() => {
const GW = 1280, GH = 720, AW = 1400, AH = 705;
const ATLAS = {
  curry:     { r: [0, 633, 92, 70],     a: [46.0, 35.0] },
  cycle:     { r: [0, 0, 330, 339],     a: [165.0, 169.5] },
  hourglass: { r: [378, 341, 162, 150], a: [81.0, 75.0] },
  warning:   { r: [542, 341, 162, 150], a: [81.0, 75.0] },
  bubble:    { r: [409, 500, 167, 118], a: [83.5, 59.0] },
  boom:      { r: [578, 500, 114, 112], a: [57.0, 56.0] },
  debris:    { r: [1100, 500, 177, 93], a: [88.5, 46.5] },
  spark:     { r: [230, 633, 47, 47],   a: [23.5, 23.5] },
  wok:       { r: [694, 500, 144, 104], a: [72.0, 52.0] },
  stove:     { r: [840, 500, 144, 104], a: [72.0, 52.0] },
  pot:       { r: [226, 341, 150, 151], a: [75.0, 75.5] },
  ramen:     { r: [986, 500, 112, 102], a: [56.0, 51.0] },
  chicken:   { r: [1279, 500, 103, 93], a: [51.5, 46.5] },
  cloudA:    { r: [630, 0, 266, 198],   a: [133.0, 99.0] },
  cloudB:    { r: [332, 0, 296, 221],   a: [148.0, 110.5] },
  cloudC:    { r: [898, 0, 266, 198],   a: [133.0, 99.0] }
};

const game = $("game3"), cap = $("game3-cap"), ana = $("ana3"), gcv = $("game3-canvas");
const popup = $("hard-popup"), btnGive = $("btn-berikan"), btnDelay = $("btn-tunda");

let gr, gscene, gcam, atlasTex, bgMat, built = false, running = false, paused = false, raf = 0;
let T = 0, ei = 0, dotsOn = false, fxOn = false, fxT = 0, rumble = 0, angry = 0, panicMode = false;
let branchT = 0, branchMode = null, branchStep = 0;
const S = {}, tweens = [], dots = [], fx = [], clock = new THREE.Clock();
const U = (k) => S[k].userData;

/* ---------- tween mini ---------- */
const E = {
  out: (p) => 1 - (1 - p) ** 3,
  io: (p) => p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2,
  back: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2
};
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

/* ---------- pembersih background putih & sprite prosedural cadangan ---------- */
function loadSpritePng(src, fallbackDraw) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
      const w = c.width, h = c.height, vis = new Uint8Array(w * h);
      const isWhite = (idx) => d[idx] > 238 && d[idx + 1] > 238 && d[idx + 2] > 238;
      const q = [];
      for (let x = 0; x < w; x++) { q.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y++) { q.push(y * w, y * w + (w - 1)); }
      while (q.length) {
        const p = q.pop();
        if (vis[p]) continue;
        vis[p] = 1;
        const i = p * 4;
        if (!isWhite(i)) continue;
        d[i + 3] = 0;
        const x = p % w, y = (p / w) | 0;
        if (x > 0) q.push(p - 1);
        if (x < w - 1) q.push(p + 1);
        if (y > 0) q.push(p - w);
        if (y < h - 1) q.push(p + w);
      }
      g.putImageData(id, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      resolve({ tex, w, h });
    };
    img.onerror = () => resolve(fallbackDraw());
    img.src = src;
  });
}

function makePixelTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return { tex, w, h };
}

function drawBackChef(shirt, hair, hat, wide = 0) {
  return makePixelTex(96, 128, (g) => {
    const cx = 48, bw = wide ? 54 : 42;
    g.fillStyle = "#1b1412";
    g.fillRect(cx - bw / 2 - 4, 48, bw + 8, 52);
    g.fillRect(cx - 18, 98, 14, 24);
    g.fillRect(cx + 4, 98, 14, 24);
    g.fillStyle = shirt;
    g.fillRect(cx - bw / 2, 52, bw, 44);
    g.fillStyle = "#e8ecef";
    g.fillRect(cx - 16, 80, 32, 18); // celemek belakang
    g.fillStyle = "#4b5563";
    g.fillRect(cx - 14, 98, 10, 20);
    g.fillRect(cx + 4, 98, 10, 20);
    // kepala belakang
    g.fillStyle = "#1b1412";
    g.fillRect(cx - 20, 22, 40, 32);
    g.fillStyle = hair;
    g.fillRect(cx - 16, 26, 32, 26);
    if (hat) {
      g.fillStyle = "#1b1412";
      g.fillRect(cx - 24, 4, 48, 24);
      g.fillStyle = "#ffffff";
      g.fillRect(cx - 20, 8, 40, 18);
    }
  });
}

function drawFrontCust(shirt, tie, hair) {
  return makePixelTex(84, 112, (g) => {
    const cx = 42;
    g.fillStyle = "#1b1412";
    g.fillRect(cx - 22, 12, 44, 42);
    g.fillRect(cx - 18, 54, 36, 44);
    g.fillStyle = hair;
    g.fillRect(cx - 18, 16, 36, 20);
    g.fillStyle = "#f4c29f";
    g.fillRect(cx - 14, 28, 28, 22);
    g.fillStyle = "#1b1412";
    g.fillRect(cx - 9, 35, 4, 5);
    g.fillRect(cx + 5, 35, 4, 5);
    g.fillStyle = shirt;
    g.fillRect(cx - 14, 56, 28, 36);
    g.fillStyle = tie;
    g.fillRect(cx - 2, 58, 4, 18);
  });
}

function drawBoardFallback() {
  return makePixelTex(110, 84, (g) => {
    g.fillStyle = "#2b160c"; g.fillRect(14, 22, 74, 46);
    g.fillStyle = "#c86d32"; g.fillRect(18, 26, 66, 38);
    g.fillStyle = "#d1d5db"; g.fillRect(36, 18, 40, 14);
    g.fillStyle = "#4b2c20"; g.fillRect(72, 30, 22, 10);
  });
}

/* ---------- pembuat sprite Three.js ---------- */
function uvQuad(name) {
  const { r: [x, y, w, h], a: [ax, ay] } = ATLAS[name], g = new THREE.PlaneGeometry(1, 1);
  const u0 = x / AW, u1 = (x + w) / AW, v1 = 1 - y / AH, v0 = 1 - (y + h) / AH;
  g.attributes.uv.set([u0, v1, u1, v1, u0, v0, u1, v0]);
  g.translate(.5 - ax / w, ay / h - .5, 0);
  return g;
}
function mk(key, name, x, y, s = 1, o = {}) {
  const [, , w, h] = ATLAS[name].r;
  const m = new THREE.Mesh(uvQuad(name), new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false }));
  m.renderOrder = o.z || 1; m.position.z = o.z || 1;
  Object.assign(m.userData, { bx: x, by: o.rel ? y : GH - y, w: w * s, h: h * s, fx: o.flip ? -1 : 1, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  (o.parent || gscene).add(m); S[key] = m; return m;
}
function mkTex(key, info, x, y, s = 1, o = {}) {
  const g = new THREE.PlaneGeometry(1, 1);
  if (o.bottom) g.translate(0, .5, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: info.tex, transparent: true, depthWrite: false }));
  m.renderOrder = o.z || 1; m.position.z = o.z || 1;
  Object.assign(m.userData, { bx: x, by: o.rel ? y : GH - y, w: info.w * s, h: info.h * s, fx: o.flip ? -1 : 1, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  (o.parent || gscene).add(m); S[key] = m; return m;
}
function pivot(key, x, y, z = 2) {
  const g = new THREE.Object3D(); g.position.z = z;
  Object.assign(g.userData, { bx: x, by: GH - y, group: true, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
  gscene.add(g); S[key] = g; return g;
}
function glow(key, x, y, size, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.renderOrder = m.position.z = 1.3;
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

/* ---------- posisi desain 1280x720 (sesuai Hard 4, Hard 18, Hard 19) ---------- */
const P = {
  // 4 koki tampak belakang di depan meja dapur:
  // chef0 (putih - Talenan), chef1 (oranye - Kompor), chef2 (teal kuncir - Panci), chef3 (teal hijab - Wajan)
  chefs: [[190, 672], [400, 672], [820, 672], [1000, 672]],
  // 4 pelanggan di belakang meja oranye
  custs: [[190, 445], [400, 445], [820, 445], [1000, 445]],
  // bubble pesanan pelanggan
  bubs: [[190, 300, .78], [400, 300, .78], [820, 300, .78], [1000, 300, .78]],
  // posisi alat di atas meja dapur
  board: [190, 495], stove: [400, 495], pot: [820, 492], wok: [950, 492],
  // awan pikiran: chef0 butuh Kompor, chef1 butuh Panci, chef2 butuh Wajan, chef3 butuh Talenan
  clds: [
    ["cloudA", 130, 485, .52, 1, "stove", 190, 545],
    ["cloudB", 340, 485, .52, 1, "pot",   400, 545],
    ["cloudC", 760, 485, .52, 1, "wok",   820, 545],
    ["cloudA", 940, 485, .52, 1, "board", 1000, 545]
  ],
  badge: [1110, 140], cycle: [1000, 140, .42]
};

// 4 jalur circular wait: Koki 4->Kompor, Koki 1->Panci, Koki 2->Wajan, Koki 3->Talenan
const PATHS = [
  [[190, 555], [295, 430], [400, 500], 0xf08a2e],
  [[400, 555], [610, 430], [820, 500], 0x27c4c9],
  [[820, 555], [910, 430], [1000, 500], 0xe0507a],
  [[1000, 595], [600, 665], [190, 515], 0xf5b82e]
];

/* ---------- bangun scene (sekali) ---------- */
async function build() {
  const [bg, atlas, boardInfo, chef0Info, chef1Info, chef2Info, chef3Info, cust0Info, cust1Info, food7, food8, food9, food10] = await Promise.all([
    load("assets/Gemini_Generated_Image_i22aqji22aqji22a 1.png"),
    load("assets/medium-atlas.png"),
    loadSpritePng("assets/Alat Dapur.png", drawBoardFallback),
    loadSpritePng("assets/Koki Tampak Belakang.png", () => drawBackChef("#f3ead8", "#5c3a21", 0, 1)),
    loadSpritePng("assets/Koki Tampak Belakang (1).png", () => drawBackChef("#f06a24", "#1b1412", 1, 0)),
    loadSpritePng("assets/Koki Tampak Belakang (2).png", () => drawBackChef("#1d8a8a", "#1b1412", 1, 0)),
    loadSpritePng("assets/Koki Tampak Belakang (3).png", () => drawBackChef("#1d8a8a", "#0f4c5c", 1, 0)),
    loadSpritePng("assets/Pelanggan.png", () => drawFrontCust("#1f7a6e", "#d97706", "#2b1b14")),
    loadSpritePng("assets/Pelanggan (1).png", () => drawFrontCust("#fef3c7", "#0d9488", "#2b1b14")),
    load("assets/Makanan Enak 7.png"),
    load("assets/Makanan Enak 8.png"),
    load("assets/Makanan Enak 9.png"),
    load("assets/Makanan Enak 10.png")
  ]);

  atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.needsUpdate = true;
  atlasTex = atlas;
  const foodInfos = [food7, food8, food9, food10].map((tex) => {
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return { tex, w: tex.image.width, h: tex.image.height };
  });

  gr = new THREE.WebGLRenderer({ canvas: gcv, antialias: true });
  gr.setPixelRatio(Math.min(devicePixelRatio, 2));
  gr.setClearColor(0x1a1210);
  gscene = new THREE.Scene();
  gcam = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 20);
  gcam.position.z = 10;
  addEventListener("resize", fit);

  bgMat = new THREE.MeshBasicMaterial({ map: bg });
  const b = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), bgMat);
  Object.assign(b.userData, { bx: GW / 2, by: GH / 2, group: true, ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0, tint: 0 });
  gscene.add(b); S.bg = b;
  fit();

  // 4 pelanggan di belakang meja oranye (z = 1.0)
  const custInfos = [
    { info: cust0Info, s: 1.28 },
    { info: cust1Info, s: 1.28 },
    { info: cust0Info, s: 1.28 },
    { info: cust1Info, s: 1.28 }
  ];
  custInfos.forEach((c, i) => mkTex("cust" + i, c.info, P.custs[i][0], P.custs[i][1], c.s, { bottom: 1, z: 1.0 }));

  // Potongan meja oranye di depan pelanggan (z = 1.2) agar kaki pelanggan tertutup meja
  const counterY = 422, counterH = 44, counterGeo = new THREE.PlaneGeometry(GW, counterH);
  counterGeo.attributes.uv.set([
    0, 1 - counterY / GH,
    1, 1 - counterY / GH,
    0, 1 - (counterY + counterH) / GH,
    1, 1 - (counterY + counterH) / GH
  ]);
  const counter = new THREE.Mesh(counterGeo, bgMat);
  counter.position.set(GW / 2, GH - counterY - counterH / 2, 1.2);
  counter.renderOrder = 1.2;
  gscene.add(counter);

  // 4 alat dapur di meja kerja (z = 1.4) + cahaya indikator tiap alat
  glow("g0", P.board[0], P.board[1], 190, 0xf5b82e);
  glow("g1", P.stove[0], P.stove[1], 220, 0xf08a2e);
  glow("g2", P.pot[0], P.pot[1], 190, 0x27c4c9);
  glow("g3", P.wok[0], P.wok[1], 190, 0xe0507a);

  // 4 koki tampak belakang di depan meja kerja (z = 1.6)
  const chefInfos = [
    { info: chef0Info, s: 1.12 },
    { info: chef1Info, s: 1.12 },
    { info: chef2Info, s: 1.12 },
    { info: chef3Info, s: 1.12 }
  ];
  chefInfos.forEach((c, i) => mkTex("chef" + i, c.info, P.chefs[i][0], P.chefs[i][1], c.s, { bottom: 1, z: 1.6 }));

  // Bubble pesanan 4 pelanggan (z = 2.0)
  P.bubs.forEach((c, i) => {
    const gx = c[0] - 24, gy = c[1] + 50, g = pivot("ord" + i, gx, gy, 2.0);
    mk("ord" + i + "B", "bubble", c[0] - gx, gy - c[1], c[2], { parent: g, rel: 1, z: 2.0 });
    mkTex("ord" + i + "F", foodInfos[i], c[0] - gx, gy - c[1] + 6, 1.4, { parent: g, rel: 1, z: 2.1 });
  });

  // Awan pikiran 4 koki (z = 2.1)
  P.clds.forEach((c, i) => {
    const g = pivot("cld" + i, c[6], c[7], 2.1);
    mk("cld" + i + "C", c[0], c[1] - c[6], c[7] - c[2], c[3], { parent: g, rel: 1, flip: c[4], z: 2.1 });
    if (c[5] === "board") {
      mkTex("cld" + i + "I", boardInfo, c[1] - c[6], c[7] - c[2] + 4, .4, { parent: g, rel: 1, z: 2.2 });
    } else {
      mk("cld" + i + "I", c[5], c[1] - c[6], c[7] - c[2] + 4, .4, { parent: g, rel: 1, z: 2.2 });
    }
  });

  // Ikon status & efek ledakan
  mk("hg", "hourglass", ...P.badge, .92, { z: 3 });
  mk("wn", "warning", ...P.badge, .92, { z: 3 });
  mk("cyc", "cycle", P.cycle[0], P.cycle[1], P.cycle[2], { z: 3 });

  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: puffTex, color: PATHS[(i / 9) | 0][3], transparent: true, depthWrite: false })
    );
    m.renderOrder = 3; m.visible = false; gscene.add(m); dots.push(m);
  }
  ["boom", "boom", "boom", "boom", "spark", "spark", "spark", "debris", "debris"].forEach((n, i) => {
    fx.push({ m: mk("fx" + i, n, 0, 0, 1, { z: 5 }), n, age: 0, life: 1, on: false });
  });

  built = true;
}

function fit() {
  const w = innerWidth, h = innerHeight, s = Math.min(w / GW, h / GH), hw = w / s / 2, hh = h / s / 2;
  gr.setSize(w, h, false);
  Object.assign(gcam, { left: GW / 2 - hw, right: GW / 2 + hw, top: GH / 2 + hh, bottom: GH / 2 - hh });
  gcam.updateProjectionMatrix();
  if (S.bg) {
    S.bg.userData.sx = (gcam.right - gcam.left) / GW;
    S.bg.userData.sy = (gcam.top - gcam.bottom) / GH;
  }
}

/* ---------- helper timeline & pop-up ---------- */
const say = (t) => { cap.textContent = t; cap.classList.remove("show"); void cap.offsetWidth; cap.classList.add("show"); };
const pop = (k, delay = 0, from = 0) => { const o = S[k]; o.visible = true; o.userData.k = from; tw(o.userData, "k", 1, .5, "back", delay); };
const lit = (k) => { const o = S[k]; o.visible = true; o.userData.a = 0; tw(o.userData, "a", .85, .5); };

function openChoicePopup() {
  paused = true;
  popup.hidden = false;
  Sfx.alarm();
  btnGive.focus();
}

function handleChoice(mode) {
  popup.hidden = true;
  paused = false;
  branchMode = mode;
  branchT = 0;
  branchStep = 0;

  if (mode === "berikan") {
    Sfx.confirm();
    dotsOn = false;
    panicMode = false;
    [0, 1, 2, 3].forEach((i) => { S["cld" + i].visible = false; });
    // Geser kompor/energi alat ke koki yang mengantre sebagai simbol pelepasan resource
    tw(U("g1"), "bx", P.chefs[0][0], .9, "io");
    tw(U("g1"), "by", GH - P.chefs[0][1] + 90, .9, "io");
    say("Alat diberikan! Koki melepas alatnya agar koki lain bisa memasak.");
  } else {
    Sfx.alarm();
    say("Ditunda! Semua koki tetap menahan alatnya masing-masing...");
  }
}

const TL = [
  [.3,  () => say("Mode Hard: empat koki, empat alat dapur. Dapur penuh tekanan!")],
  [1.2, () => { [0, 1, 2, 3].forEach((i) => pop("chef" + i, i * .12)); Sfx.beep(440, "triangle", .1); say("Empat koki bersiap di depan meja dapur."); }],
  [3.0, () => { [0, 1, 2, 3].forEach((i) => pop("cust" + i, i * .12)); Sfx.confirm(); say("Empat pelanggan datang membawa pesanan berbeda."); }],
  [4.3, () => { pop("ord0"); pop("ord1", .2); pop("ord2", .4); pop("ord3", .6); Sfx.beep(680, "square", .08); }],
  [6.2, () => { lit("g0"); Sfx.beep(220, "square", .1); say("Koki 4 mengambil Talenan & Pisau."); }],
  [7.6, () => { lit("g1"); Sfx.beep(200, "square", .1); say("Koki 1 memegang Kompor utama."); }],
  [9.0, () => { lit("g2"); Sfx.beep(240, "square", .1); say("Koki 2 memegang Panci."); }],
  [10.4,() => { lit("g3"); Sfx.beep(260, "square", .1); say("Koki 3 memegang Wajan."); }],
  [12.2,() => {
    panicMode = true;
    [0, 1, 2, 3].forEach((i) => pop("cld" + i, i * .2));
    Sfx.beep(330, "sawtooth", .22);
    say("Semua koki butuh alat yang sedang dipakai koki lain!");
  }],
  [14.4,() => { dotsOn = true; say("Antrean 4 arah saling mengunci! Keputusanmu menentukan nasib dapur."); }],
  [16.2,() => openChoicePopup()]
];

/* ---------- kelanjutan timeline setelah pemain memilih ---------- */
function stepBranch(dt) {
  if (!branchMode) return;
  branchT += dt;

  if (branchMode === "berikan") {
    if (branchStep === 0 && branchT >= 2.2) {
      branchStep = 1;
      Sfx.confirm();
      [0, 1, 2, 3].forEach((i) => {
        tw(U("ord" + i), "k", 1.15, .3, "back");
        tw(U("ord" + i), "k", 1.0, .3, "out", .3);
      });
      say("Siklus terputus! Satu per satu pesanan selesai disajikan.");
    }
    if (branchStep === 1 && branchT >= 5.2) {
      branchStep = 2;
      $("ana3-title").textContent = "Deadlock Berhasil Dicegah! (Preemption)";
      $("ana3-desc").textContent = "Dengan memilih 'Berikan', koki melepas alat yang dipegangnya sehingga syarat Hold & Wait dan Circular Wait terputus.";
      ana.hidden = false;
      game.classList.add("done");
      cap.classList.remove("show");
      Sfx.confirm();
    }
  } else if (branchMode === "tunda") {
    if (branchStep === 0 && branchT >= 1.2) {
      branchStep = 1;
      pop("hg");
      say("Waktu terus berjalan, tidak ada koki yang mau mengalah.");
    }
    if (branchStep === 1 && branchT >= 3.6) {
      branchStep = 2;
      S.hg.visible = false;
      pop("wn");
      angry = 1;
      tw(U("bg"), "tint", .4, 1.0, "io");
      Sfx.alarm();
      say("Pelanggan mulai marah karena pesanan tak kunjung datang!");
    }
    if (branchStep === 2 && branchT >= 6.0) {
      branchStep = 3;
      S.wn.visible = false;
      pop("cyc");
      tw(U("bg"), "tint", 1, .9, "io");
      rumble = 2.8;
      fxOn = true;
      game.classList.add("dead");
      Sfx.alarm();
      say("DEADLOCK! 4 koki terjebak Circular Wait tanpa jalan keluar.");
    }
    if (branchStep === 3 && branchT >= 11.5) {
      branchStep = 4;
      $("ana3-title").textContent = "Deadlock Terjadi! (Circular Wait 4 Arah)";
      $("ana3-desc").textContent = "Karena memilih 'Tunda', keempat koki mempertahankan alat masing-masing (Hold & Wait) hingga seluruh dapur macet total.";
      ana.hidden = false;
      game.classList.add("done");
      cap.classList.remove("show");
      Sfx.confirm();
    }
  }
}

/* ---------- animasi tiap frame ---------- */
const SPOTS = [[1180, 140], [1080, 150], [90, 160], [60, 310], [1220, 340], [640, 80], [320, 110], [500, 480], [880, 340]];
const bez = (p, t) => {
  const a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0], a * p[0][1] + b * p[1][1] + c * p[2][1]];
};

function animate(t, dt) {
  const A = AMP;
  [0, 1, 2, 3].forEach((i) => {
    const ch = U("chef" + i);
    if (panicMode) {
      ch.sy = 1 + Math.sin(t * 10 + i) * .018 * A;
      ch.jx = Math.sin(t * 36 + i * 2) * 2.2 * A;
      ch.r = Math.sin(t * 8 + i) * .025 * A;
    } else {
      ch.sy = 1 + Math.sin(t * 2.4 + i) * .01 * A;
      ch.jx = Math.sin(t * 1.5 + i) * 1.1 * A;
      ch.r = Math.sin(t * 1.5 + i) * .008 * A;
    }

    const cu = U("cust" + i);
    cu.sy = 1 + Math.sin(t * 2.5 + i) * .012 * A;
    cu.jx = angry ? Math.sin(t * 32 + i) * 1.8 * A : 0;
    S["cust" + i].material.color.setRGB(1, 1 - .35 * angry * U("bg").tint, 1 - .4 * angry * U("bg").tint);

    U("ord" + i).r = Math.sin(t * 3 + i * 1.7) * (angry ? .05 : .018) * A;
    U("cld" + i).jy = Math.sin(t * 2.2 + i * 1.5) * 4 * A;
    U("g" + i).sx = U("g" + i).sy = 1 + Math.sin(t * 3.2 + i) * .1;
  });

  const h = U("hg"), f = Math.min(1, (t % 2.2) / .55);
  h.r = Math.PI * (Math.floor(t / 2.2) + E.io(f));
  h.sx = h.sy = 1 + Math.sin(t * 4) * .04;

  const w = U("wn");
  w.r = Math.sin(t * 10) * .06 * A;
  w.sx = w.sy = 1 + Math.abs(Math.sin(t * 5)) * .1;

  const c = U("cyc");
  c.r = -t * .75;
  c.sx = c.sy = 1 + Math.sin(t * 3) * .05;

  dots.forEach((m, i) => {
    m.visible = dotsOn;
    if (!dotsOn) return;
    const pa = PATHS[(i / 9) | 0], fr = (t * .34 + (i % 9) / 9) % 1, [x, y] = bez(pa, fr);
    m.position.set(x, GH - y + Math.sin(t * 5 + i) * 2, 3);
    m.scale.setScalar(Math.max(2, 19 * (1 - Math.max(0, (fr - .8) / .2))));
    m.material.opacity = Math.min(1, fr * 6);
  });

  if (fxOn && (fxT -= dt) <= 0) {
    fxT = rnd(.2, .45);
    const [x, y] = SPOTS[Math.floor(rnd(0, SPOTS.length))];
    const n = ["boom", "spark", "debris"][Math.floor(rnd(0, 3))];
    const q = fx.find((v) => !v.on && v.n === n);
    if (q) {
      Object.assign(q, { on: true, age: 0, life: rnd(.6, 1) });
      Object.assign(q.m.userData, { bx: x, by: GH - y });
      q.m.visible = true;
      if (Math.random() < .5) Sfx.beep(rnd(60, 110), "sawtooth", .2);
    }
  }
  fx.forEach((q) => {
    if (!q.on) return;
    q.age += dt;
    const p = q.age / q.life, u = q.m.userData;
    if (p >= 1) { q.on = false; q.m.visible = false; return; }
    u.k = .4 + .9 * E.out(Math.min(1, p * 3));
    u.a = p < .55 ? 1 : 1 - (p - .55) / .45;
    u.oy = q.n === "debris" ? -p * 50 : 0;
  });

  const tn = U("bg").tint;
  bgMat.color.setRGB(1 - .38 * tn, 1 - .55 * tn, 1 - .55 * tn);
  const amp = rumble * A;
  gcam.position.set(rnd(-1, 1) * amp, rnd(-1, 1) * amp, 10);
}

/* ---------- kontrol ---------- */
function reset() {
  tweens.length = 0;
  T = 0; ei = 0; paused = false;
  dotsOn = false; fxOn = false; fxT = 0; rumble = 0; angry = 0; panicMode = false;
  branchMode = null; branchT = 0; branchStep = 0;

  game.classList.remove("dead", "done");
  ana.hidden = true;
  popup.hidden = true;
  cap.classList.remove("show");

  for (const k in S) {
    const o = S[k];
    Object.assign(o.userData, { ox: 0, oy: 0, k: 1, a: 1, sx: 1, sy: 1, r: 0, jx: 0, jy: 0 });
    if (k !== "bg" && o.parent === gscene) o.visible = false;
  }
  U("bg").tint = 0;
  Object.assign(U("g1"), { bx: P.stove[0], by: GH - P.stove[1] });
  [0, 1, 2, 3].forEach((i) => { U("g" + i).a = 0; });
  fx.forEach((q) => { q.on = false; });

  clock.getDelta();
  fit();
}

function frame() {
  if (!running) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);

  if (!paused) {
    T += dt;
    while (ei < TL.length && T >= TL[ei][0]) TL[ei++][1]();
    stepBranch(dt);
  }

  stepTweens(dt);
  animate(T || performance.now() * .001, dt);
  sync();
  gr.render(gscene, gcam);
}

async function start() {
  game.hidden = false;
  stage.dataset.mode = "game";
  if (!built) {
    try {
      await build();
    } catch (error) {
      console.error("Gagal memuat mode Hard:", error);
      cap.textContent = "Mode Hard gagal dimuat. Silakan muat ulang halaman.";
      cap.classList.add("show");
      return;
    }
  }
  reset();
  running = true;
  frame();
}

function stop() {
  running = false;
  paused = false;
  popup.hidden = true;
  cancelAnimationFrame(raf);
  game.hidden = true;
  setMode("level");
}

window.startGame3 = start;

btnGive.addEventListener("click", () => handleChoice("berikan"));
btnDelay.addEventListener("click", () => handleChoice("tunda"));
$("game3-exit").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game3-menu").addEventListener("click", () => { Sfx.confirm(); stop(); });
$("game3-replay").addEventListener("click", () => { Sfx.confirm(); reset(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !game.hidden) stop(); });
})();