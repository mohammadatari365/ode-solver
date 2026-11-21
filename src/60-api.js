/* ------------------------------ رابط برنامه‌نویسی حل ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs } = CAS;
  const { ST, TAGS } = CAS;
  const P = ST.p, MH = ST.mh, STEP = ST.step;
  const inl = CAS.inl;
  const YVARS = ['y', 'yp', 'ypp', 'yppp', 'ypppp'];

  function finalizeFirst(res, cfg) {
    if (!res) return res;
    if (res.incomplete) return res;

    if (res.kind === 'implicit') {
      const U = res.implicit;
      if (cfg.hasIC) {
        const C = CAS.evalNum(U, { x: cfg.x0, y: cfg.y0s[0] });
        if (isFinite(C)) {
          res.steps.push(STEP('اعمال شرایط اولیه',
            P('شرط اولیه را در جواب ضمنی جایگذاری می‌کنیم:'),
            MH(inl(U) + ' = <i>C</i><sub>1</sub> &nbsp;⟹&nbsp; ' + inl(num(CAS.chop(C))) + ' = <i>C</i><sub>1</sub>'),
            P('بنابراین جواب خصوصی (به صورت ضمنی) چنین است:'),
            MH(inl(U) + ' = ' + inl(num(CAS.chop(C))))
          ));
          res.answerHtml = inl(U) + ' = ' + inl(num(CAS.chop(C)));
          res.answerLabel = 'جواب خصوصی (ضمنی)';
          res.particularHtml = res.answerHtml;
          res.ic = { C: CAS.chop(C) };
          res.tags = (res.tags || []).concat([TAGS.ic]);
          return res;
        }
        res.warnings.push('محاسبهٔ ثابت از شرط اولیه ممکن نشد (نقطهٔ x₀ یا y₀ تکین است).');
      }
      res.answerHtml = inl(U) + ' = <i>C</i><sub>1</sub>';
      res.answerLabel = 'جواب عمومی (ضمنی)';
      return res;
    }

    const gen = res.general;
    if (!gen) return res;

    if (!cfg.hasIC) {
      res.answerHtml = inl(gen);
      res.answerLabel = 'جواب عمومی';
      res.answerExpr = gen;
      const err = CAS.verifyResult(cfg, gen);
      if (err !== null && err < 1e-6) {
        res.steps.push(STEP('بررسی صحت جواب',
          P('جواب در معادلهٔ اصلی جایگذاری و در چند نقطه بررسی شد؛ باقی‌مانده در حد خطای گردکردن صفر است. ✓')
        ));
      }
      return res;
    }

    const c = CAS.findC1(gen, cfg.x0, cfg.y0s[0]);
    if (c === null || !isFinite(c)) {
      res.warnings.push('یافتن مقدار C₁ از شرط اولیه با روش عددی ممکن نشد؛ جواب عمومی نمایش داده می‌شود.');
      res.answerHtml = inl(gen);
      res.answerLabel = 'جواب عمومی';
      res.answerExpr = gen;
      return res;
    }
    const part = simp(subs(gen, { C1: num(c) }));
    res.steps.push(STEP('اعمال شرایط اولیه',
      P('شرط اولیهٔ <span class="math-inline"><i>y</i>(' + inl(num(cfg.x0)) + ') = ' + inl(num(cfg.y0s[0])) + '</span> را در جواب عمومی جایگذاری می‌کنیم:'),
      MH(inl(gen) + ' &nbsp;در&nbsp; <i>x</i> = ' + inl(num(cfg.x0)) + ' ⟹ ' + inl(num(cfg.y0s[0]))),
      P('و مقدار ثابت به‌دست می‌آید:'),
      MH('<i>C</i><sub>1</sub> = ' + inl(num(c))),
      P('پس جواب خصوصی نهایی:'),
      MH('<i>y</i> = ' + inl(part))
    ));
    res.particular = part;
    res.answerExpr = part;
    res.answerHtml = inl(part);
    res.answerLabel = 'جواب خصوصی';
    res.ic = { C: c };
    res.tags = (res.tags || []).concat([TAGS.ic]);
    const err = CAS.verifyResult(cfg, part);
    if (err !== null && err < 1e-6) {
      res.steps.push(STEP('بررسی صحت جواب',
        P('جواب خصوصی در معادلهٔ اصلی جایگذاری و بررسی شد؛ هم در معادله و هم در شرط اولیه صدق می‌کند. ✓')
      ));
    }
    return res;
  }

  function solveODE(cfg) {
    if (!cfg || !cfg.order) throw new Error('مرتبهٔ معادله مشخص نیست.');
    if (cfg.order === 1) {
      const pack = CAS.solveFirstOrder(cfg);
      const res = finalizeFirst(pack.primary, cfg);
      if (res && pack.list && pack.list.length > 1) {
        res.alts = pack.list
          .filter(x => x.res !== pack.primary)
          .slice(0, 3)
          .map(x => ({ label: x.label, build: () => finalizeFirst(x.res, cfg) }));
      }
      return res;
    }
    const res = CAS.solveHigher(cfg);
    res.answerHtml = res.particular ? inl(res.particular) : (res.answerHtml || inl(res.general));
    res.answerLabel = res.particular ? 'جواب خصوصی نهایی' : 'جواب عمومی';
    res.answerExpr = res.particular || res.general;
    if (!cfg.hasIC && !res.particular) {
      const err = CAS.verifyResult(cfg, res.general);
      if (err !== null && err < 1e-6) {
        res.steps.push(STEP('بررسی صحت جواب',
          P('جواب عمومی در معادلهٔ اصلی جایگذاری و در چند نقطه بررسی شد؛ باقی‌مانده در حد خطای گردکردن صفر است. ✓')
        ));
      }
    }
    return res;
  }

  CAS.finalizeFirst = finalizeFirst;
  CAS.solveODE = solveODE;
})(CAS);
