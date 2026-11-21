const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..', 'src');
fs.readdirSync(dir).filter(f => f.endsWith('.js') && !/^(70|80)-/.test(f)).sort()
  .forEach(f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f }));

function mk(o) {
  const n = o.order, coeffs = [];
  for (let k = 0; k <= n; k++) coeffs.push(CAS.parse(o.coeffs ? (o.coeffs[k] || '0') : '0'));
  return {
    order: n, coeffs, rhs: CAS.parse(o.rhs || '0'),
    hasIC: !!o.ic, x0: o.x0 || 0, y0s: o.ic || [],
    knownExpr: o.known ? CAS.parse(o.known) : null,
    rawExpr: o.raw ? CAS.parse(o.raw) : null
  };
}

/* باقی‌ماندهٔ معادله برای y داده‌شده */
function residual(cfg, y, x) {
  const env = { x };
  const names = ['y', 'yp', 'ypp', 'yppp', 'ypppp'];
  for (let k = 0; k < cfg.order + 1; k++) {
    const d = k === 0 ? y : CAS.nthDiff(y, 'x', k);
    const v = CAS.evalNum(d, env);
    if (!isFinite(v)) return NaN;
    env[names[k]] = v;
    env['y' + k] = v;
  }
  let lhs = 0;
  for (let k = 0; k <= cfg.order; k++) lhs += CAS.evalNum(cfg.coeffs[k], env) * env[names[k]];
  return lhs - CAS.evalNum(cfg.rhs, env);
}

const cases = [
  ['linear1', { order: 1, coeffs: ['2', '1'], rhs: 'exp(-x)' }, [0.6, 1.7, 2.9]],
  ['bernoulli', { order: 1, coeffs: ['1', '1'], rhs: 'x*y^2' }, [0.6, 1.7, 2.9]],
  ['separable', { order: 1, coeffs: ['0', '1'], rhs: 'x*y' }, [0.6, 1.7]],
  ['homogeneous', { order: 1, coeffs: ['0', '1'], rhs: '(x+y)/x' }, [0.6, 1.7]],
  ['exact', { order: 1, coeffs: ['0', 'x+2*y'], rhs: '-(2*x+y)' }, [0.6, 1.7]],
  ['riccati', { order: 1, coeffs: ['0', '1'], rhs: 'y^2-1', known: '1' }, [0.6, 1.7]],
  ['order2', { order: 2, coeffs: ['2', '-3', '1'] }, [0.6, 1.7]],
  ['complex', { order: 2, coeffs: ['13', '4', '1'] }, [0.6, 1.7]],
  ['repeated', { order: 2, coeffs: ['1', '-2', '1'] }, [0.6, 1.7]],
  ['nonhom', { order: 2, coeffs: ['-1', '0', '1'], rhs: 'exp(2*x)' }, [0.6, 1.7]],
  ['resonance', { order: 2, coeffs: ['1', '0', '1'], rhs: 'sin(x)' }, [0.6, 1.7]],
  ['euler', { order: 2, coeffs: ['2', '-2*x', 'x^2'] }, [0.6, 1.7]],
  ['euler nonhom', { order: 2, coeffs: ['0', 'x', 'x^2'], rhs: 'x^3' }, [0.6, 1.7]],
  ['order4', { order: 4, coeffs: ['4', '0', '-5', '0', '1'] }, [0.6, 1.7]],
  ['reduction', { order: 2, coeffs: ['0', '-1/x', '1'], known: '1' }, [0.6, 1.7]],
  ['poly rhs', { order: 2, coeffs: ['0', '0', '1'], rhs: 'x^2+1' }, [0.6, 1.7]],
  ['expcos', { order: 2, coeffs: ['1', '2', '1'], rhs: 'exp(-x)*cos(2*x)' }, [0.6, 1.7]],
  ['ic2', { order: 2, coeffs: ['2', '-3', '1'], ic: [1, 0] }, [0.6, 1.7]]
];

const map = { y: 'C1', yp: 'C1', ypp: 'C1' };
for (const [name, o, pts] of cases) {
  let res;
  try { res = CAS.solveODE(mk(o)); }
  catch (e) { console.log(name.padEnd(14), 'ERROR', e.message); continue; }
  const yRaw = res.particular || res.general;
  if (!yRaw) { console.log(name.padEnd(14), 'no explicit solution (implicit):', res.answerLabel); continue; }
  const y = res.particular ? yRaw : CAS.subs(yRaw, {
    C1: CAS.num(1.3), C2: CAS.num(-0.7), C3: CAS.num(0.4), C4: CAS.num(-1.1)
  });
  let worst = 0;
  for (const x of pts) {
    /* برای جواب عمومی، ثابت‌ها را با شرط ساختگی y(x0)=1 و y'(x0)=0.3 ... می‌بندیم */
    const r = residual(mk(o), y, x);
    if (!isFinite(r)) { worst = NaN; break; }
    worst = Math.max(worst, Math.abs(r) / (1 + Math.abs(x)));
  }
  let icErr = '';
  if (o.ic) {
    let e2 = 0;
    for (let k = 0; k < o.ic.length; k++) {
      const d = k === 0 ? y : CAS.nthDiff(y, 'x', k);
      e2 = Math.max(e2, Math.abs(CAS.evalNum(d, { x: o.x0 || 0 }) - o.ic[k]));
    }
    icErr = ' | ICerr=' + e2.toExponential(1);
  }
  console.log(name.padEnd(14), 'resid=' + (isNaN(worst) ? 'NaN' : worst.toExponential(2)), icErr);
}
