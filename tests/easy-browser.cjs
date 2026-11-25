const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const openBrowser=require('./browser-driver.cjs');
(async()=>{
  let b;
  try{
    b=await openBrowser();const {command,evaluate,wait,click,screenshot,delay}=b;
    const ready=()=>wait('typeof startGame === "function" && document.getElementById("stage").classList.contains("ready") && !document.getElementById("loader")');
    const feedback=()=>wait('!document.getElementById("easy-dialog").hidden');
    const title=()=>evaluate('document.getElementById("easy-dialog-title").textContent');
    const close=()=>click('[data-easy="close-dialog"]');
    const read=m=>evaluate(`JSON.parse(localStorage.getItem('dapurMacet.easy.results.v1'))[${m}]`);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
    await command('Page.navigate',{url:'http://127.0.0.1:8124/'});await ready();
    await evaluate('localStorage.clear()');await command('Page.reload');await ready();
    await click('[data-action="tutorial"]');await click('#tutorial-next');
    for(const name of ['Koki','Neng Puput'])await click(`.tutorial-option[data-choice-group="character"][data-label="${name}"]`);
    assert.equal(await evaluate('document.querySelector("[data-tutorial-confirm=character]").disabled'),true);
    for(const name of ['Neng Puput','Mang Ucil','Ceu Pipit'])await click(`.tutorial-option[data-choice-group="character"][data-label="${name}"]`);
    assert.equal(await evaluate('document.querySelectorAll(".tutorial-character-options [aria-pressed=true]").length'),2);
    assert.match(await evaluate('document.getElementById("tutorial-character-status").textContent'),/Maksimal/);
    await click('.tutorial-option[data-label="Neng Puput"]');await click('.tutorial-option[data-label="Ceu Pipit"]');
    await click('[data-tutorial-confirm="character"]');
    assert.deepEqual(await evaluate('EasySelection.team'),['ucil','pipit']);
    assert.match(await evaluate('document.getElementById("tutorial-character-status").textContent'),/Mang Ucil \(Koki A\).*Ceu Pipit \(Koki B\)/);
    await screenshot('easy-01-tutorial-team');await click('#tutorial-back');await click('#tutorial-back');
    await click('[data-action="play"]');await click('[data-level="Easy"]');
    await wait('getComputedStyle(document.getElementById("game")).opacity === "1"');
    assert.equal(await evaluate('document.querySelectorAll(".easy-character-options [aria-pressed=true]").length'),2);
    await click('[data-easy-item="Kompor"]');await screenshot('easy-02-setup');await click('[data-easy="ready"]');
    await screenshot('easy-03-selector');await click('[data-easy-play="1"]');
    await wait('!document.getElementById("easy-skip").disabled');
    await evaluate('EasyMatch1.advance(13)');await screenshot('easy-04-selected-match1');
    assert.match(await evaluate('document.getElementById("easy-m1-team").textContent'),/Mang Ucil.*Ceu Pipit/);
    await click('[data-easy="skip"]');const m1=await read(1);assert.equal(m1.status,'lost');assert.deepEqual(m1.team,['ucil','pipit']);
    await click('[data-easy-play="2"]');await screenshot('easy-05-match2-plan');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".easy-methods b")).map(b=>b.textContent)'),['Deteksi & Pemulihan','Pencegahan','Penghindaran']);
    await click('[data-easy="settings"]');
    const frozen=await evaluate('Array.from(document.querySelectorAll("[data-clock]")).map(e=>e.textContent)');await delay(1100);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-clock]")).map(e=>e.textContent)'),frozen);
    await evaluate('document.getElementById("easy-sfx-volume").value=0;document.getElementById("easy-sfx-volume").dispatchEvent(new Event("input",{bubbles:true}))');
    await close();assert.equal(await evaluate('document.getElementById("easy-audio").textContent'),'SFX OFF');await click('[data-easy="audio"]');
    await click('[data-easy-leader="A"]');await click('[data-easy-method="0"]');await click('[data-easy="apply-plan"]');
    assert.equal(await title(),'Benar!');await close();await click('[data-easy="cook"]');await feedback();
    assert.equal(await title(),'Benar · Pesanan Terlayani!');await close();await screenshot('easy-06-tools-released');
    await click('[data-easy="cook"]');await feedback();await close();const m2=await read(2);
    assert.deepEqual([m2.status,m2.score,m2.stars,m2.served],['won',100,3,2]);await screenshot('easy-07-match2-result');
    await click('[data-easy-play="3"]');await feedback();await screenshot('easy-08-safe-request');
    const frozen3=await evaluate('Array.from(document.querySelectorAll("[data-clock]")).map(e=>e.textContent)');await delay(1100);
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-clock]")).map(e=>e.textContent)'),frozen3);
    for(const [i,answer] of ['yes','no','yes','no'].entries()){
      assert.equal(await title(),'Izin Peminjaman Alat');
      if(i===1){assert.match(await evaluate('document.querySelector("[data-kitchen-chef=B]").textContent'),/Sedang memasak/);await screenshot('easy-09-risky-request');}
      await click(`[data-easy-give="${answer}"]`);assert.equal(await title(),'Benar!');await close();
      await feedback();assert.equal(await title(),i===3?'Semua pesanan selesai!':'Ronde Selesai!');await close();
      if(i<3)await click('[data-easy="next-round"]');
    }
    const m3=await read(3);assert.deepEqual([m3.status,m3.score,m3.stars,m3.served,m3.accuracy],['won',100,3,8,100]);
    await screenshot('easy-10-match3-result');await click('[data-easy="compare"]');await screenshot('easy-11-comparison');
    assert.ok(await evaluate('document.querySelector(".easy-table").textContent.includes("Akurasi 100%")'));
    // Urutan salah benar-benar menunggu, lalu kabur; bukan langsung melompat ke hasil.
    await click('[data-easy-play="2"]');await click('[data-easy-leader="B"]');await click('[data-easy-method="0"]');await click('[data-easy="apply-plan"]');
    assert.equal(await title(),'Salah!');await close();
    const before=await evaluate('document.querySelector("[data-clock=P1]").textContent');await delay(1200);
    assert.notEqual(await evaluate('document.querySelector("[data-clock=P1]").textContent'),before);
    await click('[data-easy="wait-timeout"]');assert.equal(await title(),'Pelanggan Kabur!');
    assert.equal(await evaluate('document.querySelectorAll(".easy-customer.escaped").length'),1);await screenshot('easy-12-customer-escaped');await close();
    assert.equal((await read(2)).status,'lost');
    // Tolak aman dan berikan berisiko: kedua cabang Salah; hanya yang kedua membentuk cycle.
    await click('[data-easy-play="3"]');await click('[data-easy-give="no"]');assert.equal(await title(),'Salah!');await close();
    assert.equal(await evaluate('document.querySelector(".easy-cycle").classList.contains("danger")'),false);
    await click('[data-easy="wait-timeout"]');await close();await click('[data-easy="next-round"]');
    await click('[data-easy-give="yes"]');assert.equal(await title(),'Salah!');await close();
    assert.equal(await evaluate('document.querySelector(".easy-cycle").classList.contains("danger")'),true);
    await screenshot('easy-13-wrong-grant-cycle');await click('[data-easy="selector"]');
    // Portrait: persiapan, popup, papan, toolbar, tabel dengan scroll lokal.
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await click('[data-easy="setup"]');await screenshot('easy-14-mobile-setup');await click('[data-easy="ready"]');
    await click('[data-easy-play="3"]');await screenshot('easy-15-mobile-request');await click('[data-easy-give="yes"]');await close();
    await screenshot('easy-16-mobile-kitchen');
    assert.ok(await evaluate('document.getElementById("easy-content").getBoundingClientRect().top >= document.querySelector(".easy-toolbar").getBoundingClientRect().bottom'));
    assert.equal(await evaluate('document.getElementById("easy-content").scrollWidth > document.getElementById("easy-content").clientWidth'),false);
    await click('[data-easy="compare"]');await screenshot('easy-17-mobile-comparison');
    await command('Page.reload');await ready();await click('[data-action="play"]');await click('[data-level="Easy"]');
    assert.deepEqual(await evaluate('EasySelection.team'),['ucil','pipit']);assert.equal((await read(3)).score,100);
    // Satu karakter mendapat pasangan default berbeda setelah konfirmasi.
    await click('[data-easy-character="ucil"]');await click('[data-team-confirm]');
    const pair=await evaluate('EasySelection.team');assert.equal(pair.length,2);assert.notEqual(pair[0],pair[1]);
    assert.match(await evaluate('document.querySelector("[data-team-status]").textContent'),/default ditambahkan/);
    await b.checkClean();
    fs.writeFileSync(path.join(b.output,'easy-browser-report.json'),JSON.stringify({status:'passed',errors:b.errors,failed:b.failed,requests:b.responses.length,match1:m1,match2:m2,match3:m3},null,2));
    console.log('Easy browser passed: 2 karakter → Match 1 → Match 2 → 4 ronde Match 3 → perbandingan; gagal/kabur, timer pause, audio, persistensi, portrait.');
  }catch(error){console.error(error);if(b){try{await b.screenshot('easy-failure');}catch(_){}console.error(JSON.stringify({errors:b.errors,failed:b.failed},null,2));}process.exitCode=1;}
  finally{if(b)await b.close();}
})();
