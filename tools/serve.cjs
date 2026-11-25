const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.json':'application/json' };
function createServer() {
  return http.createServer((req,res) => {
    let pathname;
    try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400);res.end();return; }
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+path.sep)) { res.writeHead(403);res.end();return; }
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
    });
  });
}
if (require.main===module) createServer().listen(Number(process.env.PORT)||8000,'127.0.0.1',()=>console.log('Dapur Macet: http://127.0.0.1:'+(process.env.PORT||8000)));
module.exports=createServer;
