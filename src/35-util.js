/* ------------------------------ ابزارهای مشترک حل‌کننده ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs } = CAS;

  const ST = {
    result(o) {
      return Object.assign({
        ok: true, incomplete: false, method: '', methodNote: '', tags: [],
        steps: [], answerHtml: '', answerLabel: 'جواب عمومی', answerExpr: null,
        general: null, particular: null, particularHtml: '', warnings: [], alts: [],
        kind: 'explicit', implicit: null, basis: null, ic: null, meta: {}
      }, o);
    },
    step(title, ...blocks) { return { title, blocks: blocks.filter(Boolean) }; },
    p(html) { return { t: 'p', html }; },
    m(e) { return { t: 'm', html: CAS.render(e) }; },
    mh(html) { return { t: 'm', html }; },
    note(html) { return { t: 'note', html }; },
    warn(html) { return { t: 'warn', html }; },
    list(items) { return { t: 'list', items }; },
    tag(text, kind) { return { text, kind: kind || 'def' }; }
  };
  const P = ST.p, M = ST.m, MH = ST.mh, NOTE = ST.note, WARN = ST.warn, LIST = ST.list, STEP = ST.step;
  const inl = e => CAS.render(simp(e));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const TAGS = {
    vorodi: 'مرتبهٔ اول', orden2: 'مرتبهٔ دوم', ordenN: 'مرتبهٔ بالا',
    linear: 'خطی', nonlinear: 'غیرخطی', sep: 'جداشدنی', hom: 'همگن', exact: 'کامل', bern: 'برنولی',
    riccati: 'ریکاتی', clairaut: 'کلرو', euler: 'کوشی‑اویلر', constc: 'ضرایب ثابت',
    ic: 'شرایط اولیه', homogeneousEq: 'همگن', nonhom: 'ناهمگن'
  };

  function polyRootsDesc(coeffs) { /* coeffs به ترتیب نزولی */
    return CAS.rootsComplex(coeffs);
  }

  function solveLinearSystem(A, b) {
    const n = b.length;
    const Mx = A.map((r, i) => r.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(Mx[r][i]) > Math.abs(Mx[p][i])) p = r;
      if (Math.abs(Mx[p][i]) < 1e-13) return null;
      const tmp = Mx[i]; Mx[i] = Mx[p]; Mx[p] = tmp;
      const piv = Mx[i][i];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = Mx[r][i] / piv;
        if (Math.abs(f) < 1e-18) continue;
        for (let c = i; c <= n; c++) Mx[r][c] -= f * Mx[i][c];
      }
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = Mx[i][n] / Mx[i][i];
      if (!isFinite(v)) return null;
      out.push(CAS.chop(v));
    }
    return out;
  }

  /* حل C1 از رابطهٔ (احتمالاً ضمنی) y(x0)=y0 */
  function findC1(expr, x0, y0, cname) {
    cname = cname || 'C1';
    const val = c => CAS.evalNum(expr, { x: x0, [cname]: c });
    const a = val(0), b = val(1);
    if (isFinite(a) && isFinite(b) && Math.abs(b - a) > 1e-13) {
      const c = (y0 - a) / (b - a);
      const t = val(c);
      if (isFinite(t) && Math.abs(t - y0) < 1e-8 * (1 + Math.abs(y0))) return c;
    }
    for (const start of [0, 1, -1, 2, -2, 5, -5, 0.5, -0.5, 10, -10]) {
      let c = start, ok = false;
      for (let i = 0; i < 80; i++) {
        const f0 = val(c);
        if (!isFinite(f0)) break;
        const h = 1e-6 * Math.max(1, Math.abs(c));
        const d = (val(c + h) - val(c - h)) / (2 * h);
        if (!isFinite(d) || Math.abs(d) < 1e-13) break;
        c -= (f0 - y0) / d;
        const f1 = val(c);
        if (isFinite(f1) && Math.abs(f1 - y0) < 1e-10 * (1 + Math.abs(y0))) { ok = true; break; }
      }
      if (ok) return c;
    }
    return null;
  }

  /* دستگاه خطی برای Cها بر اساس جواب عمومی خطی */
  function solveICs(gen, cfg) {
    const n = cfg.order;
    const x0 = cfg.x0;
    const cs = [];
    for (let i = 1; i <= n; i++) cs.push('C' + i);
    const base = {};
    cs.forEach(c => base[c] = 0);
    const A = [], rhs = [];
    const derivs = [];
    for (let k = 0; k < n; k++) derivs.push(k === 0 ? simp(gen) : CAS.nthDiff(gen, 'x', k));
    for (let k = 0; k < n; k++) {
      const dk = derivs[k];
      const v0 = CAS.evalNum(dk, Object.assign({ x: x0, y: 0 }, base));
      const row = [];
      for (const c of cs) {
        const env = Object.assign({ x: x0, y: 0 }, base, { [c]: 1 });
        const v1 = CAS.evalNum(dk, env);
        row.push(CAS.chop(v1 - v0));
      }
      A.push(row);
      rhs.push(CAS.chop(cfg.y0s[k] - v0));
    }
    const sol = solveLinearSystem(A, rhs);
    return { A, rhs, sol, cs, derivs };
  }

  function icSteps(gen, cfg, icRes) {
    const steps = [];
    if (!icRes || !icRes.sol) return steps;
    const { A, rhs, sol, cs } = icRes;
    const x0 = cfg.x0;
    const eqLines = [];
    for (let k = 0; k < cs.length; k++) {
      let line = '';
      for (let j = 0; j < cs.length; j++) {
        const v = A[k][j];
        if (Math.abs(v) < 1e-13) continue;
        const cHtml = '<i>C</i><sub>' + (j + 1) + '</sub>';
        const coef = Math.abs(Math.abs(v) - 1) < 1e-12 ? '' : inl(num(Math.abs(v))) + '\u2009';
        const body = coef + cHtml;
        if (!line) line = (v < 0 ? '−' : '') + body;
        else line += (v < 0 ? ' − ' : ' + ') + body;
      }
      if (!line) line = '0';
      const eqBody = line + ' = ' + inl(num(CAS.chop(rhs[k])));
      const leftSym = 'y' + ['', '′', '″', '‴', '⁗'][k];
      eqLines.push('<div class="eq-line">' + leftSym + '(' + inl(num(x0)) + ') ⟹ ' + eqBody + '</div>');
    }
    const cvals = sol.map((v, i) => '<i>C</i><sub>' + (i + 1) + '</sub> = ' + inl(num(v)));
    steps.push(STEP('اعمال شرایط اولیه',
      P('شرایط اولیه را در جواب عمومی و مشتق‌های آن جایگذاری می‌کنیم. با جایگذاری x<sub>0</sub> = ' + inl(num(x0)) + ' دستگاه خطی زیر به دست می‌آید:'),
      MH('<div class="eq-list">' + eqLines.join('') + '</div>'),
      P('این دستگاه را حل می‌کنیم:'),
      MH('<div class="eq-list">' + cvals.join(' &nbsp;، &nbsp; ') + '</div>')
    ));
    return steps;
  }

  function verifyResult(cfg, gen) {
    try {
      const L = cfg.linearLeft;
      if (!L) return null;
      const res = sub(L, cfg.rhsExpr || num(0));
      const pts = [0.37, 1.13, 1.91, 2.57, -0.83];
      const names = ['y', 'yp', 'ypp', 'yppp', 'ypppp'];
      const ds = [];
      for (let k = 0; k < 5; k++) ds.push(k === 0 ? simp(gen) : CAS.nthDiff(gen, 'x', k));
      let worst = 0, count = 0;
      for (const x of pts) {
        const env = { x };
        let ok = true;
        for (let k = 0; k < 5; k++) {
          const v = CAS.evalNum(ds[k], env);
          if (!isFinite(v)) { ok = false; break; }
          env[names[k]] = v;
        }
        if (!ok) continue;
        const r = CAS.evalNum(res, env);
        if (!isFinite(r)) continue;
        const scale = 1 + Math.abs(CAS.evalNum(cfg.rhsExpr || num(0), env));
        worst = Math.max(worst, Math.abs(r) / scale);
        count++;
      }
      if (!count) return null;
      return worst;
    } catch (err) { return null; }
  }

  /* ساده‌سازی عبارت‌های خیلی بزرگ برای نمایش */
  function soften(e) {
    try { return simp(e); } catch (err) { return e; }
  }

  function logXCoef(t) {
    let c = 1, hit = false;
    const fs = t.t === '*' ? t.a : [t];
    for (const f0 of fs) {
      if (f0.t === 'n') { c *= f0.v; continue; }
      if (f0.t === 'f' && f0.f === 'ln' && f0.a.t === 'f' && f0.a.f === 'abs' &&
        f0.a.a.t === 'v' && f0.a.a.n === 'x') { hit = true; continue; }
      if (f0.t === 'f' && f0.f === 'ln' && f0.a.t === 'v' && f0.a.n === 'x') { hit = true; continue; }
      return null;
    }
    return hit ? c : null;
  }

  /* μ = e^{∫P dx} با ساده‌سازی حالت‌های لگاریتمی */
  function muFromIp(Ip) {
    if (Ip === null) return null;
    const terms = Ip.t === '+' ? Ip.a : [Ip];
    let k = 0;
    const rest = [];
    for (const t of terms) {
      const c = logXCoef(t);
      if (c !== null) k += c;
      else rest.push(t);
    }
    if (Math.abs(k) < 1e-12) {
      if (rest.length === terms.length) return { mu: CAS.expNode(Ip), k: 0 };
      return { mu: num(1), k: 0 };
    }
    let mu = CAS.pow(vr('x'), num(k));
    if (rest.length) mu = mul(mu, CAS.expNode(simp(CAS.simpAdd(rest))));
    return { mu, k };
  }

  CAS.ST = ST;
  CAS.muFromIp = muFromIp;
  CAS.solveLinearSystem = solveLinearSystem;
  CAS.findC1 = findC1;
  CAS.solveICs = solveICs;
  CAS.icSteps = icSteps;
  CAS.verifyResult = verifyResult;
  CAS.inl = inl;
  CAS.soften = soften;
  CAS.TAGS = TAGS;
})(CAS);
