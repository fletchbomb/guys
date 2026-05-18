// Big Guy Little Guys tiny WebSocket relay server
// Deploy this somewhere that supports Node WebSockets (Render, Railway, Fly.io, etc.).
// Install: npm install
// Run: npm start
// Client URL example: https://your-github-pages-url/index.html?relay=wss://your-relay.example.com

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const rooms = new Map();

function makePin() {
  let pin;
  do pin = String(Math.floor(1000 + Math.random() * 9000));
  while (rooms.has(pin));
  return pin;
}
function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function relay(ws, room, msg) {
  if (!room) return;
  const target = ws === room.host ? room.guest : room.host;
  send(target, msg);
}
function cleanup(ws) {
  for (const [pin, room] of rooms) {
    if (room.host === ws || room.guest === ws) {
      const other = room.host === ws ? room.guest : room.host;
      send(other, { type: 'PEER_LEFT' });
      if (room.host === ws) rooms.delete(pin);
      else room.guest = null;
    }
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Big Guy Little Guys relay is running.');
});
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  ws.roomPin = null;
  ws.role = null;

  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'HOST') {
      const pin = msg.pin && !rooms.has(String(msg.pin)) ? String(msg.pin) : makePin();
      rooms.set(pin, { host: ws, guest: null });
      ws.roomPin = pin;
      ws.role = 'host';
      send(ws, { type: 'HOSTED', pin });
      return;
    }

    if (msg.type === 'JOIN') {
      const pin = String(msg.pin || '');
      const room = rooms.get(pin);
      if (!room || !room.host || room.guest) {
        send(ws, { type: 'ERROR', message: 'Room not found or already full.' });
        return;
      }
      room.guest = ws;
      ws.roomPin = pin;
      ws.role = 'guest';
      send(ws, { type: 'JOINED', pin });
      send(room.host, { type: 'GUEST_JOINED' });
      return;
    }

    const room = rooms.get(ws.roomPin);
    if (!room) return;

    if (msg.type === 'ROLE_SELECT' || msg.type === 'ROLES_RESOLVED' || msg.type === 'COMMAND' || msg.type === 'STATE') {
      relay(ws, room, msg);
    }
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

server.listen(PORT, () => console.log(`BGLG relay listening on ${PORT}`));
