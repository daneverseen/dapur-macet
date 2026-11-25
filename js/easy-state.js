/* State/aturan Easy tanpa DOM, timer browser, atau Three.js. */
(function (root) {
  "use strict";
  const CHARACTERS = {
    koki: { name: "Koki", image: "assets/easy/chef-koki.png" },
    puput: { name: "Neng Puput", image: "assets/easy/chef-puput.png" },
    pipit: { name: "Ceu Pipit", image: "assets/easy/chef-pipit.png" },
    ucil: { name: "Mang Ucil", image: "assets/easy/chef-ucil.png" }
  };
  // Istilah persis dari tiga judul kartu Tutorial pada index.html.
  const METHODS = ["Deteksi & Pemulihan", "Pencegahan", "Penghindaran"];
  const TOOLS = { wok: "Katel / Wajan", stove: "Kompor" };
  const COOK_SECONDS = 4, TOTAL_ROUNDS = 4;
  function cleanTeam(ids) { return [...new Set(Array.isArray(ids) ? ids.filter(id => CHARACTERS[id]) : [])].slice(0, 2); }
  function pairTeam(ids) {
    const team = cleanTeam(ids);
    if (!team.length) return [];
    if (team.length === 1) team.push(Object.keys(CHARACTERS).find(id => !team.includes(id)));
    return team;
  }
  function toggleTeam(ids, id) {
    const team = cleanTeam(ids);
    if (!CHARACTERS[id]) return { team, ok: false, message: "Karakter tidak dikenal." };
    if (team.includes(id)) return { team: team.filter(value => value !== id), ok: true, message: "" };
    if (team.length === 2) return { team, ok: false, message: "Maksimal hanya dapat memilih 2 karakter koki!" };
    return { team: [...team, id], ok: true, message: "" };
  }
  const stars = value => value === 100 ? 3 : value >= 50 ? 2 : 1;
  const score = s => Math.max(0, Math.min(100, s.earned - s.wrong * 10));
  const name = (s, chef) => `${CHARACTERS[s.team[chef === "A" ? 0 : 1]].name} (Koki ${chef})`;
  function log(s, text, kind = "info") { s.log.push({ text, kind }); }
  function customers(s) {
    return ["A", "B"].map((chef, i) => ({ id: `P${s.round * 2 + i + 1}`, chef,
      dish: i ? "Wafel" : "Hotdog", status: "waiting", patience: s.match === 2 ? [60,90][i] : [30,42][i],
      remaining: s.match === 2 ? [60,90][i] : [30,42][i], waited: 0 }));
  }
  function create(match, ids) {
    if (![1,2,3].includes(match)) throw new Error("Match Easy harus 1, 2, atau 3.");
    const team = pairTeam(ids);
    if (team.length !== 2) throw new Error("Pilih minimal satu karakter sebelum bermain.");
    const s = { match, team, status: "playing", phase: match === 1 ? "observe" : "plan", round: 0,
      owners: { wok: "A", stove: "B" }, waiting: { A: "stove", B: "wok" },
      leader: null, method: null, cooking: null, cookLeft: 0, queue: [],
      customers: [], history: [], log: [], earned: 0, correct: 0, wrong: 0,
      served: 0, escaped: 0, unserved: 0, elapsed: 0, deadlocked: match !== 3, hadDeadlock: match !== 3 };
    s.customers = customers(s);
    log(s, `${name(s,"A")} memegang Katel; ${name(s,"B")} memegang Kompor.`);
    if (match === 3) prepareRound(s);
    return s;
  }
  function result(s, ok, text, points) {
    if (ok) { s.correct++; s.earned += points; } else s.wrong++;
    log(s,text,ok ? "correct" : "wrong");
    return { ok, text, delta: ok ? points : -10, score: score(s) };
  }
  function finishMatch1(s) {
    if (s.match !== 1 || s.status !== "playing") return;
    s.status = "lost"; s.phase = "complete"; s.unserved = 2; s.elapsed = 29.5;
    log(s,"Tanpa penanganan: hold and wait dan circular wait A → B → A tetap berlangsung. Kedua pesanan tidak selesai.","wrong");
  }
  function selectLeader(s, id) {
    if (s.match === 2 && s.phase === "plan" && ["A","B"].includes(id)) s.leader = id;
  }
  function selectMethod(s, method) {
    if (s.match === 2 && s.phase === "plan" && METHODS.includes(method)) s.method = method;
  }
  function plan(s) {
    if (s.match !== 2 || s.phase !== "plan" || !s.leader || !s.method) return null;
    if (s.leader !== "A" || s.method !== METHODS[0]) {
      s.phase = "blocked";
      return result(s,false, s.leader !== "A"
        ? "Pelanggan P1 milik Koki A memiliki tenggat paling dekat. Rencana yang dipilih belum dijalankan karena mendahulukan P2. Tanpa pemulihan, kedua koki masih menahan alat dan timer terus berjalan."
        : `${s.method} tepat untuk mengatur permintaan sebelum siklus terbentuk. Di sini deadlock sudah terdeteksi, sehingga perlu Deteksi & Pemulihan: ambil sementara Kompor pada titik aman, selesaikan A, lalu B. Strategi yang dipilih tidak melepas alat; keduanya tetap menunggu.`,0);
    }
    s.owners.stove = "A"; s.waiting = { A: null, B: "wok" }; s.deadlocked = false;
    s.queue = ["A","B"]; s.phase = "ready";
    return result(s,true,"Deteksi & Pemulihan memutus siklus yang sudah terjadi. Kompor idle dipinjamkan ke Koki A untuk pesanan P1 yang lebih mendesak. Setelah A selesai, kedua alat dilepas untuk Koki B.",30);
  }
  function startCook(s) {
    if (s.status !== "playing" || s.phase !== "ready" || !s.queue.length) return false;
    const chef = s.queue[0];
    if (Object.values(s.owners).some(owner => owner !== null && owner !== chef)) return false;
    s.owners = { wok: chef, stove: chef }; s.waiting = { A: null, B: null };
    s.cooking = chef; s.cookLeft = COOK_SECONDS; s.phase = "cooking";
    log(s,`${name(s,chef)} memakai Katel + Kompor. Alat terkunci sampai masakan selesai.`);
    return true;
  }
  function prepareRound(s) {
    s.customers = customers(s); s.cooking = null; s.queue = []; s.cookLeft = 0;
    s.phase = "request"; s.deadlocked = false;
    const borrower = s.round < 2 ? "A" : "B", owner = borrower === "A" ? "B" : "A";
    const busy = s.round % 2 === 1;
    const tool = busy ? (borrower === "A" ? "wok" : "stove") : (borrower === "A" ? "stove" : "wok");
    s.owners = busy ? { wok: owner, stove: owner } : { wok: "A", stove: "B" };
    s.waiting = { A: null, B: null }; s.waiting[borrower] = tool;
    s.request = { borrower, owner, tool, busy };
    log(s,`Ronde ${s.round+1}: ${name(s,borrower)} meminta ${TOOLS[tool]} dari ${name(s,owner)}; alat ${busy ? "sedang dipakai bersama alat lainnya" : "menganggur"}. Timer dijeda saat permintaan diperiksa.`);
  }
  function grantPreview(s) {
    const owners = { ...s.owners, [s.request.tool]: s.request.borrower };
    const waits = {};
    for (const chef of ["A","B"]) waits[chef] = Object.keys(owners).filter(t => owners[t] !== chef).map(t => owners[t]).filter(v => v && v !== chef);
    const cycle = waits.A.includes("B") && waits.B.includes("A");
    return { owners, cycle, safe: !cycle && Object.values(owners).every(o => o === s.request.borrower) };
  }
  function decide(s, give) {
    if (s.match !== 3 || s.phase !== "request" || typeof give !== "boolean") return null;
    const p = grantPreview(s), req = s.request;
    if (give !== p.safe) {
      s.phase = "blocked";
      if (give) {
        s.owners = p.owners; s.waiting = { A: Object.keys(p.owners).find(t=>p.owners[t]!=="A"), B: Object.keys(p.owners).find(t=>p.owners[t]!=="B") };
        s.deadlocked = p.cycle; s.hadDeadlock ||= p.cycle;
      }
      return result(s,false, give
        ? `Alat yang sedang dipakai dipindahkan sebelum memasak selesai. Setelah ${TOOLS[req.tool]} diberikan, A dan B masing-masing menahan satu alat sambil menunggu alat lainnya: circular wait terbentuk. Pelanggan akan kehilangan kesabaran.`
        : "Alat menganggur dan peminjam bisa langsung selesai jika diberi kedua alat. Menolak permintaan aman ini menunda layanan tanpa alasan; pelanggan terus menunggu. Tidak terjadi circular wait baru, tetapi layanan terhambat.",0);
    }
    s.owners = give ? p.owners : s.owners;
    s.queue = give ? [req.borrower,req.owner] : [req.owner,req.borrower];
    s.phase = "ready"; startCook(s);
    return result(s,true,give
      ? `${TOOLS[req.tool]} sedang menganggur. Dikasih aman: ${name(s,req.borrower)} bisa langsung memasak, melepas kedua alat, lalu ${name(s,req.owner)} mendapat giliran.`
      : `Tidak / tunda adalah keputusan aman. Pemilik sedang memakai kedua alat; jangan pecah pasangan alatnya di tengah masak. Biarkan ${name(s,req.owner)} selesai dan melepas alat, baru layani peminjam.`,15);
  }
  function finishRound(s, successful) {
    s.history.push({ round: s.round+1, successful, customers: s.customers.map(c=>({...c})) });
    s.queue = []; s.cooking = null; s.cookLeft = 0;
    s.owners = { wok: null, stove: null }; s.waiting = { A: null, B: null }; s.deadlocked = false;
    if (s.match === 2 || s.round === TOTAL_ROUNDS-1) {
      s.phase = "complete"; s.status = successful && s.wrong === 0 ? "won" : "lost";
    } else s.phase = "roundEnd";
  }
  function nextRound(s) {
    if (s.match !== 3 || s.phase !== "roundEnd") return false;
    s.round++; prepareRound(s); return true;
  }
  function tick(s, seconds) {
    const events = [];
    if (s.status !== "playing" || !Number.isFinite(seconds) || seconds <= 0 || !["plan","ready","cooking","blocked"].includes(s.phase)) return events;
    let remaining = seconds;
    while (remaining > 1e-8 && s.status === "playing" && s.phase !== "roundEnd") {
      const active = s.customers.filter(c=>c.status === "waiting");
      if (!active.length) break;
      const dt = Math.min(remaining,...active.map(c=>c.remaining),s.cooking ? s.cookLeft : Infinity);
      active.forEach(c=>{c.remaining=Math.max(0,c.remaining-dt);c.waited+=dt;});
      s.elapsed+=dt; remaining-=dt;
      if (s.cooking) s.cookLeft=Math.max(0,s.cookLeft-dt);
      const expired = active.filter(c=>c.remaining<=1e-8);
      if (expired.length) {
        expired.forEach(c=>{c.status="escaped";s.escaped++;log(s,`${c.id} kabur: waktu kesabaran habis sebelum masakan selesai.`,"wrong");});
        s.customers.filter(c=>c.status==="waiting").forEach(c=>{c.status="unserved";s.unserved++;});
        log(s,"Dapur menghentikan ronde gagal; pesanan lain yang tersisa belum terlayani dan alat dilepas.","wrong");
        finishRound(s,false); events.push("expired"); break;
      }
      if (s.cooking && s.cookLeft<=1e-8) {
        const chef=s.cooking, customer=s.customers.find(c=>c.chef===chef && c.status==="waiting");
        customer.status="served";s.served++;s.earned+=s.match===2?35:5;
        log(s,`${customer.id} terlayani oleh ${name(s,chef)}. Katel dan Kompor dilepas.`,"correct");
        s.owners={wok:null,stove:null};s.cooking=null;s.queue.shift();events.push("served");
        if (s.queue.length) {s.phase="ready";if(s.match===3)startCook(s);else break;}
        else {finishRound(s,true);events.push(s.phase);break;}
      }
    }
    return events;
  }
  function summary(s) {
    const value=score(s), completed=[...s.history.flatMap(h=>h.customers)];
    return { match:s.match,status:s.status,team:[...s.team],score:value,stars:stars(value),correct:s.correct,wrong:s.wrong,
      accuracy:s.correct+s.wrong?Math.round(s.correct/(s.correct+s.wrong)*100):0,
      served:s.served,escaped:s.escaped,unserved:s.unserved,elapsed:Math.round(s.elapsed*10)/10,
      averageWait:completed.length?Math.round(completed.reduce((n,c)=>n+c.waited,0)/completed.length*10)/10:0,
      log:s.log.map(l=>({...l})), rounds:s.history.map(h=>({round:h.round,successful:h.successful})) };
  }
  const api={CHARACTERS,METHODS,TOOLS,COOK_SECONDS,TOTAL_ROUNDS,cleanTeam,pairTeam,toggleTeam,create,name,score,stars,
    finishMatch1,selectLeader,selectMethod,plan,startCook,grantPreview,decide,tick,nextRound,summary};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.EasyRules=api;
})(typeof window!=="undefined"?window:globalThis);
