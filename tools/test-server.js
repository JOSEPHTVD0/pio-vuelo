'use strict';
/* Mini servidor HTTP estático para probar el juego en headless.
 *
 *   node tools/test-server.js
 *
 * Con PIO_EMULATORS=1 sirve una configuración de Firebase apuntando a los
 * emuladores locales (proyecto demo-pio-vuelo) en lugar de producción. Así se
 * pueden probar registro, login y restauración sin tocar datos reales.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const EMULATORS = process.env.PIO_EMULATORS === '1';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

const EMULATOR_CONFIG = `/* Configuración generada por tools/test-server.js para emuladores. */
window.PIO_FIREBASE = {
  enabled: true,
  sdkVersion: '11.0.2',
  config: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-pio-vuelo.firebaseapp.com',
    projectId: 'demo-pio-vuelo',
    storageBucket: 'demo-pio-vuelo.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo',
    databaseURL: 'http://127.0.0.1:9000?ns=demo-pio-vuelo-default-rtdb'
  },
  emulators: {
    auth: 'http://127.0.0.1:9099',
    firestore: '127.0.0.1:8080',
    database: '127.0.0.1:9000'
  },
  options: {
    board: 'global',
    presence: true,
    runs: true,
    heartbeatMs: 60000
  }
};
`;

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';

  if (EMULATORS && p === '/js/firebase-config.js') {
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(EMULATOR_CONFIG);
    return;
  }

  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(8123, () => console.log('server on 8123' + (EMULATORS ? ' (emuladores)' : '')));
