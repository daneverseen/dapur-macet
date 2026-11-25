"use strict";
/* Navigasi dan UI Medium. Aturan ada di medium-state.js; animasi lama di medium-match1.js. */
(() => {
  const R = window.MediumRules, shell = $("game2"), content = $("medium-content");
  const dialog = $("medium-dialog"), KEY = "dapurMacet.medium.v1";
  const chefImages = { A: "assets/match3/Koki Tampak Depan.png", B: "assets/medium/chef-hijab.png", C: "assets/medium/chef-woman.png" };
  const backImages = { A: "assets/medium/chef-man-back.png", B: "assets/Koki Tampak Belakang (3).png", C: "assets/Koki Tampak Belakang (2).png" };
  const toolImages = { wok: "assets/match3/Alat Dapur-1.png", stove: "assets/match3/Alat Dapur-2.png", pot: "assets/match3/Alat Dapur.png" };
  const titles = ["", "Tanpa Penanganan", "Bergantian Barang", "Cancel 1 Pelanggan"];
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pic = (src, cls = "", alt = "") => `<img src="${src}" class="${cls}" alt="${alt}">`;
  const rating = score => "★".repeat(R.stars(score)) + "☆".repeat(3 - R.stars(score));
  let view = "selector", state = null, currentMatch = 1, busy = false, timer, generation = 0;
  let closeAction = null, lastFocus = null, m1Finished = false, m1Wrong = 0;
  let results = readResults();

  function readResults() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY)), clean = {};
      for (const match of [1, 2, 3]) {
        const r = raw?.[match];
        if (!r || r.match !== match || !["won", "lost"].includes(r.status)) continue;
        if (![r.score, r.correct, r.wrong, r.served, r.cancelled].every(v => Number.isInteger(v) && v >= 0) || r.score > 100) continue;
        if (!Array.isArray(r.log)) continue;
        clean[match] = { ...r, stars: R.stars(r.score), log: r.log.filter(i => i && typeof i.text === "string" && ["info", "correct", "wrong"].includes(i.kind)).slice(-300) };
      }
      return clean;
    } catch (_) { return {}; }
  }
  function save(result) {
    results[result.match] = result;
    try { localStorage.setItem(KEY, JSON.stringify(results)); } catch (_) { /* Penyimpanan privat: hasil tetap tersedia selama sesi. */ }
  }
  function cleanup() {
    generation++; clearTimeout(timer); busy = false;
    window.MediumMatch1.halt();
    dialog.hidden = true; closeAction = null;
    $("ana2").hidden = true; $("medium-m1-controls").hidden = true;
    $("game2-cap").classList.remove("show"); shell.classList.remove("dead", "done");
  }
  function location(text) { $("medium-location").textContent = text; }
  function setView(next) {
    cleanup(); view = next;
    shell.dataset.view = next;
    $("game2-canvas").hidden = next !== "match1";
    content.hidden = next === "match1";
  }
  function focusContent() { content.querySelector("h1, h2")?.focus({ preventScroll: true }); }
  function status(r) { return !r ? "Belum dimainkan" : r.status === "won" ? "Berhasil · Siklus terputus" : "Gagal · Deadlock"; }
  function selector() {
    setView("selector"); location("Pilih match");
    content.innerHTML = `<div class="medium-heading"><span class="medium-eyebrow">TIGA MATCH · SATU DAPUR</span><h1 tabindex="-1">Putus rantai tunggunya!</h1><p>Amati deadlock, pinjamkan alat, lalu bandingkan dengan membatalkan satu pesanan.</p></div>
      <div class="medium-match-cards">${[1, 2, 3].map(match => {
        const r = results[match];
        return `<article class="medium-match-card"><div class="medium-card-art">${pic(`assets/${match === 1 ? "medium-preview.png" : `match${match}/Medium ${match === 2 ? "14" : "24"}.png`}`)}<span>MATCH ${match}</span></div><div class="medium-card-copy"><h2>${titles[match]}</h2><p>${["", "Tiga koki menahan alat. Apakah menunggu saja cukup?", "Pinjamkan Kompor ke Cowo, lalu gunakan alat secara bergantian.", "Pilih satu korban dengan biaya terendah. Selamatkan dua pesanan lain."][match]}</p><div class="medium-card-status">${status(r)}${r ? `<b>${match === 1 ? "0 / 3 terlayani" : `${r.score}/100 · ${rating(r.score)}`}</b>` : ""}</div><button class="btn" data-play="${match}">${r ? "Ulangi" : "Mulai"} Match ${match} →</button></div></article>`;
      }).join("")}</div><p class="medium-save-note">Hasil percobaan terakhir disimpan di browser ini. Kamu boleh memilih atau mengulang match mana pun.</p>`;
    focusContent();
  }
  function showDialog(title, html, { ok = true, icon = ok ? "✓" : "!", button = "Lanjutkan", after = null, settings = false } = {}) {
    lastFocus = document.activeElement;
    window.MediumMatch1.pause(true);
    $("medium-dialog-title").textContent = title;
    $("medium-dialog-copy").innerHTML = html;
    $("medium-dialog-icon").textContent = icon;
    dialog.dataset.tone = ok ? "correct" : "wrong";
    $("medium-dialog-actions").innerHTML = `<button class="btn" data-medium="close-dialog">${button}</button>`;
    closeAction = after; dialog.hidden = false;
    if (settings) wireSliders();
    dialog.querySelector("button").focus();
  }
  function closeDialog() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    const after = closeAction; closeAction = null;
    window.MediumMatch1.pause(false);
    if (after) after();
    if (lastFocus?.isConnected && !lastFocus.closest("[hidden]") && !lastFocus.disabled) lastFocus.focus({ preventScroll: true });
    else if (!shell.hidden) (view === "match1" ? $("game2-replay") : content.querySelector("button"))?.focus({ preventScroll: true });
  }
  async function play(match) {
    setView(match === 1 ? "match1" : "play"); currentMatch = match;
    location(`Match ${match} · ${titles[match]}`);
    if (match === 1) {
      m1Finished = false; m1Wrong = 0;
      const controls = $("medium-m1-controls"); controls.hidden = false;
      controls.querySelector('[data-medium="observe"]').hidden = false;
      $("medium-m1-choices").hidden = true;
      try {
        await window.MediumMatch1.start({
          onDecision() { if (m1Finished) return; controls.querySelector('[data-medium="observe"]').hidden = true; $("medium-m1-choices").hidden = false; },
          onDone() {
            if (m1Finished) return;
            m1Finished = true; controls.hidden = true;
            save({ match: 1, status: "lost", score: 0, stars: 1, correct: 0, wrong: m1Wrong, served: 0, cancelled: 0,
              log: [{ kind: "wrong", text: "Circular wait A → B → C → A tetap tertutup. Setiap koki menahan satu alat sambil menunggu alat lain (hold and wait). Tidak ada penanganan." }] });
            $("game2-replay").focus({ preventScroll: true });
          }
        });
      } catch (_) {
        if (view !== "match1") return;
        // Jika WebGL tidak tersedia, papan DOM tetap bisa mengajarkan kondisi dan keputusan yang sama.
        content.hidden = false; $("game2-canvas").hidden = true;
        content.innerHTML = `<div class="medium-heading"><h1 tabindex="-1">Match 1 · Circular Wait</h1><p>Ketiga koki menahan alat. Tanpa preemption atau pembatalan, permintaan baru tetap terblokir.</p></div>${graph({ owners: { wok: "A", stove: "B", pot: "C" }, done: [], cancelled: [] })}`;
        controls.querySelector('[data-medium="observe"]').hidden = true; $("medium-m1-choices").hidden = false;
      }
    } else { state = R.create(match); renderPlay(); focusContent(); }
  }
  function m1Decision(action) {
    if (m1Finished) return;
    m1Wrong++;
    showDialog("Salah · Dapur tetap macet", `<p>${action === "m1-wait" ? "Menunggu lebih lama" : "Meminta Kompor tanpa mengambil atau melepas alat"} tidak mengubah kepemilikan alat. Cowo menahan Katel, Hijab menahan Kompor, dan Tanpa Hijab menahan Panci.</p><p>Hold and wait dan circular wait tetap terjadi. Match 1 sengaja tidak memiliki mekanisme pemulihan.</p>`, {
      ok: false, button: "Lihat hasil Match 1", after() {
        window.MediumMatch1.advance(34);
        if (!m1Finished) { // Fallback DOM tanpa WebGL.
          m1Finished = true; $("medium-m1-controls").hidden = true; $("ana2").hidden = false;
          save({ match: 1, status: "lost", score: 0, stars: 1, correct: 0, wrong: m1Wrong, served: 0, cancelled: 0,
            log: [{ kind: "wrong", text: "Tanpa penanganan, hold and wait dan circular wait terus berlangsung." }] });
        }
      }
    });
  }
  function graph(s) {
    const ids = ["A", "B", "C"], tools = ["wok", "stove", "pot"], y = [42, 126, 210];
    let paths = "";
    tools.forEach((tool, i) => {
      const owner = s.owners[tool];
      if (owner) paths += `<path class="hold-edge" d="M 410 ${y[i]+8} L 158 ${y[ids.indexOf(owner)]+8}" marker-end="url(#hold-head)"/>`;
    });
    ids.forEach((id, i) => {
      if (s.done.includes(id) || s.cancelled.includes(id)) return;
      const need = R.CHEFS[id].need;
      if (s.owners[need] !== id) paths += `<path class="wait-edge" d="M 158 ${y[i]-8} L 410 ${y[tools.indexOf(need)]-8}" marker-end="url(#wait-head)"/>`;
    });
    return `<div class="medium-graph" role="img" aria-label="Graf kepemilikan alat. Garis oranye dari alat ke koki berarti memegang; garis putus teal dari koki ke alat berarti menunggu."><svg viewBox="0 0 570 253" aria-hidden="true"><defs><marker id="hold-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="#d5652f"/></marker><marker id="wait-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7Z" fill="#247c80"/></marker></defs>${paths}</svg>
      ${ids.map((id, i) => `<div class="graph-chef" style="top:${i*33.2+3}%">${pic(chefImages[id])}<span>${id} · ${R.CHEFS[id].short}</span></div>`).join("")}
      ${tools.map((t, i) => `<div class="graph-tool" style="top:${i*33.2+3}%">${pic(toolImages[t])}<span>${R.TOOLS[t]}<small>${s.owners[t] ? `di ${R.CHEFS[s.owners[t]].short}` : "Bebas"}</small></span></div>`).join("")}</div><div class="graph-legend"><span>╌→ Menunggu</span><span>━→ Memegang</span></div>`;
  }
  function notify() {
    if (state.status === "won") return "Semua pesanan aktif sudah terlayani. Alat kembali bebas; circular wait berhasil diputus!";
    if (state.phase === "cancel") return "Notifikasi: ketiga koki saling menunggu. Batalkan satu pesanan dengan biaya terendah: pelanggan 3, progres 0%.";
    const id = R.expected(state), c = R.CHEFS[id], owner = state.owners[c.need];
    if (state.phase === "cooking") return `Alat lengkap! ${c.name} siap memasak. Selesaikan pesanan dan lepaskan alat untuk koki berikutnya.`;
    return `Notifikasi: ${c.name} membutuhkan ${R.TOOLS[c.need]}${owner && owner !== id ? ` dari ${R.CHEFS[owner].name}` : " yang sudah bebas"}!`;
  }
  function renderPlay() {
    const s = state, ids = ["A", "B", "C"], complete = s.phase === "complete";
    content.innerHTML = `<div class="medium-play-heading"><div><span class="medium-eyebrow">MATCH ${s.match} / 3</span><h1 tabindex="-1">${titles[s.match]}</h1></div><div class="medium-score" aria-live="polite"><b>${R.score(s)}<small>/100</small></b><span>${s.done.length}/${s.match === 2 ? 3 : 2} terlayani · ${s.correct} benar · ${s.wrong} salah</span></div></div>
      <div class="medium-notice" role="status" aria-live="polite"><span aria-hidden="true">!</span><p>${notify()}</p></div>
      <div class="medium-play-layout"><div class="medium-workspace"><div class="medium-kitchen ${s.match === 3 ? "termination" : ""}">
        <div class="medium-customers">${ids.map((id, i) => {
          const done = s.done.includes(id), cancelled = s.cancelled.includes(id);
          const names = s.match === 2 ? ["Ramen", "Kari", "Ayam"] : ["Kue", "Es krim", "Minuman"];
          return `<article class="medium-customer ${done ? "served" : cancelled ? "cancelled" : ""}"><div class="medium-order">${pic(`assets/medium/food-${s.match}-${i+1}.png`)}<span>P${i+1} · ${names[i]}</span>${s.match === 3 ? `<small>${[80,60,0][i]}% persiapan${i === 2 ? " · terakhir masuk" : ""}</small>` : ""}</div>${pic(`assets/medium/customer-${i+1}.png`, "customer-sprite")}<span class="order-status">${done ? "✓ Terlayani" : cancelled ? "✕ Dibatalkan" : "Menunggu"}</span>${s.phase === "cancel" ? `<button class="medium-cancel" data-cancel="${i+1}">Cancel Pelanggan ${i+1}</button>` : ""}</article>`;
        }).join("")}</div>
        <div class="medium-counter" aria-hidden="true"></div><div class="medium-chefs">${ids.map(id => {
          const done = s.done.includes(id), cancelled = s.cancelled.includes(id), held = Object.keys(s.owners).filter(t => s.owners[t] === id);
          return `<button class="medium-chef ${s.selected === id ? "selected" : ""} ${done || cancelled ? "inactive" : ""}" data-chef="${id}" aria-pressed="${s.selected === id}" ${done || cancelled || s.phase === "cancel" || s.phase === "cooking" ? "disabled" : ""}>
            <span class="chef-thought">${done ? "✓ Selesai" : cancelled ? "Pesanan dibatalkan" : `Butuh ${R.TOOLS[R.CHEFS[id].need]}`}</span>${pic(backImages[id], "chef-sprite")}<strong>${id} · ${R.CHEFS[id].short}</strong><small>${held.length ? held.map(t => R.TOOLS[t]).join(" + ") : "Tidak memegang alat"}</small></button>`;
        }).join("")}</div></div>
        <div class="medium-action-panel"><div class="medium-step"><b>${complete ? "Selesai!" : s.phase === "cancel" ? "1. Pilih korban" : s.phase === "cooking" ? "3. Masak & lepaskan" : s.selected ? "2. Berikan alat" : "1. Pilih koki"}</b><span>${complete ? "Semua alat kembali bebas." : s.phase === "cancel" ? "Kriteria: biaya pembatalan paling rendah." : s.phase === "cooking" ? "Pelanggan dilayani setelah tombol memasak ditekan." : s.match === 2 && s.step === 0 ? "Wajib mulai dari Koki Cowo → Kompor." : `Giliran ${R.CHEFS[R.expected(s)].short}.`}</span></div>
        ${complete ? '<p class="medium-action-note">Lanjutkan ke hasil untuk melihat skor dan bintang.</p>' : s.phase === "cooking" ? `<button class="btn medium-cook" data-medium="cook">Masak & Lepaskan Alat →</button>` : s.phase === "cancel" ? `<p class="medium-action-note">Klik Cancel pada kartu pelanggan di atas.</p>` : `<div class="medium-tool-buttons">${Object.keys(R.TOOLS).map(t => `<button data-tool="${t}" ${!s.selected ? "disabled" : ""}>${pic(toolImages[t])}<span>Berikan ${R.TOOLS[t]}</span></button>`).join("")}</div>`}</div>
      </div><aside class="medium-side"><section class="medium-map"><h2>Peta Alat</h2>${graph(s)}</section><section class="medium-log"><h2>${pic("assets/match3/Ikon Log Keputusan.png")}Log Keputusan <small>${s.log.length}</small></h2><ol>${s.log.map(l => `<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol></section></aside></div>`;
    const log = content.querySelector(".medium-log ol"); if (log) log.scrollTop = log.scrollHeight;
  }
  function validate(result) {
    if (!result) { renderPlay(); return; }
    renderPlay();
    const text = `<p>${escape(result.text)}</p><div class="medium-points">${result.ok ? "+" : ""}${result.delta} poin · Skor ${result.score}/100</div>${!result.ok ? "<small>Kesalahan mengurangi skor akhir sebanyak 15 poin, termasuk saat skor sementara masih 0.</small>" : ""}`;
    showDialog(result.ok ? "Betul / Benar!" : "Salah!", text, { ok: result.ok,
      button: result.fatal ? "Lihat Game Over" : state.status === "won" ? "Lihat Hasil" : "Lanjutkan", after() {
        if (["won", "lost"].includes(state.status)) { save(R.summary(state)); renderResult(); }
      }
    });
  }
  function renderResult() {
    const r = results[currentMatch]; setView("result"); location(`Hasil Match ${currentMatch}`);
    content.innerHTML = `<div class="medium-result"><span class="medium-eyebrow">MATCH ${currentMatch} · ${titles[currentMatch]}</span><h1 tabindex="-1">${r.status === "won" ? "Dapur lancar kembali!" : "Game Over · Dapur Macet"}</h1><div class="medium-stars" aria-label="${r.stars} bintang">${rating(r.score)}</div><div class="medium-final-score">${r.score}<small>/100</small></div><p>${r.status === "lost" ? "Koki Cowo tetap menunggu Kompor. Aturan awal belum terpenuhi; circular wait tidak terputus." : currentMatch === 2 ? "Tiga pelanggan terlayani. Preemption memindahkan Kompor sementara; alat lalu dipakai bergantian tanpa membatalkan pesanan." : "Dua pelanggan terlayani, satu dibatalkan. Process termination melepas alat milik korban dan membuka jalan bagi pesanan lain."}</p><div class="medium-result-stats"><span><b>${r.correct}</b> langkah benar</span><span><b>${r.wrong}</b> langkah salah</span><span><b>${r.served}</b> terlayani</span><span><b>${r.cancelled}</b> dibatalkan</span></div><p class="medium-rating-note">100 = ★★★ · 50–99 = ★★☆ · 0–49 = ★☆☆</p><div class="medium-result-buttons"><button class="btn" data-play="${currentMatch}">↻ Ulangi Match</button><button class="btn" data-medium="${currentMatch === 2 ? "next3" : "compare"}">${currentMatch === 2 ? "Lanjut Match 3 →" : "Perbandingan 3 Match →"}</button><button class="medium-plain" data-medium="selector">Pilih Match</button>${currentMatch === 2 ? '<button class="medium-plain" data-medium="compare">Lihat Perbandingan</button>' : ""}</div></div>`;
    focusContent();
  }
  function compare() {
    setView("compare"); location("Perbandingan 3 Match");
    content.innerHTML = `<div class="medium-heading"><span class="medium-eyebrow">APA YANG BERUBAH?</span><h1 tabindex="-1">Perbandingan Penanganan Deadlock</h1><p>Hasil nyata percobaan terakhir. Match yang belum selesai tetap ditandai belum dimainkan.</p></div><div class="medium-comparison-wrap"><table class="medium-comparison"><caption>Hasil tiga match Medium</caption><thead><tr><th>Strategi</th><th>Match 1<br>Tanpa Penanganan</th><th>Match 2<br>Bergantian Barang</th><th>Match 3<br>Cancel 1 Pelanggan</th></tr></thead><tbody>
      <tr><th>Status</th>${[1,2,3].map(m => `<td class="${results[m]?.status || ""}">${status(results[m])}</td>`).join("")}</tr>
      <tr><th>Pelanggan</th>${[1,2,3].map(m => `<td>${results[m] ? `${results[m].served} terlayani · ${results[m].cancelled} dibatalkan` : "—"}</td>`).join("")}</tr>
      <tr><th>Langkah benar / salah</th>${[1,2,3].map(m => `<td>${results[m] ? `${results[m].correct} / ${results[m].wrong}` : "—"}</td>`).join("")}</tr>
      <tr><th>Skor & bintang</th>${[1,2,3].map(m => `<td>${results[m] ? m === 1 ? "0/100 · Deadlock" : `<b>${results[m].score}/100</b><span class="medium-table-stars">${rating(results[m].score)}</span>` : "—"}</td>`).join("")}</tr>
      <tr><th>Cara kerja</th><td>Hold and wait berlanjut. Circular wait tidak diputus; semua proses tertahan.</td><td>Kompor diambil sementara dari Hijab untuk Cowo. Urutan Cowo → Tanpa Hijab → Hijab membebaskan alat satu per satu.</td><td>Hentikan pesanan pelanggan 3 (progres 0%). Panci bebas; Hijab → Cowo menyelesaikan dua pesanan tersisa.</td></tr>
      <tr><th>Efektivitas & biaya</th><td>Tidak ada kemajuan; tidak ada biaya pemulihan yang dilakukan.</td><td>Menyelamatkan semua 3 pesanan, dengan 3 pemindahan alat dan tanpa pembatalan.</td><td>Memerlukan 1 pembatalan dan 2 pemindahan alat. Dua pesanan selamat, satu pesanan dikorbankan. Lebih sedikit langkah, ada kehilangan layanan.</td></tr>
      <tr><th>Main kembali</th>${[1,2,3].map(m => `<td><button class="medium-plain" data-play="${m}">Main Match ${m} →</button></td>`).join("")}</tr>
      </tbody></table></div><details class="medium-comparison-log"><summary>${pic("assets/match3/Ikon Log Keputusan.png")} Log Keputusan Match 3 (${results[3]?.log.length || 0})</summary>${results[3] ? `<ol>${results[3].log.map(l => `<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol>` : "<p>Selesaikan Match 3 untuk melihat log keputusan.</p>"}</details><p class="medium-save-note">Aturan khusus skenario: Match 2 wajib mulai dari Cowo. Pada sistem operasi umum, urutan aman dan korban dapat berbeda bergantung alokasi serta biaya pemulihan.</p><div class="medium-compare-actions"><button class="btn" data-medium="selector">← Pilih Match</button><button class="medium-plain" data-medium="exit">Kembali ke Pilih Level</button></div>`;
    focusContent();
  }
  function settingsDialog() {
    showDialog("Pengaturan Suara", `<p>Atur volume tanpa meninggalkan match.</p><label class="medium-volume">Musik <input id="medium-music-volume" type="range" min="0" max="100" value="${Math.round(Music.volume*100)}"></label><label class="medium-volume">SFX <input id="medium-sfx-volume" type="range" min="0" max="100" value="${Math.round(Sfx.volume*100)}"></label>`, { icon: "♫", settings: true, button: "Kembali ke Game" });
  }
  function syncAudio() { const on = Sfx.volume > 0; $("medium-audio").textContent = on ? "SFX ON" : "SFX OFF"; $("medium-audio").setAttribute("aria-pressed", String(on)); }
  function wireSliders() {
    $("medium-music-volume").addEventListener("input", e => { Music.set(Number(e.target.value)/100); Music.start(); saveAudio(); });
    $("medium-sfx-volume").addEventListener("input", e => { Sfx.setVolume(Number(e.target.value)/100); syncChip(); syncAudio(); saveAudio(); });
  }
  function exit() { cleanup(); shell.hidden = true; setMode("level"); $("menu-level").querySelector('[data-level="Medium"]').focus(); }
  function cook() {
    if (busy || state?.phase !== "cooking") return;
    busy = true; const token = generation;
    const button = content.querySelector(".medium-cook"); button.disabled = true; button.textContent = "Memasak…";
    content.querySelector(".medium-kitchen").classList.add("is-cooking");
    timer = setTimeout(() => {
      if (generation !== token) return;
      busy = false; validate(R.cook(state));
    }, reduceMotion ? 100 : 850);
  }
  function handleClick(e) {
    const button = e.target.closest("button"); if (!button || button.disabled) return;
    const action = button.dataset.medium;
    if (!dialog.hidden) { if (action === "close-dialog") closeDialog(); return; }
    if (action === "audio") { $("sfx").click(); syncAudio(); return; }
    Sfx.confirm();
    if (action === "exit") return exit();
    if (action === "settings") { if (!busy) settingsDialog(); return; }
    if (action === "selector") return selector();
    if (action === "compare") return compare();
    if (action === "next2") return play(2);
    if (action === "next3") return play(3);
    if (action === "observe") return window.MediumMatch1.advance(16.5);
    if (action?.startsWith("m1-")) return m1Decision(action);
    if (button.dataset.play) return play(Number(button.dataset.play));
    if (busy || view !== "play") return;
    if (button.dataset.chef) return validate(R.select(state, button.dataset.chef));
    if (button.dataset.tool) return validate(R.transfer(state, button.dataset.tool));
    if (button.dataset.cancel) return validate(R.cancel(state, Number(button.dataset.cancel)));
    if (action === "cook") cook();
  }
  shell.addEventListener("click", handleClick); dialog.addEventListener("click", handleClick);
  // Tinggi toolbar mengikuti pembungkusan tombol pada perangkat kecil.
  new ResizeObserver(([entry]) => {
    if (entry.target.offsetHeight) shell.style.setProperty("--medium-header", `${entry.target.offsetHeight}px`);
  }).observe(shell.querySelector(".medium-toolbar"));
  $("game2-replay").addEventListener("click", () => play(1));
  $("game2-menu").addEventListener("click", selector);
  document.addEventListener("keydown", e => {
    if (shell.hidden) return;
    if (!dialog.hidden) {
      if (e.key === "Escape") { e.preventDefault(); closeDialog(); }
      if (e.key === "Tab") {
        const all = Array.from(dialog.querySelectorAll("button, input")), first = all[0], last = all[all.length-1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    } else if (e.key === "Escape") { e.preventDefault(); view === "selector" ? exit() : selector(); }
  });
  window.startGame2 = () => { shell.hidden = false; stage.dataset.mode = "game"; syncAudio(); selector(); };
})();
