/* ------------------------------ مرتبهٔ دوم و بالاتر (۲) ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, neg, sub, div, simp, depends, diff, subs } = CAS;
  const { ST, TAGS } = CAS;
  const P = ST.p, M = ST.m, MH = ST.mh, NOTE = ST.note, WARN = ST.warn, LIST = ST.list, STEP = ST.step;
  const inl = CAS.inl;
  const YVARS = ['y', 'yp', 'ypp', 'yppp', 'ypppp'];
  const DER = ['', '′', '″', '‴', '⁗'];

  const constVal = e => {
    if (!e) return 0;
    if (depends(e, 'x') || depends(e, 'y') || depends(e, 'yp')) return null;
    const v = CAS.evalNum(e, {});
    return isFinite(v) ? v : null;
  };

  function sumExpr(list) { return CAS.simpAdd(list); }

  function yhFromBasis(basis) {
    return sumExpr(basis.map((b, i) => mul(sy('C' + (i + 1)), b)));
  }
  const basisTerms = basis => basis.map((b, i) => mul(sy('C' + (i + 1)), b));
  const yhHtml = basis => CAS.renderOrdered(basisTerms(basis));

  function rootBlocks(info, order, exactQuad, varName) {
    const rv = varName || 'r';
    const R = '<i>' + rv + '</i>';
    const blocks = [];
    if (exactQuad) {
      const { a2, a1, a0 } = exactQuad;
      const D = a1 * a1 - 4 * a2 * a0;
      blocks.push(MH('Δ = <i>b</i><sup>2</sup> − 4<i>ac</i> = (' + inl(num(a1)) + ')<sup>2</sup> − 4(' + inl(num(a2)) + ')(' + inl(num(a0)) + ') = ' + inl(num(D))));
      if (D >= 0) {
        const r1 = (-a1 + Math.sqrt(D)) / (2 * a2);
        const r2 = (-a1 - Math.sqrt(D)) / (2 * a2);
        blocks.push(MH(R + '<sub>1,2</sub> = ' + CAS.fracHtml('−<i>b</i> ± √Δ', '2<i>a</i>') + ' = ' + inl(num(r1)) + ' ، ' + inl(num(r2))));
      } else {
        const al = -a1 / (2 * a2), be = Math.sqrt(-D) / (2 * Math.abs(a2));
        blocks.push(MH(R + '<sub>1,2</sub> = ' + inl(num(al)) + ' ± ' + inl(num(be)) + '<i>i</i>'));
      }
    }
    const rows = [];
    for (const g of info.realRoots) {
      rows.push('<div class="root-row"><span class="root-val">' + R + ' = ' + inl(num(g.r)) + '</span><span class="root-m">تکرار ' + g.m + '</span><span class="root-type">حقیقی' + (g.m > 1 ? ' مضاعف' : '') + '</span></div>');
    }
    for (const g of info.complexGroups) {
      rows.push('<div class="root-row"><span class="root-val">' + R + ' = ' + inl(num(g.a)) + ' ± ' + inl(num(g.b)) + '<i>i</i></span><span class="root-m">تکرار ' + g.m + '</span><span class="root-type">مختلط مزدوج</span></div>');
    }
    blocks.push(MH('<div class="root-list">' + rows.join('') + '</div>'));
    return blocks;
  }

  function basisExplanation(info, order, varName) {
    const rv = varName || 'r';
    const R = '<i>' + rv + '</i>';
    const items = [];
    for (const g of info.realRoots) {
      const terms = [];
      for (let j = 0; j < g.m; j++) {
        const pre = j === 0 ? num(1) : pow(vr('x'), num(j));
        terms.push('<span class="math-inline">' + inl(mul(pre, CAS.expNode(mul(num(g.r), vr('x'))))) + '</span>');
      }
      const head = g.m === 1
        ? 'ریشهٔ حقیقی سادهٔ <span class="math-inline">' + R + ' = ' + inl(num(g.r)) + '</span>'
        : 'ریشهٔ حقیقی <span class="math-inline">' + R + ' = ' + inl(num(g.r)) + '</span> با تکرار ' + g.m;
      items.push(head + ' ⟹ جواب‌های ' + (g.m === 1 ? terms[0] : terms.join(' ، ') + ' ، …'));
    }
    for (const g of info.complexGroups) {
      const e = CAS.expNode(mul(num(g.a), vr('x')));
      const t1 = mul(e, fn('cos', mul(num(g.b), vr('x'))));
      const t2 = mul(e, fn('sin', mul(num(g.b), vr('x'))));
      items.push('ریشه‌های مختلط <span class="math-inline"><i>α</i> ± <i>βi</i></span> با <span class="math-inline"><i>α</i> = ' + inl(num(g.a)) + '</span> و <span class="math-inline"><i>β</i> = ' + inl(num(g.b)) + '</span> ⟹ جواب‌های <span class="math-inline">' + inl(t1) + '</span> و <span class="math-inline">' + inl(t2) + '</span>');
    }
    return items;
  }

  function solveHigher(cfg) {
    const order0 = cfg.order;
    let coeffs = cfg.coeffs.slice();
    for (let k = 0; k < coeffs.length; k++) {
      if (depends(coeffs[k], 'y') || depends(coeffs[k], 'yp')) {
        throw new Error('ضرایب معادله‌های مرتبهٔ دوم و بالاتر باید فقط تابع x باشند (نه y یا y′). این معادله غیرخطی است.');
      }
    }
    let n = order0;
    while (n > 0 && CAS.isZero(coeffs[n])) n--;
    if (n === 0) throw new Error('ضریب بالاترین مشتق صفر است و معادله عملاً جبری می‌شود.');
    const cs = coeffs.slice(0, n + 1);
    cfg.order = n;

    /* عبارت سمت چپ برای بررسی */
    let L = num(0);
    for (let k = 0; k <= n; k++) L = add(L, mul(cs[k], vr(YVARS[k])));
    cfg.linearLeft = L;
    cfg.rhsExpr = cfg.rhs;

    const R = cfg.rhs;
    const nonhom = !CAS.isZero(R);
    const warnings = [];
    if (n < order0) warnings.push('ضریب y<sup>(' + order0 + ')</sup> صفر بود؛ مرتبهٔ واقعی معادله ' + n + ' است و فقط ' + n + ' شرط اولیه قابل اعمال است.');

    /* ضرایب ثابت؟ */
    let consts = [], allConst = true;
    for (let k = 0; k <= n; k++) {
      const v = constVal(cs[k]);
      if (v === null) { allConst = false; break; }
      consts.push(v);
    }
    const coeffDesk = consts.slice().reverse();
    const euler = !allConst ? CAS._eulerData(cs, n) : null;

    let basis = null, yh = null, info = null, eulerInfo = null, methodName = '', methodNote = '', tags = [];
    const steps = [];

    if (allConst) {
      info = CAS._charInfo(coeffDesk, n);
      if (info.basis.length < n) throw new Error('محاسبهٔ ریشه‌های معادلهٔ مشخصه با دقت کافی انجام نشد. لطفاً ضرایب را ساده‌تر وارد کنید.');
      basis = info.basis.slice();
      yh = yhFromBasis(basis);
      methodName = nonhom ? 'معادلهٔ خطی ناهمگن با ضرایب ثابت' : 'معادلهٔ خطی همگن با ضرایب ثابت';
      methodNote = 'حل با معادلهٔ مشخصه' + (nonhom ? ' + جواب خصوصی' : '');
      tags = [n === 2 ? TAGS.orden2 : TAGS.ordenN, TAGS.linear, TAGS.constc, nonhom ? TAGS.nonhom : TAGS.homogeneousEq];

      steps.push(STEP('تشخیص نوع معادله',
        P('معادلهٔ خطی با <b>ضرایب ثابت</b> و مرتبهٔ ' + n + ' است' + (nonhom ? ' و سمت راست آن صفر نیست (ناهمگن).' : ' و همگن است.')),
        MH('L[y] = ' + inl(L) + (nonhom ? ' = ' + inl(R) : ' = 0'))
      ));
      steps.push(STEP('تشکیل معادلهٔ مشخصه',
        P('برای جواب‌های نمایی <span class="math-inline"><i>y</i> = <i>e</i><sup><i>rx</i></sup></span>، معادلهٔ مشخصه به دست می‌آید:'),
        MH('<i>P</i>(<i>r</i>) = ' + CAS._charPolyString(coeffDesk, 'r') + ' = 0')
      ));
      steps.push(STEP('ریشه‌های معادلهٔ مشخصه',
        ...rootBlocks(info, n, n === 2 ? { a2: consts[2], a1: consts[1], a0: consts[0] } : null)
      ));
      steps.push(STEP('ساخت جواب عمومی همگن',
        P('بر اساس نوع ریشه‌ها، جواب‌های پایه (مستقل خطی) ساخته می‌شوند:'),
        LIST(basisExplanation(info, n)),
        MH('<i>y</i><sub>h</sub> = ' + yhHtml(basis))
      ));
    } else if (euler) {
      eulerInfo = CAS._indicial(euler.slice().reverse());
      const indRoots = CAS.rootsComplex(eulerInfo).map(CAS._cleanRoot);
      const eb = CAS._eulerBasis(indRoots, n);
      if (eb.basis.length < n) throw new Error('ریشه‌های معادلهٔ شاخصی به‌درستی محاسبه نشدند.');
      basis = eb.basis.slice();
      info = eb.info;
      yh = yhFromBasis(basis);
      methodName = 'معادلهٔ کوشی–اویلر (Euler–Cauchy)' + (nonhom ? ' ناهمگن' : '');
      methodNote = 'حل با تغییر متغیر x = e^t و معادلهٔ شاخصی';
      tags = [n === 2 ? TAGS.orden2 : TAGS.ordenN, TAGS.linear, TAGS.euler, nonhom ? TAGS.nonhom : TAGS.homogeneousEq];
      steps.push(STEP('تشخیص معادلهٔ کوشی–اویلر',
        P('ضرایب معادله به ترتیب توان‌های x هستند؛ یعنی ضریب مشتق k‌ام با x<sup>k</sup> متناسب است. این معادله از نوع <b>کوشی–اویلر</b> است:'),
        MH(inl(L) + (nonhom ? ' = ' + inl(R) : ' = 0')),
        P('با تغییر متغیر <span class="math-inline"><i>x</i> = <i>e</i><sup><i>t</i></sup></span> (یا فرض <span class="math-inline"><i>y</i> = <i>x</i><sup><i>λ</i></sup></span>) به معادلهٔ خطی با ضرایب ثابت تبدیل می‌شود.')
      ));
      steps.push(STEP('معادلهٔ شاخصی',
        P('با جایگذاری <span class="math-inline"><i>y</i> = <i>x</i><sup><i>λ</i></sup></span> در معادله، معادلهٔ شاخصی (مشخصه) به دست می‌آید:'),
        MH(CAS._charPolyString(eulerInfo, 'λ') + ' = 0')
      ));
      steps.push(STEP('ریشه‌های معادلهٔ شاخصی',
        ...rootBlocks(info, n, null, 'λ')
      ));
      steps.push(STEP('جواب عمومی همگن',
        P('با ریشه‌های λ، جواب‌ها به شکل <span class="math-inline"><i>x</i><sup>λ</sup></span> (و در حالت مختلط <span class="math-inline"><i>x</i><sup>α</sup>cos(β ln x)</span>) ساخته می‌شوند:'),
        MH('<i>y</i><sub>h</sub> = ' + yhHtml(basis))
      ));
      if (cfg.x0 <= 0) warnings.push('جواب کوشی–اویلر روی بازهٔ x > 0 نوشته می‌شود؛ نقطهٔ x₀ باید مثبت باشد.');
    } else if (n === 2 && cfg.knownExpr) {
      const y1 = cfg.knownExpr;
      const lhs1 = add(mul(cs[2], CAS.nthDiff(y1, 'x', 2)), mul(cs[1], diff(y1, 'x')), mul(cs[0], y1));
      if (!CAS.isZero(lhs1)) {
        throw new Error('جواب معلوم واردشده در معادله صدق نمی‌کند؛ آن را بررسی کنید.');
      }
      const red = CAS._reductionOfOrder(y1, cs[1], cs[2]);
      basis = [y1, red.y2];
      yh = add(mul(sy('C1'), y1), mul(sy('C2'), red.y2));
      methodName = 'کاهش مرتبه با جواب معلوم';
      methodNote = 'یافتن جواب دوم مستقل خطی';
      tags = [TAGS.orden2, TAGS.linear];
      steps.push(STEP('جواب معلوم و تغییر متغیر',
        P('جواب <span class="math-inline"><i>y</i><sub>1</sub> = ' + inl(y1) + '</span> در معادله صدق می‌کند. برای یافتن جواب دوم مستقل، از تغییر متغیر <span class="math-inline"><i>y</i> = <i>u</i>(<i>x</i>)<i>y</i><sub>1</sub></span> استفاده می‌کنیم.'),
        MH('<i>y</i><sub>2</sub> = <i>y</i><sub>1</sub> ∫ ' + CAS.fracHtml('<i>e</i><sup>−∫<i>P</i> d<i>x</i></sup>', '<i>y</i><sub>1</sub><sup>2</sup>') + ' d<i>x</i>')
      ));
      steps.push(STEP('محاسبهٔ جواب دوم',
        MH('<i>P</i>(<i>x</i>) = ' + CAS.fracHtml(inl(cs[1]), inl(cs[2])) + ' = ' + inl(red.P) + ' &nbsp;،&nbsp; ∫<i>P</i> d<i>x</i> = ' + inl(red.Ip !== null ? red.Ip : { t: 'int', a: red.P, v: 'x' })),
        MH('<i>e</i><sup>−∫<i>P</i> d<i>x</i></sup> = ' + inl(CAS.expNode(neg(red.Ip !== null ? red.Ip : { t: 'int', a: red.P, v: 'x' })))),
        MH('<i>y</i><sub>2</sub> = ' + inl(red.y2))
      ));
      steps.push(STEP('جواب عمومی',
        MH('<i>y</i> = <i>C</i><sub>1</sub>(' + inl(y1) + ') + <i>C</i><sub>2</sub>(' + inl(red.y2) + ')'),
        MH('<i>y</i> = ' + inl(yh))
      ));
    } else {
      throw new Error('این معادلهٔ خطی مرتبهٔ ' + n + ' با ضرایب متغیر است و در قالب کوشی–اویلر یا کاهش مرتبه حل نمی‌شود. برای مرتبهٔ دوم می‌توانید یک جواب معلوم وارد کنید.');
    }

    /* ---------------- بخش ناهمگن ---------------- */
    let yp = null, partInfo = null, partMethod = '', variation = null;
    if (nonhom) {
      if (allConst) {
        const und = CAS._undetermined(consts.slice().reverse(), R, info);
        if (und) {
          yp = und.yp; partInfo = und; partMethod = 'undetermined';
          steps.push(STEP('انتخاب شکل جواب خصوصی (ضرایب نامعین)',
            P('جملهٔ ناهمگن ترکیبی از چندجمله‌ای، نمایی و توابع مثلثاتی است. شکل حدسی جواب خصوصی را با ضرایب نامعین می‌نویسیم:'),
            MH(trialHtml(und.basis)),
            P('با جایگذاری در معادله و مساوی قرار دادن ضرایب، دستگاه خطی ضرایب حل می‌شود.'),
            MH('<i>y</i><sub>p</sub> = ' + inl(yp))
          ));
        } else if (n === 2) {
          variation = CAS._variation2(basis, R, cs[2]);
          yp = variation.yp; partMethod = 'variation';
          steps.push(STEP('روش تغییر پارامترها',
            P('چون جملهٔ ناهمگن در قالب ضرایب نامعین نمی‌گنجد، از روش تغییر پارامترها استفاده می‌کنیم:'),
            MH('<i>y</i><sub>p</sub> = −<i>y</i><sub>1</sub> ∫ ' + CAS.fracHtml('<i>y</i><sub>2</sub><i>g</i>', '<i>W</i>') + ' d<i>x</i> + <i>y</i><sub>2</sub> ∫ ' + CAS.fracHtml('<i>y</i><sub>1</sub><i>g</i>', '<i>W</i>') + ' d<i>x</i>'),
            MH('<i>W</i>(<i>y</i><sub>1</sub>,<i>y</i><sub>2</sub>) = ' + inl(variation.W)),
            MH('<i>y</i><sub>p</sub> = ' + inl(yp)),
            NOTE('در اینجا g(x) سمت راست معادله پس از نرمال‌سازی (تقسیم بر ضریب y″) است.')
          ));
        }
      } else if (euler && n === 2) {
        variation = CAS._variation2(basis, R, cs[2]);
        yp = variation.yp; partMethod = 'variation';
        steps.push(STEP('جواب خصوصی با تغییر پارامترها',
          P('برای معادلهٔ کوشی–اویلر ناهمگن، از تغییر پارامترها استفاده می‌کنیم:'),
          MH('<i>W</i> = ' + inl(variation.W)),
          MH('<i>y</i><sub>p</sub> = ' + inl(yp))
        ));
      }
      if (!yp) {
        warnings.push('برای این جملهٔ ناهمگن، جواب خصوصی با روش‌های نمادین این نسخه به دست نیامد؛ جواب همگن ارائه شده است.');
      }
    }

    const general = yp ? add(yh, yp) : yh;
    const yhTerms = basisTerms(basis);
    const generalTerms = yp
      ? yhTerms.concat(yp.t === '+' ? yp.a : [yp])
      : yhTerms;

    if (yp) {
      steps.push(STEP('جواب عمومی کامل',
        P('جواب عمومی معادلهٔ ناهمگن، مجموع جواب همگن و جواب خصوصی است:'),
        MH('<i>y</i> = <i>y</i><sub>h</sub> + <i>y</i><sub>p</sub> = ' + CAS.renderOrdered(generalTerms))
      ));
    }

    /* ---------------- شرایط اولیه ---------------- */
    let particular = null, icRes = null;
    if (cfg.hasIC) {
      icRes = CAS.solveICs(general, cfg);
      if (icRes.sol) {
        const map = {};
        icRes.cs.forEach((c, i) => map[c] = num(icRes.sol[i]));
        particular = simp(subs(general, map));
        steps.push(...CAS.icSteps(general, cfg, icRes));
        steps.push(STEP('جواب خصوصی نهایی', MH('<i>y</i> = ' + inl(particular))));
        /* بررسی سازگاری */
        let maxErr = 0;
        for (let k = 0; k < cfg.order; k++) {
          const dk = k === 0 ? particular : CAS.nthDiff(particular, 'x', k);
          const v = CAS.evalNum(dk, { x: cfg.x0, y: 0 });
          if (isFinite(v)) maxErr = Math.max(maxErr, Math.abs(v - cfg.y0s[k]));
        }
        if (maxErr > 1e-6 * (1 + Math.max(...cfg.y0s.map(Math.abs)))) {
          warnings.push('شرایط اولیه با دقت عددی برقرار نشدند؛ ممکن است شرایط ناسازگار یا نقطهٔ x₀ تکین باشد.');
        }
      } else {
        warnings.push('دستگاه شرایط اولیه تکین بود و ثابت‌ها به‌دست نیامدند.');
      }
    }

    if (yp) {
      const err = CAS.verifyResult(cfg, particular || general);
      if (err !== null && err < 1e-5) {
        steps.push(STEP('بررسی صحت جواب',
          P('جواب به‌دست‌آمده در معادلهٔ اصلی جایگذاری و در چند نقطه به‌صورت عددی بررسی شد؛ باقی‌ماندهٔ معادله در حد خطای گردکردن صفر است. ✓')
        ));
      }
    }

    const res = ST.result({
      method: methodName,
      methodNote,
      tags,
      steps,
      general,
      particular,
      warnings,
      answerHtml: particular ? inl(particular) : CAS.renderOrdered(generalTerms),
      answerLabel: particular ? 'جواب خصوصی نهایی' : 'جواب عمومی',
      meta: { info, basis, yh, yp, partMethod, n, consts, euler, yhTerms }
    });

    /* روش‌های جایگزین */
    if (nonhom && allConst) {
      if (partMethod === 'undetermined' && n === 2) {
        res.alts.push({
          label: 'حل با روش تغییر پارامترها',
          build: () => buildVariationAlt(cfg, basis, R, cs[2], info)
        });
      } else if (partMethod === 'variation') {
        const und = CAS._undetermined(consts.slice().reverse(), R, info);
        if (und) res.alts.push({ label: 'حل با روش ضرایب نامعین', build: () => buildUndetAlt(cfg, basis, R, info, consts) });
      }
    }
    return res;
  }

  function trialHtml(basis) {
    const parts = basis.map((b, i) => '<span class="trial-term"><i>A</i><sub>' + (i + 1) + '</sub>·' + inl(b) + '</span>');
    return parts.join(' + ');
  }

  function buildVariationAlt(cfg, basis, R, a2, info) {
    const steps = [];
    const yh = yhFromBasis(basis);
    steps.push(STEP('جواب همگن', MH('<i>y</i><sub>h</sub> = ' + inl(yh))));
    const v = CAS._variation2(basis, R, a2);
    steps.push(STEP('روش تغییر پارامترها',
      P('جواب خصوصی با فرمول تغییر پارامترها محاسبه می‌شود:'),
      MH('<i>W</i> = <i>y</i><sub>1</sub><i>y</i><sub>2</sub>′ − <i>y</i><sub>1</sub>′<i>y</i><sub>2</sub> = ' + inl(v.W)),
      MH('<i>y</i><sub>p</sub> = ' + inl(v.yp))
    ));
    const gen = add(yh, v.yp);
    steps.push(STEP('جواب عمومی', MH('<i>y</i> = ' + inl(gen))));
    const res = ST.result({
      method: 'معادلهٔ ناهمگن با روش تغییر پارامترها',
      methodNote: 'فرمول عمومی تغییر پارامترها',
      tags: [TAGS.orden2, TAGS.linear, TAGS.nonhom],
      steps, general: gen, meta: { n: 2, basis }
    });
    return CAS._finalizeHigher(res, cfg);
  }

  function buildUndetAlt(cfg, basis, R, info, consts) {
    const und = CAS._undetermined(consts.slice().reverse(), R, info);
    if (!und) throw new Error('روش ضرایب نامعین برای این جملهٔ ناهمگن به کار نمی‌رود.');
    const yh = yhFromBasis(basis);
    const steps = [];
    steps.push(STEP('جواب همگن', MH('<i>y</i><sub>h</sub> = ' + inl(yh))));
    steps.push(STEP('انتخاب جواب خصوصی',
      MH(trialHtml(und.basis)),
      MH('<i>y</i><sub>p</sub> = ' + inl(und.yp))
    ));
    const gen = add(yh, und.yp);
    steps.push(STEP('جواب عمومی', MH('<i>y</i> = ' + inl(gen))));
    const res = ST.result({
      method: 'معادلهٔ ناهمگن با روش ضرایب نامعین',
      methodNote: 'حدس شکل جواب و تعیین ضرایب',
      tags: [TAGS.orden2, TAGS.linear, TAGS.nonhom],
      steps, general: gen, meta: { n: 2, basis }
    });
    return CAS._finalizeHigher(res, cfg);
  }

  /* اعمال شرایط اولیه روی نتایج جایگزین */
  CAS._finalizeHigher = function (res, cfg) {
    if (!cfg.hasIC) return res;
    const icRes = CAS.solveICs(res.general, cfg);
    if (!icRes.sol) { res.warnings.push('شرایط اولیه حل نشد.'); return res; }
    const map = {};
    icRes.cs.forEach((c, i) => map[c] = num(icRes.sol[i]));
    res.particular = simp(subs(res.general, map));
    res.steps.push(...CAS.icSteps(res.general, cfg, icRes));
    res.steps.push(STEP('جواب خصوصی نهایی', MH('<i>y</i> = ' + inl(res.particular))));
    return res;
  };

  CAS.solveHigher = solveHigher;
})(CAS);
