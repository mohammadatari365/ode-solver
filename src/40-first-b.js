/* ------------------------------ حل‌کننده‌های مرتبهٔ اول (۲) ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs, integrate } = CAS;
  const { ST, TAGS } = CAS;
  const P = ST.p, M = ST.m, MH = ST.mh, NOTE = ST.note, WARN = ST.warn, LIST = ST.list, STEP = ST.step;
  const inl = CAS.inl;
  const INT = (e, v) => ({ t: 'int', a: simp(e), v });

  /* ---------------------- تفکیک‌پذیر ---------------------- */
  function splitSep(F) {
    if (!depends(F, 'y')) return { f: F, g: num(1) };
    const refs = [[0.61, 1.7], [1.27, -0.93], [-0.77, 2.31], [2.13, 0.57], [-1.91, -0.43]];
    for (const [x1, y1] of refs) {
      const f = simp(subs(F, { y: num(y1) }));
      if (depends(f, 'y')) continue;
      const g0 = simp(subs(F, { x: num(x1) }));
      if (depends(g0, 'x')) continue;
      const gv = CAS.evalNum(g0, { x: x1, y: y1 });
      if (!isFinite(gv) || Math.abs(gv) < 1e-8) continue;
      const g = div(g0, num(gv));
      if (!CAS.numApprox(F, mul(f, g))) continue;
      let f2 = simp(f), g2 = simp(g);
      const c = numLead(f2);
      if (isFinite(c) && Math.abs(c) > 1e-12 && Math.abs(c - 1) > 1e-9) {
        f2 = simp(div(f2, num(c)));
        g2 = simp(mul(g2, num(c)));
      }
      if (!CAS.numApprox(F, mul(f2, g2))) continue;
      return { f: f2, g: g2 };
    }
    return null;
  }

  function numLead(e) {
    if (e.t === 'n') return e.v;
    if (e.t === '*') {
      const n = e.a.find(x => x.t === 'n');
      return n ? n.v : 1;
    }
    return 1;
  }

  function logCoef(e) {
    e = simp(e);
    const fs = e.t === '*' ? e.a : [e];
    let k = 1, hit = false;
    for (const f0 of fs) {
      if (f0.t === 'n') { k *= f0.v; continue; }
      if (f0.t === 'f' && f0.f === 'ln' && f0.a.t === 'f' && f0.a.f === 'abs' &&
        f0.a.a.t === 'v' && f0.a.a.n === 'y') { hit = true; continue; }
      return null;
    }
    return hit ? k : null;
  }

  function solveSeparable1(F, cfg, sp) {
    const { f, g } = sp;
    const steps = [];
    steps.push(STEP('تشخیص معادلهٔ تفکیک‌پذیر',
      P('معادله را می‌توان به صورت حاصل‌ضرب دو تابع، یکی فقط از <i>x</i> و دیگری فقط از <i>y</i>، نوشت:'),
      MH('<i>y</i>′ = <span class="paren">(</span>' + inl(f) + '<span class="paren">)</span><span class="paren">(</span>' + inl(g) + '<span class="paren">)</span>')
    ));
    steps.push(STEP('تفکیک متغیرها',
      P('با تقسیم بر g(y) و ضرب در dx، متغیرها از هم جدا می‌شوند:'),
      MH(CAS.fracHtml(inl(num(1)), inl(g)) + ' d<i>y</i> = ' + inl(f) + ' d<i>x</i>')
    ));
    const invg = div(num(1), g);
    const Iy = integrate(invg, 'y');
    const Ix = integrate(f, 'x');
    const lhs = Iy !== null ? Iy : INT(invg, 'y');
    const rhs = Ix !== null ? Ix : INT(f, 'x');
    steps.push(STEP('انتگرال‌گیری از دو طرف',
      MH('∫ ' + CAS.fracHtml('1', inl(g)) + ' d<i>y</i> = ∫ ' + inl(f) + ' d<i>x</i>'),
      MH(inl(lhs) + ' = ' + inl(rhs) + ' + <i>C</i><sub>1</sub>')
    ));
    let general = null;
    const kLog = logCoef(lhs);
    if (CAS.isNum(g, 1)) {
      general = add(rhs, sy('C1'));
    } else if (kLog !== null) {
      const e = div(rhs, num(kLog));
      general = mul(sy('C1'), CAS.expNode(e));
      steps.push(STEP('صریح‌سازی جواب',
        P('با نمایی‌کردن دو طرف و ادغام ثابت (علامت قدر مطلق در ثابت پنهان می‌شود):'),
        MH('<i>y</i> = <i>C</i><sub>1</sub> <i>e</i><sup>' + inl(e) + '</sup>')
      ));
    }
    const implicit = sub(lhs, rhs);
    const res = ST.result({
      method: 'معادلهٔ دیفرانسیل تفکیک‌پذیر',
      methodNote: 'تفکیک متغیرها و انتگرال‌گیری دو طرف',
      tags: [TAGS.vorodi, TAGS.sep],
      steps,
      general: general,
      kind: general ? 'explicit' : 'implicit',
      implicit,
      meta: { f, g, lhs, rhs }
    });
    if (!general) {
      steps.push(STEP('جواب عمومی (ضمنی)',
        P('جواب عمومی به صورت ضمنی به دست آمد:'),
        MH(inl(implicit) + ' = <i>C</i><sub>1</sub>')
      ));
      res.answerHtml = inl(implicit) + ' = <i>C</i><sub>1</sub>';
      res.answerLabel = 'جواب عمومی (ضمنی)';
    }
    return res;
  }

  /* ---------------------- همگن ---------------------- */
  function isHomogeneousF(F) {
    if (!depends(F, 'y')) return false;
    const pts = [[0.83, -1.27], [1.91, 0.61], [-1.33, 2.17], [2.53, 1.11], [0.47, 2.83]];
    let checks = 0;
    for (const [x, y] of pts) {
      const base = CAS.evalNum(F, { x, y, yp: 1.1 });
      if (!isFinite(base)) continue;
      for (const t of [2, 0.5, 3.1]) {
        const v = CAS.evalNum(F, { x: x * t, y: y * t, yp: 1.1 });
        if (!isFinite(v)) continue;
        checks++;
        if (Math.abs(v - base) > 1e-7 * (1 + Math.abs(base))) return false;
      }
    }
    return checks > 0;
  }

  function solveHomogeneous1(F, cfg) {
    const G = simp(subs(F, { x: num(1), y: vr('v') }));
    if (depends(G, 'x') || depends(G, 'y')) return null;
    const H = sub(G, vr('v'));
    const I = integrate(div(num(1), H), 'v');
    const lhs = I !== null ? I : INT(div(num(1), H), 'v');
    const implicit = sub(lhs, fn('ln', fn('abs', vr('x'))));
    const implicitY = simp(subs(implicit, { v: div(vr('y'), vr('x')) }));
    const steps = [];
    steps.push(STEP('تشخیص معادلهٔ همگن',
      P('تابع سمت راست در <i>x</i> و <i>y</i> همگن از درجهٔ صفر است؛ یعنی با تغییر مقیاس (x,y) → (tx,ty) مقدار آن تغییر نمی‌کند. معادله را به شکل تابعی از y/x می‌نویسیم:'),
      MH('<i>y</i>′ = <i>G</i><span class="paren">(</span>' + CAS.fracHtml('<i>y</i>', '<i>x</i>') + '<span class="paren">)</span> = ' + inl(G))
    ));
    steps.push(STEP('تغییر متغیر v = y/x',
      P('با قرار دادن y = vx داریم y′ = v + x v′؛ بنابراین:'),
      MH('<i>v</i> + <i>x</i><i>v</i>′ = ' + inl(G)),
      MH('<i>x</i><i>v</i>′ = ' + inl(H))
    ));
    steps.push(STEP('حل معادلهٔ جداشدنی در v',
      MH(CAS.fracHtml('d<i>v</i>', inl(H)) + ' = ' + CAS.fracHtml('d<i>x</i>', '<i>x</i>')),
      MH(inl(lhs) + ' = ln|<i>x</i>| + <i>C</i><sub>1</sub>')
    ));
    let general = null;
    if (!depends(H, 'v')) {
      const vSol = mul(H, add(fn('ln', fn('abs', vr('x'))), sy('C1')));
      general = mul(vr('x'), vSol);
      steps.push(STEP('بازگشت به y',
        MH('<i>v</i> = ' + inl(vSol)),
        MH('<i>y</i> = <i>x</i><i>v</i> = ' + inl(general))
      ));
    } else {
      steps.push(STEP('بازگشت به y',
        P('با جایگذاری v = y/x جواب عمومی به صورت ضمنی به دست می‌آید:'),
        MH(inl(implicitY) + ' = <i>C</i><sub>1</sub>')
      ));
    }
    return ST.result({
      method: 'معادلهٔ دیفرانسیل همگن',
      methodNote: 'تغییر متغیر y = vx و تبدیل به معادلهٔ جداشدنی',
      tags: [TAGS.vorodi, TAGS.hom, TAGS.nonlinear],
      steps,
      general,
      kind: general ? 'explicit' : 'implicit',
      implicit: implicitY,
      meta: { G, H }
    });
  }

  /* ---------------------- کامل (Exact) ---------------------- */
  function exactCore(Mx, Nx) {
    const Ux = integrate(Mx, 'x');
    if (Ux === null) return null;
    const gP = simp(sub(Nx, diff(Ux, 'y')));
    const gy = integrate(gP, 'y');
    if (gy === null) return null;
    return { Ux, gP, gy, U: simp(add(Ux, gy)) };
  }

  function exactData(c0, c1) {
    const My = diff(c0, 'y'), Nx = diff(c1, 'x');
    if (CAS.numApprox(My, Nx)) return { exact: true, M: c0, N: c1, My, Nx, core: exactCore(c0, c1) };
    const d = sub(My, Nx);
    /* عامل انتگرال‌ساز μ(x) */
    const r1 = div(d, c1);
    if (!depends(r1, 'y')) {
      const Ir = integrate(r1, 'x');
      if (Ir !== null) {
        const mu = CAS.expNode(Ir);
        const M2 = simp(mul(mu, c0)), N2 = simp(mul(mu, c1));
        const core = exactCore(M2, N2);
        if (core) return { exact: false, M: c0, N: c1, My, Nx, mu, Ir, muType: 'x', M2, N2, core };
      }
    }
    const r2 = div(neg(d), c0);
    if (!depends(r2, 'x')) {
      const Ir = integrate(r2, 'y');
      if (Ir !== null) {
        const mu = CAS.expNode(Ir);
        const M2 = simp(mul(mu, c0)), N2 = simp(mul(mu, c1));
        const core = exactCore(M2, N2);
        if (core) return { exact: false, M: c0, N: c1, My, Nx, mu, Ir, muType: 'y', M2, N2, core };
      }
    }
    return { exact: false, M: c0, N: c1, My, Nx, noIF: true };
  }

  function solveExact1(F, cfg, data) {
    const steps = [];
    steps.push(STEP('نوشتن معادله به شکل دیفرانسیلی',
      P('معادله را به شکل زیر می‌نویسیم:'),
      MH(inl(data.M) + ' d<i>x</i> + <span class="paren">(</span>' + inl(data.N) + '<span class="paren">)</span> d<i>y</i> = 0')
    ));
    if (data.exact) {
      steps.push(STEP('آزمون کامل بودن',
        P('شرط کامل بودن را بررسی می‌کنیم:'),
        MH(CAS.fracHtml('∂<i>M</i>', '∂<i>y</i>') + ' = ' + inl(data.My) + ' &nbsp;&nbsp;،&nbsp;&nbsp; ' + CAS.fracHtml('∂<i>N</i>', '∂<i>x</i>') + ' = ' + inl(data.Nx)),
        P('چون این دو برابرند، معادله <b>کامل</b> است و تابع پتانسیل U(x,y) وجود دارد.'),
        MH('∂<i>U</i>/∂<i>x</i> = <i>M</i> &nbsp;،&nbsp; ∂<i>U</i>/∂<i>y</i> = <i>N</i>')
      ));
    } else {
      steps.push(STEP('یافتن عامل انتگرال‌ساز',
        P('معادلهٔ اولیه کامل نیست، زیرا:'),
        MH(CAS.fracHtml('∂<i>M</i>', '∂<i>y</i>') + ' = ' + inl(data.My) + ' ≠ ' + inl(data.Nx) + ' = ' + CAS.fracHtml('∂<i>N</i>', '∂<i>x</i>')),
        P('با استفاده از نسبت مناسب، عامل انتگرال‌ساز به دست می‌آید:'),
        MH('<i>μ</i> = <i>e</i><sup>∫ ' + inl(data.muType === 'x' ? div(sub(data.My, data.Nx), data.N) : div(sub(data.Nx, data.My), data.M)) + ' d' + data.muType + '</sup> = ' + inl(data.mu)),
        P('با ضرب معادله در μ، معادلهٔ جدید کامل می‌شود.'),
        MH(inl(data.M2) + ' d<i>x</i> + <span class="paren">(' + inl(data.N2) + ')</span> d<i>y</i> = 0')
      ));
    }
    const core = data.core;
    steps.push(STEP('یافتن تابع پتانسیل',
      P('از ∂U/∂x = M انتگرال می‌گیریم:'),
      MH('<i>U</i> = ' + inl(core.Ux) + ' + <i>g</i>(<i>y</i>)'),
      P('با مشتق‌گیری نسبت به y و برابر قرار دادن با N:'),
      MH('<i>g</i>′(<i>y</i>) = ' + inl(core.gP)),
      MH('<i>g</i>(<i>y</i>) = ' + inl(core.gy)),
      P('پس:'),
      MH('<i>U</i>(<i>x</i>,<i>y</i>) = ' + inl(core.U))
    ));
    steps.push(STEP('جواب عمومی',
      P('جواب عمومی معادلهٔ کامل به صورت سطح تراز تابع پتانسیل است:'),
      MH(inl(core.U) + ' = <i>C</i><sub>1</sub>')
    ));
    return ST.result({
      method: data.exact ? 'معادلهٔ دیفرانسیل کامل (Exact)' : 'معادلهٔ کامل با عامل انتگرال‌ساز',
      methodNote: 'یافتن تابع پتانسیل U(x,y)',
      tags: [TAGS.vorodi, TAGS.exact],
      steps,
      kind: 'implicit',
      implicit: core.U,
      meta: { data }
    });
  }

  /* ---------------------- کلرو ---------------------- */
  function clairautData(L) {
    const p = CAS.polyIn(L, 'yp');
    if (!p) return null;
    const deg = p.length ? p[p.length - 1].d : 0;
    if (deg !== 2) return null;
    const coef = d => (p.find(o => o.d === d) || { c: num(0) }).c;
    const c0 = coef(0), c1 = coef(1), c2 = coef(2);
    if (depends(c0, 'x') || depends(c1, 'y')) return null;
    const p0 = CAS.polyIn(c0, 'y');
    if (!p0 || p0.some(o => o.d > 1)) return null;
    const beta = (p0.find(o => o.d === 1) || { c: num(0) }).c;
    if (CAS.isNum(beta, 0)) return null;
    const xl = CAS.linearIn(c1, 'x');
    if (!xl) return null;
    if (!CAS.isNum(simp(div(xl.a, beta)), -1)) return null;
    if (depends(c2, 'x') || depends(c2, 'y')) return null;
    const Lb = div(L, beta);
    const phi = simp(neg(simp(subs(Lb, { x: num(0), y: num(0) }))));
    if (depends(phi, 'x') || depends(phi, 'y')) return null;
    if (!CAS.numApprox(Lb, sub(sub(vr('y'), mul(vr('x'), vr('yp'))), phi))) return null;
    return { phi, beta };
  }

  function solveClairaut1(cfg, data) {
    const { phi } = data;
    const gen = add(mul(sy('C1'), vr('x')), simp(subs(phi, { yp: sy('C1') })));
    const steps = [];
    steps.push(STEP('تشخیص معادلهٔ کلرو',
      P('معادله از نوع <b>کلرو</b> است و می‌توان آن را به شکل زیر نوشت:'),
      MH('<i>y</i> = <i>x</i><i>y</i>′ + <i>φ</i>(<i>y</i>′) &nbsp;،&nbsp; <i>φ</i>(<i>p</i>) = ' + inl(phi))
    ));
    steps.push(STEP('مشتق‌گیری از دو طرف',
      P('اگر p = y′ باشد، با مشتق‌گیری نسبت به x:'),
      MH('<i>p</i> = <i>p</i> + <i>x</i><i>p</i>′ + <i>φ</i>′(<i>p</i>)<i>p</i>′'),
      MH('<i>p</i>′<span class="paren">(</span><i>x</i> + <i>φ</i>′(<i>p</i>)<span class="paren">)</span> = 0')
    ));
    steps.push(STEP('جواب عمومی',
      P('حالت اول p′ = 0 یعنی p = C ثابت است؛ با جایگذاری در معادله:'),
      MH('<i>y</i> = <i>C</i><sub>1</sub><i>x</i> + <i>φ</i>(<i>C</i><sub>1</sub>)'),
      MH('<i>y</i> = ' + inl(gen))
    ));
    const dphi = diff(phi, 'yp');
    if (!CAS.isZero(sub(dphi, mul(dphi, num(0))))) { /* nothing */ }
    if (!CAS.isNum(dphi, 0)) {
      const xPar = simp(neg(subs(dphi, { yp: vr('t') })));
      const yPar = simp(add(mul(vr('t'), xPar), subs(phi, { yp: vr('t') })));
      steps.push(STEP('جواب منفرد (پارامتری)',
        P('حالت دوم x + φ′(p) = 0 جواب منفرد را به شکل پارامتری می‌دهد:'),
        MH('<i>x</i> = ' + inl(xPar) + ' &nbsp;،&nbsp; <i>y</i> = <i>t</i> <i>x</i> + <i>φ</i>(<i>t</i>)'),
        MH('<i>y</i> = ' + inl(yPar)),
        NOTE('این جواب در حالت کلی پوش دستهٔ خطوط y = Cx + φ(C) است و در جواب عمومی مستتر نیست.')
      ));
    }
    return ST.result({
      method: 'معادلهٔ دیفرانسیل کلرو',
      methodNote: 'جواب عمومی خطوط و جواب منفرد پوش',
      tags: [TAGS.vorodi, TAGS.clairaut, TAGS.nonlinear],
      steps,
      general: gen,
      meta: { phi }
    });
  }

  /* ---------------------- تشخیص و انتخاب روش ---------------------- */
  function affineInY(F) {
    const p = CAS.polyIn(F, 'y');
    if (!p) return null;
    if (p.some(o => o.d > 1)) return null;
    const a = (p.find(o => o.d === 1) || { c: num(0) }).c;
    const b = (p.find(o => o.d === 0) || { c: num(0) }).c;
    return { a, b };
  }

  function solveFirstOrder(cfg) {
    let L, c0, c1;
    if (cfg.rawExpr) {
      L = simp(cfg.rawExpr);
    } else {
      const A = cfg.coeffs[1] || num(0);
      const B = cfg.coeffs[0] || num(0);
      L = simp(add(mul(A, vr('yp')), mul(B, vr('y')), neg(cfg.rhs)));
    }
    cfg.linearLeft = L;
    const p = CAS.polyIn(L, 'yp');
    if (!p) throw new Error('معادله نسبت به y′ چندجمله‌ای نیست؛ ورودی را ساده‌تر بنویسید.');
    const deg = p.length ? p[p.length - 1].d : 0;
    if (deg === 0) throw new Error('عبارت واردشده شامل y′ نیست؛ این یک معادلهٔ دیفرانسیل نیست.');
    if (deg > 2) throw new Error('معادله نسبت به y′ از درجهٔ ' + deg + ' است؛ این نسخه تا درجهٔ دوم (کلرو) را پشتیبانی می‌کند.');

    const coef = d => (p.find(o => o.d === d) || { c: num(0) }).c;
    c0 = coef(0); c1 = coef(1);

    if (deg === 2) {
      const cd = clairautData(L);
      if (!cd) throw new Error('معادله نسبت به y′ درجهٔ دوم است و از نوع کلرو تشخیص داده نشد. آن را به شکل y = x y′ + f(y′) بنویسید.');
      const res = solveClairaut1(cfg, cd);
      return { primary: res, list: [{ id: 'clairaut', label: 'روش کلرو', res }] };
    }

    if (CAS.isZero(c1)) throw new Error('ضریب y′ صفر است؛ معادله عملاً دیفرانسیل نیست.');
    const F = simp(div(neg(c0), c1));

    const methods = [];
    const aff = affineInY(F);
    if (aff) methods.push({ id: 'linear', label: 'روش معادلهٔ خطی مرتبهٔ اول', build: () => CAS._solveLinear1(F, cfg, aff) });

    const bd = CAS._bernoulliData(F);
    if (bd) methods.push({ id: 'bernoulli', label: 'روش برنولی', build: () => CAS._solveBernoulli1(F, cfg, bd) });

    if (isHomogeneousF(F)) {
      const test = solveHomogeneous1(F, cfg);
      if (test) methods.push({ id: 'homogeneous', label: 'روش معادلهٔ همگن', build: () => test });
    }

    const sp = splitSep(F);
    if (sp) methods.push({ id: 'separable', label: 'روش تفکیک متغیرها', build: () => solveSeparable1(F, cfg, sp) });

    const ed = exactData(c0, c1);
    if (ed.core) methods.push({ id: ed.exact ? 'exact' : 'ifac', label: ed.exact ? 'روش معادلهٔ کامل' : 'روش عامل انتگرال‌ساز', build: () => solveExact1(F, cfg, ed) });

    const rd = CAS._riccatiData(F);
    if (rd) {
      const y1 = cfg.knownExpr || CAS._riccatiGuess(F);
      if (y1 && CAS.numApprox(diff(y1, 'x'), subs(F, { y: y1 }))) {
        methods.push({ id: 'riccati', label: 'روش ریکاتی', build: () => CAS._solveRiccati1(F, cfg, rd, y1) });
      }
    }

    if (methods.length === 0) {
      return { primary: unsupportedFirst(F, cfg, c0, c1), list: [] };
    }

    const orderIds = ['exact', 'separable', 'homogeneous', 'linear', 'bernoulli', 'ifac', 'riccati'];
    methods.sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
    if (cfg.knownExpr) {
      const ri = methods.findIndex(m => m.id === 'riccati');
      if (ri > 0) methods.unshift(methods.splice(ri, 1)[0]);
    }
    const built = [];
    for (const m of methods) {
      try { built.push({ id: m.id, label: m.label, res: m.build() }); }
      catch (err) { /* رد کردن روش ناموفق */ }
    }
    if (built.length === 0) return { primary: unsupportedFirst(F, cfg, c0, c1), list: [] };
    const primary = built[0].res;
    primary.meta.F = F;
    primary.alts = [];
    return { primary, list: built };
  }

  function unsupportedFirst(F, cfg, c0, c1) {
    const steps = [];
    steps.push(STEP('تشخیص نوع معادله',
      P('معادله به شکل صریح زیر نوشته می‌شود:'),
      MH('<i>y</i>′ = ' + inl(F)),
      P('این معادله در دسته‌های استاندارد تفکیک‌پذیر، خطی، همگن، کامل، برنولی، ریکاتی یا کلرو قرار نگرفت.')
    ));
    steps.push(STEP('پیشنهادها',
      LIST([
        'اگر یکی از جواب‌های خصوصی معادله را می‌دانید، آن را در کادر «جواب معلوم» وارد کنید (برای ریکاتی یا کاهش مرتبه).',
        'می‌توانید معادله را با تغییر متغیر ساده کنید؛ برای نمونه تغییر متغیرهای u = y/x یا v = y/x² را امتحان کنید.',
        'برای حل عددی، از روش‌های اویلر یا رونگه–کوتا استفاده کنید.'
      ])
    ));
    return ST.result({
      ok: false, incomplete: true,
      method: 'روش تحلیلی استاندارد پیدا نشد',
      methodNote: 'معادله در الگوهای شناخته‌شدهٔ این نسخه قرار نمی‌گیرد',
      tags: [TAGS.vorodi],
      steps,
      warnings: ['این معادله با روش‌های تحلیلی داخل برنامه حل نشد.',
        'برخی معادلات مرتبهٔ اول فقط با تغییر متغیرهای خاص یا به صورت سری/عددی حل می‌شوند.']
    });
  }

  CAS.solveFirstOrder = solveFirstOrder;
  CAS._splitSep = splitSep;
  CAS._isHomogeneousF = isHomogeneousF;
  CAS._solveSeparable1 = solveSeparable1;
  CAS._solveHomogeneous1 = solveHomogeneous1;
  CAS._exactData = exactData;
  CAS._solveExact1 = solveExact1;
  CAS._solveClairaut1 = solveClairaut1;
})(CAS);
