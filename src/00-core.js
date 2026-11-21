/* ============================================================
   CAS — موتور جبر نمادین سبک و کاملاً آفلاین
   نمایش داخلی درخت عبارت:
     {t:'n', v}          عدد
     {t:'v', n}          متغیر (x, y, yp, e, pi, ...)
     {t:'s', n}          ثابت نمادین (C1, C2, ...)
     {t:'+', a:[...]}    جمع
     {t:'*', a:[...]}    ضرب
     {t:'^', b, e}       توان
     {t:'f', f, a}       تابع
     {t:'int', a, v}     انتگرال نامعین (∫ a dv) برای نمایش/محاسبهٔ عددی
   ============================================================ */
var CAS = (function () {
  'use strict';

  const num = v => ({ t: 'n', v: Number(v) });
  const vr = n => ({ t: 'v', n });
  const sy = n => ({ t: 's', n });

  function chop(v) {
    if (!isFinite(v)) return v;
    if (Math.abs(v) < 1e-13) return 0;
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-12 * Math.max(1, Math.abs(v))) return r;
    return v;
  }

  function key(e) {
    switch (e.t) {
      case 'n': return 'n' + e.v;
      case 'v': return 'v' + e.n;
      case 's': return 's' + e.n;
      case 'f': return 'f' + e.f + '(' + key(e.a) + ')';
      case '+': return '+(' + e.a.map(key).join(',') + ')';
      case '*': return '*(' + e.a.map(key).join(',') + ')';
      case '^': return '^(' + key(e.b) + ',' + key(e.e) + ')';
      case 'int': return 'I(' + key(e.a) + ',' + e.v + ')';
    }
    return '?';
  }
  function hasSym(e) {
    switch (e.t) {
      case 's': return true;
      case 'f': return hasSym(e.a);
      case '+': case '*': return e.a.some(hasSym);
      case '^': return hasSym(e.b) || hasSym(e.e);
      case 'int': return hasSym(e.a);
    }
    return false;
  }
  /* ترتیب نمایش: جمله‌های حاوی ثابت‌های C اول، سپس بر اساس اندازه و کلید */
  const desc = (a, b) => ((hasSym(b) ? 1 : 0) - (hasSym(a) ? 1 : 0)) || (nodeSize(a) - nodeSize(b)) || (key(a) < key(b) ? -1 : 1);

  function nodeSize(e) {
    switch (e.t) {
      case 'n': case 'v': case 's': return 1;
      case 'f': return 1 + nodeSize(e.a);
      case '+': case '*': return 1 + e.a.reduce((s, x) => s + nodeSize(x), 0);
      case '^': return 1 + nodeSize(e.b) + nodeSize(e.e);
      case 'int': return 2 + nodeSize(e.a);
    }
    return 1;
  }
  const isNum = (e, v) => e && e.t === 'n' && (v === undefined || Math.abs(e.v - v) < 1e-13);

  /* ------------------------------ ساده‌ساز ------------------------------ */
  function simp(e) {
    if (!e) return num(0);
    switch (e.t) {
      case 'n': return num(chop(e.v));
      case 'v': case 's': return e;
      case 'int': {
        const a = simp(e.a);
        if (isNum(a, 0)) return num(0);
        if (!depends(a, e.v)) return simpMul([a, vr(e.v)]);
        return { t: 'int', a, v: e.v };
      }
      case 'f': return simpFn(e.f, simp(e.a));
      case '+': return simpAdd(e.a);
      case '*': return simpMul(e.a);
      case '^': return simpPow(e.b, e.e);
    }
    return e;
  }

  const isExpNode = e => e.t === '^' && e.b.t === 'v' && e.b.n === 'e';
  const expNode = u => simpPow(vr('e'), u);

  function simpFn(f, a) {
    if (f === 'exp') return simpPow(vr('e'), a);
    if (f === 'sqrt') return simpPow(a, num(0.5));
    if (f === 'log') f = 'ln';
    if (f === 'abs' && a.t === 'n') return num(Math.abs(a.v));
    if (a.t === 'n') {
      if (f === 'ln' && a.v === 1) return num(0);
      if (f === 'sin' && a.v === 0) return num(0);
      if (f === 'cos' && a.v === 0) return num(1);
      if (f === 'tan' && a.v === 0) return num(0);
      if (f === 'sinh' && a.v === 0) return num(0);
      if (f === 'cosh' && a.v === 0) return num(1);
      if (f === 'tanh' && a.v === 0) return num(0);
      if (f === 'asin' && a.v === 0) return num(0);
      if (f === 'atan' && a.v === 0) return num(0);
    }
    if (f === 'ln' && isExpNode(a)) return a.e;
    if (f === 'ln' && isNum(a, 1)) return num(0);
    return { t: 'f', f, a };
  }

  function simpAdd(args) {
    let cst = 0;
    const map = new Map();
    const addTerm = t => {
      if (t.t === 'n') { cst += t.v; return; }
      if (t.t === '+') { t.a.forEach(addTerm); return; }
      let coef = 1, base = t;
      if (t.t === '*') {
        const ni = t.a.findIndex(x => x.t === 'n');
        if (ni >= 0) {
          coef = t.a[ni].v;
          const rest = t.a.filter((_, i) => i !== ni);
          base = rest.length === 0 ? num(1) : rest.length === 1 ? rest[0] : { t: '*', a: rest };
        }
      }
      const k = key(base);
      if (map.has(k)) map.get(k).coef += coef;
      else map.set(k, { base, coef });
    };
    for (const a of args) addTerm(simp(a));
    /* اتحاد sin²u + cos²u = 1 */
    const trig = new Map();
    map.forEach((ent, k) => {
      const b = ent.base;
      if (b.t === '^' && isNum(b.e, 2) && b.b.t === 'f' && (b.b.f === 'sin' || b.b.f === 'cos')) {
        const ak = key(b.b.a);
        if (!trig.has(ak)) trig.set(ak, {});
        trig.get(ak)[b.b.f] = { ent, k };
      }
    });
    trig.forEach(g => {
      if (g.sin && g.cos) {
        const cs = g.sin.ent.coef, cc = g.cos.ent.coef;
        if (Math.abs(cs - cc) < 1e-12) {
          cst += cs;
          map.delete(g.sin.k);
          map.delete(g.cos.k);
        }
      }
    });
    const out = [];
    map.forEach(({ base, coef }) => {
      const c = chop(coef);
      if (Math.abs(c) < 1e-13) return;
      if (base.t === 'n') { cst += c * base.v; return; }
      if (Math.abs(c - 1) < 1e-13) out.push(base);
      else out.push(mulNum(c, base));
    });
    if (Math.abs(cst) > 1e-13) out.push(num(chop(cst)));
    if (out.length === 0) return num(0);
    if (out.length === 1) return out[0];
    out.sort(desc);
    return { t: '+', a: out };
  }

  function mulNum(c, base) {
    if (base.t === '*') {
      const fs = base.a.slice();
      fs.unshift(num(c));
      return { t: '*', a: fs };
    }
    return { t: '*', a: [num(c), base] };
  }

  function simpMul(args) {
    let cst = 1;
    const map = new Map();
    const addFactor = f0 => {
      if (f0.t === 'n') { cst *= f0.v; return; }
      if (f0.t === '*') { f0.a.forEach(addFactor); return; }
      let base = f0, ex = num(1);
      if (f0.t === '^') { base = f0.b; ex = f0.e; }
      if (base.t === 'n') {
        if (ex.t === 'n') { cst *= Math.pow(base.v, ex.v); return; }
      }
      const k = key(base);
      if (map.has(k)) map.get(k).ex = simpAdd([map.get(k).ex, ex]);
      else map.set(k, { base, ex });
    };
    for (const a of args) addFactor(simp(a));
    if (chop(cst) === 0) return num(0);
    const out = [];
    map.forEach(({ base, ex }) => {
      const e2 = simp(ex);
      if (isNum(e2, 0)) return;
      out.push(isNum(e2, 1) ? base : { t: '^', b: base, e: e2 });
    });
    out.sort(desc);
    if (Math.abs(cst - 1) > 1e-13 || out.length === 0) out.unshift(num(chop(cst)));
    if (out.length === 0) return num(1);
    if (out.length === 1) return out[0];
    /* توزیع ضریب عددی روی تنها جملهٔ جمعی (برای نمایش تمیزتر) */
    if (out.length === 2 && out[0].t === 'n' && out[1].t === '+' && Math.abs(out[0].v) > 1e-13) {
      const c = out[0].v;
      return simpAdd(out[1].a.map(t => mulNum(c, t)));
    }
    return { t: '*', a: out };
  }

  function logXCoefCore(t) {
    let c = 1, hit = false;
    const fs = t.t === '*' ? t.a : [t];
    for (const f0 of fs) {
      if (f0.t === 'n') { c *= f0.v; continue; }
      if (f0.t === 'f' && f0.f === 'ln') {
        const a = f0.a;
        if (a.t === 'v' && a.n === 'x') { hit = true; continue; }
        if (a.t === 'f' && a.f === 'abs' && a.a.t === 'v' && a.a.n === 'x') { hit = true; continue; }
      }
      return null;
    }
    return hit ? c : null;
  }

  function simpPow(b, e) {
    const B = simp(b), E = simp(e);
    if (E.t === 'n') {
      if (E.v === 0) return num(1);
      if (E.v === 1) return B;
      if (B.t === 'n') {
        if (E.v === 0.5) {
          if (B.v >= 0 && Number.isInteger(Math.sqrt(B.v))) return num(Math.sqrt(B.v));
          return { t: '^', b: B, e: E };
        }
        if (Number.isInteger(E.v)) return num(chop(Math.pow(B.v, E.v)));
        return { t: '^', b: B, e: E };
      }
      if (B.t === '^' && B.e.t === 'n' && Number.isInteger(E.v)) return simpPow(B.b, num(B.e.v * E.v));
      if (B.t === '^' && (isExpNode(B) || (B.b.t === 'n' && B.b.v > 0))) {
        return simpPow(B.b, simpMul([B.e, E]));
      }
      if (B.t === '*' && Number.isInteger(E.v) && Math.abs(E.v) <= 5) {
        return simpMul(B.a.map(x => simpPow(x, E)));
      }      return { t: '^', b: B, e: E };
    }
    /* e^{k ln|x| + ...} = x^k · e^{...} (روی بازهٔ x>0) */
    if (B.t === 'v' && B.n === 'e') {
      const terms = E.t === '+' ? E.a : [E];
      let k = 0, found = false;
      const rest = [];
      for (const t of terms) {
        const c = logXCoefCore(t);
        if (c !== null) { k += c; found = true; }
        else rest.push(t);
      }
      if (found) {
        const parts = [];
        if (Math.abs(k) > 1e-13) parts.push(simpPow(vr('x'), num(k)));
        if (rest.length) parts.push(simpPow(vr('e'), simpAdd(rest)));
        if (parts.length === 0) return num(1);
        return simpMul(parts);
      }
    }
    if (B.t === 'n' && B.v === 1) return num(1);
    if (B.t === 'n' && B.v === Math.E && E.t === 'f' && E.f === 'ln') return E.a;
    return { t: '^', b: B, e: E };
  }

  /* ------------------------------ توابع عمومی ------------------------------ */
  const add = (...xs) => simpAdd(xs);
  const mul = (...xs) => simpMul(xs);
  const pow = (b, e) => simpPow(b, e);
  const fn = (f, a) => simpFn(f, simp(a));
  const neg = x => simpMul([num(-1), x]);
  const sub = (a, b) => simpAdd([a, neg(b)]);
  const div = (a, b) => simpMul([a, simpPow(b, num(-1))]);

  function depends(e, v) {
    switch (e.t) {
      case 'v': return e.n === v;
      case 'n': case 's': return false;
      case 'int': return e.v === v || depends(e.a, v);
      case 'f': return depends(e.a, v);
      case '+': case '*': return e.a.some(x => depends(x, v));
      case '^': return depends(e.b, v) || depends(e.e, v);
    }
    return false;
  }

  function varsOf(e, out) {
    out = out || new Set();
    switch (e.t) {
      case 'v': if (e.n !== 'e' && e.n !== 'pi') out.add(e.n); break;
      case 'f': varsOf(e.a, out); break;
      case '+': case '*': e.a.forEach(x => varsOf(x, out)); break;
      case '^': varsOf(e.b, out); varsOf(e.e, out); break;
      case 'int': varsOf(e.a, out); break;
    }
    return out;
  }

  function subs(e, m) {
    switch (e.t) {
      case 'n': return e;
      case 's': return Object.prototype.hasOwnProperty.call(m, e.n) ? m[e.n] : e;
      case 'v': return Object.prototype.hasOwnProperty.call(m, e.n) ? m[e.n] : e;
      case 'f': return simpFn(e.f, subs(e.a, m));
      case '+': return simpAdd(e.a.map(x => subs(x, m)));
      case '*': return simpMul(e.a.map(x => subs(x, m)));
      case '^': return simpPow(subs(e.b, m), subs(e.e, m));
      case 'int': return { t: 'int', a: subs(e.a, m), v: e.v };
    }
    return e;
  }

  function replaceSubtree(e, target, repl) {
    if (key(e) === key(target)) return repl;
    switch (e.t) {
      case 'n': case 'v': case 's': return e;
      case 'f': return { t: 'f', f: e.f, a: replaceSubtree(e.a, target, repl) };
      case '+': return { t: '+', a: e.a.map(x => replaceSubtree(x, target, repl)) };
      case '*': return { t: '*', a: e.a.map(x => replaceSubtree(x, target, repl)) };
      case '^': return { t: '^', b: replaceSubtree(e.b, target, repl), e: replaceSubtree(e.e, target, repl) };
      case 'int': return { t: 'int', a: replaceSubtree(e.a, target, repl), v: e.v };
    }
    return e;
  }

  const PI = Math.PI, E = Math.E, G = 1.5707963267948966;

  function applyFn(f, x) {
    switch (f) {
      case 'sin': return Math.sin(x);
      case 'cos': return Math.cos(x);
      case 'tan': return Math.tan(x);
      case 'cot': return 1 / Math.tan(x);
      case 'sec': return 1 / Math.cos(x);
      case 'csc': return 1 / Math.sin(x);
      case 'asin': return Math.asin(x);
      case 'acos': return Math.acos(x);
      case 'atan': return Math.atan(x);
      case 'sinh': return Math.sinh(x);
      case 'cosh': return Math.cosh(x);
      case 'tanh': return Math.tanh(x);
      case 'ln': return Math.log(x);
      case 'abs': return Math.abs(x);
      case 'erf': return erf(x);
    }
    return NaN;
  }
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  function evalNum(e, env) {
    env = env || {};
    switch (e.t) {
      case 'n': return e.v;
      case 'v': {
        if (e.n === 'e') return E;
        if (e.n === 'pi') return PI;
        const v = env[e.n];
        return v === undefined ? NaN : v;
      }
      case 's': {
        const v = env[e.n];
        return v === undefined ? NaN : v;
      }
      case 'f': return applyFn(e.f, evalNum(e.a, env));
      case '+': { let s = 0; for (const x of e.a) s += evalNum(x, env); return s; }
      case '*': { let s = 1; for (const x of e.a) s *= evalNum(x, env); return s; }
      case '^': return Math.pow(evalNum(e.b, env), evalNum(e.e, env));
      case 'int': return quadNode(e, env);
    }
    return NaN;
  }

  /* انتگرال عددی (قاعدهٔ نقطهٔ میانی) برای انتگرال‌های نمایشی */
  function quadNode(e, env) {
    const b = env[e.v];
    if (!isFinite(b)) return NaN;
    if (!depends(e.a, e.v)) return evalNum(e.a, env) * b;
    const a = 0;
    const N = 500;
    const h = (b - a) / N;
    let s = 0;
    for (let i = 0; i < N; i++) {
      const x = a + (i + 0.5) * h;
      const env2 = Object.assign({}, env);
      env2[e.v] = x;
      const val = evalNum(e.a, env2);
      if (!isFinite(val)) return NaN;
      s += val;
    }
    return s * h;
  }

  function numApprox(a, b) {
    const pts = [[0.73, -1.31, 0.9], [1.94, 0.47, -1.2], [-2.17, 1.63, 2.1], [2.61, -0.82, 1.4], [-0.61, 2.29, -0.7], [3.07, 1.13, 0.3]];
    let ok = 0, tot = 0;
    for (const [x, y, z] of pts) {
      const env = { x, y, yp: z, u: y, v: x, t: x };
      const va = evalNum(a, env), vb = evalNum(b, env);
      if (!isFinite(va) || !isFinite(vb)) continue;
      tot++;
      if (Math.abs(va - vb) <= 1e-8 * (1 + Math.abs(va) + Math.abs(vb))) ok++;
    }
    return tot === 0 ? true : ok === tot;
  }

  const isZero = e => numApprox(e, num(0));
  const eqExpr = (a, b) => numApprox(simp(sub(a, b)), num(0));

  function evalAt(e, x, y) {
    return evalNum(e, { x, y, yp: 1.1, u: y, v: x, t: x });
  }

  /* ------------------------------ مشتق‌گیری ------------------------------ */
  const DERIV = {
    sin: u => fn('cos', u),
    cos: u => neg(fn('sin', u)),
    tan: u => add(num(1), pow(fn('tan', u), num(2))),
    cot: u => neg(add(num(1), pow(fn('cot', u), num(2)))),
    sec: u => mul(fn('sec', u), fn('tan', u)),
    csc: u => neg(mul(fn('csc', u), fn('cot', u))),
    asin: u => pow(sub(num(1), pow(u, num(2))), num(-0.5)),
    acos: u => neg(pow(sub(num(1), pow(u, num(2))), num(-0.5))),
    atan: u => pow(add(num(1), pow(u, num(2))), num(-1)),
    sinh: u => fn('cosh', u),
    cosh: u => fn('sinh', u),
    tanh: u => sub(num(1), pow(fn('tanh', u), num(2))),
    ln: u => pow(u, num(-1)),
    abs: u => fn('sign', u)
  };

  function diff(e, v) {
    switch (e.t) {
      case 'n': case 's': return num(0);
      case 'v': return num(e.n === v ? 1 : 0);
      case 'int': return e.v === v ? e.a : num(0);
      case '+': return simpAdd(e.a.map(x => diff(x, v)));
      case '*': {
        const terms = e.a.map((x, i) =>
          simpMul(e.a.slice(0, i).concat([diff(x, v)]).concat(e.a.slice(i + 1))));
        return simpAdd(terms);
      }
      case '^': {
        const b = e.b, ex = e.e;
        if (!depends(ex, v)) return mul(ex, pow(b, sub(ex, num(1))), diff(b, v));
        if (!depends(b, v)) return mul(pow(b, ex), fn('ln', b), diff(ex, v));
        return mul(pow(b, ex), add(mul(diff(ex, v), fn('ln', b)), div(mul(ex, diff(b, v)), b)));
      }
      case 'f': {
        if (e.f === 'ln' && e.a.t === 'f' && e.a.f === 'abs') {
          return mul(diff(e.a.a, v), pow(e.a.a, num(-1)));
        }
        const d = DERIV[e.f];
        if (!d) return num(0);
        return mul(simp(d(e.a)), diff(e.a, v));
      }
    }
    return num(0);
  }

  function nthDiff(e, v, n) {
    let r = simp(e);
    for (let i = 0; i < n; i++) r = diff(r, v);
    return simp(r);
  }

  /* ------------------------------ بسط و چندجمله‌ای ------------------------------ */
  function expand(e, budget) {
    budget = budget || { n: 0 };
    e = simp(e);
    if (++budget.n > 4000) return e;
    if (e.t === '+') return simpAdd(e.a.map(x => expand(x, budget)));
    if (e.t === '*') {
      let terms = [num(1)];
      for (const f0 of e.a) {
        const ef = expand(f0, budget);
        const fs = ef.t === '+' ? ef.a : [ef];
        const next = [];
        for (const t of terms) {
          for (const g of fs) {
            next.push(simpMul([t, g]));
            if (next.length > 600) return simp(e);
          }
        }
        terms = next;
      }
      return simpAdd(terms);
    }
    if (e.t === '^' && e.e.t === 'n' && Number.isInteger(e.e.v) && e.e.v > 1 && e.e.v <= 5) {
      const b = expand(e.b, budget);
      if (b.t === '+') {
        let acc = num(1);
        for (let i = 0; i < e.e.v; i++) acc = expand(simpMul([acc, b]), budget);
        return acc;
      }
    }
    return e;
  }

  /* چندجمله‌ای نسبت به v: [{d, c}] صعودی — null اگر چندجمله‌ای نباشد */
  function polyIn(e, v) {
    const E = expand(e);
    const terms = E.t === '+' ? E.a : [E];
    const map = new Map();
    for (const t of terms) {
      let deg = 0;
      const rest = [];
      const factors = t.t === '*' ? t.a : [t];
      let bad = false;
      for (const f0 of factors) {
        if (f0.t === 'v' && f0.n === v) deg += 1;
        else if (f0.t === '^' && f0.b.t === 'v' && f0.b.n === v && f0.e.t === 'n' && Number.isInteger(f0.e.v)) deg += f0.e.v;
        else if (depends(f0, v)) { bad = true; break; }
        else rest.push(f0);
      }
      if (bad) return null;
      const coef = rest.length ? simpMul(rest) : num(1);
      map.set(deg, simpAdd([map.get(deg) || num(0), coef]));
    }
    return [...map.entries()]
      .map(([d, c]) => ({ d, c }))
      .filter(o => !isNum(o.c, 0))
      .sort((a, b) => a.d - b.d);
  }

  const degreeIn = (e, v) => {
    const p = polyIn(e, v);
    if (!p) return null;
    return p.length ? p[p.length - 1].d : 0;
  };

  /* ضرایب معادلهٔ خطی نسبت به v: {a,b} برای a*v+b */
  function linearIn(e, v) {
    const p = polyIn(e, v);
    if (!p) return null;
    if (p.some(o => o.d > 1)) return null;
    const a = (p.find(o => o.d === 1) || { c: num(0) }).c;
    const b = (p.find(o => o.d === 0) || { c: num(0) }).c;
    return { a, b };
  }

  function isConstant(e, v) { return !depends(simp(e), v); }

  /* ------------------------------ ریشه‌های چندجمله‌ای ------------------------------ */
  function polyEval(coefs, z) {
    let re = 0, im = 0;
    for (const c of coefs) {
      const nr = re * z.re - im * z.im + c;
      const ni = re * z.im + im * z.re;
      re = nr; im = ni;
    }
    return { re, im };
  }

  function rootsComplex(coefsIn) {
    let coefs = coefsIn.slice();
    while (coefs.length > 1 && Math.abs(coefs[0]) < 1e-14) coefs.shift();
    if (coefs.length <= 1) return [];
    const n = coefs.length - 1;
    const a0 = coefs[0];
    coefs = coefs.map(c => c / a0);
    let zs = [];
    for (let i = 0; i < n; i++) {
      const ang = 2 * Math.PI * i / n + 0.35;
      const rad = 0.35 + 0.17 * i;
      zs.push({ re: Math.cos(ang) * rad, im: Math.sin(ang) * rad });
    }
    for (let it = 0; it < 800; it++) {
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        const pi = polyEval(coefs, zs[i]);
        let dr = 1, di = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const ar = zs[i].re - zs[j].re, ai = zs[i].im - zs[j].im;
          const nr = dr * ar - di * ai, ni = dr * ai + di * ar;
          dr = nr; di = ni;
        }
        const den = dr * dr + di * di;
        if (den < 1e-300) continue;
        const qr = (pi.re * dr + pi.im * di) / den;
        const qi = (pi.im * dr - pi.re * di) / den;
        zs[i] = { re: zs[i].re - qr, im: zs[i].im - qi };
        const d = Math.hypot(qr, qi);
        if (d > maxd) maxd = d;
      }
      if (maxd < 1e-15) break;
    }
    return zs;
  }

  /* خوشه‌بندی ریشه‌ها و ساخت پایهٔ جواب همگن */
  function basisFromRoots(roots, order) {
    const used = new Array(roots.length).fill(false);
    const groups = [];
    for (let i = 0; i < roots.length; i++) {
      if (used[i]) continue;
      const r = roots[i];
      used[i] = true;
      const grp = [r];
      for (let j = i + 1; j < roots.length; j++) {
        if (!used[j] && Math.hypot(roots[j].re - r.re, roots[j].im - r.im) < 1e-6 * (1 + Math.abs(r.re) + Math.abs(r.im))) {
          used[j] = true; grp.push(roots[j]);
        }
      }
      groups.push(grp);
    }
    const realRoots = [], complexGroups = [];
    for (const g of groups) {
      if (Math.abs(g[0].im) < 1e-7) realRoots.push({ r: g[0].re, m: g.length });
      else if (g[0].im > 0) complexGroups.push({ a: g[0].re, b: Math.abs(g[0].im), m: g.length });
    }
    const basis = [];
    realRoots.sort((a, b) => a.r - b.r);
    complexGroups.sort((a, b) => (a.a - b.a) || (a.b - b.b));
    for (const { r, m } of realRoots) {
      for (let j = 0; j < m; j++) {
        const xj = j === 0 ? num(1) : pow(vr('x'), num(j));
        basis.push(mul(xj, expNode(mul(num(r), vr('x')))));
      }
    }
    for (const { a, b, m } of complexGroups) {
      for (let j = 0; j < m; j++) {
        const xj = j === 0 ? num(1) : pow(vr('x'), num(j));
        basis.push(mul(xj, expNode(mul(num(a), vr('x'))), fn('cos', mul(num(b), vr('x')))));
        basis.push(mul(xj, expNode(mul(num(a), vr('x'))), fn('sin', mul(num(b), vr('x')))));
      }
    }
    return { basis: basis.slice(0, order), realRoots, complexGroups, groups };
  }

  /* ------------------------------ ابزار عددی ------------------------------ */
  function rat(v, tol) {
    tol = tol || 1e-9;
    if (!isFinite(v)) return null;
    const sg = v < 0 ? -1 : 1;
    v = Math.abs(v);
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, b = v;
    for (let i = 0; i < 24; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 5000) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(v - h1 / k1) <= tol * Math.max(1, Math.abs(v))) return { n: sg * h1, d: k1 };
      const frac = b - a;
      if (frac < 1e-14) break;
      b = 1 / frac;
    }
    return null;
  }

  function fmt(v) {
    if (!isFinite(v)) return '?';
    if (Math.abs(v) < 1e-13) return '0';
    if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v));
    const r = rat(v);
    if (r && Math.abs(r.d) <= 16 && Math.abs(r.n) <= 500) return (r.n) + '/' + r.d;
    return String(Number(v.toPrecision(6)));
  }

  return {
    num, vr, sy, ZERO: num(0), ONE: num(1),
    key, simp, add, mul, pow, fn, neg, sub, div, expNode, isExpNode,
    depends, varsOf, subs, replaceSubtree, evalNum, evalAt, applyFn,
    numApprox, isZero, eqExpr, diff, nthDiff,
    expand, polyIn, degreeIn, linearIn, isConstant,
    rootsComplex, basisFromRoots, rat, fmt, chop, isNum,
    simpAdd, simpMul, simpPow, cmpExpr: desc
  };
})();
