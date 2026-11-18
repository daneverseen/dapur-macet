"use strict";

/* ============================================================
   1. Util & audio 8-bit
   ============================================================ */
const $ = (id) => document.getElementById(id);
const stage = $("stage");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AMP = reduceMotion ? .3 : 1;                 // pengali amplitudo animasi

const Sfx = (() => {
  let ctx = null, vol = .5, last = .5;               // vol 0..1, diatur dari Pengaturan > Suara
  const getCtx = () => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const beep = (f, type = "square", dur = .08, at = 0) => {
    if (vol <= 0) return;
    try {
      const c = getCtx(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.24 * vol, t); g.gain.exponentialRampToValueAtTime(.002, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* audio diblokir browser */ }
  };
  return {
    beep, ctx: getCtx,
    get volume() { return vol; },
    setVolume(v) { vol = v; if (v > 0) last = v; },
    confirm() { beep(330, "triangle", .06); beep(660, "square", .1, .06); },
    alarm() { beep(520, "square", .09); beep(390, "square", .09, .1); beep(520, "square", .09, .2); },
    toggle() { vol = vol > 0 ? 0 : last; return vol > 0; }
  };
})();

/* ============================================================
   2. UI: menu, layar level, modal
   ============================================================ */
const LEVELS = {
  Easy: "Pelanggan sabar dan bahan melimpah. Pas untuk belajar dasar deadlock.",
  Medium: "Pesanan makin banyak dan bahan terbatas. Awas antrean saling menunggu!",
  Hard: "Dapur penuh sesak dan waktu mepet. Satu salah urut, semuanya macet!"
};
const SCREENS = {
  tutorial: { title: "Cara Bermain", html: `
    <ul>
      <li><b>Ambil bahan:</b> klik dispenser mie &amp; kuah kaldu.</li>
      <li><b>Masak:</b> rebus hingga indikator hijau menyala.</li>
      <li><b>Topping:</b> beri telur mata sapi dan irisan daun bawang.</li>
      <li><b>Sajikan:</b> antar ke meja sebelum pengunjung marah!</li>
    </ul>` },
  settings: { title: "Pengaturan Game", html: `
    <div class="row"><span>Resolusi</span><b>Auto (layar penuh)</b></div>
    <div class="row"><span>Bahasa</span><b>Indonesia</b></div>
    <div class="row"><span>Filter grafis</span><b>Retro Crisp</b></div>` }
};

const modal = $("modal");
const openModal = (title, html) => {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html;
  modal.classList.add("open");
  $("modal-close").focus();
};
const closeModal = () => { Sfx.beep(280, "triangle", .05); modal.classList.remove("open"); };

let setPanic = () => {};                           // diisi oleh scene Three.js
const setMode = (m) => {
  stage.dataset.mode = m;
  $("menu-main").hidden = m !== "menu";
  $("menu-level").hidden = m !== "level";
  setPanic(m === "level");
};

document.querySelectorAll("button[data-action]").forEach((b) => b.addEventListener("click", () => {
  const a = b.dataset.action;
  if (a === "play") { Sfx.alarm(); setMode("level"); return; }
  Sfx.confirm();
  if (a === "back") setMode("menu");
  else openModal(SCREENS[a].title, SCREENS[a].html);
}));
document.querySelectorAll("button[data-level]").forEach((b) => b.addEventListener("click", () => {
  const l = b.dataset.level;
  Sfx.confirm();
  if (l === "Easy") { startGame(); return; }
  if (l === "Medium") { startGame2(); return; }
  openModal("Mode " + l, `<p style="text-align:center">${LEVELS[l]}</p><p style="text-align:center">Segera hadir…</p>`);
}));
document.querySelectorAll(".btn").forEach((b) => b.addEventListener("mouseenter", () => Sfx.beep(520, "square", .04)));
$("modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (modal.classList.contains("open")) closeModal(); else if (stage.dataset.mode === "level") setMode("menu");
});

$("sfx").addEventListener("click", (e) => {
  const on = Sfx.toggle();
  e.currentTarget.textContent = on ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  e.currentTarget.setAttribute("aria-pressed", on);
  if (on) Sfx.confirm();
});

