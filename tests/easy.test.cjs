const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../js/easy-state.js');
const team=['pipit','ucil'];
function goodPlan(s){R.selectLeader(s,'A');R.selectMethod(s,R.METHODS[0]);return R.plan(s);}
function round(s,give){const r=R.decide(s,give);R.tick(s,r.ok?9:60);return r;}
test('Pemilihan maksimal dua, deselect, pergeseran A/B, dan pasangan default unik',()=>{
  let ids=[];ids=R.toggleTeam(ids,'puput').team;ids=R.toggleTeam(ids,'ucil').team;
  const third=R.toggleTeam(ids,'pipit');assert.equal(third.ok,false);assert.deepEqual(third.team,ids);
  assert.match(third.message,/Maksimal/);
  ids=R.toggleTeam(ids,'puput').team;assert.deepEqual(ids,['ucil']);
  ids=R.toggleTeam(ids,'pipit').team;assert.deepEqual(ids,['ucil','pipit']);
  assert.deepEqual(R.pairTeam(['ucil']),['ucil','koki']);assert.deepEqual(R.pairTeam([]),[]);
  assert.deepEqual(R.cleanTeam(['koki','koki','bogus','puput']),['koki','puput']);
});
test('Nama tiga strategi sama persis dengan judul Tutorial',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const part=html.split('id="tutorial-slide-7"')[1].split('id="tutorial-slide-8"')[0];
  const labels=[...part.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
  assert.deepEqual(R.METHODS,labels);
});
test('Pilihan tim dibawa ke semua match; Match 1 selalu deadlock',()=>{
  for(const m of [1,2,3])assert.deepEqual(R.create(m,team).team,team);
  const s=R.create(1,team);assert.match(R.name(s,'A'),/Ceu Pipit/);
  R.finishMatch1(s);const r=R.summary(s);assert.equal(r.status,'lost');assert.equal(r.served,0);assert.equal(r.unserved,2);
  assert.equal(r.score,0);assert.match(r.log.at(-1).text,/circular wait/);
  assert.throws(()=>R.create(2,[]));
});
test('Match 2: rencana A + Deteksi & Pemulihan, alokasi nyata dan dua layanan = 100',()=>{
  const s=R.create(2,team);assert.equal(goodPlan(s).ok,true);
  assert.deepEqual(s.owners,{wok:'A',stove:'A'});assert.equal(s.deadlocked,false);
  assert.equal(R.startCook(s),true);R.tick(s,4);
  assert.equal(s.served,1);assert.equal(s.phase,'ready');assert.deepEqual(s.owners,{wok:null,stove:null});
  R.startCook(s);assert.deepEqual(s.owners,{wok:'B',stove:'B'});R.tick(s,4);
  const r=R.summary(s);assert.deepEqual([r.status,r.score,r.stars,r.served,r.correct,r.wrong],['won',100,3,2,1,0]);
  assert.equal(r.escaped,0);
});
test('Match 2: semua kombinasi rencana salah tetap menunggu lalu pelanggan kabur',()=>{
  for(const chef of ['A','B'])for(const method of R.METHODS){
    if(chef==='A'&&method===R.METHODS[0])continue;
    const s=R.create(2,team);R.selectLeader(s,chef);R.selectMethod(s,method);
    assert.equal(R.plan(s).ok,false);assert.equal(s.phase,'blocked');assert.equal(s.deadlocked,true);
    assert.equal(R.startCook(s),false);R.tick(s,61);
    const r=R.summary(s);assert.equal(r.status,'lost');assert.equal(r.escaped,1);assert.equal(r.unserved,1);assert.equal(r.served,0);
    assert.equal(r.score,0);assert.ok(r.log.some(l=>l.text.includes('kabur')));
  }
});
test('Timer dua pelanggan independen; bisa habis sebelum keputusan; deadline ketat',()=>{
  const s=R.create(2,team);R.tick(s,10);assert.deepEqual(s.customers.map(c=>c.remaining),[50,80]);
  R.tick(s,50);assert.equal(s.status,'lost');assert.equal(s.customers[0].status,'escaped');assert.equal(R.plan(s),null);
  const tight=R.create(2,team);R.tick(tight,56);goodPlan(tight);R.startCook(tight);R.tick(tight,4);
  assert.equal(tight.served,0);assert.equal(tight.status,'lost','Harus selesai sebelum, bukan tepat pada tenggat');
});
test('Match 3: permintaan/ronde berikutnya menjeda timer di state murni',()=>{
  const s=R.create(3,team),before=JSON.stringify(s);assert.deepEqual(R.tick(s,1000),[]);assert.equal(JSON.stringify(s),before);
  round(s,true);assert.equal(s.phase,'roundEnd');const after=JSON.stringify(s);R.tick(s,1000);assert.equal(JSON.stringify(s),after);
});
test('Match 3: Dikasih aman, Tidak saat alat aktif mencegah siklus; 4 ronde = 100',()=>{
  const s=R.create(3,team);
  for(const [i,give] of [true,false,true,false].entries()){
    const preview=R.grantPreview(s);assert.equal(preview.safe,give);assert.equal(preview.cycle,!give);
    assert.equal(round(s,give).ok,true);assert.equal(s.history[i].successful,true);
    if(i<3)assert.equal(R.nextRound(s),true);
  }
  const r=R.summary(s);assert.deepEqual([r.status,r.score,r.stars,r.correct,r.wrong,r.served,r.accuracy],['won',100,3,4,0,8,100]);
  assert.equal(r.escaped,0);assert.equal(R.nextRound(s),false);assert.equal(R.decide(s,true),null);
});
test('Memberikan alat aktif benar-benar membentuk cycle; menolak idle menghambat tanpa cycle',()=>{
  const s=R.create(3,team);assert.equal(R.decide(s,false).ok,false);assert.equal(s.deadlocked,false);assert.equal(s.phase,'blocked');
  R.tick(s,31);assert.equal(s.escaped,1);R.nextRound(s);
  assert.equal(R.decide(s,true).ok,false);assert.equal(s.deadlocked,true);
  assert.deepEqual(s.owners,{wok:'A',stove:'B'});assert.deepEqual(s.waiting,{A:'stove',B:'wok'});
  const before=JSON.stringify(s);assert.equal(R.decide(s,true),null);assert.equal(JSON.stringify(s),before);
});
test('Semua 16 kombinasi izin: skor, akurasi, layanan, dan akhir ronde konsisten',()=>{
  for(let mask=0;mask<16;mask++){
    const s=R.create(3,team);let correct=0;
    for(let i=0;i<4;i++){
      const give=Boolean(mask&(1<<i)),ok=give===[true,false,true,false][i];if(ok)correct++;
      round(s,give);if(i<3)R.nextRound(s);
    }
    const r=R.summary(s);assert.equal(r.score,Math.max(0,correct*25-(4-correct)*10));
    assert.equal(r.served,correct*2);assert.equal(r.accuracy,correct*25);
    assert.equal(r.status,correct===4?'won':'lost');assert.equal(r.rounds.length,4);
    assert.equal(r.served+r.escaped+r.unserved,8);assert.deepEqual(s.owners,{wok:null,stove:null});
  }
});
test('Skor/bintang, klik ganda, replay, dan hasil snapshot terisolasi',()=>{
  for(const [value,stars] of [[0,1],[49,1],[50,2],[99,2],[100,3]])assert.equal(R.stars(value),stars);
  const s=R.create(2,team);goodPlan(s);const before=JSON.stringify(s);assert.equal(R.plan(s),null);assert.equal(JSON.stringify(s),before);
  R.startCook(s);assert.equal(R.startCook(s),false);R.tick(s,4);R.startCook(s);R.tick(s,4);
  const end=JSON.stringify(s);R.tick(s,999);R.plan(s);assert.equal(JSON.stringify(s),end);
  const result=R.summary(s);s.log[0].text='changed';s.team[0]='koki';assert.notEqual(result.log[0].text,'changed');assert.equal(result.team[0],'pipit');
  const fresh=R.create(2,team);assert.equal(R.score(fresh),0);assert.equal(fresh.served,0);assert.deepEqual(fresh.owners,{wok:'A',stove:'B'});
});
