// 내장 송출 서버: 조작 화면과 프릭샷 오버레이(웹 소스)를 제공하고, 상태를 WebSocket으로 실시간 전달한다.
// 127.0.0.1 에만 열어서 외부 접속과 윈도우 방화벽 팝업을 막는다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const ROUTES = {
  '/': 'control/index.html',
  '/control': 'control/index.html',
  '/overlay/1': 'overlay/index.html',
  '/overlay/2': 'overlay/index.html',
};

function startServer({ dataDir, staticDir, port = 7777, tries = 10 }) {
  const root = path.resolve(staticDir);
  const stateFile = path.join(dataDir, 'state.json');

  let state = null;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    state = null; // 첫 실행: 조작 화면이 기본값을 보내 준다
  }

  let saveTimer = null;
  function flush() {
    clearTimeout(saveTimer);
    if (!state) return;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const tmp = stateFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, stateFile);
    } catch (err) {
      console.error('상태 저장 실패', err);
    }
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 300);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const clean = url.pathname.replace(/\/+$/, '') || '/';
    const rel = ROUTES[clean] || decodeURIComponent(clean).replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('없는 페이지입니다');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(buf);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state', state }));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type !== 'state' || !msg.state || typeof msg.state !== 'object') return;
      state = msg.state;
      scheduleSave();
      const out = JSON.stringify({ type: 'state', state });
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === 1) client.send(out);
      }
    });
  });

  return new Promise((resolve, reject) => {
    let current = port;
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && current < port + tries - 1) {
        current += 1;
        server.listen(current, '127.0.0.1');
      } else {
        reject(err);
      }
    };
    server.on('error', onError);
    server.once('listening', () => {
      server.off('error', onError);
      resolve({
        port: current,
        flush,
        close() {
          flush();
          wss.close();
          server.close();
        },
      });
    });
    server.listen(current, '127.0.0.1');
  });
}

module.exports = { startServer };
