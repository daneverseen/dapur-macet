"use strict";
/* Hard orchestrator: selector, tiga match, keputusan, matriks, antrean, hasil. */
(()=>{
  const R=window.HardRules,shell=$("game3"),content=$("hard-content"),dialog=$("hard-dialog"),KEY="dapurMacet.hard.results.v1";
  const titles=["","Tanpa Penanganan","Arahkan 4 Koki","Gelombang & Safe State"];
  const toolImages={wok:"assets/wajan.png",pot:"assets/panci.png",stove:"assets/kompor.png"};
  const foodImages=["assets/Makanan Enak 7.png","assets/Makanan Enak 8.png","assets/Makanan Enak 9.png","assets/Makanan Enak 10.png"];
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pic=(src,cls="",alt="")=>`<img src="${src}" class="${cls}" alt="${alt}">`;
  const vector=v=>`[${v.join(", ")}]`,rating=v=>"★".repeat(R.stars(v))+"☆".repeat(3-R.stars(v));
  let view="selector",state=null,match=1,generation=0,raf=0,lastTime=0,kind="feedback",after=null,lastFocus=null;
  const results=readResults();
  function readResults(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)),clean={};
      for(const m of [1,2,3]){
        const r=raw?.[m];if(!r||r.match!==m||!["won","partial","lost"].includes(r.status)||!Array.isArray(r.log))continue;
        if(![r.score,r.correct,r.wrong,r.served,r.escaped,r.cancelled,r.unserved,r.accuracy,r.recoveries,r.rescheduled,r.time].every(n=>Number.isFinite(n)&&n>=0)||r.score>100||r.accuracy>100)continue;
        if(r.total!==(m===3?12:4))continue;
        clean[m]={...r,stars:R.stars(r.score),sequence:Array.isArray(r.sequence)?r.sequence.filter(id=>R.IDS.includes(id)):[],
          waves:Array.isArray(r.waves)?r.waves.filter(w=>w&&Array.isArray(w.sequence)).map(w=>({...w,sequence:w.sequence.filter(id=>R.IDS.includes(id))})):[],
          log:r.log.filter(l=>l&&typeof l.text==="string"&&["info","correct","wrong"].includes(l.kind)).slice(-300)};
      }
      return clean;
    }catch(_){return {};}
  }
  function save(){results[match]=R.summary(state);try{localStorage.setItem(KEY,JSON.stringify(results));}catch(_){}}
  function cleanup(){generation++;cancelAnimationFrame(raf);window.HardMatch1.halt();dialog.hidden=true;after=null;$("hard-skip").hidden=true;$("hard-m1-info").hidden=true;$("game3-cap").classList.remove("show");shell.classList.remove("dead","done");}
  function setView(next){cleanup();view=next;shell.dataset.hardView=next;content.hidden=next==="match1";$("game3-canvas").hidden=next!=="match1";content.scrollTop=0;}
  function location(text){$("hard-location").textContent=text;}
  function focus(){content.querySelector("h1")?.focus({preventScroll:true});}
  function status(r){return !r?"Belum dimainkan":r.match===1?"Deadlock · 4 pesanan tertahan":r.status==="won"?"Berhasil · Semua terlayani":r.status==="partial"?"Pulih · Sebagian terlayani":"Gagal · Tenggat / layanan";}
  function selector(){
    setView("selector");location("Pilih Match");
    content.innerHTML=`<div class="hard-heading"><span class="hard-eyebrow">4 KOKI · HANYA 3 UNIT ALAT</span><h1 tabindex="-1">Dapur penuh. Atur gilirannya.</h1><p>A / Koki · B / Neng Puput · C / Ceu Pipit · D / Mang Ucil</p></div><div class="hard-match-cards">${[1,2,3].map(m=>`<article class="hard-match-card"><div class="hard-card-art">${pic(`assets/hard/Hard ${m===1?"19":m===2?"4":"18"}.png`)}<span>MATCH ${m}</span></div><div class="hard-card-copy"><h2>${titles[m]}</h2><p>${["","Amati siklus tiga pemegang alat dan satu koki lain yang ikut tertahan.","Pulihkan alokasi, lalu arahkan A, B, C, dan D dalam urutan aman.","Hadapi 12 pelanggan, periksa izin peminjaman, dan pulihkan antrean jika macet."][m]}</p><div class="hard-card-status">${status(results[m])}${results[m]&&m!==1?`<b>${results[m].score}/100 · ${rating(results[m].score)}</b>`:""}</div><button class="btn" data-hard-play="${m}">${results[m]?"Ulangi":"Mulai"} Match ${m} →</button></div></article>`).join("")}</div><p class="hard-small hard-center">Setiap alat hanya satu unit. Hasil terakhir tiap match disimpan di browser ini.</p>`;focus();
  }
  function showDialog(title,html,{ok=true,button="Lanjutkan",next=null,type="feedback",actions=null,icon=ok?"✓":"!"}={}){
    lastFocus=document.activeElement;window.HardMatch1.pause(true);kind=type;after=next;
    $("hard-dialog-title").textContent=title;$("hard-dialog-copy").innerHTML=html;$("hard-dialog-icon").textContent=icon;
    dialog.dataset.tone=ok?"correct":"wrong";$("hard-dialog-actions").innerHTML=actions||`<button class="btn" data-hard="close-dialog">${button}</button>`;
    dialog.hidden=false;dialog.querySelector("button,input")?.focus();
  }
  function closeDialog(){
    if(dialog.hidden||kind==="loan")return;
    dialog.hidden=true;const next=after;after=null;lastTime=performance.now();window.HardMatch1.pause(false);if(next)next();
    if(!dialog.hidden)return;
    if(lastFocus?.isConnected&&!lastFocus.closest("[hidden]")&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});
    else content.querySelector("button")?.focus({preventScroll:true});
  }
  async function play(number){
    match=number;setView(match===1?"match1":"play");state=R.create(match);location(`Match ${match} · ${titles[match]}`);
    if(match===1){
      const token=generation,skip=$("hard-skip");skip.hidden=false;skip.disabled=true;$("hard-m1-info").hidden=false;
      try{await window.HardMatch1.start({onDone(){R.finishMatch1(state);save();renderResult();}});if(token===generation)skip.disabled=false;}
      catch(_){if(token!==generation)return;content.hidden=false;content.innerHTML='<div class="hard-heading"><h1 tabindex="-1">A → B → C → A · Circular Wait</h1><p>A menahan Katel, B Kompor, C Panci. D tidak memiliki alat dan juga tertahan. Tanpa penanganan, keempat pesanan gagal selesai.</p></div>';skip.disabled=false;}
    }else{renderPlay();focus();lastTime=performance.now();raf=requestAnimationFrame(frame);if(match===3)loanDialog();}
  }
  function notice(){
    if(state.phase==="plan")return "Deadlock sudah terjadi: A memegang Katel, B Kompor, C Panci; D belum mendapat alat. Pilih strategi pemulihan dari Tutorial.";
    if(state.phase==="blocked")return "Tidak ada koki yang dapat selesai. Tiga alat terkunci, D ikut menunggu. Pulihkan alokasi sebelum pelanggan kehabisan kesabaran.";
    if(state.phase==="request")return "Permintaan peminjaman masuk. Periksa hasil safety test atas alokasi setelah transfer. Timer dijeda selama popup.";
    if(state.cooking)return `${R.name(state.cooking)} sedang memasak; alat akan dilepas setelah ${R.COOK_SECONDS} detik. Koki lain tetap mengantre.`;
    if(state.phase==="complete")return "Simulasi selesai. Periksa layanan, keputusan, dan urutan yang benar-benar dijalankan.";
    return "Alokasi aman. Arahkan setiap koki yang belum selesai, termasuk D, agar tidak ada pesanan yang terus tertunda.";
  }
  function stations(){
    return `<div class="hard-kitchen">${R.currentJobs(state).map((job,i)=>{
      const id=job.chef,c=R.CHEFS[id],held=R.TOOLS.filter(t=>state.owners[t]===id),done=["served","cancelled","escaped","unserved"].includes(job.status);
      return `<article class="hard-station ${job.status} ${state.cooking===id?"cooking":""}" data-hard-chef="${id}"><div class="hard-order">${pic(foodImages[i])}<b>${job.id} · ${c.dish}</b><span>Pelanggan Koki ${id}</span><progress data-hard-patience="${job.id}" max="${job.patience}" value="${R.remaining(state,job)}" aria-label="Kesabaran ${job.id}"></progress><small data-hard-clock="${job.id}">${Math.ceil(R.remaining(state,job))} detik</small></div>${pic(`assets/medium/customer-${i%2+1}.png`,"hard-customer-sprite")}<div class="hard-counter-line"></div><div class="hard-chef-area"><div class="hard-held">${held.map(t=>pic(toolImages[t],"",R.LABELS[t])).join("")}${!held.length?"<span>Tanpa alat</span>":""}</div>${pic(c.image,"hard-chef-sprite",c.name)}<strong>${id} · ${c.name}</strong><small>${state.cooking===id?"Sedang memasak":job.status==="served"?"✓ Terlayani":job.status==="cancelled"?"✕ Dibatalkan":job.status==="escaped"?"Kabur!":job.status==="unserved"?"Belum terlayani":"Menunggu giliran"}</small><span class="hard-recipe">${R.TOOLS.filter((t,n)=>R.MAX[id][n]).map(t=>R.LABELS[t]).join(" + ")}</span>${match===2&&!done?`<button class="btn" data-hard-dispatch="${id}" ${state.phase!=="schedule"?"disabled":""}>Arahkan Koki ${id}</button>`:""}</div></article>`;
    }).join("")}</div>`;
  }
  function matrix(){
    const check=R.safety(state);
    return `<section class="hard-paper hard-matrix-panel"><h2>Safe State · Banker's</h2><p class="hard-small">Vektor: Katel, Panci, Kompor<br>Total ${vector(R.TOTAL)} · Available <b>${vector(check.available)}</b></p><div class="hard-matrix-scroll"><table class="hard-matrix"><thead><tr><th>Koki</th><th>Max</th><th>Allocation</th><th>Need</th></tr></thead><tbody>${R.IDS.map(id=>`<tr><th>${id}</th><td>${R.MAX[id].join("")}</td><td>${(check.allocation[id]||[0,0,0]).join("")}</td><td>${check.need[id]?check.need[id].join(""):"Selesai"}</td></tr>`).join("")}</tbody></table></div><p class="hard-safe-sequence ${check.safe?"safe":"unsafe"}">${check.safe?`SAFE · ${check.sequence.join(" → ")||"Semua selesai"}`:"UNSAFE · Tidak ada koki dapat selesai"}</p><details><summary>Jejak Work</summary><ol>${check.trace.map(t=>`<li>${t.chef}: ${vector(t.before)} → ${vector(t.after)}</li>`).join("")||"<li>Need setiap koki melebihi Work yang tersedia.</li>"}</ol></details></section>`;
  }
  function actionPanel(){
    if(match===2&&["plan","blocked"].includes(state.phase))return `<section class="hard-paper hard-plan"><h2>1. Pulihkan alokasi alat</h2><div class="hard-methods">${R.METHODS.map((m,i)=>`<button data-hard-method="${i}" aria-pressed="${state.method===m}">${escape(m)}</button>`).join("")}</div><button class="btn" data-hard="recover" ${!state.method?"disabled":""}>Terapkan Strategi →</button>${state.phase==="blocked"?'<button class="hard-plain" data-hard="wait-timeout">Amati sampai tenggat habis</button>':""}</section>`;
    if(match===3&&state.phase==="blocked")return `<section class="hard-paper hard-repair"><h2>Pulihkan Tiga Alat yang Terkunci</h2><p>Pilih pemegang alat untuk melepas alokasinya. Penjadwalan ulang mempertahankan tenggat; pembatalan mengorbankan satu pesanan.</p><label for="hard-victim">Pesanan / koki</label><select id="hard-victim">${R.activeIds(state).map(id=>`<option value="${id}">${R.name(id)}</option>`).join("")}</select><div class="hard-actions"><button class="btn" data-hard-repair="reschedule">Jadwalkan Ulang</button><button class="hard-plain" data-hard-repair="cancel">Batalkan Pesanan</button><button class="hard-plain" data-hard="wait-timeout">Amati sampai tenggat habis</button></div></section>`;
    if(state.cooking)return `<section class="hard-paper"><h2>Masak, Selesai, Lepaskan</h2><p data-hard-cook-label>${R.name(state.cooking)} · ${Math.ceil(state.cookLeft)} detik</p><progress id="hard-cook-progress" max="${R.COOK_SECONDS}" value="${R.COOK_SECONDS-state.cookLeft}" aria-label="Progres memasak"></progress></section>`;
    if(state.phase==="schedule")return `<section class="hard-paper"><h2>2. Jalankan Urutan Aman</h2><p>${match===2?"Klik Arahkan pada setiap koki yang belum selesai. Beberapa urutan aman dapat dipakai; jangan abaikan koki terakhir.":"Penjadwal memakai hasil safety test dan memberi giliran kepada seluruh koki."}</p>${match===2?'<button class="hard-plain" data-hard="wait-timeout">Amati jika koki terus ditunda</button>':'<button class="btn" data-hard="auto">Jalankan Safe Sequence →</button>'}</section>`;
    return "";
  }
  function queue(){
    if(match!==3)return "";
    const labels={future:"Akan datang",queued:"Antre",waiting:"Aktif",cooking:"Memasak",served:"Terlayani",cancelled:"Dibatalkan",escaped:"Kabur",unserved:"Belum terlayani"};
    return `<section class="hard-paper hard-queue"><h2>Antrean 12 Pelanggan · 3 Gelombang</h2><p class="hard-small">Gelombang datang pada detik 0, 7, dan 14. Tenggat dihitung sejak kedatangan, termasuk ketika masih antre.</p><div>${state.jobs.map(j=>`<span class="${j.status}" data-hard-queue="${j.id}"><b>${j.id} · ${j.chef}</b>${labels[j.status]}<small data-hard-queue-clock="${j.id}">${j.status==="future"?`Datang ${j.releaseAt}s`:!['served','cancelled','escaped','unserved'].includes(j.status)?`${Math.ceil(R.remaining(state,j))}s tersisa`:""}</small></span>`).join("")}</div></section>`;
  }
  function renderPlay(){
    const needs=R.notify(state);
    content.innerHTML=`<div class="hard-play-heading"><div><span class="hard-eyebrow">MATCH ${match} / 3${match===3?` · GELOMBANG ${state.wave+1} / 3`:""}</span><h1 tabindex="-1">${titles[match]}</h1></div><div class="hard-score"><b>${R.score(state)}<small>/100</small></b><span>${state.served}/${state.jobs.length} terlayani · ${state.correct} benar / ${state.wrong} salah</span></div></div><div class="hard-notice" role="status"><span>!</span><p>${notice()}</p></div><p class="hard-aging" id="hard-aging">Semua koki dipantau agar tidak terus tertunda.</p><div class="hard-play-layout"><div class="hard-workspace">${stations()}<div id="hard-action-panel">${actionPanel()}</div>${queue()}</div><aside class="hard-sidebar">${matrix()}<section class="hard-paper hard-needs"><h2>Notifikasi Kebutuhan</h2><ul>${needs.map(t=>`<li>${t}</li>`).join("")||"<li>Alat lengkap atau bebas; tidak ada permintaan yang tertahan pemilik lain.</li>"}</ul></section><section class="hard-paper hard-log"><h2>${pic("assets/match3/Ikon Log Keputusan.png")}Log Keputusan</h2><ol>${state.log.map(l=>`<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol></section></aside></div>`;
    const list=content.querySelector(".hard-log ol");list.scrollTop=list.scrollHeight;clocks();
  }
  function clocks(){
    for(const job of state.jobs){
      const text=content.querySelector(`[data-hard-clock="${job.id}"]`),bar=content.querySelector(`[data-hard-patience="${job.id}"]`),queued=content.querySelector(`[data-hard-queue-clock="${job.id}"]`);
      const active=["waiting","queued","cooking"].includes(job.status),left=Math.ceil(R.remaining(state,job));
      if(text)text.textContent=active?`${left} detik`:job.status==="served"?"Selesai":job.status==="escaped"?"Waktu habis":job.status==="cancelled"?"Dibatalkan":"Belum terlayani";
      if(bar)bar.value=R.remaining(state,job);if(queued&&active)queued.textContent=`${left}s tersisa`;
    }
    const label=content.querySelector('[data-hard-cook-label]'),bar=$("hard-cook-progress");if(bar)bar.value=R.COOK_SECONDS-state.cookLeft;if(label&&state.cooking)label.textContent=`${R.name(state.cooking)} · ${Math.ceil(state.cookLeft)} detik`;
    const waiting=state.jobs.filter(j=>["waiting","queued"].includes(j.status)).sort((a,b)=>(state.time-b.releaseAt)-(state.time-a.releaseAt));
    if(waiting[0]&&$("hard-aging")){const age=Math.max(0,Math.floor(state.time-waiting[0].releaseAt));$("hard-aging").textContent=age>=20?`Perhatian: ${waiting[0].id} / Koki ${waiting[0].chef} sudah menunggu ${age} detik. Hindari starvation layanan.`:"Semua koki dipantau agar tidak terus tertunda.";}
  }
  function feedback(result,{auto=false}={}){
    if(!result)return;renderPlay();showDialog(result.ok?"Benar!":"Salah!",`<p>${escape(result.text)}</p><div class="hard-points">${result.delta>0?"+":""}${result.delta} poin · Skor ${result.score}/100</div>${result.ok?"":"<small>Penalti tetap diperhitungkan pada skor akhir, termasuk ketika skor sementara masih nol.</small>"}`,{ok:result.ok,next:auto?()=>{if(state.phase==="schedule"){R.startAuto(state);renderPlay();}}:null});
  }
  function loanDialog(){
    const q=state.request,before=R.safety(state),preview=R.previewLoan(state);
    showDialog("Konfirmasi Peminjaman",`<div class="hard-loan-visual">${pic(R.CHEFS[q.from].image)}${pic(toolImages[q.tool])}${pic(R.CHEFS[q.to].image)}</div><p><b>${R.name(q.to)}</b> meminta <b>${R.LABELS[q.tool]}</b> dari <b>${R.name(q.from)}</b>.</p><p class="hard-small">Permintaan diperiksa pada checkpoint sebelum masakan berikutnya dimulai.</p><div class="hard-loan-test"><p><b>Sebelum:</b> Available ${vector(before.available)} · Safe sequence ${before.sequence.join(" → ")}.</p><p><b>Setelah transfer:</b> Available ${vector(preview.available)}.</p><p><b>Safety test:</b> ${preview.safe?`SAFE · ${preview.sequence.join(" → ")}. Semua koki dapat selesai dan mengembalikan alat secara berurutan.`:"UNSAFE · Tidak ada Need yang dapat dipenuhi Work. A/B/C saling menunggu dan D juga tertahan."}</p></div><p class="hard-pause-note">Ⅱ Timer dijeda saat permintaan dan popup hasil diperiksa.</p>`,{type:"loan",icon:"?",actions:'<button class="btn hard-yes" data-hard-give="yes">Dikasih / Ya</button><button class="btn hard-no" data-hard-give="no">Tidak</button><button class="hard-plain" data-hard="cancel-request">Kembali ke Pilih Match</button>'});
  }
  function handleEvents(events){
    if(!events.length){clocks();return;}
    renderPlay();
    if(state.phase==="complete"){
      save();const won=state.status==="won";
      showDialog(won?"Semua Pelanggan Terlayani!":state.escaped?"Salah · Pelanggan Kabur!":"Pemulihan Selesai",`<p>${won?"Seluruh koki mendapatkan giliran dan mengembalikan alat setelah memasak.":state.escaped?"Ada koki yang tertahan sampai tenggat habis. Pesanan yang belum selesai dicatat sebagai belum terlayani.":"Pesanan aktif selesai, dengan biaya pembatalan yang tercatat pada hasil."}</p>`,{ok:!state.escaped,button:"Lihat Hasil",next:renderResult});
    }else if(state.phase==="request")loanDialog();
    else if(match===2&&events.includes("served"))showDialog("Benar · Pesanan Terlayani!","<p>+10 poin layanan. Koki telah melepas alokasinya. Arahkan koki berikutnya yang belum selesai; jangan meninggalkan koki D.</p>");
  }
  function frame(time){
    if(view!=="play"||shell.hidden)return;
    const dt=Math.min(Math.max(0,(time-lastTime)/1000),.25);lastTime=time;
    if(dialog.hidden&&!document.hidden)handleEvents(R.tick(state,dt));
    if(view==="play")raf=requestAnimationFrame(frame);
  }
  function renderResult(){
    const r=results[match];setView("result");location(`Hasil Match ${match}`);
    content.innerHTML=`<div class="hard-paper hard-result"><span class="hard-eyebrow">HARD MATCH ${match} · 4 KOKI / 3 UNIT ALAT</span><h1 tabindex="-1">${match===1?"Deadlock Tanpa Penanganan":r.status==="won"?"Semua Koki Mendapat Giliran!":r.status==="partial"?"Pulih, Ada Pesanan Dikorbankan":"Layanan Belum Berhasil"}</h1>${match===1?'<div class="hard-result-cycle">A → B → C → A</div>':`<div class="hard-stars" aria-label="${r.stars} bintang">${rating(r.score)}</div><div class="hard-final-score">${r.score}<small>/100</small></div>`}<p>${match===1?"A/B/C menahan tiga alat dalam circular wait. D tidak memiliki alat dan tertahan di luar siklus. Tanpa penanganan, empat pesanan tidak selesai.":match===2?"Deteksi & Pemulihan membebaskan alokasi awal. Pemain mengarahkan seluruh koki secara bergantian, memeriksa kombinasi resep dan tenggat pelanggan.":"Safety test memeriksa Available, Max, Allocation, dan Need. Permintaan aman memberi urutan penyelesaian; pemulihan dapat melepas alokasi lewat penjadwalan ulang atau pembatalan."}</p><div class="hard-result-stats"><span><b>${r.served}/${r.total}</b> terlayani</span><span><b>${r.escaped}</b> kabur</span><span><b>${r.cancelled}</b> dibatalkan</span><span><b>${r.unserved}</b> belum terlayani</span></div>${match!==1?`<p>${r.correct} keputusan benar · ${r.wrong} salah · ${match===3?`Akurasi izin ${r.accuracy}% · ${r.rescheduled} penjadwalan ulang`:"Seluruh giliran diarahkan pemain"}</p><p class="hard-small">100 = ★★★ · 50–99 = ★★☆ · 0–49 = ★☆☆</p>`:""}<div class="hard-actions"><button class="btn" data-hard-play="${match}">↻ Ulangi Match</button><button class="btn" ${match===3?'data-hard="compare"':`data-hard-play="${match+1}"`}>${match===3?"Perbandingan 3 Match →":`Lanjut Match ${match+1} →`}</button><button class="hard-plain" data-hard="selector">Pilih Match</button><button class="hard-plain" data-hard="compare">Lihat Perbandingan</button></div></div>`;focus();
  }
  function compare(){
    setView("compare");location("Perbandingan Hard");
    const cells=fn=>[1,2,3].map(m=>`<td>${results[m]?fn(results[m],m):"Belum dimainkan"}</td>`).join("");
    content.innerHTML=`<div class="hard-heading"><span class="hard-eyebrow">HASIL PERCOBAAN TERAKHIR</span><h1 tabindex="-1">Perbandingan Penanganan Deadlock Hard Mode</h1><p>Empat koki, tiga alat, tiga pendekatan.</p></div><div class="hard-table-wrap"><table class="hard-comparison"><caption>Hard Match 1 vs Match 2 vs Match 3</caption><thead><tr><th>Perbandingan</th>${[1,2,3].map(m=>`<th>Match ${m}<br>${titles[m]}</th>`).join("")}</tr></thead><tbody><tr><th>Status</th>${cells(status)}</tr><tr><th>Pelanggan</th>${cells(r=>`${r.served}/${r.total} terlayani · ${r.escaped} kabur · ${r.cancelled} dibatalkan · ${r.unserved} belum terlayani`)}</tr><tr><th>Skor & Bintang</th>${cells((r,m)=>m===1?"— · Pengamatan deadlock":`<b>${r.score}/100</b><span class="hard-table-stars">${rating(r.score)}</span>`)}</tr><tr><th>Keputusan Benar / Salah</th>${cells((r,m)=>m===1?"—":`${r.correct} / ${r.wrong}${m===3?` · Akurasi izin ${r.accuracy}%`:""}`)}</tr><tr><th>Urutan / Gelombang</th>${cells((r,m)=>m===1?"Tidak ada proses selesai":m===2?r.sequence.join(" → "):r.waves.map(w=>`G${w.wave}: ${w.sequence.join(" → ")}`).join("<br>"))}</tr><tr><th>Cara Kerja</th><td>A/B/C membentuk circular wait; D menunggu di luar siklus. Tidak ada penanganan.</td><td>Deteksi & Pemulihan pada checkpoint, lalu pemain mengarahkan A/B/C/D. Alat dilepas setelah tiap resep selesai.</td><td>Banker's safety test atas 4 proses dan 3 unit. Gelombang datang saat dapur masih melayani antrean. Izin diberikan jika seluruh proses memiliki safe sequence.</td></tr><tr><th>Starvation & Pemulihan</th><td>D ikut tertahan meski tidak memegang alat.</td><td>Koki yang terus dilewatkan bisa kehilangan pelanggan. Pemain harus memberi giliran kepada semua.</td><td>Penjadwalan ulang tidak mereset tenggat. Pembatalan melepas alat tetapi mengurangi layanan yang diselamatkan.</td></tr><tr><th>Main Lagi</th>${[1,2,3].map(m=>`<td><button class="hard-plain" data-hard-play="${m}">Main Match ${m} →</button></td>`).join("")}</tr></tbody></table></div><details class="hard-paper hard-comparison-log"><summary>${pic("assets/match3/Ikon Log Keputusan.png")}Log Keputusan Match 3 (${results[3]?.log.length||0})</summary>${results[3]?`<ol>${results[3].log.map(l=>`<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol>`:"<p>Selesaikan Match 3 untuk melihat log.</p>"}</details><p class="hard-small hard-center">Banker's memeriksa seluruh urutan, bukan hanya satu koki. Pada model single-instance ini, tiga alat berarti paling banyak tiga pemegang alat; koki keempat dapat menunggu tanpa menjadi pemegang dalam siklus.</p><div class="hard-actions"><button class="btn" data-hard="selector">← Pilih Match</button><button class="hard-plain" data-hard="home">Kembali ke Menu Utama</button></div>`;focus();
  }
  function audio(){const on=Sfx.volume>0;$("hard-audio").textContent=on?"SFX ON":"SFX OFF";$("hard-audio").setAttribute("aria-pressed",String(on));}
  function settings(){
    showDialog("Pengaturan Suara",`<p>Timer Hard dijeda selama pengaturan dibuka.</p><label class="hard-volume">Musik<input id="hard-music-volume" type="range" min="0" max="100" value="${Math.round(Music.volume*100)}"></label><label class="hard-volume">SFX<input id="hard-sfx-volume" type="range" min="0" max="100" value="${Math.round(Sfx.volume*100)}"></label>`,{icon:"♫",button:"Kembali ke Game"});
    $("hard-music-volume").addEventListener("input",e=>{Music.set(Number(e.target.value)/100);Music.start();saveAudio();});
    $("hard-sfx-volume").addEventListener("input",e=>{Sfx.setVolume(Number(e.target.value)/100);syncChip();audio();saveAudio();});
  }
  function exit(home=false){cleanup();shell.hidden=true;setMode(home?"menu":"level");$(home?"menu-main":"menu-level").querySelector("button").focus();}
  function click(e){
    const b=e.target.closest("button");if(!b||b.disabled)return;const action=b.dataset.hard;
    if(!dialog.hidden){
      if(action==="close-dialog")closeDialog();else if(action==="cancel-request")selector();
      else if(kind==="loan"&&b.dataset.hardGive){dialog.hidden=true;kind="feedback";feedback(R.decide(state,b.dataset.hardGive==="yes"),{auto:true});}
      return;
    }
    if(action==="audio"){$("sfx").click();audio();return;}
    Sfx.confirm();
    if(action==="selector")return selector();if(action==="compare")return compare();if(action==="settings")return settings();if(action==="exit")return exit();if(action==="home")return exit(true);
    if(b.dataset.hardPlay)return play(Number(b.dataset.hardPlay));
    if(action==="skip"){window.HardMatch1.advance(27.7);if(view==="match1"){R.finishMatch1(state);save();renderResult();}return;}
    if(view!=="play")return;
    if(b.dataset.hardMethod!==undefined){const i=b.dataset.hardMethod;state.method=R.METHODS[Number(i)];renderPlay();content.querySelector(`[data-hard-method="${i}"]`).focus({preventScroll:true});return;}
    if(action==="recover")return feedback(R.recover(state,state.method));
    if(b.dataset.hardDispatch)return feedback(R.dispatch(state,b.dataset.hardDispatch));
    if(action==="auto"){R.startAuto(state);renderPlay();return;}
    if(action==="wait-timeout"){const jobs=state.jobs.filter(j=>["waiting","queued","cooking"].includes(j.status));handleEvents(R.tick(state,Math.min(...jobs.map(j=>R.remaining(state,j)))+1));return;}
    if(b.dataset.hardRepair){const id=$("hard-victim").value;return feedback(R.repair(state,b.dataset.hardRepair,id),{auto:true});}
  }
  shell.addEventListener("click",click);dialog.addEventListener("click",click);
  new ResizeObserver(([entry])=>{if(entry.target.offsetHeight)shell.style.setProperty("--hard-header",`${entry.target.offsetHeight}px`);}).observe(shell.querySelector(".hard-toolbar"));
  document.addEventListener("keydown",e=>{
    if(shell.hidden)return;
    if(!dialog.hidden){
      if(e.key==="Escape"){e.preventDefault();kind==="loan"?selector():closeDialog();}
      if(e.key==="Tab"){const all=[...dialog.querySelectorAll("button,input")],first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }else if(e.key==="Escape"){e.preventDefault();view==="selector"?exit():selector();}
  });
  document.addEventListener("visibilitychange",()=>{lastTime=performance.now();window.HardMatch1.pause(document.hidden||!dialog.hidden);});
  window.startGame3=()=>{shell.hidden=false;stage.dataset.mode="game";audio();selector();};
})();
