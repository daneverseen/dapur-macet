/* Empat proses, tiga resource single-instance. Aturan murni dan Banker's safety test. */
(function(root){
  "use strict";
  const IDS=["A","B","C","D"],TOOLS=["wok","pot","stove"],TOTAL=[1,1,1],COOK_SECONDS=3,WAVES=3;
  const CHEFS={
    A:{name:"Koki",image:"assets/easy/chef-koki.png",dish:"Hotdog"},
    B:{name:"Neng Puput",image:"assets/easy/chef-puput.png",dish:"Sup"},
    C:{name:"Ceu Pipit",image:"assets/easy/chef-pipit.png",dish:"Tumis"},
    D:{name:"Mang Ucil",image:"assets/easy/chef-ucil.png",dish:"Paket Lengkap"}
  };
  const LABELS={wok:"Katel / Wajan",pot:"Panci",stove:"Kompor"};
  const MAX={A:[1,0,1],B:[0,1,1],C:[1,1,0],D:[1,1,1]};
  const METHODS=["Deteksi & Pemulihan","Pencegahan","Penghindaran"];
  const initial=()=>({wok:"A",pot:"C",stove:"B"});
  const empty=()=>({wok:null,pot:null,stove:null});
  const name=id=>`${CHEFS[id].name} (Koki ${id})`;
  const stars=value=>value===100?3:value>=50?2:1;
  const score=s=>Math.max(0,Math.min(100,s.earned-s.wrong*10));
  const log=(s,text,kind="info")=>s.log.push({text,kind,time:Math.round(s.time*10)/10});
  const terminal=status=>["served","escaped","cancelled","unserved"].includes(status);
  const currentJobs=s=>s.jobs.filter(j=>j.wave===s.wave);
  const activeIds=s=>s.match===1?[...IDS]:currentJobs(s).filter(j=>!terminal(j.status)).map(j=>j.chef);
  const remaining=(s,j)=>Math.max(0,j.deadline-s.time);

  function analyse(owners,active=IDS,priority=IDS,claims=MAX){
    if(Object.keys(owners).length!==3||TOOLS.some(t=>!Object.hasOwn(owners,t)))throw new Error("Hard memiliki tepat tiga jenis alat.");
    const ids=[...new Set(active)];
    if(ids.some(id=>!Object.hasOwn(CHEFS,id)))throw new Error("Proses tidak dikenal.");
    const allocation={},need={};
    for(const id of ids){
      if(!Array.isArray(claims[id])||claims[id].length!==3||claims[id].some(n=>n!==0&&n!==1))throw new Error("Max harus tiga klaim biner untuk tiga unit alat.");
      allocation[id]=TOOLS.map(t=>owners[t]===id?1:0);
      need[id]=claims[id].map((max,i)=>max-allocation[id][i]);
      if(need[id].some(v=>v<0))throw new Error("Allocation melebihi Max resep.");
    }
    for(const owner of Object.values(owners))if(owner!==null&&!ids.includes(owner))throw new Error("Alat dimiliki proses yang tidak aktif.");
    const available=TOOLS.map(t=>owners[t]===null?1:0),work=[...available],sequence=[],trace=[];
    const order=[...new Set([...priority,...ids])].filter(id=>ids.includes(id));
    const runnable=order.filter(id=>need[id].every((v,i)=>v<=work[i]));
    while(sequence.length<ids.length){
      const id=order.find(id=>!sequence.includes(id)&&need[id].every((v,i)=>v<=work[i]));
      if(!id)break;
      const before=[...work];allocation[id].forEach((v,i)=>work[i]+=v);sequence.push(id);
      trace.push({chef:id,before,after:[...work]});
    }
    return {safe:sequence.length===ids.length,sequence,available,allocation,need,runnable,trace,work,total:[...TOTAL]};
  }
  function safety(s,priority=s.priority||IDS){return analyse(s.owners,activeIds(s),priority);}
  function notify(s){
    const messages=[];
    for(const id of activeIds(s))for(let i=0;i<TOOLS.length;i++){
      const tool=TOOLS[i],owner=s.owners[tool];
      if(MAX[id][i]&&owner&&owner!==id)messages.push(`${name(id)} membutuhkan ${LABELS[tool]} dari ${name(owner)}.`);
    }
    return messages;
  }
  function recordNeeds(s){notify(s).forEach(text=>log(s,text));}
  function create(match){
    if(![1,2,3].includes(match))throw new Error("Match Hard harus 1, 2, atau 3.");
    const s={match,status:"playing",phase:match===1?"observe":match===2?"plan":"request",wave:0,time:0,
      owners:initial(),jobs:[],log:[],history:[],priority:[...IDS],method:null,selected:null,recovered:false,
      request:null,autoQueue:[],cooking:null,cookLeft:0,sequence:[],waveSequence:[],earned:0,correct:0,wrong:0,
      loanCorrect:0,loanWrong:0,served:0,escaped:0,cancelled:0,unserved:0,recoveries:0,rescheduled:0};
    const waves=match===3?WAVES:1;
    for(let w=0;w<waves;w++)for(let i=0;i<IDS.length;i++){
      const releaseAt=match===3?w*7:0,patience=match===3?[26,32,38,44][i]:[60,72,84,96][i];
      s.jobs.push({id:`H${w*4+i+1}`,chef:IDS[i],wave:w,releaseAt,deadline:releaseAt+patience,patience,
        status:w===0?"waiting":"future",started:false,rescheduled:false});
    }
    log(s,"4 koki aktif memakai 3 unit: 1 Katel, 1 Panci, 1 Kompor. Setiap resep memiliki klaim Max yang tetap.");
    if(match===3)prepareWave(s);else recordNeeds(s);
    return s;
  }
  function answer(s,ok,text,points=0,{loan=false}={}){
    if(ok){s.correct++;s.earned+=points;if(loan)s.loanCorrect++;}
    else{s.wrong++;if(loan)s.loanWrong++;}
    log(s,text,ok?"correct":"wrong");return {ok,text,delta:ok?points:-10,score:score(s)};
  }
  function finishMatch1(s){
    if(s.match!==1||s.status!=="playing")return;
    s.time=27.7;s.phase="complete";s.status="lost";
    s.jobs.forEach(j=>j.status="unserved");s.unserved=4;
    log(s,"Tanpa penanganan: A → B → C → A membentuk circular wait atas tiga alat. D tidak memegang alat dan tertahan di luar siklus. Keempat pesanan gagal selesai.","wrong");
  }
  function recover(s,method){
    if(s.match!==2||s.status!=="playing"||!["plan","blocked"].includes(s.phase)||s.recovered||!METHODS.includes(method))return null;
    s.method=method;
    if(method!==METHODS[0]){
      s.phase="blocked";return answer(s,false,`${method} digunakan sebelum alokasi tidak aman terjadi. Di sini siklus sudah terbentuk; tanpa Deteksi & Pemulihan, A/B/C tetap menahan alat dan D menunggu. Timer pelanggan terus berjalan.`);
    }
    // Semua koki berada pada checkpoint sebelum memasak: rollback alokasi idle secara atomik.
    s.owners=empty();s.recovered=true;s.phase="schedule";
    recordNeeds(s);
    return answer(s,true,"Deadlock terdeteksi. Deteksi & Pemulihan melepas tiga alat idle pada checkpoint. Sekarang arahkan keempat koki satu per satu; semua resep bisa diselesaikan dalam safe sequence tanpa menambah unit alat.",20);
  }
  function dispatchInternal(s,id){
    const job=currentJobs(s).find(j=>j.chef===id&&!terminal(j.status));
    if(!job||s.cooking)return false;
    const owners={...s.owners};
    for(let i=0;i<TOOLS.length;i++)if(MAX[id][i]){
      const tool=TOOLS[i];if(owners[tool]!==null&&owners[tool]!==id)return false;owners[tool]=id;
    }
    if(!analyse(owners,activeIds(s),s.priority).safe)return false;
    s.owners=owners;s.cooking=id;s.cookLeft=COOK_SECONDS;s.phase="cooking";job.status="cooking";job.started=true;
    s.sequence.push(id);s.waveSequence.push(id);
    log(s,`${name(id)} mulai ${job.id}: memakai ${TOOLS.filter((t,i)=>MAX[id][i]).map(t=>LABELS[t]).join(" + ")}. Alat dilepas saat selesai.`);
    return true;
  }
  function dispatch(s,id){
    if(s.match!==2||s.status!=="playing"||s.phase!=="schedule"||!IDS.includes(id))return null;
    if(!currentJobs(s).some(j=>j.chef===id&&!terminal(j.status)))return null;
    s.selected=id;
    if(!dispatchInternal(s,id))return answer(s,false,`${name(id)} belum dapat memiliki kombinasi resep lengkap. Periksa alat yang sedang dipegang koki lain dan safe sequence. Jangan memecah alat masak aktif.`);
    recordNeeds(s);
    return answer(s,true,`${name(id)} diarahkan pemain. Alokasi memenuhi Max resep dan menyisakan urutan penyelesaian yang aman bagi koki lain.`,10);
  }
  function prepareWave(s){
    for(const j of currentJobs(s))j.status="waiting";
    s.priority=[...IDS];s.waveSequence=[];s.autoQueue=[];s.cooking=null;s.cookLeft=0;s.phase="request";
    if(s.wave<2){s.owners={wok:"A",pot:"C",stove:"A"};s.request=s.wave===0?{from:"A",to:"C",tool:"wok"}:{from:"A",to:"B",tool:"stove"};}
    else{s.owners={wok:"C",pot:"C",stove:"B"};s.request={from:"C",to:"B",tool:"pot"};}
    log(s,`Gelombang ${s.wave+1} aktif: empat pesanan, total antrean ${s.jobs.filter(j=>!terminal(j.status)).length}.`);
    recordNeeds(s);
    log(s,`${name(s.request.to)} meminta ${LABELS[s.request.tool]} dari ${name(s.request.from)} pada checkpoint. Timer dijeda untuk memeriksa safe state.`);
  }
  function previewLoan(s){
    const q=s.request;
    if(!q||!IDS.includes(q.to)||!TOOLS.includes(q.tool)||s.owners[q.tool]!==q.from||!MAX[q.to][TOOLS.indexOf(q.tool)])return {legal:false,safe:false,reason:"Permintaan tidak sesuai kepemilikan/klaim resep."};
    const owners={...s.owners,[q.tool]:q.to},check=analyse(owners,activeIds(s),s.priority);
    return {...check,owners,legal:true};
  }
  function decide(s,give){
    if(s.match!==3||s.status!=="playing"||s.phase!=="request"||typeof give!=="boolean")return null;
    const p=previewLoan(s);if(!p.legal)return null;
    if(give)s.owners=p.owners;
    const ok=give===p.safe;
    s.phase=safety(s).safe?"schedule":"blocked";
    if(!ok)return answer(s,false,give
      ? "Pemberian ini menghasilkan Allocation dan Need tanpa satu pun koki yang dapat selesai. A/B/C saling menahan tiga alat, dan D ikut tertahan. Dapur deadlock; pulihkan melalui penjadwalan ulang atau pembatalan satu pesanan pemegang alat."
      : "Permintaan sebenarnya memiliki safe sequence untuk seluruh koki. Penolakan ini menunda layanan; alokasi awal tetap aman sehingga penjadwal masih bisa menjalankannya setelah popup ditutup.",0,{loan:true});
    return answer(s,true,give
      ? `Hasil safety test aman: ${p.sequence.join(" → ")}. Work awal [${p.available.join(", ")}]; setiap koki bisa selesai secara berurutan lalu mengembalikan alokasinya.`
      : `Tidak / tunda mempertahankan alokasi aman: ${safety(s).sequence.join(" → ")}. Jika diberikan, tidak ada koki yang bisa selesai; koki keempat juga tidak mendapat kombinasi lengkap.`,[15,15,10][s.wave],{loan:true});
  }
  function startAuto(s){
    if(s.match!==3||s.status!=="playing"||s.phase!=="schedule")return false;
    const check=safety(s);if(!check.safe)return false;
    s.autoQueue=[...check.sequence];return dispatchInternal(s,s.autoQueue[0]);
  }
  function repair(s,type,id){
    if(s.match!==3||s.status!=="playing"||s.phase!=="blocked"||!["reschedule","cancel"].includes(type)||!IDS.includes(id))return null;
    const before=safety(s),job=currentJobs(s).find(j=>j.chef===id&&!terminal(j.status));
    if(before.safe||before.runnable.length||!job)return null;
    const owners={...s.owners};TOOLS.forEach(t=>{if(owners[t]===id)owners[t]=null;});
    const active=type==="cancel"?activeIds(s).filter(c=>c!==id):activeIds(s);
    const priority=[...active.filter(c=>c!==id),...(active.includes(id)?[id]:[])];
    const check=analyse(owners,active,priority);
    if(!check.safe)return answer(s,false,`${name(id)} tidak memegang alat yang memutus siklus. Pembatalan/penjadwalan ulang ini belum diterapkan. Pilih pemegang alat yang membuat safety test kembali aman.`);
    s.owners=owners;s.priority=priority;s.phase="schedule";s.recoveries++;
    if(type==="cancel"){job.status="cancelled";s.cancelled++;}
    else{job.rescheduled=true;s.rescheduled++;}
    const text=type==="cancel"
      ? `${job.id} milik ${name(id)} dibatalkan. Alatnya bebas; safe sequence tersisa ${check.sequence.join(" → ")}. Satu layanan dikorbankan.`
      : `${job.id} milik ${name(id)} dijadwalkan ulang: alokasi idle dilepas dan gilirannya ditaruh setelah koki lain. Tenggat asli tetap ${job.deadline} detik, tanpa reset timer. Safe sequence: ${check.sequence.join(" → ")}.`;
    log(s,text,"correct");return {ok:true,text,delta:0,score:score(s)};
  }
  function release(s,id){TOOLS.forEach(t=>{if(s.owners[t]===id)s.owners[t]=null;});}
  function finish(s){
    s.phase="complete";s.cooking=null;s.cookLeft=0;s.autoQueue=[];s.owners=empty();
    s.status=s.escaped?"lost":s.served===s.jobs.length?"won":s.served?"partial":"lost";
  }
  function waveDone(s){
    s.history.push({wave:s.wave+1,sequence:[...s.waveSequence],served:currentJobs(s).filter(j=>j.status==="served").length,cancelled:currentJobs(s).filter(j=>j.status==="cancelled").length});
    if(s.match===2||s.wave===WAVES-1){finish(s);return "complete";}
    s.wave++;prepareWave(s);return "request";
  }
  function tick(s,seconds){
    const events=[];
    if(s.status!=="playing"||!["plan","blocked","schedule","cooking"].includes(s.phase)||!Number.isFinite(seconds)||seconds<=0)return events;
    let left=seconds;
    while(left>1e-8&&s.status==="playing"&&s.phase!=="request"){
      const pending=s.jobs.filter(j=>!terminal(j.status)&&j.status!=="future");
      const future=s.jobs.filter(j=>j.status==="future");
      const nextArrival=Math.min(Infinity,...future.map(j=>j.releaseAt-s.time));
      const nextDeadline=Math.min(Infinity,...pending.map(j=>j.deadline-s.time));
      const dt=Math.max(0,Math.min(left,nextArrival,nextDeadline,s.cooking?s.cookLeft:Infinity));
      s.time+=dt;left-=dt;if(s.cooking)s.cookLeft=Math.max(0,s.cookLeft-dt);
      const arrived=future.filter(j=>j.releaseAt<=s.time+1e-8);
      arrived.forEach(j=>j.status="queued");
      if(arrived.length){log(s,`${arrived.length} pelanggan gelombang ${arrived[0].wave+1} datang. Antrean bertambah; tenggat dihitung sejak kedatangan.`);events.push("arrived");}
      const expired=pending.filter(j=>j.deadline<=s.time+1e-8);
      if(expired.length){
        for(const j of expired){j.status="escaped";s.escaped++;log(s,`${j.id} kabur: ${name(j.chef)} ${j.started?"belum selesai memasak":"terus tertunda tanpa kombinasi alat (starvation layanan)"}. Tenggat habis.`,"wrong");}
        for(const j of s.jobs)if(!terminal(j.status)){j.status="unserved";s.unserved++;}
        finish(s);events.push("expired");break;
      }
      if(s.cooking&&s.cookLeft<=1e-8){
        const id=s.cooking,job=currentJobs(s).find(j=>j.chef===id&&j.status==="cooking");
        job.status="served";s.served++;s.earned+=s.match===2?10:5;
        release(s,id);s.cooking=null;s.cookLeft=0;
        log(s,`${job.id} terlayani oleh ${name(id)}. Alokasi dilepas; total alat tetap [1, 1, 1].`,"correct");events.push("served");
        if(currentJobs(s).every(j=>terminal(j.status))){events.push(waveDone(s));break;}
        s.phase="schedule";
        if(s.match===3){s.autoQueue.shift();dispatchInternal(s,s.autoQueue[0]);}
        else break;
      }
      if(dt===0&&!arrived.length)break;
    }
    return events;
  }
  function summary(s){
    const decisions=s.match===3?s.loanCorrect+s.loanWrong:s.correct+s.wrong;
    return {match:s.match,status:s.status,score:score(s),stars:stars(score(s)),correct:s.correct,wrong:s.wrong,
      accuracy:decisions?Math.round((s.match===3?s.loanCorrect:s.correct)/decisions*100):0,
      served:s.served,total:s.jobs.length,escaped:s.escaped,cancelled:s.cancelled,unserved:s.unserved,
      recoveries:s.recoveries,rescheduled:s.rescheduled,time:Math.round(s.time*10)/10,
      sequence:[...s.sequence],waves:s.history.map(h=>({...h,sequence:[...h.sequence]})),log:s.log.map(l=>({...l}))};
  }
  const api={IDS,TOOLS,TOTAL,CHEFS,MAX,LABELS,METHODS,COOK_SECONDS,WAVES,name,stars,score,create,analyse,safety,notify,
    currentJobs,activeIds,remaining,finishMatch1,recover,dispatch,previewLoan,decide,startAuto,repair,tick,summary};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.HardRules=api;
})(typeof window!=="undefined"?window:globalThis);
