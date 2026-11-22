/* ------------------------------ موتور انتگرال‌گیری ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, add, mul, pow, fn, neg, sub, div, simp, depends, diff, isZero, linearIn, polyIn, isNum } = CAS;

  const ANTI = {
    sin: u => neg(fn('cos', u)),
    cos: u => fn('sin', u),
    tan: u => neg(fn('ln', fn('abs', fn('cos', u)))),
    cot: u => fn('ln', fn('abs', fn('sin', u))),
    sec: u => fn('ln', fn('abs', add(fn('sec', u), fn('tan', u)))),
    csc: u => neg(fn('ln', fn('abs', add(fn('csc', u), fn('cot', u))))),
    sinh: u => fn('cosh', u),
    cosh: u => fn('sinh', u),
    tanh: u => fn('ln', fn('cosh', u)),
    ln: u => sub(mul(u, fn('ln', u)), u),
    asin: u => add(mul(u, fn('asin', u)), pow(sub(num(1), pow(u, num(2))), num(0.5))),
    acos: u => sub(mul(u, fn('acos', u)), pow(sub(num(1), pow(u, num(2))), num(0.5))),
    atan: u => sub(mul(u, fn('atan', u)), mul(num(0.5), fn('ln', add(num(1), pow(u, num(2)))))),
    abs: u => mul(num(0.5), u, fn('abs', u)),
    sqrt: u => mul(num(2 / 3), pow(u, num(1.5)))
  };

  function integrate(e, v) { return intg(e, v, 0); }

  function intg(e, v, depth) {
    if (depth > 8) return null;
    e = simp(e);
    if (isNum(e, 0)) return num(0);
    if (!depends(e, v)) return mul(e, vr(v));
    if (e.t === '+') {
      const parts = e.a.map(t => intg(t, v, depth + 1));
      if (parts.some(p => p === null)) return null;
      return add(...parts);
    }
    if (e.t === '*') {
      const consts = e.a.filter(x => !depends(x, v));
      const rest = e.a.filter(x => depends(x, v));
      if (consts.length) {
        const inner = rest.length === 0 ? num(1) : rest.length === 1 ? rest[0] : CAS.mul(...rest);
        const I = intg(inner, v, depth + 1);
        if (I) return mul(...consts, I);
        return null;
      }
      const sb = trySubstitution(e, v, depth);
      if (sb) return sb;
      const lg = logPower(e, v);
      if (lg) return lg;
      const bp = tryByParts(e, v, depth);
      if (bp) return bp;
      const rt = rationalIntegrate(e, v);
      if (rt) return rt;
      return null;
    }
    return atom(e, v, depth);
  }

  function atom(e, v, depth) {
    if (e.t === 'v' && e.n === v) return mul(num(0.5), pow(vr(v), num(2)));

    /* توان با پایهٔ خطی */
    if (e.t === '^') {
      const baseLin = linearIn(e.b, v);
      if (baseLin && !depends(e.e, v) && e.e.t === 'n') {
        const n = e.e.v;
        const k = baseLin.a;
        if (isNum(k, 0)) return null;
        if (Math.abs(n + 1) < 1e-13) return mul(pow(k, num(-1)), fn('ln', fn('abs', e.b)));
        return mul(pow(k, num(-1)), pow(e.b, num(n + 1)), pow(num(n + 1), num(-1)));
      }
      /* e^{u} یا a^{u} با u خطی */
      const b = e.b;
      const linE = linearIn(e.e, v);
      if (linE && !isNum(linE.a, 0)) {
        if (b.t === 'v' && b.n === 'e') return mul(pow(linE.a, num(-1)), e);
        if (b.t === 'n' && b.v > 0) return mul(pow(linE.a, num(-1)), div(e, fn('ln', b)));
      }
      /* ∫ du/sqrt(a²-u²) */
      if (e.e.t === 'n' && Math.abs(e.e.v + 0.5) < 1e-13) {
        const q = quadCoeffs(e.b, v);
        if (q && Math.abs(q.a) < 1e-13) {
          if (q.c > 0 && q.b * q.b - 4 * q.a * q.c < 0) {
            const A = Math.sqrt(q.c);
            return fn('asin', div(vr(v), num(A)));
          }
        }
        if (q) {
          const rt = quadRational(div(num(1), e), v);
          if (rt) return rt;
        }
      }
      return rationalIntegrate(e, v);
    }

    if (e.t === 'f') {
      if (e.f === 'ln' && ((e.a.t === 'v' && e.a.n === v) ||
        (e.a.t === 'f' && e.a.f === 'abs' && e.a.a.t === 'v' && e.a.a.n === v))) {
        return sub(mul(vr(v), e), vr(v));
      }
      const lin = linearIn(e.a, v);
      if (lin && !isNum(lin.a, 0)) {
        if (e.f === 'ln') {
          const u = e.a;
          return mul(pow(lin.a, num(-1)), sub(mul(u, fn('ln', u)), u));
        }
        const A = ANTI[e.f];
        if (A) return mul(pow(lin.a, num(-1)), A(e.a));
      }
      if (e.f === 'ln') {
        return null;
      }
      return null;
    }

    /* کسرهای گویا */
    const rt = rationalIntegrate(e, v);
    if (rt) return rt;
    return null;
  }

  function quadCoeffs(e, v) {
    const p = polyIn(e, v);
    if (!p || p.some(o => o.d > 2)) return null;
    const pick = d => (p.find(o => o.d === d) || { c: num(0) }).c;
    const a = pick(2), b = pick(1), c = pick(0);
    if (!isNum(a) || !isNum(b) || !isNum(c)) return null;
    return { a: a.v, b: b.v, c: c.v };
  }

  /* انتگرال تابع گویا با مخرج درجهٔ ۲ (ضرایب عددی) */
  function quadRational(e, v) {
    if (isNum(e, 0)) return num(0);
    let numerator = num(1), denominator = num(1);
    const factors = e.t === '*' ? e.a : [e];
    const pos = [], neg = [];
    for (const f0 of factors) {
      if (f0.t === '^' && f0.e.t === 'n' && f0.e.v < 0 && Number.isInteger(f0.e.v)) {
        const k = -f0.e.v;
        for (let i = 0; i < k; i++) neg.push(f0.b);
      } else pos.push(f0);
    }
    if (neg.length === 0) return null;
    numerator = pos.length ? CAS.mul(...pos) : num(1);
    denominator = CAS.mul(...neg);
    const N = polyIn(numerator, v), D = polyIn(denominator, v);
    if (!N || !D) return null;
    if (D.some(o => o.d > 2)) return null;
    if (N.some(o => o.d > 2)) return null;
    const coef = (p, d) => (p.find(o => o.d === d) || { c: num(0) }).c;
    const na = coef(N, 2), nb = coef(N, 1), nc = coef(N, 0);
    const da = coef(D, 2), db = coef(D, 1), dc = coef(D, 0);
    if (!isNum(na) || !isNum(nb) || !isNum(nc) || !isNum(da) || !isNum(db) || !isNum(dc)) return null;
    let a = da.v, b = db.v, c = dc.v;
    let n2 = na.v, n1 = nb.v, n0 = nc.v;
    if (Math.abs(a) < 1e-13) return null;
    /* تقسیم چندجمله‌ای اگر درجهٔ صورت ≥ ۲ */
    let quotient = num(0);
    if (Math.abs(n2) > 1e-13) {
      const q = n2 / a;
      quotient = mul(num(q), vr(v));
      n1 -= q * b; n0 -= q * c; n2 = 0;
      const q2 = 0;
    }
    const disc = b * b - 4 * a * c;
    let out = quotient;
    if (disc > 1e-10) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      const A1 = (n1 * r1 + n0) / (a * (r1 - r2));
      const A2 = (n1 * r2 + n0) / (a * (r2 - r1));
      out = add(out, mul(num(A1), fn('ln', fn('abs', sub(vr(v), num(r1))))));
      out = add(out, mul(num(A2), fn('ln', fn('abs', sub(vr(v), num(r2))))));
    } else if (disc < -1e-10) {
      const p = n1 / (2 * a);
      const q = n0 - p * b;
      const alpha = Math.sqrt(-disc);
      out = add(out, mul(num(p), fn('ln', fn('abs', CAS.mul(num(a), pow(vr(v), num(2)), add(num(b), mul(num(1), vr(v))))))));
      /* بازنویسی ساده‌تر: p ln|a v²+bv+c| */
      out = sub(out, mul(num(p), fn('ln', fn('abs', denominator))));
      out = add(out, mul(num(p), fn('ln', fn('abs', denominator))));
      out = add(out, mul(num(2 * q / alpha), fn('atan', div(add(mul(num(2 * a), vr(v)), num(b)), num(alpha)))));
    } else {
      const r = -b / (2 * a);
      const p = n1 / (2 * a);
      const q = n0 - p * b;
      out = add(out, mul(num(p), fn('ln', fn('abs', sub(vr(v), num(r))))));
      out = sub(out, mul(num(q / (a * (0 - 1))), pow(sub(vr(v), num(r)), num(-1))));
    }
    return simp(out);
  }

  function rationalIntegrate(e, v) { return quadRational(e, v); }

  /* ---------------------- جایگذاری u ---------------------- */
  function collectSubs(e, v, out, depth) {
    if (!out) out = new Map();
    if (depth > 6) return out;
    if (depends(e, v) && e.t !== 'n' && e.t !== 's') {
      if (e.t !== 'v' || e.n !== v) out.set(CAS.key(e), e);
    }
    if (e.t === 'f') collectSubs(e.a, v, out, depth + 1);
    else if (e.t === '^') { collectSubs(e.b, v, out, depth + 1); collectSubs(e.e, v, out, depth + 1); }
    else if (e.t === '+' || e.t === '*') e.a.forEach(x => collectSubs(x, v, out, depth + 1));
    return out;
  }

  /* نسبت F/u1 را عددی بررسی می کند؛ اگر ثابت بود مقدار را برمی گرداند */
  function propConst(F, u1, v) {
    const pts = [0.63, 1.37, -1.11, 2.29, -2.41, 3.03];
    let c = null;
    for (const p of pts) {
      const env = { x: p, y: 0.7, yp: 0.3, u: p, v: p, t: p };
      const a = CAS.evalNum(F, env), b = CAS.evalNum(u1, env);
      if (!isFinite(a) || !isFinite(b) || Math.abs(b) < 1e-9 || Math.abs(a) > 1e8) continue;
      const r = a / b;
      if (c === null) c = r;
      else if (Math.abs(r - c) > 1e-6 * (1 + Math.abs(c))) return null;
    }
    return c;
  }

  function trySubstitution(e, v, depth) {
    const cands = [...collectSubs(e, v).values()];
    cands.sort((a, b) => CAS.key(b).length - CAS.key(a).length);
    const factors = e.t === '*' ? e.a : [e];
    let tested = 0;
    for (const u of cands) {
      if (++tested > 40) break;
      const u1 = diff(u, v);
      if (isZero(u1)) continue;
      for (let i = 0; i < factors.length; i++) {
        const F = factors[i];
        const c = propConst(F, u1, v);
        if (c === null || Math.abs(c) < 1e-12) continue;
        const others = factors.filter((_, j) => j !== i);
        const rest = others.length ? CAS.mul(...others) : num(1);
        let restU;
        try { restU = CAS.replaceSubtree(rest, u, vr('u')); } catch (err) { continue; }
        restU = simp(restU);
        if (depends(restU, v)) continue;
        const H = mul(num(c), restU);
        const I = intg(H, 'u', depth + 1);
        if (I) return simp(CAS.subs(I, { u: u }));
      }
    }
    return null;
  }

  /* ---------------------- انتگرال‌گیری جزءبه‌جزء ---------------------- */
  function tryByParts(e, v, depth) {
    if (e.t !== '*') return null;
    const factors = e.a.slice();
    for (let i = 0; i < factors.length; i++) {
      const P = factors[i];
      const p = polyIn(P, v);
      if (!p) continue;
      const deg = p.length ? p[p.length - 1].d : 0;
      if (deg < 1 || deg > 4) continue;
      const Q = factors.filter((_, j) => j !== i);
      const Qe = Q.length ? CAS.mul(...Q) : num(1);
      const Q1 = intg(Qe, v, depth + 1);
      if (!Q1) continue;
      const dP = diff(P, v);
      if (isZero(dP)) continue;
      const rest = intg(mul(dP, Q1), v, depth + 1);
      if (rest === null) continue;
      return sub(mul(P, Q1), rest);
    }
    /* حالت خاص: e^{ax}·sin(bx) و مانند آن */
    return expTrig(e, v);
  }

  function expTrig(e, v) {
    if (e.t !== '*') return null;
    const factors = e.a.slice();
    const expIdx = factors.findIndex(f0 => CAS.isExpNode(f0));
    if (expIdx < 0) return null;
    const ex = factors[expIdx];
    const lin = linearIn(ex.e, v);
    if (!lin || !isNum(lin.a, 0)) return null;
    const rest = factors.filter((_, j) => j !== expIdx);
    if (rest.length !== 1) return null;
    const tr = rest[0];
    if (tr.t !== 'f' || (tr.f !== 'sin' && tr.f !== 'cos')) return null;
    const tl = linearIn(tr.a, v);
    if (!tl || isNum(tl.a, 0)) return null;
    const a = lin.a.v, b = tl.a.v;
    const den = a * a + b * b;
    if (tr.f === 'cos') {
      return mul(ex, div(add(mul(num(a), fn('cos', tr.a)), mul(num(b), fn('sin', tr.a))), num(den)));
    }
    return mul(ex, div(sub(mul(num(a), fn('sin', tr.a)), mul(num(b), fn('cos', tr.a))), num(den)));
  }

  /* ---------------------- انتگرال x^n · ln|x| ---------------------- */
  function logPower(e, v) {
    if (e.t !== '*') return null;
    const fs = e.a.slice();
    const li = fs.findIndex(f0 => f0.t === 'f' && f0.f === 'ln' && (
      (f0.a.t === 'v' && f0.a.n === v) ||
      (f0.a.t === 'f' && f0.a.f === 'abs' && f0.a.a.t === 'v' && f0.a.a.n === v)));
    if (li < 0) return null;
    const rest = fs.filter((_, j) => j !== li);
    const R = rest.length ? mul(...rest) : num(1);
    const p = polyIn(R, v);
    if (!p || p.length !== 1 || !isNum(p[0].c)) return null;
    const n = p[0].d, c = p[0].c.v;
    if (n === -1) return mul(num(c / 2), pow(fs[li], num(2)));
    const m = n + 1;
    const xm = pow(vr(v), num(m));
    return mul(num(c), sub(mul(xm, pow(num(m), num(-1)), fs[li]), mul(xm, pow(num(m), num(-2)))));
  }

  CAS.integrate = integrate;
})(CAS);
