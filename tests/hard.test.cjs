const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../js/hard-state.js');
const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,n)=>n!==i)).map(p=>[x,...p])):[[]];
function invariant(s){
  assert.deepEqual(Object.keys(s.owners).sort(),[...R.TOOLS].sort());
  const check=R.safety(s);
  for(let i=0;i<3;i++)assert.equal(check.available[i]+Object.values(check.allocation).reduce((n,a)=>n+a[i],0),1);
  for(const [id,row] of Object.entries(check.allocation))assert.ok(row.every((a,i)=>a<=R.MAX[id][i]));
  assert.ok(R.score(s)>=0&&R.score(s)<=100);
}
function wave(s,give){R.decide(s,give);if(s.phase==='schedule')R.startAuto(s);R.tick(s,12);}
function getBlockedWave2(){const s=R.create(3);wave(s,true);assert.equal(s.wave,1);R.decide(s,true);assert.equal(s.phase,'blocked');return s;}
test('Hard menetapkan 4 karakter, 3 unit, Max, dan nama metode yang sesuai tutorial',()=>{
  assert.deepEqual(R.IDS.map(id=>R.CHEFS[id].name),['Koki','Neng Puput','Ceu Pipit','Mang Ucil']);
  assert.deepEqual(R.TOTAL,[1,1,1]);assert.equal(R.TOOLS.length,3);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const section=html.split('id="tutorial-slide-7"')[1].split('id="tutorial-slide-8"')[0];
  assert.deepEqual([...section.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1].replace(/&amp;/g,'&')),R.METHODS);
});
test('Safety test cocok dengan brute force pada 64 alokasi legal, tanpa menggandakan unit',()=>{
  const options=R.TOOLS.map((t,i)=>[null,...R.IDS.filter(id=>R.MAX[id][i])]);
  let count=0;
  for(const wok of options[0])for(const pot of options[1])for(const stove of options[2]){
    const owners={wok,pot,stove},check=R.analyse(owners);
    const brute=permutations(R.IDS).some(order=>{
      const work=R.TOOLS.map(t=>owners[t]===null?1:0);
      for(const id of order){
        const allocation=R.TOOLS.map(t=>owners[t]===id?1:0),need=R.MAX[id].map((v,i)=>v-allocation[i]);
        if(need.some((v,i)=>v>work[i]))return false;
        allocation.forEach((v,i)=>work[i]+=v);
      }
      return true;
    });
    assert.equal(check.safe,brute,JSON.stringify(owners));
    if(check.safe){assert.equal(new Set(check.sequence).size,4);assert.deepEqual(check.work,[1,1,1]);}
    for(const step of check.trace)assert.ok(check.need[step.chef].every((v,i)=>v<=step.before[i]));
    count++;
  }
  assert.equal(count,64);
});
test('Satu proses bisa selesai belum cukup untuk menyatakan seluruh sistem safe',()=>{
  const claims={A:[1,0,0],B:[0,1,1],C:[0,1,1],D:[1,1,1]};
  const check=R.analyse({wok:'A',pot:'B',stove:'C'},R.IDS,R.IDS,claims);
  assert.deepEqual(check.runnable,['A']);assert.deepEqual(check.sequence,['A']);assert.equal(check.safe,false);
});
test('Safety test menolak alat keempat, owner tidak aktif, serta Max/Allocation tidak valid',()=>{
  assert.throws(()=>R.analyse({wok:null,pot:null,stove:null,board:null}));
  assert.throws(()=>R.analyse({wok:'B',pot:null,stove:null}));
  assert.throws(()=>R.analyse({wok:'A',pot:null,stove:null},['B','C','D']));
  assert.throws(()=>R.analyse({wok:null,pot:null,stove:null},['A'],['A'],{A:[2,0,0]}));
});
test('Match 1: siklus A/B/C dan D tertahan, empat pesanan tidak selesai',()=>{
  const s=R.create(1);assert.equal(R.safety(s).safe,false);assert.deepEqual(R.safety(s).allocation.D,[0,0,0]);
  R.finishMatch1(s);const r=R.summary(s);assert.equal(r.status,'lost');assert.equal(r.unserved,4);assert.equal(r.served,0);
  assert.match(r.log.at(-1).text,/D tidak memegang alat/);invariant(s);
});
test('Match 2: seluruh 24 urutan serial aman melayani keempat koki dengan skor 100',()=>{
  for(const sequence of permutations(R.IDS)){
    const s=R.create(2);assert.equal(R.recover(s,R.METHODS[0]).ok,true);invariant(s);
    for(const id of sequence){assert.equal(R.dispatch(s,id).ok,true);invariant(s);R.tick(s,3);invariant(s);}
    const r=R.summary(s);assert.deepEqual(r.sequence,sequence);assert.equal(r.status,'won');assert.equal(r.score,100);
    assert.equal(r.stars,3);assert.equal(r.served,4);assert.equal(r.correct,5);
  }
});
test('Match 2: strategi salah mempertahankan deadlock, dapat dikoreksi sebelum tenggat',()=>{
  const s=R.create(2);assert.equal(R.recover(s,R.METHODS[1]).ok,false);assert.equal(s.phase,'blocked');
  assert.equal(R.safety(s).safe,false);assert.equal(R.dispatch(s,'D'),null);
  assert.equal(R.recover(s,R.METHODS[0]).ok,true);
  for(const id of R.IDS){R.dispatch(s,id);R.tick(s,3);}
  assert.equal(R.score(s),90);assert.equal(s.status,'won');
  const fail=R.create(2);R.recover(fail,R.METHODS[2]);R.tick(fail,61);
  assert.equal(fail.status,'lost');assert.equal(fail.escaped,1);assert.equal(fail.unserved,3);
});
test('Starvation layanan D terdeteksi jika pemain melayani A/B/C lalu terus menunda D',()=>{
  const s=R.create(2);R.recover(s,R.METHODS[0]);
  for(const id of ['A','B','C']){R.dispatch(s,id);R.tick(s,3);}
  R.tick(s,88);assert.equal(s.status,'lost');assert.equal(s.served,3);assert.equal(s.escaped,1);
  assert.ok(s.log.some(l=>l.text.includes('Mang Ucil')&&l.text.includes('starvation')));invariant(s);
});
test('Match 3: preview murni; kondisi aman/unsafe berasal dari matriks aktual',()=>{
  const s=R.create(3),before=JSON.stringify(s),p=R.previewLoan(s);assert.equal(p.safe,true);assert.equal(JSON.stringify(s),before);
  assert.deepEqual(p.sequence,['C','A','B','D']);wave(s,true);
  assert.equal(R.previewLoan(s).safe,false);assert.deepEqual(R.previewLoan(s).runnable,[]);
  assert.equal(R.safety(s).safe,true);R.decide(s,true);assert.equal(R.safety(s).safe,false);invariant(s);
});
test('Tiga gelombang benar: 12 layanan, tiga keputusan, skor 100, waktu 36 detik',()=>{
  const s=R.create(3);
  for(const answer of [true,false,true]){wave(s,answer);invariant(s);}
  const r=R.summary(s);assert.deepEqual([r.status,r.score,r.stars,r.served,r.accuracy],['won',100,3,12,100]);
  assert.equal(r.waves.length,3);assert.equal(r.time,36);assert.equal(r.sequence.length,12);assert.equal(r.cancelled,0);
});
test('Antrean baru datang saat memasak; deadline dihitung dari kedatangan, bukan aktivasi',()=>{
  const s=R.create(3);R.decide(s,true);R.startAuto(s);R.tick(s,7);
  assert.equal(s.wave,0);assert.equal(s.jobs.filter(j=>j.status==='queued').length,4);
  assert.equal(s.jobs.find(j=>j.id==='H5').deadline,33);assert.equal(R.remaining(s,s.jobs.find(j=>j.id==='H5')),26);
  R.tick(s,5);assert.equal(s.wave,1);assert.equal(R.remaining(s,s.jobs.find(j=>j.id==='H5')),21);
});
test('Timer jeda pada request, klik ganda tidak memberi poin, input tidak valid diabaikan',()=>{
  const s=R.create(3),before=JSON.stringify(s);R.tick(s,1000);assert.equal(JSON.stringify(s),before);
  R.decide(s,true);const points=R.score(s);assert.equal(R.decide(s,true),null);assert.equal(R.score(s),points);
  const m2=R.create(2);R.recover(m2,R.METHODS[0]);R.dispatch(m2,'A');assert.equal(R.dispatch(m2,'A'),null);
  assert.equal(R.recover(m2,R.METHODS[0]),null);R.tick(m2,NaN);invariant(m2);
});
test('Unsafe Dikasih: D tanpa alat bukan korban pemutus siklus; pemulihan gagal tidak diterapkan',()=>{
  const s=getBlockedWave2(),owners={...s.owners};
  assert.equal(R.repair(s,'cancel','D').ok,false);assert.deepEqual(s.owners,owners);assert.equal(s.cancelled,0);
  assert.equal(R.repair(s,'reschedule','D').ok,false);assert.deepEqual(s.owners,owners);assert.equal(s.rescheduled,0);
});
test('Penjadwalan ulang melepaskan alokasi tanpa mereset deadline dan menyelamatkan 12 pesanan',()=>{
  const s=getBlockedWave2(),deadline=s.jobs.find(j=>j.id==='H5').deadline;
  assert.equal(R.repair(s,'reschedule','A').ok,true);assert.equal(s.jobs.find(j=>j.id==='H5').deadline,deadline);
  assert.equal(s.owners.wok,null);R.startAuto(s);R.tick(s,12);assert.deepEqual(s.history[1].sequence,['C','B','D','A']);
  wave(s,true);const r=R.summary(s);assert.equal(r.status,'won');assert.equal(r.served,12);assert.equal(r.score,75);
  assert.equal(r.rescheduled,1);assert.equal(r.accuracy,67);invariant(s);
});
test('Pembatalan pemegang alat memulihkan sistem dengan satu layanan dikorbankan',()=>{
  const s=getBlockedWave2();assert.equal(R.repair(s,'cancel','A').ok,true);assert.equal(s.cancelled,1);
  R.startAuto(s);R.tick(s,9);wave(s,true);const r=R.summary(s);
  assert.equal(r.status,'partial');assert.equal(r.served,11);assert.equal(r.cancelled,1);assert.equal(r.score,70);invariant(s);
});
test('Menolak permintaan aman salah namun tidak menciptakan deadlock baru',()=>{
  const s=R.create(3);assert.equal(R.decide(s,false).ok,false);assert.equal(R.safety(s).safe,true);assert.equal(s.phase,'schedule');
  R.startAuto(s);R.tick(s,12);wave(s,false);wave(s,true);
  assert.equal(s.status,'won');assert.equal(R.score(s),75);assert.equal(s.served,12);
});
test('Deadlock tanpa pemulihan berakhir pelanggan kabur; semua layanan terhitung konsisten',()=>{
  const s=getBlockedWave2();R.tick(s,100);
  assert.equal(s.status,'lost');assert.equal(s.escaped,1);assert.equal(s.served+s.escaped+s.cancelled+s.unserved,12);invariant(s);
  const before=JSON.stringify(s);R.tick(s,100);R.decide(s,false);R.repair(s,'cancel','B');assert.equal(JSON.stringify(s),before);
});
test('Ambang bintang, hasil snapshot, dan replay terisolasi',()=>{
  for(const [n,stars] of [[0,1],[49,1],[50,2],[99,2],[100,3]])assert.equal(R.stars(n),stars);
  const s=R.create(3);for(const a of [true,false,true])wave(s,a);const result=R.summary(s);
  s.log[0].text='changed';s.history[0].sequence[0]='D';assert.notEqual(result.log[0].text,'changed');assert.equal(result.waves[0].sequence[0],'C');
  const fresh=R.create(3);assert.equal(R.score(fresh),0);assert.equal(fresh.served,0);assert.equal(fresh.phase,'request');invariant(fresh);
});
