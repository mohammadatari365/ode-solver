/* ساخت فایل نهایی تک‌فایلی از قالب + استایل + موتور جبر */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcDir = path.join(root, 'src');
const template = fs.readFileSync(path.join(root, 'ui', 'template.html'), 'utf8');
const fontCss = fs.readFileSync(path.join(root, 'ui', 'fonts.css'), 'utf8');
const css = fontCss + '\n' + fs.readFileSync(path.join(root, 'ui', 'app.css'), 'utf8');

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => {
  const code = fs.readFileSync(path.join(srcDir, f), 'utf8');
  if (code.includes('</script')) throw new Error('کد شامل تگ بستن اسکریپت است: ' + f);
  return '/* ===== ' + f + ' ===== */\n' + code;
}).join('\n\n');

const out = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

const outPath = path.join(root, 'ode-solver.html');
fs.writeFileSync(outPath, out, 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), out, 'utf8');

const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
const external = /(https?:)?\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}/gi;
const hits = out.match(external) || [];
console.log('ساخته شد: ' + outPath);
console.log('حجم: ' + kb + ' کیلوبایت — فایل‌های موتور: ' + files.length);
console.log('ارجاع خارجی: ' + (hits.length ? hits.join(', ') : 'هیچ'));