const root = document.documentElement, fsBtn = $("fs");
const reqFs = root.requestFullscreen || root.webkitRequestFullscreen;
if (reqFs) {
  fsBtn.hidden = false;
  fsBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen(); else reqFs.call(root);
  });
}

/* ============================================================
   3. Loading screen: logo pop + berdenyut, lalu masuk ke menu
   ============================================================ */
let sceneReadyResolve;
const sceneReady = new Promise((r) => { sceneReadyResolve = r; });
(() => {
  const loader = $("loader"), wash = $("wash");
  $("loader-logo").src = document.querySelector(".logo img").src;
  const minShow = new Promise((r) => setTimeout(r, reduceMotion ? 800 : 2600));
  const giveUp = new Promise((r) => setTimeout(r, 8000));
  Promise.race([Promise.all([sceneReady, minShow, document.fonts ? document.fonts.ready : 0]), giveUp]).then(() => {
    loader.classList.add("leave");
    setTimeout(() => loader.classList.add("out"), 350);
    setTimeout(() => { wash.classList.add("clear"); stage.classList.add("ready"); }, 600);
    setTimeout(() => { loader.remove(); wash.remove(); }, 1800);
  });
})();

/* ============================================================
   4. Scene Three.js: latar, 2 sprite koki (mesh di-warp), partikel
   ============================================================ */
const ASSETS = { bg: "assets/bg.webp", chef: "assets/chef.png", panic: "assets/chef-panic.png" };
const BG_W = 1376, BG_H = 768;
// aspect = lebar/tinggi sprite; bowl & head = titik 0..1 dari pojok kiri-atas sprite
const CHEF_A = { aspect: .6702, bowl: [.2657, .5963], head: [.5, .4] };
const CHEF_B = { aspect: .7301, bowl: [.79, .513], head: [.445, .427] };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
} catch (error) {
  console.warn("WebGL unavailable, using static fallback background.", error);
  stage.classList.add("fallback-bg");
}
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 20);   // satuan = piksel layar
cam.position.z = 10;

const texLoader = new THREE.TextureLoader();
const load = (src) => new Promise((ok, no) => texLoader.load(src, (t) => {
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; ok(t);
}, undefined, no));
const canvasTex = (draw) => {
  const c = document.createElement("canvas"); c.width = c.height = 64; draw(c.getContext("2d"));
  return new THREE.CanvasTexture(c);
};
const puffTex = canvasTex((g) => {
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, "rgba(255,252,245,.95)"); r.addColorStop(.5, "rgba(255,250,240,.45)"); r.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const dropTex = canvasTex((g) => {
  g.fillStyle = "#8fdcf5"; g.strokeStyle = "#2f7fa8"; g.lineWidth = 5; g.beginPath();
  g.moveTo(32, 4); g.quadraticCurveTo(58, 38, 46, 54); g.quadraticCurveTo(32, 64, 18, 54); g.quadraticCurveTo(6, 38, 32, 4);
  g.fill(); g.stroke();
});
const bitTex = canvasTex((g) => { g.fillStyle = "#fff"; g.fillRect(12, 12, 40, 40); });

const rnd = (a, b) => a + Math.random() * (b - a);

/* --- kolam partikel (sprite dipakai ulang) --- */
function makePool(n, tex, steam = false) {
  return Array.from({ length: n }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.position.z = 2; s.renderOrder = 3; scene.add(s);
    return { s, steam, on: false, age: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 1, freq: 0, ph: 0, wob: 0 };
  });
}
function spawn(pool, init) {
  const p = pool.find((q) => !q.on);
  if (p) { p.on = true; p.age = 0; init(p); }
}
function stepPool(pool, dt) {
  pool.forEach((p) => {
    if (!p.on) return;
    p.age += dt;
    if (p.age >= p.life) { p.on = false; p.s.material.opacity = 0; return; }
    const a = p.age / p.life;
    p.vy -= p.g * dt;
    p.x += (p.vx + (p.steam ? Math.sin(p.age * p.freq + p.ph) * p.wob : 0)) * dt;
    p.y += p.vy * dt;
    p.s.position.set(p.x, p.y, 2);
    if (p.steam) {                                   // asap: membesar lalu memudar
      p.s.scale.setScalar(p.size * (.5 + a * 1.4));
      p.s.material.opacity = Math.sin(Math.PI * a) * .55;
    } else {                                         // keringat / remah mie: jatuh lalu hilang
      p.s.scale.setScalar(p.size);
      p.s.material.opacity = a < .8 ? 1 : (1 - a) / .2;
    }
  });
}

