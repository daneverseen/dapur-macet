/* CDP minimal untuk tes lokal tanpa npm dependency. */
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function openBrowser({port=8124,profile='.test-browser-easy'}={}){
  const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
  const server=require('../tools/serve.cjs')();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const browser=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
    '--headless=new','--no-first-run','--no-default-browser-check','--no-proxy-server','--remote-debugging-port=0',
    '--enable-unsafe-swiftshader','--use-angle=swiftshader','--user-data-dir='+path.resolve(root,'..',profile),'about:blank'
  ],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let ws,nextId=0;const pending=new Map(),errors=[],failed=[],responses=[];
  const close=async()=>{if(ws?.readyState===1){try{await send('Browser.close');}catch(_){}}browser.kill();server.close();};
  function send(method,params={},sessionId){return new Promise((resolve,reject)=>{
    const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},20000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });}
  try{
    const endpoint=await new Promise((resolve,reject)=>{
      let data='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout: '+data)),20000);
      browser.on('error',reject);browser.stderr.on('data',chunk=>{data+=chunk;const m=data.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
    });
    ws=new WebSocket(endpoint);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
    ws.addEventListener('message',e=>{
      const m=JSON.parse(e.data);
      if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
      else{
        if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
        if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry);
        if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params);
        if(m.method==='Network.loadingFailed'&&!m.params.canceled)failed.push(m.params);
        if(m.method==='Network.responseReceived')responses.push(m.params.response);
      }
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const command=(method,params={})=>send(method,params,sessionId);
    for(const domain of ['Page','Runtime','Network','Log'])await command(domain+'.enable');
    await command('Page.bringToFront');
    const evaluate=async expression=>{
      const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
    };
    const wait=async(expression,timeout=10000)=>{const t=Date.now();while(Date.now()-t<timeout){if(await evaluate(expression))return;await delay(80);}throw new Error('Timed out: '+expression);};
    const click=async selector=>{
      // Popup masuk dengan transform .2s; klik setelah geometri tombol stabil.
      await delay(250);
      const rect=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||e.closest('[hidden]'))return null;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(x,y))};})()`);
      assert.ok(rect?.w&&rect?.h,'Missing/hidden/disabled control: '+selector);
      assert.ok(rect.hit,'Control is covered: '+selector);
      await command('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1});
      await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x,y:rect.y,button:'left',clickCount:1});
      await delay(50);
    };
    const screenshot=async name=>{await delay(650);const {data}=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(data,'base64'));};
    const checkClean=async()=>{
      const broken=await evaluate('Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute("src"))');
      assert.deepEqual(broken,[],'Broken images');assert.deepEqual(errors,[],'Console errors');assert.deepEqual(failed,[],'Failed requests');
      assert.deepEqual(responses.filter(r=>r.status>=400).map(r=>r.url),[],'HTTP errors');
    };
    return {command,evaluate,wait,click,screenshot,checkClean,close,delay,errors,failed,responses,output};
  }catch(error){await close();throw error;}
};
