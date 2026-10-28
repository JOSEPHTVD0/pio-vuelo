'use strict';
/* Genera test-drive.html: index.html + driver que automatiza partida y pantallas, capturando errores JS */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const driver = `
<script>
window.__errors = '';
window.onerror = function (m, s, l, c, e) { window.__errors += (m + ' @' + l + '\\n'); };
window.__result = '';
var __count = 0, __timer = null;
function __step() {
  try {
    if (__count % 3 === 0) G.flap();
    __count++;
    if (__count % 60 === 0) { G.togglePause(); }
    if (__count % 120 === 0) { G.togglePause(); }
    if (__count === 180) { UI.openGeneric('shop'); SAVE.addCoins(600); }
    if (__count === 200) { SAVE.buy('fx', 'fx-flame'); SAVE.equip('fx', 'fx-flame'); SAVE.checkAch(); }
    if (__count === 240) { UI.closeGeneric(); UI.openGeneric('maps'); }
    if (__count === 280) { UI.closeGeneric(); UI.openGeneric('progress'); }
    if (__count === 320) { UI.closeGeneric(); UI.openGeneric('settings'); }
    if (__count === 360) { UI.closeGeneric(); G.goMenu(); }
    if (__count >= 400) {
      if (__timer) clearInterval(__timer);
      window.__result = 'state=' + G.getState() + '|coins=' + SAVE.get().coins +
        '|flights=' + SAVE.get().stats.flights + '|pipes=' + SAVE.get().stats.pipes +
        '|level=' + SAVE.get().level + '|errors=' + (window.__errors || 'none') + '|achieved=' + SAVE.get().achieved.length;
      document.title = 'RESULT:' + window.__result;
      return;
    }
  } catch (e) {
    window.__errors += (e && e.message ? e.message : e) + '\\n';
    if (__timer) clearInterval(__timer);
    window.__result = 'state=' + G.getState() + '|errors=' + (window.__errors || 'none');
    document.title = 'RESULT:' + window.__result;
  }
}
function __boot() {
  if (typeof SAVE === 'undefined' || !SAVE.get()) { setTimeout(__boot, 50); return; }
  __timer = setInterval(__step, 45);
  G.startPlay();
}
setTimeout(__boot, 20);
window.__finish = function(){ return window.__result; };
</script>
</body>`;

const out = html.replace('</body>', driver);
const dest = path.join(root, 'test-drive.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('OK', dest);