/* ------------------------------ مرتبهٔ دوم و بالاتر (۱) ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs, integrate } = CAS;
  const { ST, TAGS } = CAS;
  const P = ST.p, M = ST.m, MH = ST.mh, NOTE = ST.note, WARN = ST.warn, LIST = ST.list, STEP = ST.step;
  const inl = CAS.inl;
  const INT = (e, v) => ({ t: 'int', a: simp(e), v });

  const cleanRoot = z => ({ re: CAS.chop(Number(z.re.toFixed(12))), im: CAS.chop(Number(z.im.toFixed(12))) });

  function rootLabel(z) {
    const re = z.re, im = z.im;
    if (Math.abs(im) < 1e-7) return inl(num(re));
    const core = inl(num(Math.abs(im)));
    return inl(num(re)) + (im > 0 ? ' + ' : ' − ') + core + '<i>i</i>';
  }

  /* ریشه‌ها و ساختار جواب همگن */
  function charInfo(coeffsDesk, order) {
    const roots = CAS.rootsComplex(coeffsDesk).map(cleanRoot);
    const info = CAS.basisFromRoots(roots, order);
    return Object.assign({ roots }, info);
  }

  function basisTags(info) {
    const items = [];
    for (const g of info.realRoots) {
      for (let j = 0; j < g.m; j++) {
        if (j === 0) items.push('<span class="math-inline"><i>e</i><sup>' + inl(num(g.r)) + '<i>x</i></sup></span>');
        else items.push('<span class="math-inline"><i>x</i><sup>' + j + '</sup><i>e</i><sup>' + inl(num(g.r)) + '<i>x</i></sup></span>');
      }
    }
    for (const g of info.complexGroups) {
      for (let j = 0; j < g.m; j++) {
        const pre = j === 0 ? '' : '<i>x</i><sup>' + j + '</sup>';
        items.push('<span class="math-inline">' + pre + '<i>e</i><sup>' + inl(num(g.a)) + '<i>x</i></sup>cos(' + inl(num(g.b)) + '<i>x</i>)</span>');
        items.push('<span class="math-inline">' + pre + '<i>e</i><sup>' + inl(num(g.a)) + '<i>x</i></sup>sin(' + inl(num(g.b)) + '<i>x</i>)</span>');
      }
    }
    return items;
  }

  function charPolyString(coeffsDesk, varName) {
    const r = varName || 'r';
    const parts = [];
    coeffsDesk.forEach((c, i) => {
      const deg = coeffsDesk.length - 1 - i;
      if (Math.abs(c) < 1e-13) return;
      const sign = c < 0 ? '−' : (parts.length ? '+' : '');
      const av = Math.abs(c);
      let term = '';
      if (deg === 0) term = inl(num(av));
      else {
        const coefStr = Math.abs(av - 1) < 1e-12 ? '' : inl(num(av));
        const rp = deg === 1 ? '<i>' + r + '</i>' : '<i>' + r + '</i><sup>' + deg + '</sup>';
        term = coefStr + rp;
      }
      parts.push(sign + (parts.length ? ' ' : '') + term);
    });
    return parts.length ? parts.join(' ') : '0';
  }

  /* ---------------------- کوشی–اویلر ---------------------- */
  function eulerData(coeffs, order) {
    const cs = [];
    const xs = [1.3, 2.1, 0.7, 3.3];
    for (let k = 0; k < coeffs.length; k++) {
      const a = coeffs[k];
      if (!a) { cs.push(0); continue; }
      let c = null, ok = true;
      for (const x of xs) {
        const v = CAS.evalNum(a, { x, y: 0, yp: 0 });
        if (!isFinite(v)) { ok = false; break; }
        const r = v / Math.pow(x, k);
        if (c === null) c = r;
        else if (Math.abs(r - c) > 1e-8 * (1 + Math.abs(c))) { ok = false; break; }
      }
      if (!ok) return null;
      cs.push(CAS.chop(c));
    }
    if (Math.abs(cs[cs.length - 1]) < 1e-12) return null;
    return cs;
  }

  function indicial(coeffsDesk) {
    const n = coeffsDesk.length - 1;
    /* ضرایب چندجمله‌ای λ به ترتیب نزولی */
    let poly = [0];
    for (let k = 0; k <= n; k++) {
      const c = coeffsDesk[n - k];
      if (Math.abs(c) < 1e-15) continue;
      let term = [1];
      for (let j = 0; j < k; j++) term = polyMul(term, [1, -j]);
      term = term.map(v => v * c);
      poly = polyAdd(poly, term);
    }
    return poly;
  }
  function polyMul(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  }
  function polyAdd(a, b) {
    const n = Math.max(a.length, b.length);
    const out = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) out[n - a.length + i] += a[i];
    for (let i = 0; i < b.length; i++) out[n - b.length + i] += b[i];
    return out;
  }

  function eulerBasis(indRoots, order) {
    const info = CAS.basisFromRoots(indRoots.map(cleanRoot), order);
    const basis = [];
    for (const g of info.realRoots) {
      for (let j = 0; j < g.m; j++) {
        const pre = j === 0 ? num(1) : pow(fn('ln', fn('abs', vr('x'))), num(j));
        basis.push(mul(pre, pow(vr('x'), num(g.r))));
      }
    }
    for (const g of info.complexGroups) {
      for (let j = 0; j < g.m; j++) {
        const pre = j === 0 ? num(1) : pow(fn('ln', fn('abs', vr('x'))), num(j));
        basis.push(mul(pow(vr('x'), num(g.a)), pre, fn('cos', mul(num(g.b), fn('ln', fn('abs', vr('x')))))));
        basis.push(mul(pow(vr('x'), num(g.a)), pre, fn('sin', mul(num(g.b), fn('ln', fn('abs', vr('x')))))));
      }
    }
    return { basis: basis.slice(0, order), info };
  }

  /* ---------------------- تغییر پارامترها (مرتبهٔ ۲) ---------------------- */
  function variation2(basis, R, a2) {
    const y1 = basis[0], y2 = basis[1];
    const W = simp(sub(mul(y1, diff(y2, 'x')), mul(diff(y1, 'x'), y2)));
    const den = mul(a2, W);
    const f1 = div(mul(neg(y2), R), den);
    const f2 = div(mul(y1, R), den);
    const I1 = integrate(f1, 'x');
    const I2 = integrate(f2, 'x');
    const yp = add(mul(y1, I1 !== null ? I1 : INT(f1, 'x')), mul(y2, I2 !== null ? I2 : INT(f2, 'x')));
    return { W, f1, f2, I1, I2, yp: simp(yp) };
  }

  /* ---------------------- کاهش مرتبه ---------------------- */
  function reductionOfOrder(y1, a1, a2) {
    const P = simp(div(a1, a2));
    const Ip = integrate(P, 'x');
    const expPart = CAS.expNode(neg(Ip !== null ? Ip : INT(P, 'x')));
    const integrand = div(expPart, pow(y1, num(2)));
    const I = integrate(integrand, 'x');
    const y2 = mul(y1, I !== null ? I : INT(integrand, 'x'));
    return { P, Ip, integrand, I, y2: simp(y2) };
  }

  /* ---------------------- خانوادهٔ جملات ناهمگن ---------------------- */
  function rhsFamilies(R) {
    const E = CAS.expand(R);
    const terms = E.t === '+' ? E.a : [E];
    const fams = [];
    for (const t of terms) {
      const fam = termFamily(t);
      if (!fam) return null;
      fams.push(fam);
    }
    /* ادغام خانواده‌های یکسان */
    const out = [];
    for (const f0 of fams) {
      const ex = out.find(o => Math.abs(o.a - f0.a) < 1e-8 && Math.abs(o.b - f0.b) < 1e-8);
      if (ex) ex.deg = Math.max(ex.deg, f0.deg);
      else out.push({ a: f0.a, b: f0.b, deg: f0.deg });
    }
    return out;
  }

  function termFamily(t) {
    let a = 0, b = 0, deg = 0;
    const factors = t.t === '*' ? t.a : [t];
    for (const f0 of factors) {
      if (f0.t === 'n') continue;
      if (f0.t === 'v' && f0.n === 'x') { deg += 1; continue; }
      if (f0.t === '^' && f0.b.t === 'v' && f0.b.n === 'x' && f0.e.t === 'n' && Number.isInteger(f0.e.v) && f0.e.v >= 0) {
        deg += f0.e.v; continue;
      }
      if (f0.t === '^' && f0.b.t === 'v' && f0.b.n === 'e') {
        const lin = CAS.linearIn(f0.e, 'x');
        if (!lin) return null;
        a += CAS.evalNum(lin.a, {});
        continue;
      }
      if (f0.t === 'f' && (f0.f === 'sin' || f0.f === 'cos')) {
        const lin = CAS.linearIn(f0.a, 'x');
        if (!lin) return null;
        const k = CAS.evalNum(lin.a, {});
        if (!isFinite(k) || Math.abs(k) < 1e-12) return null;
        if (b !== 0 && Math.abs(Math.abs(k) - b) > 1e-8) return null;
        b = Math.abs(k);
        continue;
      }
      if (f0.t === 'f' && f0.f === 'ln') { /* پشتیبانی نمی شود */ return null; }
      if (f0.t === 'f' && f0.f === 'abs') return null;
      if (f0.t === 'f') return null;
      return null;
    }
    return { a: CAS.chop(a), b: CAS.chop(b), deg };
  }

  function multiplicityAt(info, a, b) {
    let m = 0;
    for (const z of info.roots) {
      if (b < 1e-9) {
        if (Math.abs(z.im) < 1e-6 && Math.abs(z.re - a) < 1e-5 * (1 + Math.abs(a))) m++;
      } else {
        if (z.im > 0 && Math.abs(z.re - a) < 1e-5 * (1 + Math.abs(a)) && Math.abs(z.im - b) < 1e-5 * (1 + b)) m++;
      }
    }
    return m;
  }

  function undetermined(coeffsDesk, R, info) {
    const fams = rhsFamilies(R);
    if (!fams || fams.length === 0) return null;
    if (fams.length > 5) return null;
    const order = coeffsDesk.length - 1;
    const basis = [];
    for (const fam of fams) {
      const m = multiplicityAt(info, fam.a, fam.b);
      if (fam.deg + m > 4) return null;
      for (let j = m; j <= m + fam.deg; j++) {
        const pre = j === 0 ? num(1) : pow(vr('x'), num(j));
        if (fam.b < 1e-9) {
          basis.push(mul(pre, CAS.expNode(mul(num(fam.a), vr('x')))));
        } else {
          basis.push(mul(pre, CAS.expNode(mul(num(fam.a), vr('x'))), fn('cos', mul(num(fam.b), vr('x')))));
          basis.push(mul(pre, CAS.expNode(mul(num(fam.a), vr('x'))), fn('sin', mul(num(fam.b), vr('x')))));
        }
      }
    }
    if (basis.length > 14) return null;
    const Lof = e => {
      let s = num(0);
      for (let k = 0; k <= order; k++) {
        const c = coeffsDesk[order - k];
        if (Math.abs(c) < 1e-14) continue;
        s = add(s, mul(num(c), CAS.nthDiff(e, 'x', k)));
      }
      return simp(s);
    };
    const Lb = basis.map(Lof);
    const k = basis.length;
    const xs = [-2.1, -1.35, -0.62, 0.11, 0.84, 1.57, 2.3, 3.03, 3.76, 4.49, 5.22, 5.95, 6.68, 7.41];
    const A = [], rhs = [];
    for (let s = 0; s < k; s++) {
      const x = xs[s];
      const row = [];
      for (let i = 0; i < k; i++) row.push(CAS.evalNum(Lb[i], { x, y: 0, yp: 0 }));
      A.push(row);
      rhs.push(CAS.evalNum(R, { x, y: 0, yp: 0 }));
    }
    const sol = CAS.solveLinearSystem(A, rhs);
    if (!sol) return null;
    let yp = num(0);
    for (let i = 0; i < k; i++) yp = add(yp, mul(num(sol[i]), basis[i]));
    yp = simp(yp);
    /* بررسی عددی */
    let worst = 0, count = 0;
    for (const x of [-1.73, -0.91, -0.17, 0.58, 1.29, 2.02, 2.77, 3.51, 4.26, 5.01]) {
      const residual = CAS.evalNum(sub(Lof(yp), R), { x, y: 0, yp: 0 });
      const scale = 1 + Math.abs(CAS.evalNum(R, { x, y: 0, yp: 0 }));
      if (!isFinite(residual)) continue;
      worst = Math.max(worst, Math.abs(residual) / scale);
      count++;
    }
    if (count === 0 || worst > 1e-6) return null;
    return { basis, Lb, sol, yp, fams };
  }

  CAS._charInfo = charInfo;
  CAS._basisTags = basisTags;
  CAS._charPolyString = charPolyString;
  CAS._eulerData = eulerData;
  CAS._indicial = indicial;
  CAS._eulerBasis = eulerBasis;
  CAS._variation2 = variation2;
  CAS._reductionOfOrder = reductionOfOrder;
  CAS._rhsFamilies = rhsFamilies;
  CAS._undetermined = undetermined;
  CAS._rootLabel = rootLabel;
  CAS._cleanRoot = cleanRoot;
})(CAS);
