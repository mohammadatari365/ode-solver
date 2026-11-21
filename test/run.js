const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !/^(70|80)-/.test(f)).sort();
for (const f of files) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
}

function strip(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&thinsp;/g, ' ').replace(/&middot;/g, '·');
}

function mk(o) {
  const n = o.order;
  const coeffs = [];
  for (let k = 0; k <= n; k++) coeffs.push(CAS.parse(o.coeffs ? (o.coeffs[k] || '0') : '0'));
  const cfg = {
    order: n,
    coeffs,
    rhs: CAS.parse(o.rhs || '0'),
    hasIC: o.ic != null,
    x0: o.x0 != null ? o.x0 : 0,
    y0s: o.ic || [],
    knownExpr: o.known ? CAS.parse(o.known) : null,
    rawExpr: o.raw ? CAS.parse(o.raw) : null
  };
  if (o.rhs && o.rhs !== '0') cfg.hasRHS = true;
  return cfg;
}

function run(name, o, showSteps) {
  try {
    const res = CAS.solveODE(mk(o));
    console.log('\n=== ' + name + ' ===');
    console.log('[method] ' + res.method + (res.methodNote ? ' | ' + res.methodNote : ''));
    console.log('[tags] ' + (res.tags || []).map(t => t.text).join('، '));
    if (res.warnings && res.warnings.length) console.log('[warn] ' + res.warnings.map(strip).join(' | '));
    console.log('[answer] ' + strip(res.answerHtml));
    if (res.alts && res.alts.length) console.log('[alts] ' + res.alts.map(a => a.label).join(' | '));
    if (showSteps) {
      for (const s of res.steps) {
        console.log('  • ' + s.title + ': ' + s.blocks.map(b => strip(b.html || (b.items || []).join(' ; '))).join(' || ').slice(0, 400));
      }
    }
    return res;
  } catch (err) {
    console.log('\n=== ' + name + ' ===');
    console.log('[ERROR] ' + err.message);
    console.log(err.stack.split('\n').slice(0, 4).join('\n'));
    return null;
  }
}

run('linear1', { order: 1, coeffs: ['2', '1'], rhs: 'exp(-x)' }, true);
run('linear1 ic', { order: 1, coeffs: ['2', '1'], rhs: 'exp(-x)', ic: [1], x0: 0 });
run('bernoulli', { order: 1, coeffs: ['1', '1'], rhs: 'x*y^2' }, true);
run('separable', { order: 1, coeffs: ['0', '1'], rhs: 'x*y' }, true);
run('separable ic', { order: 1, coeffs: ['0', '1'], rhs: 'x*y', ic: [2], x0: 0 });
run('homogeneous', { order: 1, coeffs: ['0', '1'], rhs: '(x+y)/x' }, true);
run('exact', { order: 1, coeffs: ['0', 'x+2*y'], rhs: '-(2*x+y)' }, true);
run('exact raw', { order: 1, raw: '(2*x+y) + (x+2*y)*y\'' }, true);
run('riccati known', { order: 1, coeffs: ['0', '1'], rhs: 'y^2 - 1', known: '1' }, true);
run('clairaut raw', { order: 1, raw: 'y = x*y\' + y\'^2' }, true);
run('clairaut coeff', { order: 1, coeffs: ['1', '-x'], rhs: 'yp^2' }, true);
run('order2 distinct', { order: 2, coeffs: ['2', '-3', '1'] }, true);
run('order2 complex', { order: 2, coeffs: ['13', '4', '1'] }, true);
run('order2 repeated', { order: 2, coeffs: ['1', '-2', '1'] }, true);
run('order2 ic', { order: 2, coeffs: ['2', '-3', '1'], ic: [1, 0] }, true);
run('nonhom undet', { order: 2, coeffs: ['-1', '0', '1'], rhs: 'exp(2*x)' }, true);
run('nonhom resonance', { order: 2, coeffs: ['1', '0', '1'], rhs: 'sin(x)' }, true);
run('nonhom variation', { order: 2, coeffs: ['1', '0', '1'], rhs: '1/x' }, true);
run('euler', { order: 2, coeffs: ['2', '-2*x', 'x^2'] }, true);
run('euler nonhom', { order: 2, coeffs: ['0', 'x', 'x^2'], rhs: 'x^3' });
run('order4', { order: 4, coeffs: ['4', '0', '-5', '0', '1'] }, true);
run('reduction', { order: 2, coeffs: ['0', '-1/x', '1'], known: '1' }, true);
run('poly rhs', { order: 2, coeffs: ['0', '0', '1'], rhs: 'x^2+1' }, true);
run('exp cos rhs', { order: 2, coeffs: ['1', '2', '1'], rhs: 'exp(-x)*cos(2*x)' }, true);
