"use strict";
/* Orkestrator Easy. Animasi lama di easy-match1.js; aturan/timer di easy-state.js. */
(() => {
  const R=window.EasyRules, Selection=window.EasySelection, shell=$("game"), content=$("easy-content"), dialog=$("easy-dialog");
  const KEY="dapurMacet.easy.results.v1", titles=["","Tanpa Penanganan","Urutan & Strategi","Izin Peminjaman"];
  const toolImages={wok:"assets/wajan.png",stove:"assets/kompor.png"};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const image=(src,cls="",alt="")=>`<img src="${src}" class="${cls}" alt="${alt}">`;
  const stars=value=>"★".repeat(R.stars(value))+"☆".repeat(3-R.stars(value));
  let view="setup",state=null,match=1,raf=0,lastTime=0,afterDialog=null,dialogKind="feedback",lastFocus=null,generation=0;
  const results=readResults();
  function readResults(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)),out={};
      for(const m of [1,2,3]){
        const r=raw?.[m];
        if(!r||r.match!==m||!["won","lost"].includes(r.status)||R.cleanTeam(r.team).length!==2)continue;
        if(![r.score,r.correct,r.wrong,r.served,r.escaped,r.unserved,r.accuracy].every(n=>Number.isFinite(n)&&n>=0)||r.score>100||r.accuracy>100)continue;
        if(!Array.isArray(r.log))continue;
        out[m]={...r,team:R.cleanTeam(r.team),stars:R.stars(r.score),log:r.log.filter(l=>l&&typeof l.text==="string"&&["info","correct","wrong"].includes(l.kind)).slice(-200)};
      }
      return out;
    }catch(_){return {};}
  }
  function save(){results[match]=R.summary(state);try{localStorage.setItem(KEY,JSON.stringify(results));}catch(_){}}
  function cleanup(){
    generation++;cancelAnimationFrame(raf);window.EasyMatch1.halt();dialog.hidden=true;afterDialog=null;
    $("ana").hidden=true;$("game-cap").classList.remove("show");shell.classList.remove("dead","done");
    $("easy-skip").hidden=true;$("easy-m1-team").hidden=true;
  }
  function setView(next){cleanup();view=next;shell.dataset.easyView=next;content.hidden=next==="match1";$("game-canvas").hidden=next!=="match1";content.scrollTop=0;}
  function location(text){$("easy-location").textContent=text;}
  function focus(){content.querySelector("h1")?.focus({preventScroll:true});}
  function teamLine(team=Selection.team){return team.map((id,i)=>`${R.CHARACTERS[id].name} (Koki ${i?"B":"A"})`).join(" & ");}
  function setup(){
    setView("setup");location("Persiapan Dapur");
    content.innerHTML=`<div class="easy-heading"><span class="easy-eyebrow">SEBELUM MEMBUKA DAPUR</span><h1 tabindex="-1">Siapkan dua kokimu!</h1><p>Pilih maksimal dua karakter. Urutan pilihan menentukan Koki A dan Koki B di semua match Easy.</p></div>
      <div class="easy-preparation"><section class="easy-paper"><h2>Pemilihan Karakter</h2><p>Klik kartu untuk memilih atau membatalkan. Pilihan ketiga tidak akan ditambahkan.</p><div class="easy-character-options" role="group" aria-label="Pilih maksimal dua koki">${Object.entries(R.CHARACTERS).map(([id,c])=>`<button data-easy-character="${id}" aria-pressed="false">${image(c.image,"",c.name)}<span>${c.name}</span></button>`).join("")}</div><button class="btn" data-team-confirm>Konfirmasi Karakter</button><p class="easy-team-status" data-team-status role="status" aria-live="polite"></p></section>
      <section class="easy-paper"><h2>Pemilihan Barang</h2><p>Pilih alat yang ingin kamu kenali lebih dulu.</p><div class="easy-item-options" role="group" aria-label="Barang fokus tutorial">${[["Wajan","assets/wajan.png"],["Panci","assets/panci.png"],["Kompor","assets/kompor.png"]].map(([label,src])=>`<button data-easy-item="${label}" aria-pressed="false">${image(src)}<span>${label}</span></button>`).join("")}</div><p class="easy-small">Pilihan ini menjadi fokus pengamatan. Alokasi skenario Easy tetap: A memegang Katel dan B memegang Kompor.</p><p class="easy-small">Jika hanya satu karakter dipilih, konfirmasi akan menambahkan satu pasangan default yang berbeda.</p></section></div>
      <div class="easy-actions"><button class="btn" data-easy="ready" data-team-confirm>Gunakan Tim & Pilih Match →</button></div>`;
    Selection.sync();focus();
  }
  function resultStatus(r){return !r?"Belum dimainkan":r.status==="won"?"Berhasil · Pesanan terselamatkan":"Gagal · Layanan terhenti";}
  function selector(){
    setView("selector");location("Pilih Match");
    content.innerHTML=`<div class="easy-heading"><span class="easy-eyebrow">DUA KOKI · TIGA CARA BELAJAR</span><h1 tabindex="-1">Dapur kecil, keputusan besar.</h1><p>${teamLine()}</p></div><div class="easy-match-cards">${[1,2,3].map(m=>`<article class="easy-match-card"><div class="easy-card-art">${image("assets/easy/asset-f4cce51c5aa1.png")}${Selection.team.map(id=>image(R.CHARACTERS[id].image,"easy-card-chef")).join("")}<span>MATCH ${m}</span></div><div class="easy-card-copy"><h2>${titles[m]}</h2><p>${["","Amati dua koki saling menahan alat sampai dapur macet.","Dahulukan pelanggan yang lebih mendesak dan pilih strategi dari tutorial.","Periksa kondisi alat sebelum menjawab Dikasih atau Tidak."][m]}</p><div class="easy-card-status">${resultStatus(results[m])}${results[m]?`<b>${m===1?"Deadlock tanpa penanganan":`${results[m].score}/100 · ${stars(results[m].score)}`}</b>`:""}</div><button class="btn" data-easy-play="${m}">${results[m]?"Ulangi":"Mulai"} Match ${m} →</button></div></article>`).join("")}</div><p class="easy-small easy-center">Hasil terakhir disimpan di browser ini. Kamu bisa mengulang setiap match atau mengganti tim melalui Tim Koki.</p>`;focus();
  }
  function showDialog(title,html,{ok=true,button="Lanjutkan",after=null,kind="feedback",actions=null,icon=ok?"✓":"!"}={}){
    lastFocus=document.activeElement;window.EasyMatch1.pause(true);
    $("easy-dialog-title").textContent=title;$("easy-dialog-copy").innerHTML=html;
    $("easy-dialog-icon").textContent=icon;dialog.dataset.tone=ok?"correct":"wrong";
    $("easy-dialog-actions").innerHTML=actions||`<button class="btn" data-easy="close-dialog">${button}</button>`;
    dialogKind=kind;afterDialog=after;dialog.hidden=false;dialog.querySelector("button,input")?.focus();
  }
  function closeDialog(){
    if(dialog.hidden||dialogKind==="request")return;
    dialog.hidden=true;const after=afterDialog;afterDialog=null;lastTime=performance.now();window.EasyMatch1.pause(false);
    if(after)after();
    if(!dialog.hidden)return;
    if(lastFocus?.isConnected&&!lastFocus.closest("[hidden]")&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});
    else content.querySelector("button")?.focus({preventScroll:true});
  }
  async function play(number){
    match=number;setView(match===1?"match1":"play");location(`Match ${match} · ${titles[match]}`);
    state=R.create(match,Selection.team);
    if(match===1){
      const token=generation;$("easy-m1-team").hidden=false;$("easy-m1-team").textContent=teamLine(state.team);
      const skip=$("easy-skip");skip.hidden=false;skip.disabled=true;
      try{await window.EasyMatch1.start({team:state.team,onDone(){R.finishMatch1(state);save();renderResult();}});if(token===generation)skip.disabled=false;}
      catch(_){if(token!==generation)return;content.hidden=false;content.innerHTML=`<div class="easy-heading"><h1 tabindex="-1">Circular Wait · A ⇄ B</h1><p>${teamLine(state.team)}</p><p>A memegang Katel dan menunggu Kompor. B memegang Kompor dan menunggu Katel. Keduanya tidak melepas alat; tanpa penanganan, dapur tetap macet.</p></div>`;skip.disabled=false;}
    }else{renderPlay();focus();lastTime=performance.now();raf=requestAnimationFrame(frame);if(match===3)requestDialog();}
  }
  function notice(){
    if(state.phase==="plan")return "Dua pelanggan datang bersamaan. P1 (Koki A) memiliki tenggat terdekat. Circular wait sudah terdeteksi; tentukan urutan dan strategi pemulihan.";
    if(state.phase==="request")return "Ada permintaan peminjaman alat. Periksa pemilik, kondisi pemakaian, serta kemungkinan circular wait. Timer dijeda selama popup.";
    if(state.phase==="blocked")return state.deadlocked?"Circular wait! Kedua koki masih saling menunggu. Timer pelanggan terus berkurang.":"Permintaan aman ditolak; layanan terhambat. Pelanggan terus menunggu.";
    if(state.phase==="roundEnd")return "Ronde selesai. Periksa hasilnya, lalu lanjutkan ke kondisi alat berikutnya.";
    if(state.phase==="complete")return "Simulasi selesai. Periksa skor, pelanggan, dan keputusanmu.";
    if(state.cooking)return `${R.name(state,state.cooking)} sedang memasak. Setelah selesai, alat dilepas dan giliran berikutnya bisa dimulai.`;
    return `Alat siap untuk ${R.name(state,state.queue[0])}. Mulai masak agar pelanggan terlayani sebelum kehabisan waktu.`;
  }
  function kitchen(){
    const s=state;
    return `<div class="easy-kitchen"><div class="easy-customers">${s.customers.map((c,i)=>`<article class="easy-customer ${c.status}"><div class="easy-order">${image(`assets/easy/food-${i?"b":"a"}.png`)}<b>${c.id} · ${c.dish}</b><span>${R.name(s,c.chef)}</span><progress data-patience="${c.id}" max="${c.patience}" value="${c.remaining}" aria-label="Kesabaran ${c.id}"></progress><small data-clock="${c.id}">${Math.ceil(c.remaining)} detik</small></div>${image(`assets/medium/customer-${i+1}.png`,"easy-customer-sprite")}<span class="easy-customer-status">${{waiting:"Menunggu",served:"✓ Terlayani",escaped:"Kabur! Waktu habis",unserved:"Belum terlayani"}[c.status]}</span></article>`).join("")}</div><div class="easy-kitchen-counter"></div><div class="easy-chefs">${["A","B"].map((id,i)=>{
      const held=Object.keys(s.owners).filter(t=>s.owners[t]===id),cooking=s.cooking===id||(s.phase==="request"&&s.request?.busy&&s.request.owner===id);
      return `<article class="easy-chef ${cooking?"cooking":""}" data-kitchen-chef="${id}"><div class="easy-held-tools">${held.map(t=>image(toolImages[t],"",R.TOOLS[t])).join("")}${!held.length?'<span>Alat bebas / menunggu giliran</span>':""}</div>${image(R.CHARACTERS[s.team[i]].image,"easy-chef-sprite",R.CHARACTERS[s.team[i]].name)}<strong>Koki ${id} · ${R.CHARACTERS[s.team[i]].name}</strong><small>${cooking?"Sedang memasak":s.waiting[id]?`Menunggu ${R.TOOLS[s.waiting[id]]}`:"Siap / menganggur"}</small></article>`;
    }).join("")}</div></div>`;
  }
  function actionPanel(){
    if(state.phase==="plan")return `<div class="easy-paper easy-plan"><h2>1. Siapa menggunakan alat dulu?</h2><div class="easy-leaders">${["A","B"].map(id=>`<button data-easy-leader="${id}" aria-pressed="${state.leader===id}">${R.name(state,id)}${id==="A"?" · P1 / 60 detik":" · P2 / 90 detik"}</button>`).join("")}</div><h2>2. Pilih strategi dari Tutorial</h2><div class="easy-methods">${R.METHODS.map((method,i)=>`<button data-easy-method="${i}" aria-pressed="${state.method===method}"><b>${escape(method)}</b><span>${["Deteksi siklus yang sudah terjadi, lalu pulihkan alokasi alat.","Atur penggunaan sejak awal agar syarat deadlock tidak terjadi.","Periksa safe state sebelum mengabulkan permintaan baru."][i]}</span></button>`).join("")}</div><button class="btn" data-easy="apply-plan" ${!state.leader||!state.method?"disabled":""}>Terapkan Urutan & Strategi →</button></div>`;
    if(state.phase==="ready")return `<div class="easy-paper"><h2>Giliran ${R.name(state,state.queue[0])}</h2><p>Gunakan Katel + Kompor, selesaikan pesanan, lalu lepaskan keduanya.</p><button class="btn" data-easy="cook">${state.served?"Alokasikan Alat & ":""}Masak Pesanan →</button></div>`;
    if(state.phase==="cooking")return `<div class="easy-paper easy-cooking"><h2>Memasak & Melayani</h2><p data-cooking-label>${R.name(state,state.cooking)} · ${Math.ceil(state.cookLeft)} detik</p><progress id="easy-cook-progress" max="${R.COOK_SECONDS}" value="${R.COOK_SECONDS-state.cookLeft}" aria-label="Progres memasak"></progress></div>`;
    if(state.phase==="blocked")return `<div class="easy-paper easy-blocked"><h2>${state.deadlocked?"Dapur Macet!":"Layanan Tertunda"}</h2><p>${state.deadlocked?"Tidak ada koki yang bisa melanjutkan. Pelanggan akan kabur ketika kesabarannya habis.":"Penolakan tadi menghambat pesanan yang sebenarnya bisa selesai."}</p><button class="btn" data-easy="wait-timeout">Lihat Akibat Menunggu →</button><small>Simulasikan waktu berlalu hingga tenggat pelanggan berikutnya.</small></div>`;
    if(state.phase==="roundEnd")return `<div class="easy-paper"><h2>Ronde ${state.round+1} selesai</h2><p>Setiap ronde memiliki dua pesanan dan alokasi alat baru.</p><button class="btn" data-easy="next-round">Lanjut Ronde ${state.round+2} →</button></div>`;
    return "";
  }
  function allocation(){
    return `<section class="easy-paper easy-allocation"><h2>Siapa Memegang Alat?</h2>${Object.entries(R.TOOLS).map(([t,label])=>`<div>${image(toolImages[t])}<span>${label}<b>${state.owners[t]?R.name(state,state.owners[t]):"Bebas"}</b></span></div>`).join("")}<p class="easy-cycle ${state.deadlocked?"danger":""}">${state.deadlocked?"A → B → A · Circular wait":"Tidak ada circular wait aktif"}</p></section>`;
  }
  function renderPlay(){
    content.innerHTML=`<div class="easy-play-heading"><div><span class="easy-eyebrow">MATCH ${match} / 3${match===3?` · RONDE ${state.round+1} / ${R.TOTAL_ROUNDS}`:""}</span><h1 tabindex="-1">${titles[match]}</h1></div><div class="easy-score"><b>${R.score(state)}<small>/100</small></b><span>${state.served}/${match===2?2:8} terlayani · ${state.correct} benar / ${state.wrong} salah</span></div></div><div class="easy-notice" role="status"><span>!</span><p>${notice()}</p></div><div class="easy-play-layout"><div class="easy-workspace">${kitchen()}<div id="easy-action-panel">${actionPanel()}</div></div><aside class="easy-sidebar">${allocation()}<section class="easy-paper easy-log"><h2>Log Dapur</h2><ol>${state.log.map(l=>`<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol></section></aside></div>`;
    const log=content.querySelector(".easy-log ol");log.scrollTop=log.scrollHeight;
  }
  function clocks(){
    for(const c of state.customers){const text=content.querySelector(`[data-clock="${c.id}"]`),bar=content.querySelector(`[data-patience="${c.id}"]`);if(text)text.textContent=c.status==="waiting"?`${Math.ceil(c.remaining)} detik`:c.status==="served"?"Selesai":c.status==="escaped"?"Waktu habis":"Ronde dihentikan";if(bar)bar.value=c.remaining;}
    const bar=$("easy-cook-progress"),label=content.querySelector('[data-cooking-label]');if(bar)bar.value=R.COOK_SECONDS-state.cookLeft;if(label&&state.cooking)label.textContent=`${R.name(state,state.cooking)} · ${Math.ceil(state.cookLeft)} detik`;
  }
  function feedback(res){
    if(!res)return;renderPlay();showDialog(res.ok?"Benar!":"Salah!",`<p>${escape(res.text)}</p><div class="easy-points">${res.delta>0?"+":""}${res.delta} poin · Skor ${res.score}/100</div>${!res.ok?"<small>Penalti 10 poin tetap dihitung pada skor akhir, termasuk ketika skor sementara masih nol.</small>":""}`,{ok:res.ok});
  }
  function handleEvents(events){
    if(!events.length){clocks();return;}
    renderPlay();
    if(state.phase==="complete"){
      save();showDialog(state.status==="won"?"Semua pesanan selesai!":"Pelanggan Kabur!",`<p>${state.status==="won"?"Alat digunakan bergantian dan semua pelanggan terlayani sebelum tenggat.":"Ada pelanggan kehabisan kesabaran karena layanan terhambat. Periksa keputusan dan alokasi alat pada hasil."}</p>`,{ok:state.status==="won",button:"Lihat Hasil",after:renderResult});
    }else if(state.phase==="roundEnd"){
      const success=state.history.at(-1).successful;
      showDialog(success?"Ronde Selesai!":"Pelanggan Kabur!",`<p>${success?"Kedua pelanggan terlayani. Alat dikembalikan dan siap untuk ronde berikutnya.":"Tenggat habis saat layanan terhambat. Pesanan lain pada ronde ini belum terlayani; ronde berikutnya dimulai dengan alokasi baru."}</p>`,{ok:success});
    }else if(match===2&&events.includes("served"))showDialog("Benar · Pesanan Terlayani!","<p>+35 poin layanan. Koki melepas Katel dan Kompor. Sekarang alokasikan kedua alat ke koki berikutnya.</p>");
  }
  function frame(time){
    if(view!=="play"||shell.hidden)return;
    const dt=Math.min(Math.max(0,(time-lastTime)/1000),.25);lastTime=time;
    if(dialog.hidden&&!document.hidden)handleEvents(R.tick(state,dt));
    if(view==="play")raf=requestAnimationFrame(frame);
  }
  function requestDialog(){
    const q=state.request,p=R.grantPreview(state),owner=R.name(state,q.owner),borrower=R.name(state,q.borrower);
    showDialog("Izin Peminjaman Alat",`<div class="easy-request-visual">${image(R.CHARACTERS[state.team[q.owner==="A"?0:1]].image)}${image(toolImages[q.tool])}${image(R.CHARACTERS[state.team[q.borrower==="A"?0:1]].image)}</div><p><b>${borrower}</b> ingin meminjam <b>${R.TOOLS[q.tool]}</b> dari <b>${owner}</b>.</p><div class="easy-request-facts"><p><b>Kondisi pemilik:</b> ${q.busy?"sedang memasak, memakai Katel dan Kompor bersamaan. Jika satu alat diambil, masakannya terhenti.":"alat yang diminta sedang menganggur dan belum dipakai memasak."}</p><p><b>Setelah dipinjamkan:</b> ${p.cycle?"peminjam akan menahan satu alat sambil meminta alat satunya; pemilik juga menunggu alat yang diambil. Siklus A ⇄ B akan terbentuk.":"peminjam akan memiliki semua alat yang dibutuhkan, dapat langsung menyelesaikan masakan dan mengembalikan alat."}</p><p><b>Pesanan aktif:</b> ${state.customers.map(c=>`${c.id} ${c.dish} / Koki ${c.chef}`).join(" · ")}</p></div><p class="easy-pause-note">Ⅱ Timer dijeda selama kamu memeriksa permintaan dan popup hasil.</p>`,{kind:"request",icon:"?",actions:'<button class="btn easy-yes" data-easy-give="yes">Dikasih</button><button class="btn easy-no" data-easy-give="no">Tidak</button><button class="easy-plain" data-easy="cancel-request">Kembali ke Pilih Match</button>'});
  }
  function renderResult(){
    const r=results[match];setView("result");location(`Hasil Match ${match}`);
    content.innerHTML=`<div class="easy-result easy-paper"><span class="easy-eyebrow">EASY MATCH ${match} · ${titles[match]}</span><h1 tabindex="-1">${match===1?"Deadlock Tanpa Penanganan":r.status==="won"?"Dapur Kembali Lancar!":"Layanan Belum Berhasil"}</h1><p>${teamLine(r.team)}</p>${match===1?' <div class="easy-result-icon">A ⇄ B</div>':`<div class="easy-stars" aria-label="${r.stars} bintang">${stars(r.score)}</div><div class="easy-final-score">${r.score}<small>/100</small></div>`}<p>${match===1?"Kedua koki menahan satu alat sambil menunggu alat lain. Tanpa penanganan, hold and wait dan circular wait terus berlangsung.":match===2?"Rencana pemulihan harus sesuai kondisi deadlock yang sudah terjadi dan tenggat pelanggan. Lepas alat setelah memasak agar koki lain mendapat giliran.":"Periksa safe state setiap kali ada permintaan. Berikan alat idle yang membuat peminjam langsung selesai; tunda pemindahan yang memecah pasangan alat koki yang sedang memasak."}</p><div class="easy-result-stats"><span><b>${r.served}</b> terlayani</span><span><b>${r.escaped}</b> kabur</span><span><b>${r.unserved}</b> belum terlayani</span><span><b>${r.correct}/${r.correct+r.wrong}</b> keputusan benar</span></div>${match===3?`<p>Akurasi keputusan: ${r.accuracy}% · 4 ronde / 8 pesanan.</p>`:""}${match!==1?'<p class="easy-small">100 = ★★★ · 50–99 = ★★☆ · 0–49 = ★☆☆</p>':""}<div class="easy-actions"><button class="btn" data-easy-play="${match}">↻ Ulangi Match</button><button class="btn" ${match===3?'data-easy="compare"':`data-easy-play="${match+1}"`}>${match===3?"Perbandingan 3 Match →":`Lanjut Match ${match+1} →`}</button><button class="easy-plain" data-easy="selector">Pilih Match</button><button class="easy-plain" data-easy="compare">Lihat Perbandingan</button></div></div>`;focus();
  }
  function compare(){
    setView("compare");location("Perbandingan Easy");
    const cells=fn=>[1,2,3].map(m=>`<td>${results[m]?fn(results[m],m):"Belum dimainkan"}</td>`).join("");
    content.innerHTML=`<div class="easy-heading"><span class="easy-eyebrow">HASIL PERCOBAAN TERAKHIR</span><h1 tabindex="-1">Perbandingan Penanganan Deadlock</h1><p>Easy Match 1 vs Match 2 vs Match 3</p></div><div class="easy-table-wrap"><table class="easy-table"><caption>Hasil nyata tiga match Easy</caption><thead><tr><th>Perbandingan</th>${[1,2,3].map(m=>`<th>Match ${m}<br>${titles[m]}</th>`).join("")}</tr></thead><tbody><tr><th>Status</th>${cells(resultStatus)}</tr><tr><th>Tim Koki</th>${cells(r=>teamLine(r.team))}</tr><tr><th>Pelanggan</th>${cells(r=>`${r.served} terlayani · ${r.escaped} kabur · ${r.unserved} belum terlayani`)}</tr><tr><th>Skor & Bintang</th>${cells((r,m)=>m===1?"— · Pengamatan deadlock":`<b>${r.score}/100</b><span class="easy-table-stars">${stars(r.score)}</span>`)}</tr><tr><th>Keputusan Benar / Salah</th>${cells((r,m)=>m===1?"—":`${r.correct} / ${r.wrong}${m===3?` · Akurasi ${r.accuracy}%`:""}`)}</tr><tr><th>Cara Kerja</th><td>Tanpa penanganan. A menahan Katel, B menahan Kompor; circular wait tidak diputus.</td><td>Deteksi & Pemulihan atas siklus yang sudah terjadi. Prioritaskan tenggat P1, pinjamkan Kompor ke A pada titik aman, lalu gunakan alat bergantian.</td><td>Validasi izin Dikasih / Tidak berdasarkan alokasi dan kondisi pemakaian. Cegah siklus baru, biarkan masakan aktif selesai sebelum alat dipinjamkan.</td></tr><tr><th>Pelajaran</th><td>Menunggu saja tidak memulihkan deadlock.</td><td>Pencegahan mengatur syarat sejak awal; Penghindaran memeriksa alokasi sebelum permintaan diberikan. Keduanya berbeda dari memulihkan siklus yang sudah terjadi.</td><td>Alat sibuk tidak selalu berarti deadlock. Pada ronde berisiko ini, memecah dua alat yang sama-sama diperlukan membentuk circular wait; menunda sampai pemilik selesai tetap memungkinkan layanan.</td></tr><tr><th>Main kembali</th>${[1,2,3].map(m=>`<td><button class="easy-plain" data-easy-play="${m}">Main Match ${m} →</button></td>`).join("")}</tr></tbody></table></div><details class="easy-paper easy-comparison-log"><summary>Log Keputusan Match 3 (${results[3]?.log.length||0})</summary>${results[3]?`<ol>${results[3].log.map(l=>`<li class="${l.kind}">${escape(l.text)}</li>`).join("")}</ol>`:"<p>Selesaikan Match 3 untuk melihat log.</p>"}</details><div class="easy-actions"><button class="btn" data-easy="selector">← Pilih Match</button><button class="easy-plain" data-easy="exit">Kembali ke Menu Utama</button></div>`;focus();
  }
  function audio(){const on=Sfx.volume>0;$("easy-audio").textContent=on?"SFX ON":"SFX OFF";$("easy-audio").setAttribute("aria-pressed",String(on));}
  function settings(){
    showDialog("Pengaturan Suara",`<p>Timer match dijeda selama pengaturan dibuka.</p><label class="easy-volume">Musik <input id="easy-music-volume" type="range" min="0" max="100" value="${Math.round(Music.volume*100)}"></label><label class="easy-volume">SFX <input id="easy-sfx-volume" type="range" min="0" max="100" value="${Math.round(Sfx.volume*100)}"></label>`,{icon:"♫",button:"Kembali ke Game"});
    $("easy-music-volume").addEventListener("input",e=>{Music.set(Number(e.target.value)/100);Music.start();saveAudio();});
    $("easy-sfx-volume").addEventListener("input",e=>{Sfx.setVolume(Number(e.target.value)/100);syncChip();audio();saveAudio();});
  }
  function exit(){cleanup();shell.hidden=true;setMode("menu");$("menu-main").querySelector("button").focus();}
  function click(e){
    const b=e.target.closest("button");if(!b||b.disabled)return;
    const action=b.dataset.easy;
    if(!dialog.hidden){
      if(action==="close-dialog")closeDialog();
      else if(action==="cancel-request")selector();
      else if(b.dataset.easyGive&&dialogKind==="request"){
        dialog.hidden=true;dialogKind="feedback";feedback(R.decide(state,b.dataset.easyGive==="yes"));
      }
      return;
    }
    if(b.dataset.easyCharacter){Selection.toggle(b.dataset.easyCharacter);Sfx.confirm();return;}
    if(b.dataset.easyItem){Selection.setItem(b.dataset.easyItem);Sfx.confirm();return;}
    if(b.hasAttribute("data-team-confirm")){if(Selection.confirm()&&action==="ready")selector();Sfx.confirm();return;}
    if(action==="audio"){$("sfx").click();audio();return;}
    Sfx.confirm();
    if(action==="setup")return setup();if(action==="selector")return selector();if(action==="compare")return compare();if(action==="exit")return exit();if(action==="settings")return settings();
    if(b.dataset.easyPlay)return play(Number(b.dataset.easyPlay));
    if(action==="skip") {window.EasyMatch1.advance(29.5);if(view==="match1"){R.finishMatch1(state);save();renderResult();}return;}
    if(view!=="play")return;
    if(b.dataset.easyLeader){const id=b.dataset.easyLeader;R.selectLeader(state,id);renderPlay();content.querySelector(`[data-easy-leader="${id}"]`).focus({preventScroll:true});return;}
    if(b.dataset.easyMethod!==undefined){const index=b.dataset.easyMethod;R.selectMethod(state,R.METHODS[Number(index)]);renderPlay();content.querySelector(`[data-easy-method="${index}"]`).focus({preventScroll:true});return;}
    if(action==="apply-plan")return feedback(R.plan(state));
    if(action==="cook"){R.startCook(state);renderPlay();return;}
    if(action==="wait-timeout")return handleEvents(R.tick(state,Math.max(...state.customers.map(c=>c.remaining))+1));
    if(action==="next-round"&&R.nextRound(state)){renderPlay();requestDialog();}
  }
  shell.addEventListener("click",click);dialog.addEventListener("click",click);
  new ResizeObserver(([entry])=>{if(entry.target.offsetHeight)shell.style.setProperty("--easy-header",`${entry.target.offsetHeight}px`);}).observe(shell.querySelector(".easy-toolbar"));
  document.addEventListener("keydown",e=>{
    if(shell.hidden)return;
    if(!dialog.hidden){
      if(e.key==="Escape"){e.preventDefault();dialogKind==="request"?selector():closeDialog();}
      if(e.key==="Tab"){
        const all=[...dialog.querySelectorAll("button,input")],first=all[0],last=all.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }else if(e.key==="Escape"){e.preventDefault();view==="setup"||view==="selector"?exit():selector();}
  });
  document.addEventListener("visibilitychange",()=>{lastTime=performance.now();window.EasyMatch1.pause(document.hidden||!dialog.hidden);});
  window.startGame=()=>{shell.hidden=false;stage.dataset.mode="game";audio();setup();};
})();
