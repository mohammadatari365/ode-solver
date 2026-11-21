/* ------------------------------ حل‌کننده‌های مرتبهٔ اول (۱) ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs, integrate } = CAS;
  const { ST, TAGS } = CAS;
  const P = ST.p, M = ST.m, MH = ST.mh, NOTE = ST.note, WARN = ST.warn, LIST = ST.list, STEP = ST.step;
  const inl = CAS.inl;
  const INT = (e, v) => ({ t: 'int', a: simp(e), v });
  const expNode = CAS.expNode;

  /* حل معادلهٔ خطی y′ + P y = Q (یا در متغیر u) */
  function linearCore(Pf, Qf) {
    const Ip = depends(Pf, 'x') ? integrate(Pf, 'x') : mul(Pf, vr('x'));
    const mm = Ip !== null ? CAS.muFromIp(Ip) : null;
    const mu = mm && mm.mu ? mm.mu : expNode(INT(Pf, 'x'));
    const muQ = mul(mu, Qf);
    const I = integrate(muQ, 'x');
    const sol = div(add(I !== null ? I : INT(muQ, 'x'), sy('C1')), mu);
    return { Ip, mu, muQ, I, sol, IpOk: Ip !== null, IOk: I !== null };
  }

  function linearStepBlocks(Pf, Qf, core, depVar) {
    const v = depVar || 'y';
    const vh = CAS.render(vr(v));
    const blocks = [];
    blocks.push(P('شکل استاندارد معادلهٔ خطی مرتبهٔ اول چنین است:'));
    blocks.push(MH(vh + '′ + <span class="paren">(</span>' + inl(Pf) + '<span class="paren">)</span>' + vh + ' = ' + inl(Qf)));
    blocks.push(P('ابتدا عامل انتگرال‌ساز را می‌سازیم:'));
    blocks.push(MH('<i>μ</i>(<i>x</i>) = <i>e</i><sup>∫<i>P</i> d<i>x</i></sup> = <i>e</i><sup>' + (core.IpOk ? inl(core.Ip) : '∫' + inl(Pf) + ' d<i>x</i>') + '</sup> = ' + inl(core.mu)));
    blocks.push(P('دو طرف معادله را در μ ضرب می‌کنیم. سمت چپ به صورت مشتق حاصل‌ضرب درمی‌آید:'));
    blocks.push(MH('<span class="paren">(</span><i>μ</i>' + vh + '<span class="paren">)</span>′ = <i>μ</i> · ' + inl(Qf)));
    blocks.push(P('با انتگرال‌گیری از دو طرف:'));
    blocks.push(MH('<i>μ</i>' + vh + ' = ' + (core.IOk ? inl(core.I) : '∫ ' + inl(core.muQ) + ' d<i>x</i>') + ' + <i>C</i><sub>1</sub>'));
    blocks.push(P('و در نتیجه جواب عمومی:'));
    blocks.push(MH(vh + ' = ' + inl(core.sol)));
    if (!core.IOk) blocks.push(NOTE('انتگرال <span class="math-inline">∫ ' + inl(core.muQ) + ' d<i>x</i></span> به شکل بستهٔ مقدماتی به دست نیامد؛ همان شکل انتگرالی، جواب معتبر و کامل است.'));
    return blocks;
  }

  function solveLinear1(F, cfg, aff) {
    const A1 = aff.a, b1 = aff.b;
    const Pf = neg(A1), Qf = b1;
    const core = linearCore(Pf, Qf);
    const steps = [];
    steps.push(STEP('تشخیص نوع معادله',
      P('این معادله نسبت به <i>y</i> خطی است و می‌توان آن را به شکل استاندارد <b>معادلهٔ دیفرانسیل خطی مرتبهٔ اول</b> نوشت.'),
      MH('<i>y</i>′ = ' + inl(F)),
      P('یعنی:'),
      MH('<i>y</i>′ + <span class="paren">(</span>' + inl(Pf) + '<span class="paren">)</span><i>y</i> = ' + inl(Qf))
    ));
    steps.push(STEP('عامل انتگرال‌ساز و حل', ...linearStepBlocks(Pf, Qf, core, 'y')));
    const res = ST.result({
      method: 'معادلهٔ دیفرانسیل خطی مرتبهٔ اول',
      methodNote: 'حل با عامل انتگرال‌ساز',
      tags: [TAGS.vorodi, TAGS.linear],
      steps,
      general: core.sol,
      meta: { P: Pf, Q: Qf, core }
    });
    return res;
  }

  /* برنولی: y' = -P y + Q y^n */
  function bernoulliData(F) {
    const p = CAS.polyIn(F, 'y');
    if (!p) return null;
    const degs = p.map(o => o.d).sort((a, b) => a - b);
    if (degs.length !== 2 || degs[0] !== 1 || degs[1] < 2) return null;
    const n = degs[1];
    const c1 = p.find(o => o.d === 1).c;
    const cn = p.find(o => o.d === n).c;
    if (depends(c1, 'yp') || depends(cn, 'yp')) return null;
    return { n, P: neg(c1), Q: cn };
  }

  function solveBernoulli1(F, cfg, data) {
    const { n, P: Pf, Q: Qf } = data;
    const k = 1 - n;
    const Pv = mul(num(k), Pf), Qv = mul(num(k), Qf);
    const core = linearCore(Pv, Qv);
    const vSol = core.sol;
    const ySol = pow(vSol, num(1 / k));
    const steps = [];
    steps.push(STEP('تشخیص معادلهٔ برنولی',
      P('معادله به شکل زیر است و توان <i>y</i> برابر n = ' + inl(num(n)) + ' است (نه ۰ و نه ۱)؛ پس <b>معادلهٔ برنولی</b> است.'),
      MH('<i>y</i>′ + <span class="paren">(</span>' + inl(Pf) + '<span class="paren">)</span><i>y</i> = <span class="paren">(</span>' + inl(Qf) + '<span class="paren">)</span> <i>y</i><sup>' + inl(num(n)) + '</sup>')
    ));
    steps.push(STEP('تغییر متغیر',
      P('دو طرف را بر <i>y</i><sup>n</sup> تقسیم می‌کنیم و تغییر متغیر زیر را به کار می‌بریم:'),
      MH('<i>v</i> = <i>y</i><sup>1−n</sup> = <i>y</i><sup>' + inl(num(k)) + '</sup> &nbsp;⟹&nbsp; <i>v</i>′ = ' + inl(num(k)) + ' <i>y</i><sup>−' + inl(num(n)) + '</sup> <i>y</i>′'),
      P('در این صورت معادله به یک معادلهٔ خطی مرتبهٔ اول در <i>v</i> تبدیل می‌شود:'),
      MH('<i>v</i>′ + <span class="paren">(</span>' + inl(Pv) + '<span class="paren">)</span><i>v</i> = ' + inl(Qv))
    ));
    steps.push(STEP('حل معادلهٔ خطی در v', ...linearStepBlocks(Pv, Qv, core, 'v')));
    steps.push(STEP('بازگشت به متغیر اصلی',
      P('با قرار دادن <i>v</i> = <i>y</i><sup>1−n</sup> جواب عمومی به دست می‌آید:'),
      MH('<i>y</i><sup>' + inl(num(k)) + '</sup> = ' + inl(vSol)),
      MH('<i>y</i> = ' + inl(ySol))
    ));
    return ST.result({
      method: 'معادلهٔ دیفرانسیل برنولی',
      methodNote: 'تبدیل به معادلهٔ خطی با تغییر متغیر v = y^(1−n)',
      tags: [TAGS.vorodi, TAGS.bern, TAGS.nonlinear],
      steps,
      general: ySol,
      meta: { P: Pf, Q: Qf, n }
    });
  }

  /* ریکاتی: F = a + b y + c y² */
  function riccatiData(F) {
    const p = CAS.polyIn(F, 'y');
    if (!p) return null;
    if (p.some(o => o.d > 2)) return null;
    const c2 = p.find(o => o.d === 2);
    if (!c2) return null;
    const coef = d => (p.find(o => o.d === d) || { c: num(0) }).c;
    const a = coef(0), b = coef(1), c = c2.c;
    if ([a, b, c].some(x => depends(x, 'yp'))) return null;
    return { a, b, c };
  }

  function riccatiGuess(F) {
    const cands = [num(0), num(1), num(-1), num(2), num(-2), vr('x'), neg(vr('x')),
      pow(vr('x'), num(2)), div(num(1), vr('x')), expNode(vr('x')), expNode(neg(vr('x'))),
      fn('tan', vr('x')), add(vr('x'), num(1))];
    for (const q of cands) {
      try {
        if (CAS.numApprox(diff(q, 'x'), subs(F, { y: q }))) return q;
      } catch (err) { /* ignore */ }
    }
    return null;
  }

  function solveRiccati1(F, cfg, data, y1) {
    const { a, b, c } = data;
    const b2 = add(b, mul(num(2), c, y1));
    const core = linearCore(b2, neg(c)); // u' + b2 u = -c
    const uSol = core.sol;
    const ySol = add(y1, div(num(1), uSol));
    const steps = [];
    steps.push(STEP('تشخیص معادلهٔ ریکاتی',
      P('معادله نسبت به <i>y</i> از درجهٔ دوم است و جملهٔ <i>y</i><sup>2</sup> دارد؛ بنابراین <b>معادلهٔ ریکاتی</b> است:'),
      MH('<i>y</i>′ = ' + inl(F)),
      MH('<i>y</i>′ = <i>a</i>(<i>x</i>) + <i>b</i>(<i>x</i>)<i>y</i> + <i>c</i>(<i>x</i>)<i>y</i><sup>2</sup>')
    ));
    if (y1) {
      const guessed = !cfg.knownExpr;
      steps.push(STEP('جواب خصوصی معلوم',
        P((guessed ? 'با بررسی چند گزینهٔ ساده، جواب خصوصی زیر پیدا شد و در معادله صدق می‌کند:' : 'جواب خصوصی داده‌شده در معادله صدق می‌کند:')),
        MH('<i>y</i><sub>1</sub> = ' + inl(y1)),
        P('برای حل، از تغییر متغیر زیر استفاده می‌کنیم:'),
        MH('<i>y</i> = <i>y</i><sub>1</sub> + <i>u</i><sup>−1</sup>')
      ));
      steps.push(STEP('تبدیل به معادلهٔ خطی',
        P('با جایگذاری این تغییر متغیر، معادلهٔ ریکاتی به یک معادلهٔ خطی مرتبهٔ اول در <i>u</i> تبدیل می‌شود:'),
        MH('<i>u</i>′ + <span class="paren">(</span>' + inl(b2) + '<span class="paren">)</span><i>u</i> = ' + inl(neg(c)))
      ));
      steps.push(STEP('حل معادلهٔ خطی در u', ...linearStepBlocks(b2, neg(c), core, 'u')));
      steps.push(STEP('بازگشت به y',
        MH('<i>y</i> = ' + inl(y1) + ' + ' + inl(div(num(1), uSol))),
        MH('<i>y</i> = ' + inl(ySol))
      ));
    }
    return ST.result({
      method: 'معادلهٔ دیفرانسیل ریکاتی',
      methodNote: 'کاهش به معادلهٔ خطی با جواب خصوصی معلوم',
      tags: [TAGS.vorodi, TAGS.riccati, TAGS.nonlinear],
      steps,
      general: ySol,
      meta: { a, b, c, y1 }
    });
  }

  CAS._linearCore = linearCore;
  CAS._linearStepBlocks = linearStepBlocks;
  CAS._solveLinear1 = solveLinear1;
  CAS._bernoulliData = bernoulliData;
  CAS._solveBernoulli1 = solveBernoulli1;
  CAS._riccatiData = riccatiData;
  CAS._riccatiGuess = riccatiGuess;
  CAS._solveRiccati1 = solveRiccati1;
})(CAS);
