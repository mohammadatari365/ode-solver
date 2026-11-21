/* ساخت CSS فونتهای داخلی از فایلهای ttf (بدون هیچ ارجاع خارجی) */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const assets = path.join(root, 'assets');

function face(family, file, weight) {
  const buf = fs.readFileSync(path.join(assets, file));
  const b64 = buf.toString('base64');
  return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:${weight};font-style:normal;font-display:swap;}`;
}

const css = [
  '/* فونتهای داخلی — Vazirmatn (فارسی) و Orbitron (سایبرپانک) */',
  face('Vazirmatn', 'Vazirmatn.ttf', '100 900'),
  face('Orbitron', 'Orbitron.ttf', '400 900'),
  ''
].join('\n');

const out = path.join(root, 'ui', 'fonts.css');
fs.writeFileSync(out, css, 'utf8');
console.log('ساخته شد: ' + out + ' (' + (Buffer.byteLength(css, 'utf8') / 1024).toFixed(1) + ' کیلوبایت)');
