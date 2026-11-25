/* Aturan Medium murni: kepemilikan resource, validasi, skor, dan hasil.
   Tidak bergantung DOM/Three.js, sehingga aturan bisa diuji dengan Node. */
(function (root) {
  "use strict";
  const CHEFS = {
    A: { name: "Koki Cowo", short: "Cowo", held: "wok", need: "stove" },
    B: { name: "Koki Cewe Berhijab", short: "Hijab", held: "stove", need: "pot" },
    C: { name: "Koki Cewe Tanpa Hijab", short: "Tanpa Hijab", held: "pot", need: "wok" }
  };
  const TOOLS = { wok: "Katel / Wajan", stove: "Kompor", pot: "Panci" };
  const stars = score => score === 100 ? 3 : score >= 50 ? 2 : 1;
  const score = s => Math.max(0, Math.min(100, s.earned - s.wrong * 15));
  function create(match) {
    if (![2, 3].includes(match)) throw new Error("Match interaktif harus 2 atau 3.");
    const s = { match, status: "playing", phase: match === 2 ? "select" : "cancel", step: 0,
      selected: null, owners: { wok: "A", stove: "B", pot: "C" },
      done: [], cancelled: [], earned: 0, correct: 0, wrong: 0, log: [] };
    Object.entries(CHEFS).forEach(([id, c]) => s.log.push({ kind: "info",
      text: `${id} · ${c.name} memegang ${TOOLS[c.held]}, membutuhkan ${TOOLS[c.need]}.` }));
    if (match === 3) s.log.push({ kind: "info", text: "Pelanggan 3 masuk terakhir, mengikat Panci dan melengkapi siklus. Progres 0%; pilih korban dengan biaya terendah." });
    return s;
  }
  function response(s, ok, text, points = 0, fatal = false) {
    if (ok) { s.correct++; s.earned += points; }
    else { s.wrong++; if (fatal) s.status = "lost"; }
    s.log.push({ kind: ok ? "correct" : "wrong", text });
    return { ok, text, delta: ok ? points : -15, fatal, score: score(s) };
  }
  function locked(s) { return s.status !== "playing"; }
  function expected(s) { return s.match === 2 ? ["A", "C", "B"][s.step] : ["B", "A"][s.step]; }
  function select(s, id) {
    if (locked(s) || s.phase === "cancel" || s.phase === "cooking" || !CHEFS[id]) return null;
    if (s.match === 2 && s.step === 0 && id !== "A") {
      return response(s, false, "Deadlock gagal dipecahkan karena Koki Cowo tetap tertahan tanpa Kompor. Aturan awal skenario ini: pilih Koki Cowo, lalu berikan Kompor kepadanya.", 0, true);
    }
    s.selected = id; s.phase = "transfer";
    s.log.push({ kind: "info", text: `${CHEFS[id].name} dipilih untuk menerima alat.` });
    return null;
  }
  function transfer(s, tool) {
    if (locked(s) || s.phase === "cancel" || s.phase === "cooking" || !TOOLS[tool]) return null;
    const id = expected(s), need = CHEFS[id].need;
    const first = s.match === 2 && s.step === 0;
    if (s.selected !== id || tool !== need) {
      return response(s, false, first
        ? "Alat atau koki awal salah. Koki Cowo tetap tidak mendapat Kompor sehingga circular wait bertahan. Game Over."
        : `Urutan belum aman. Saat ini ${CHEFS[id].name} membutuhkan ${TOOLS[need]}. Pilih koki dan alat tersebut.`, 0, first);
    }
    // Hanya langkah pertama Match 2 boleh mengambil alat yang masih dimiliki koki lain.
    const owner = s.owners[tool];
    if (owner && owner !== id && !first) return response(s, false, `${TOOLS[tool]} belum dilepas oleh ${CHEFS[owner].name}.`);
    s.owners[tool] = id;
    // Kompor yang dipinjam A sudah bebas; alokasikan kembali saat B mendapat Panci.
    const returnedStove = id === "B" && s.owners.stove === null;
    if (returnedStove) s.owners.stove = "B";
    s.phase = "cooking";
    return response(s, true, first
      ? "Kompor dipinjam dari Koki Cewe Berhijab ke Koki Cowo. Resource preemption memutus circular wait; Cowo kini bisa memasak."
      : `${TOOLS[tool]} yang sudah bebas diberikan ke ${CHEFS[id].name}${returnedStove ? "; Kompor bebas juga dialokasikan kepadanya" : ""}. Sekarang masak dan lepaskan alat.`, s.match === 2 ? 20 : 15);
  }
  function cancel(s, customer) {
    if (locked(s) || s.phase !== "cancel" || ![1, 2, 3].includes(customer)) return null;
    if (customer !== 3) return response(s, false,
      `Pembatalan pelanggan ${customer} bisa memutus siklus, tetapi membuang pesanan yang hampir selesai. Dalam skenario ini, pilih pelanggan 3: pesanan terakhir, progres 0%, biaya pembatalan terendah. Belum ada pesanan dibatalkan.`);
    s.cancelled.push("C");
    Object.keys(s.owners).forEach(tool => { if (s.owners[tool] === "C") s.owners[tool] = null; });
    s.phase = "select";
    return response(s, true, "Pelanggan 3 dibatalkan (process termination). Koki C berhenti; Panci dilepas. Kini Hijab dapat menerima Panci, kemudian Cowo menerima Kompor. Dua pesanan tersisa diselamatkan.", 40);
  }
  function cook(s) {
    if (locked(s) || s.phase !== "cooking") return null;
    const id = expected(s), c = CHEFS[id];
    if (s.owners[c.held] !== id || s.owners[c.need] !== id) return response(s, false, "Kedua alat belum dimiliki; pesanan belum bisa dimasak.");
    s.done.push(id);
    Object.keys(s.owners).forEach(tool => { if (s.owners[tool] === id) s.owners[tool] = null; });
    const points = s.match === 2 && s.step === 2 ? 10 : 15;
    s.step++; s.selected = null; s.phase = "select";
    if (s.step === (s.match === 2 ? 3 : 2)) { s.status = "won"; s.phase = "complete"; }
    return response(s, true, `${c.name} selesai memasak, pelanggan terlayani, dan semua alatnya dilepas.${s.status === "won" ? " Seluruh pesanan aktif selesai!" : " Lanjutkan ke koki berikutnya."}`, points);
  }
  function summary(s) {
    return { match: s.match, status: s.status, score: score(s), stars: stars(score(s)),
      correct: s.correct, wrong: s.wrong, served: s.done.length, cancelled: s.cancelled.length,
      log: s.log.map(item => ({ ...item })) };
  }
  const api = { CHEFS, TOOLS, create, select, transfer, cancel, cook, expected, score, stars, summary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MediumRules = api;
})(typeof window !== "undefined" ? window : globalThis);