Promise.all([load(ASSETS.bg), load(ASSETS.chef), load(ASSETS.panic)]).then(([bgT, aT, bT]) => {
  if (!renderer) {
    stage.classList.add("fallback-bg");
    sceneReadyResolve();
    return;
  }
  /* --- latar --- */
  const bgMat = new THREE.MeshBasicMaterial({ map: bgT });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  scene.add(bg);

  /* --- koki: plane tinggi 1 satuan, vertex digeser tiap frame --- */
  const makeChef = (tex, m) => {
    const geo = new THREE.PlaneGeometry(m.aspect, 1, 16, 26);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1; scene.add(mesh);
    return { m, geo, mat, mesh, base: Float32Array.from(geo.attributes.position.array), home: { x: 0, y: 0, h: 1 } };
  };
  const chefA = makeChef(aT, CHEF_A), chefB = makeChef(bT, CHEF_B);

  let hop = 0;                                       // 0..1 progres lompat
  const warp = (x, y, t, p) => {                     // p = tingkat panik 0..1
    const h = y + .5, f = 1 + p * 2.2;
    const sway = Math.sin(t * 1.4 * f) * .014 * (1 + p * 1.5) * h * h;
    const hat = h > .7 ? ((h - .7) / .3) ** 2 * Math.sin(t * 2.9 * f + 1) * .009 * (1 + p) : 0;
    const shake = p * Math.sin(t * 38 + y * 9) * .003 * h;
    const bowl = h > .1 && h < .5 ? Math.sin(t * 2.2 * f + .6) * .006 * (1 + p * 2) : 0;
    const k = Math.sin(t * 2.2 * f) * .012 * (1 + p) + (hop > 0 ? Math.sin(hop * Math.PI) * .05 : 0);
    return [x + (sway + hat + shake) * AMP, y + (h * k + bowl) * AMP];
  };

  /* --- layout responsif (landscape & portrait) --- */
  let W = 1, H = 1;
  const layout = () => {
    W = innerWidth; H = innerHeight;
    const portrait = W < H;
    renderer.setSize(W, H, false);
    cam.right = W; cam.top = H; cam.updateProjectionMatrix();
    const s = Math.max(W / BG_W, H / BG_H), bw = BG_W * s, bh = BG_H * s;   // "cover"
    bg.scale.set(bw, bh, 1);
    bg.position.set((W - bw) * (portrait ? .8 : 1) + bw / 2, H / 2, 0);
    [chefA, chefB].forEach((c) => {
      const h = portrait ? Math.min(H * .46, W * .95 / c.m.aspect) : H * .93, w = h * c.m.aspect;
      c.home = { h, x: portrait ? Math.min(W - w / 2 - W * .02, W * .6) : W - w / 2 - W * .01, y: h / 2 - h * .04 };
      c.mesh.scale.set(h, h, 1);
    });
  };
  addEventListener("resize", layout);
  layout();

  /* --- partikel --- */
  const steam = makePool(48, puffTex, true), drops = makePool(14, dropTex), bits = makePool(8, bitTex);
  const acc = { steam: 0, drop: 0, bit: 0 };
  let target = 0, p = 0, burst = 0;
  setPanic = (on) => { target = on ? 1 : 0; hop = .001; };

  /* --- klik / tap koki --- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), canvas = $("scene");
  const hit = (e) => {
    ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.intersectObject(p > .5 ? chefB.mesh : chefA.mesh).length > 0;
  };
  let bubbleTimer;
  const say = (txt) => {
    const b = $("bubble"); b.textContent = txt; b.classList.add("show");
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove("show"), 1600);
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (!hit(e) || hop > 0) return;
    hop = .001; burst = 1.2; Sfx.confirm();
    say(target ? "Aduh! Cepat pilih levelnya!" : "Mie gurih mantap!");
  });
  canvas.addEventListener("pointermove", (e) => { canvas.style.cursor = hit(e) ? "pointer" : "default"; });

  /* --- loop animasi --- */
  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
       if (stage.dataset.mode === "settings" || stage.dataset.mode === "game") { clock.getDelta(); return; }   // hemat baterai  // hemat baterai
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    p += (target - p) * Math.min(1, dt * 4);
    if (hop > 0) { hop += dt * 1.6; if (hop >= 1) hop = 0; }
    burst = Math.max(0, burst - dt);

    bgMat.color.setRGB(1 - .3 * p, 1 - .42 * p, 1 - .45 * p);     // latar menggelap saat panik

    [chefA, chefB].forEach((c, i) => {
      const o = i ? p : 1 - p;                                    // crossfade sprite normal ↔ panik
      c.mat.opacity = o; c.mesh.visible = o > .01;
      if (!c.mesh.visible) return;
      const bob = Math.abs(Math.sin(t * 1.1 * (1 + p))) * .006 * AMP + (hop > 0 ? Math.sin(hop * Math.PI) * .07 : 0);
      c.mesh.position.set(c.home.x, c.home.y + bob * c.home.h, 1);
      const pos = c.geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const w = warp(c.base[k * 3], c.base[k * 3 + 1], t, p);
        pos.setXY(k, w[0], w[1]);
      }
      pos.needsUpdate = true;
    });

    /* titik keluar partikel mengikuti gerakan koki */
    const c = p > .5 ? chefB : chefA, U = c.home.h, boost = 1 + burst * 2;
    const at = (a) => {
      const w = warp((a[0] - .5) * c.m.aspect, .5 - a[1], t, p);
      return [c.mesh.position.x + w[0] * U, c.mesh.position.y + w[1] * U];
    };

    acc.steam += dt * (11 + p * 5) * boost;
    while (acc.steam >= 1) {
      acc.steam--;
      const b = at(c.m.bowl);
      spawn(steam, (q) => {
        q.x = b[0] + rnd(-.05, .05) * U; q.y = b[1]; q.vx = 0; q.vy = rnd(.1, .16) * U; q.g = 0;
        q.life = rnd(2.6, 3.6); q.size = rnd(.07, .12) * U;
        q.freq = rnd(2, 4); q.ph = rnd(0, 6.28); q.wob = rnd(.03, .07) * U * AMP;
      });
    }
    if (p > .5) {
      acc.drop += dt * 5 * boost;                                  // keringat muncrat dari kepala
      while (acc.drop >= 1) {
        acc.drop--;
        const hd = at(c.m.head), dir = Math.random() < .5 ? -1 : 1;
        spawn(drops, (q) => {
          q.x = hd[0] + dir * rnd(.08, .16) * U; q.y = hd[1] + rnd(0, .08) * U;
          q.vx = dir * rnd(.15, .5) * U; q.vy = rnd(.25, .6) * U; q.g = 1.5 * U;
          q.life = rnd(.8, 1.3); q.size = rnd(.04, .06) * U;
        });
      }
      acc.bit += dt * 2 * boost;                                   // remah mie terlempar dari mangkok
      while (acc.bit >= 1) {
        acc.bit--;
        const b = at(c.m.bowl);
        spawn(bits, (q) => {
          q.x = b[0] + rnd(-.08, .02) * U; q.y = b[1] - .02 * U;
          q.vx = rnd(-.35, .1) * U; q.vy = rnd(.4, .8) * U; q.g = 1.6 * U;
          q.life = rnd(.9, 1.4); q.size = rnd(.018, .03) * U;
          q.s.material.color.setHex([0xf5a623, 0x6cbf3a, 0xe8472f][Math.floor(Math.random() * 3)]);
        });
      }
    }
    stepPool(steam, dt); stepPool(drops, dt); stepPool(bits, dt);

    renderer.render(scene, cam);
  })();

  sceneReadyResolve();
}).catch(() => sceneReadyResolve());                 // kalau aset gagal dimuat, UI tetap bisa dipakai