const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/medium-state.js');

function give(s, chef, tool) { R.select(s, chef); return R.transfer(s, tool); }
function invariants(s) {
  assert.ok(R.score(s) >= 0 && R.score(s) <= 100);
  assert.ok(Object.values(s.owners).every(owner => owner === null || R.CHEFS[owner]));
  for (const id of [...s.done, ...s.cancelled]) assert.ok(!Object.values(s.owners).includes(id));
  assert.equal(new Set(s.done).size, s.done.length);
  assert.ok(s.cancelled.length <= 1);
}
test('Match 2: preemption A, lalu C dan B; 3 pelanggan, 100 poin', () => {
  const s = R.create(2);
  assert.deepEqual(s.owners, { wok: 'A', stove: 'B', pot: 'C' });
  for (const [chef, tool] of [['A','stove'], ['C','wok'], ['B','pot']]) {
    assert.equal(give(s, chef, tool).ok, true);
    assert.equal(s.phase, 'cooking');
    assert.equal(R.cook(s).ok, true); invariants(s);
  }
  assert.deepEqual(s.done, ['A','C','B']);
  assert.deepEqual(s.owners, { wok: null, stove: null, pot: null });
  assert.equal(s.status, 'won');
  const r = R.summary(s);
  assert.deepEqual([r.score,r.stars,r.correct,r.wrong,r.served,r.cancelled], [100,3,6,0,3,0]);
});
test('Match 2: memilih koki awal selain A langsung Game Over', () => {
  for (const id of ['B','C']) {
    const s = R.create(2), res = R.select(s,id);
    assert.equal(res.fatal,true); assert.equal(s.status,'lost');
    assert.match(res.text,/Koki Cowo/);
    assert.equal(R.transfer(s,'stove'),null); assert.equal(R.cook(s),null);
    invariants(s);
  }
});
test('Match 2: alat awal salah fatal; input setelah hasil tidak memberi poin', () => {
  for (const tool of ['wok','pot']) {
    const s = R.create(2); R.select(s,'A');
    assert.equal(R.transfer(s,tool).fatal,true);
    const before = JSON.stringify(s); R.transfer(s,'stove'); R.select(s,'A');
    assert.equal(JSON.stringify(s), before);
  }
});
test('Match 2: kesalahan sesudah preemption mengurangi skor dan bisa diperbaiki', () => {
  const s = R.create(2);
  give(s,'A','stove'); R.cook(s);
  assert.equal(give(s,'B','pot').ok,false);
  give(s,'C','wok'); R.cook(s); give(s,'B','pot'); R.cook(s);
  assert.equal(R.score(s),85); assert.equal(R.summary(s).stars,2);
});
test('Match 3: hanya 1 pelanggan dibatalkan; B kemudian A diselamatkan', () => {
  const s = R.create(3);
  assert.equal(R.cancel(s,3).ok,true);
  assert.equal(s.owners.pot,null); assert.deepEqual(s.cancelled,['C']);
  assert.equal(R.cancel(s,1),null);
  for (const [chef,tool] of [['B','pot'],['A','stove']]) {
    assert.equal(give(s,chef,tool).ok,true); R.cook(s); invariants(s);
  }
  const r = R.summary(s);
  assert.deepEqual([r.status,r.score,r.stars,r.served,r.cancelled,r.correct], ['won',100,3,2,1,5]);
  assert.ok(r.log.some(l=>l.text.includes('process termination')));
});
test('Match 3: korban mahal ditolak tanpa benar-benar membatalkan; penalti tetap dihitung dari nol', () => {
  const s = R.create(3);
  for (const c of [1,2]) {
    const res = R.cancel(s,c); assert.equal(res.ok,false);
    assert.match(res.text,/bisa memutus siklus/);
    assert.equal(s.cancelled.length,0); assert.equal(s.owners.pot,'C');
  }
  R.cancel(s,3); give(s,'B','pot'); R.cook(s); give(s,'A','stove'); R.cook(s);
  assert.equal(R.score(s),70); assert.equal(R.stars(R.score(s)),2);
});
test('Skor dibatasi 0–100, ambang bintang tepat, tidak ada poin dari klik ganda', () => {
  for (const [score,stars] of [[0,1],[49,1],[50,2],[99,2],[100,3]]) assert.equal(R.stars(score),stars);
  const s = R.create(3);
  for (let i=0;i<15;i++) R.cancel(s,1);
  R.cancel(s,3); give(s,'B','pot');
  const before=JSON.stringify(s);
  assert.equal(R.transfer(s,'pot'),null); assert.equal(R.cancel(s,3),null);
  assert.equal(JSON.stringify(s),before);
  R.cook(s); give(s,'A','stove'); R.cook(s);
  assert.equal(R.score(s),0); assert.equal(s.status,'won'); invariants(s);
});
test('Replay baru mengembalikan kepemilikan, log, dan nilai awal; summary tidak berbagi log', () => {
  const s=R.create(2); give(s,'A','stove'); R.cook(s);
  const result=R.summary(s); s.log[0].text='berubah'; assert.notEqual(result.log[0].text,'berubah');
  const fresh=R.create(2); assert.equal(fresh.correct,0); assert.equal(fresh.selected,null);
  assert.deepEqual(fresh.owners,{wok:'A',stove:'B',pot:'C'});
});
