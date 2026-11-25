/* Uji integrasi tanpa paket npm: Node 22+ dan Chrome/Edge lokal.
   Server uji port 8123 dimulai otomatis. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(r => setTimeout(r,ms));
const root = path.resolve(__dirname,'..');
const output = path.join(root,'test-results'); fs.mkdirSync(output,{recursive:true});
const server = require('../tools/serve.cjs')();
server.listen(8123,'127.0.0.1');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0','--no-proxy-server','--enable-unsafe-swiftshader','--use-angle=swiftshader',
  '--user-data-dir='+path.resolve(root,'../.test-browser'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws, nextId=0; const pending=new Map(), errors=[], failed=[], responses=[];
function send(method,params={},sessionId) {
  return new Promise((resolve,reject)=>{ const id=++nextId; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})); });
}
async function main() {
  const endpoint = await new Promise((resolve,reject)=>{
    let all=''; const timeout=setTimeout(()=>reject(new Error('Chrome startup timeout: '+all)),20000);
    browser.stderr.on('data',data=>{all+=data; const match=all.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
    browser.on('error',reject);
  });
  ws=new WebSocket(endpoint); await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}else{
    if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    if(msg.method==='Log.entryAdded' && msg.params.entry.level==='error') errors.push(msg.params.entry);
    if(msg.method==='Network.loadingFailed') failed.push(msg.params);
    if(msg.method==='Network.responseReceived') responses.push(msg.params.response);
  }});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true});
  const command=(method,params={})=>send(method,params,sid);
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Log.enable');
  await command('Page.bringToFront');
  const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async(expression,timeout=15000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(60);}throw new Error('Timed out: '+expression);};
  const click=async selector=>{assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`),'Missing '+selector);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);};
  const screenshot=async name=>{await delay(1200);const {data}=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data,'base64'));};
  const close=()=>click('[data-medium="close-dialog"]');
  const give=async(chef,tool)=>{await click(`[data-chef="${chef}"]`);await click(`[data-tool="${tool}"]`);await wait('!document.getElementById("medium-dialog").hidden');assert.equal(await evaluate('document.getElementById("medium-dialog-title").textContent'),'Betul / Benar!');await close();};
  const cook=async()=>{await click('[data-medium="cook"]');await wait('!document.getElementById("medium-dialog").hidden');await close();};

  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:'http://127.0.0.1:8123/'});
  await wait('typeof startGame2 === "function" && document.getElementById("stage").classList.contains("ready")');
  // Menu dan tutorial tetap dapat dibuka sesudah konflik Git diperbaiki.
  await click('[data-action="tutorial"]');await click('#tutorial-next');
  assert.equal(await evaluate('document.getElementById("tutorial").dataset.slide'),'2');
  await click('#tutorial-back');await click('#tutorial-back');
  await click('[data-action="play"]');await click('[data-level="Medium"]');
  await wait('getComputedStyle(document.getElementById("game2")).opacity === "1"');
  await screenshot('01-selector');
  await click('[data-play="1"]');await delay(1000);await click('[data-medium="observe"]');
  await wait('!document.getElementById("medium-m1-choices").hidden');
  await click('[data-medium="m1-request"]');await close();
  await wait('!document.getElementById("ana2").hidden');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("dapurMacet.medium.v1"))[1].status'),'lost');
  await screenshot('02-match1-deadlock');
  await click('[data-medium="next2"]');await screenshot('03-match2');
  // Maupun pemilihan B maupun alat salah harus langsung kalah di langkah pertama.
  await click('[data-chef="B"]');assert.equal(await evaluate('document.getElementById("medium-dialog-title").textContent'),'Salah!');await close();
  assert.ok(await evaluate('document.getElementById("medium-content").textContent.includes("Game Over")'));
  await click('[data-play="2"]');await click('[data-chef="A"]');await click('[data-tool="pot"]');await close();
  assert.ok(await evaluate('document.getElementById("medium-content").textContent.includes("Game Over")'));
  await click('[data-play="2"]');
  await give('A','stove');await cook();await give('C','wok');await cook();await give('B','pot');await cook();
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("dapurMacet.medium.v1"))[2].score'),100);
  await screenshot('04-match2-result');await click('[data-medium="next3"]');
  await screenshot('05-match3');
  await click('[data-cancel="1"]');await close();await click('[data-cancel="3"]');await close();
  await give('B','pot');await cook();await give('A','stove');await cook();
  const m3=await evaluate('JSON.parse(localStorage.getItem("dapurMacet.medium.v1"))[3]');
  assert.equal(m3.score,85);assert.equal(m3.cancelled,1);assert.equal(m3.served,2);assert.equal(m3.stars,2);
  await click('[data-medium="compare"]');await screenshot('06-comparison');
  assert.ok(await evaluate('document.querySelector(".medium-comparison").textContent.includes("100/100")'));
  await click('.medium-comparison-log summary'); // summary bukan tombol, .click tetap bekerja.
  await click('[data-medium="settings"]');
  await evaluate('document.getElementById("medium-sfx-volume").value=0;document.getElementById("medium-sfx-volume").dispatchEvent(new Event("input",{bubbles:true}))');
  await close(); assert.equal(await evaluate('document.getElementById("medium-audio").textContent'),'SFX OFF');
  await click('[data-medium="audio"]');

  // Reload mempertahankan hasil, graf pada portrait, dan path gambar valid.
  await command('Page.reload');await wait('typeof startGame2 === "function" && document.getElementById("stage").classList.contains("ready")');
  await evaluate('startGame2()');assert.ok(await evaluate('document.getElementById("medium-content").textContent.includes("100/100")'));
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('07-mobile-selector');await click('[data-play="3"]');await screenshot('08-mobile-match3');
  assert.ok(await evaluate('document.getElementById("medium-content").getBoundingClientRect().top >= document.querySelector(".medium-toolbar").getBoundingClientRect().bottom'), 'Toolbar menutupi konten mobile');
  const overflow=await evaluate('document.getElementById("medium-content").scrollWidth>document.getElementById("medium-content").clientWidth');
  assert.equal(overflow,false,'Gameplay portrait meluap horizontal');
  await click('[data-medium="selector"]');await click('[data-medium="compare"]');await screenshot('09-mobile-comparison');
  await click('[data-medium="exit"]');
  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  // Smoke Easy dan Hard: renderer, kontrol keluar, serta popup Hard asli.
  await click('[data-level="Easy"]');await wait('!document.getElementById("game").hidden');await delay(1200);await click('#game-exit');
  await click('[data-action="play"]');await click('[data-level="Hard"]');await wait('!document.getElementById("game3").hidden');
  await delay(1800);await screenshot('10-hard-regression');await click('#game3-exit');
  const broken=await evaluate('Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute("src"))');
  assert.deepEqual(broken,[],'Gambar rusak');
  assert.deepEqual(responses.filter(r=>r.status>=400).map(r=>[r.status,r.url]),[],'HTTP error');
  assert.deepEqual(errors,[],'Console error');
  assert.deepEqual(failed,[],'Resource request gagal');
  fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({status:'passed',errors,failed,requests:responses.length,match3:m3},null,2));
  console.log('Browser smoke passed: alur 1→2→3→perbandingan, 2 kegagalan awal, penalti, persistensi, audio, portrait, Easy/Hard.');
}
main().catch(error=>{console.error(error); console.error(JSON.stringify({errors,failed},null,2));process.exitCode=1;}).finally(async()=>{if(ws?.readyState===1){try{await send('Browser.close');}catch{}}browser.kill();server.close();});
