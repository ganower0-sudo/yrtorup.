const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/api/prices/RUB.json') {
    try {
      const upstream = await fetch('https://market.csgo.com/api/v2/prices/RUB.json', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'YRTORUP-demo/1.0' }
      });
      if (!upstream.ok) {
        res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});
        return res.end(JSON.stringify({success:false, error:`Market.CSGO ответил HTTP ${upstream.status}`}));
      }
      const body = await upstream.text();
      res.writeHead(200, {
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store',
        'Access-Control-Allow-Origin':'*'
      });
      return res.end(body);
    } catch (e) {
      res.writeHead(502, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});
      return res.end(JSON.stringify({success:false, error:'Не удалось связаться с Market.CSGO', details:String(e)}));
    }
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep) && target !== path.join(ROOT,'index.html')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Файл не найден'); }
    const ext = path.extname(target).toLowerCase();
    const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
    res.writeHead(200, {'Content-Type':types[ext] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(data);
  });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`YRTORUP запущен: http://127.0.0.1:${PORT}`);
  console.log('Не закрывай это окно, пока пользуешься сайтом.');
});
