/* ============================================================
   رابط کاربری برنامه — اتصال ورودی‌ها به موتور حل
   ============================================================ */
(function () {
  'use strict';
  var CAS = window.CAS;
  var $ = function (id) { return document.getElementById(id); };
  var PRIMES = ['', '′', '″', '‴', '⁗', '⁽⁵⁾'];
  var YNAMES = ['y', 'y′', 'y″', 'y‴', 'y⁗', 'y⁽⁵⁾'];
  var GREET = 'سلام';

  var state = {
    order: 2,
    coefVals: ['', '', '', '', '', ''],
    icX0: '0',
    icVals: ['', '', '', '', ''],
    rawMode: false,
    primaryRes: null,
    lastCfg: null,
    busy: false
  };

  /* ------------------------------ ابزار ------------------------------ */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function yvar(k) {
    return '<i>y</i>' + (k > 0 ? PRIMES[k] : '');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function errMsg(text) {
    var box = $('errorBox');
    if (!box) return;
    if (!text) { box.className = 'error-box'; box.innerHTML = ''; return; }
    box.className = 'error-box show';
    box.innerHTML = '<span aria-hidden="true">⚠ </span>' + esc(text);
  }
  function clearErr() { errMsg(''); }

  /* ------------------------------ ورودی‌ها ------------------------------ */
  function buildOrderButtons() {
    var wrap = $('orderRow');
    wrap.innerHTML = '';
    for (var n = 1; n <= 5; n++) {
      (function (n2) {
        var b = el('button', 'order-btn' + (n2 === state.order ? ' active' : ''), 'مرتبه ' + n2);
        b.type = 'button';
        b.setAttribute('data-order', String(n2));
        b.addEventListener('click', function () {
          state.order = n2;
          buildOrderButtons();
          buildCoefRows();
          buildICFields();
          updatePreview();
        });
        wrap.appendChild(b);
      })(n);
    }
  }

  function buildCoefRows() {
    var wrap = $('coefList');
    wrap.innerHTML = '';
    for (var k = state.order; k >= 0; k--) {
      (function (k2) {
        var row = el('div', 'coef-row');
        var tag = el('div', 'coef-tag', yvar(k2));
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id = 'coef-' + k2;
        inp.className = 'math-input';
        inp.dir = 'ltr';
       
        inp.value = state.coefVals[k2] || '';
        inp.placeholder = k2 === 0 ? 'مثلاً 2 یا 2x  (خالی = ۰)' : 'خالی = ۰';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.addEventListener('input', function () {
          state.coefVals[k2] = inp.value;
          updatePreview();
        });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
        });
        row.appendChild(tag);
        row.appendChild(inp);
        wrap.appendChild(row);
      })(k);
    }
  }

  function buildICFields() {
    var wrap = $('icFields');
    wrap.innerHTML = '';
    var xrow = el('div', 'grid-2');
    var f1 = el('div', 'field');
    f1.innerHTML = '<label>نقطهٔ شروع <span class="math-inline"><i>x</i><sub>0</sub></span></label>';
    var i1 = document.createElement('input');
    i1.type = 'text'; i1.id = 'ic-x0'; i1.value = state.icX0;
    i1.className = 'math-input'; i1.dir = 'ltr';
    i1.placeholder = '0'; i1.autocomplete = 'off'; i1.spellcheck = false;
    i1.addEventListener('input', function () { state.icX0 = i1.value; });
    i1.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
    });
    f1.appendChild(i1);
    xrow.appendChild(f1);
    wrap.appendChild(xrow);
    for (var k = 0; k < state.order; k++) {
      (function (k2) {
        var f = el('div', 'field');
        f.innerHTML = '<label><span class="math-inline">' + yvar(k2) + '(<i>x</i><sub>0</sub>)</span></label>';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.id = 'ic-' + k2;
        inp.className = 'math-input';
        inp.dir = 'ltr';
       
        inp.value = state.icVals[k2] || '';
        inp.placeholder = '0';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.addEventListener('input', function () { state.icVals[k2] = inp.value; });
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
        });
        f.appendChild(inp);
        wrap.appendChild(f);
      })(k);
    }
  }

  /* ------------------------------ پیش‌نمایش ------------------------------ */
  function coefTermHtml(expr) {
    if (CAS._signOf(expr) < 0) return { neg: true, e: CAS._absTerm(expr) };
    return { neg: false, e: expr };
  }

  function previewEquation() {
    if (state.rawMode) {
      var txt = $('rawInput').value.trim();
      if (!txt) return '<span class="op" style="color:#8b98a9">معادله را در کادر بالا بنویسید…</span>';
      try {
        var ex = CAS.parse(txt);
        return CAS.render(ex) + ' = 0';
      } catch (e) {
        return esc(txt);
      }
    }
    var parts = [];
    for (var k = state.order; k >= 0; k--) {
      var txt2 = (state.coefVals[k] || '').trim();
      if (!txt2) continue;
      var expr;
      try { expr = CAS.parse(txt2); } catch (e) { expr = null; }
      if (!expr) {
        var plain = esc(txt2) + (k > 0 ? '·' + YNAMES[k] : '');
        parts.push({ neg: false, html: plain });
        continue;
      }
      var s = coefTermHtml(expr);
      var cHtml = CAS.render(s.e);
      var needParen = s.e.t === '+' || s.e.t === '*';
      var body;
      if (CAS.isNum(s.e, 1)) {
        body = yvar(k);
      } else {
        body = (needParen ? '<span class="paren">(</span>' + cHtml + '<span class="paren">)</span>' : cHtml) +
          (s.e.t === '+' ? '' : '\u2009') + yvar(k);
      }
      parts.push({ neg: s.neg, html: body });
    }
    if (!parts.length) return '<span class="op" style="color:#8b98a9">ضرایب را وارد کنید…</span>';
    var out = '';
    parts.forEach(function (p, i) {
      if (i === 0) out += (p.neg ? '−' : '') + p.html;
      else out += (p.neg ? ' − ' : ' + ') + p.html;
    });
    var rhsTxt = '';
    if ($('nonhomCheck').checked) {
      rhsTxt = $('rhsInput').value.trim();
    }
    if (rhsTxt) {
      try {
        out += ' = ' + CAS.render(CAS.parse(rhsTxt));
      } catch (e2) {
        out += ' = ' + esc(rhsTxt);
      }
    } else {
      out += ' = 0';
    }
    return out;
  }

  function updatePreview() {
    var box = $('previewBox');
    if (!box) return;
    box.innerHTML = '<div class="math">' + previewEquation() + '</div>';
  }

  /* ------------------------------ ساخت cfg ------------------------------ */
  function fieldVal(id) {
    var e = $(id);
    return e ? String(e.value).trim() : '';
  }
  function parseOr(text, label) {
    if (!text) return CAS.num(0);
    try { return CAS.parse(text); }
    catch (e) { throw new Error(label + ': ' + e.message); }
  }

  function buildCfg() {
    var cfg = { hasIC: false, x0: 0, y0s: [], knownExpr: null, rawExpr: null };
    if (state.rawMode) {
      var raw = $('rawInput').value.trim();
      if (!raw) throw new Error('در حالت معادلهٔ کامل، عبارت معادله را وارد کنید.');
      cfg.order = 1;
      cfg.rawExpr = parseOr(raw, 'معادله');
      cfg.coeffs = [CAS.num(0), CAS.num(1)];
      cfg.rhs = CAS.num(0);
    } else {
      cfg.order = state.order;
      cfg.coeffs = [];
      var any = false;
      for (var k = 0; k <= state.order; k++) {
        var t = (state.coefVals[k] || '').trim();
        if (t) any = true;
        cfg.coeffs.push(parseOr(t, 'ضریب ' + YNAMES[k]));
      }
      if (!any) throw new Error('حداقل یکی از ضرایب را وارد کنید (مثلاً ضریب y یا y′).');
      var nonhom = $('nonhomCheck').checked;
      cfg.rhs = nonhom ? parseOr(fieldVal('rhsInput'), 'سمت راست معادله') : CAS.num(0);
    }

    var icOn = $('icCheck').checked;
    if (icOn) {
      cfg.hasIC = true;
      cfg.x0 = parseOr(fieldVal('ic-x0'), 'مقدار x₀');
      var x0v = CAS.evalNum(cfg.x0, {});
      if (!isFinite(x0v)) throw new Error('مقدار x₀ باید یک عدد باشد.');
      cfg.x0 = x0v;
      cfg.y0s = [];
      for (var j = 0; j < cfg.order; j++) {
        var v = fieldVal('ic-' + j);
        var ex = parseOr(v, 'مقدار ' + YNAMES[j] + '(x₀)');
        var nv = CAS.evalNum(ex, {});
        if (!isFinite(nv)) throw new Error('مقدار ' + YNAMES[j] + '(x₀) باید عدد باشد.');
        cfg.y0s.push(nv);
      }
    }

    var known = fieldVal('knownInput');
    if (known) cfg.knownExpr = parseOr(known, 'جواب معلوم');
    return cfg;
  }

  /* ------------------------------ حل ------------------------------ */
  function solve() {
    if (state.busy) return;
    clearErr();
    var btn = $('solveBtn');
    var old = btn.innerHTML;
    state.busy = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> در حال حل…';
    try {
      var cfg = buildCfg();
      var res = CAS.solveODE(cfg);
      state.lastCfg = cfg;
      state.primaryRes = res;
      renderResult(res, false);
    } catch (err) {
      state.primaryRes = null;
      errMsg(err && err.message ? err.message : 'خطای نامشخص در محاسبات.');
      renderEmpty('ورودی را اصلاح کنید', 'پیام خطا در کنار فرم ورودی نمایش داده شده است.');
    }
    state.busy = false;
    btn.disabled = false;
    btn.innerHTML = old;
  }

  /* ------------------------------ رندر نتیجه ------------------------------ */
  function renderEmpty(title, text) {
    var box = $('resultWrap');
    box.innerHTML =
      '<div class="empty-state fade-in">' +
      '<div class="icon">pgu</div>' +
      '<h3>' + esc(title || 'آمادهٔ حل هستید') + '</h3>' +
      '<p>' + esc(text || 'ضرایب معادله را وارد کنید و دکمهٔ «حل گام به گام» را بزنید. برنامه نوع معادله را تشخیص می‌دهد و مراحل را به فارسی توضیح می‌دهد.') + '</p>' +
      '</div>';
  }

  function blockHtml(b) {
    if (!b) return '';
    switch (b.t) {
      case 'p': return '<p>' + b.html + '</p>';
      case 'm': return '<div class="math">' + b.html + '</div>';
      case 'note': return '<div class="note">' + b.html + '</div>';
      case 'warn': return '<div class="warn">' + b.html + '</div>';
      case 'list': return '<ul>' + b.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    }
    return '';
  }

  function tagClass(t) {
    if (t.indexOf('شرایط') === 0) return 'ic';
    if (t.indexOf('ناهمگن') === 0) return 'nonhom';
    return '';
  }

  function renderResult(res, isAlt) {
    var box = $('resultWrap');
    if (!res) { renderEmpty(); return; }
    var html = '';
    html += '<div class="result-head">';
    html += '<div><div class="method-name"><span class="dot"></span><span>' + esc(res.method || 'روش حل') + '</span></div>';
    if (res.methodNote) html += '<div class="method-note">' + esc(res.methodNote) + '</div>';
    html += '</div>';
    var tags = (res.tags || []).filter(function (t, i, a) { return a.indexOf(t) === i; });
    if (tags.length) {
      html += '<div class="tags">' + tags.map(function (t) {
        return '<span class="tag ' + tagClass(t) + '">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }
    html += '</div>';

    var tinted = /خصوصی|ضمنی/.test(res.answerLabel || '') ? ' tinted' : '';
    html += '<div class="answer-box' + tinted + '">' +
      '<div class="cap">' + esc(res.answerLabel || 'جواب') + '</div>' +
      '<div class="math">' + (res.answerHtml || '—') + '</div>' +
      '</div>';

    if (res.warnings && res.warnings.length) {
      html += '<div class="warnings"><b>توجه:</b> ' + res.warnings.map(esc).join(' — ') + '</div>';
    }

    html += '<div class="steps">';
    (res.steps || []).forEach(function (s, i) {
      html += '<div class="step">';
      html += '<div class="step-title"><span class="step-no">' + (i + 1) + '</span><span>' + esc(s.title) + '</span></div>';
      html += (s.blocks || []).map(blockHtml).join('');
      html += '</div>';
    });
    html += '</div>';

    if (res.alts && res.alts.length) {
      html += '<div class="alts"><h4>این معادله با روش‌های دیگری هم قابل حل است</h4><div class="row" id="altRow"></div>';
      html += '<div class="alt-note">برای دیدن حل کامل هر روش، روی دکمهٔ آن کلیک کنید.</div></div>';
    }

    html += '<div class="card-body" style="padding-top:0">' +
      '<div class="actions">' +
      (isAlt ? '<button class="btn btn-ghost" id="backBtn" type="button">‹ بازگشت به روش اصلی</button>' : '') +
      '<button class="btn btn-ghost" id="printBtn" type="button">چاپ / PDF</button>' +
      '</div></div>';

    box.innerHTML = '<div class="fade-in">' + html + '</div>';

    if (res.alts && res.alts.length) {
      var row = $('altRow');
      res.alts.forEach(function (alt) {
        var b = el('button', 'btn btn-ghost btn-small', esc(alt.label));
        b.type = 'button';
        b.addEventListener('click', function () {
          clearErr();
          try {
            var r2 = alt.build();
            renderResult(r2, true);
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (e) {
            errMsg(e && e.message ? e.message : 'این روش در این حالت قابل اجرا نیست.');
          }
        });
        row.appendChild(b);
      });
    }

    var pb = $('printBtn');
    if (pb) pb.addEventListener('click', function () { window.print(); });
    var bb = $('backBtn');
    if (bb) bb.addEventListener('click', function () {
      if (state.primaryRes) renderResult(state.primaryRes, false);
    });
  }

  /* ------------------------------ مثال‌ها ------------------------------ */
  var EXAMPLES = [
    {
      label: 'خطی: y′ + 2y = e⁻ˣ',
      set: function () {
        setOrder(1); setCoefs({ 0: '2', 1: '1' }); nonhom(true, 'exp(-x)');
        known(''); ic(false);
      }
    },
    {
      label: 'برنولی: y′ + y = x y²',
      set: function () {
        setOrder(1); setCoefs({ 0: '1', 1: '1' }); nonhom(true, 'x*y^2');
        known(''); ic(false);
      }
    },
    {
      label: 'تفکیک‌پذیر: y′ = x y',
      set: function () {
        setOrder(1); setCoefs({ 1: '1' }); nonhom(true, 'x*y');
        known(''); ic(false);
      }
    },
    {
      label: 'همگن: y′ = (x+y)/x',
      set: function () {
        setOrder(1); setCoefs({ 1: '1' }); nonhom(true, '(x+y)/x');
        known(''); ic(false);
      }
    },
    {
      label: 'کامل: (2x+y) + (x+2y)y′ = 0',
      set: function () {
        setOrder(1); raw(true, '(2*x+y) + (x+2*y)*y\'');
        known(''); ic(false);
      }
    },
    {
      label: 'ریکاتی: y′ = y² − 1',
      set: function () {
        setOrder(1); setCoefs({ 1: '1' }); nonhom(true, 'y^2 - 1');
        known('1'); ic(false);
      }
    },
    {
      label: 'کلرو: y = x y′ + y′²',
      set: function () {
        setOrder(1); raw(true, 'y = x*y\' + y\'^2');
        known(''); ic(false);
      }
    },
    {
      label: 'کوشی‑اویلر: x²y″ − 2x y′ + 2y = 0',
      set: function () {
        setOrder(2); setCoefs({ 0: '2', 1: '-2*x', 2: 'x^2' }); nonhom(false);
        known(''); ic(false);
      }
    },
    {
      label: 'ناهمگن: y″ − y = e²ˣ',
      set: function () {
        setOrder(2); setCoefs({ 0: '-1', 2: '1' }); nonhom(true, 'exp(2*x)');
        known(''); ic(false);
      }
    },
    {
      label: 'مرتبه ۴: y⁗ − 5y″ + 4y = 0',
      set: function () {
        setOrder(4); setCoefs({ 0: '4', 2: '-5', 4: '1' });
        nonhom(false); known(''); ic(false);
      }
    },
    {
      label: 'کاهش مرتبه: y″ − y′/x = 0',
      set: function () {
        setOrder(2); setCoefs({ 1: '-1/x', 2: '1' }); nonhom(false);
        known('1'); ic(false);
      }
    },
    {
      label: 'مقدار اولیه: y″ − 3y′ + 2y = 0',
      set: function () {
        setOrder(2); setCoefs({ 0: '2', 1: '-3', 2: '1' }); nonhom(false);
        known(''); ic(true, 0, ['1', '0']);
      }
    }
  ];

  function setOrder(n) {
    state.order = n;
    buildOrderButtons();
    buildCoefRows();
    buildICFields();
  }
  function setCoefs(obj) {
    state.coefVals = ['', '', '', '', '', ''];
    Object.keys(obj).forEach(function (k) { state.coefVals[Number(k)] = obj[k]; });
    buildCoefRows();
    updatePreview();
  }
  function nonhom(on, rhs) {
    $('nonhomCheck').checked = !!on;
    $('rhsField').style.display = on ? '' : 'none';
    if (rhs != null) $('rhsInput').value = rhs;
    updatePreview();
  }
  function raw(on, text) {
    state.rawMode = !!on;
    $('rawCheck').checked = !!on;
    $('rawField').style.display = on ? '' : 'none';
    $('coefArea').style.display = on ? 'none' : '';
    $('rhsRow').style.display = on ? 'none' : '';
    if (on && state.order !== 1) setOrder(1);
    if (text != null) $('rawInput').value = text;
    updatePreview();
  }
  function known(v) { $('knownInput').value = v || ''; }
  function ic(on, x0, vals) {
    $('icCheck').checked = !!on;
    $('icBody').style.display = on ? '' : 'none';
    if (x0 != null) {
      state.icX0 = String(x0);
      var x = $('ic-x0');
      if (x) x.value = String(x0);
    }
    if (vals) {
      vals.forEach(function (v, i) {
        state.icVals[i] = v;
        var f = $('ic-' + i);
        if (f) f.value = v;
      });
    }
  }

  function buildExamples() {
    var wrap = $('examples');
    wrap.innerHTML = '';
    EXAMPLES.forEach(function (ex) {
      var b = el('button', 'ex', esc(ex.label));
      b.type = 'button';
      b.addEventListener('click', function () {
        clearErr();
        try { raw(false, ''); ex.set(); } catch (e) { /* ignore */ }
        $('icBody').style.display = $('icCheck').checked ? '' : 'none';
        updatePreview();
        solve();
      });
      wrap.appendChild(b);
    });
  }

  /* ------------------------------ شروع ------------------------------ */
  function init() {
    buildOrderButtons();
    buildCoefRows();
    buildICFields();
    buildExamples();
    updatePreview();
    renderEmpty();

    $('nonhomCheck').addEventListener('change', function () {
      $('rhsField').style.display = this.checked ? '' : 'none';
      if (this.checked) { $('rhsInput').focus(); }
      updatePreview();
    });
    $('rhsInput').addEventListener('input', updatePreview);
    $('rhsInput').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
    });

    $('icCheck').addEventListener('change', function () {
      $('icBody').style.display = this.checked ? '' : 'none';
    });

    $('rawCheck').addEventListener('change', function () {
      state.rawMode = this.checked;
      $('rawField').style.display = this.checked ? '' : 'none';
      $('coefArea').style.display = this.checked ? 'none' : '';
      $('rhsRow').style.display = this.checked ? 'none' : '';
      if (this.checked && state.order !== 1) setOrder(1);
      updatePreview();
      if (this.checked) $('rawInput').focus();
    });
    $('rawInput').addEventListener('input', updatePreview);

    $('knownInput').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
    });

    $('solveBtn').addEventListener('click', solve);
    $('resetBtn').addEventListener('click', function () {
      state.order = 2;
      state.coefVals = ['', '', '', '', '', ''];
      state.icX0 = '0';
      state.icVals = ['', '', '', '', ''];
      state.rawMode = false;
      state.primaryRes = null;
      $('rawCheck').checked = false;
      $('rawField').style.display = 'none';
      $('coefArea').style.display = '';
      $('rhsRow').style.display = '';
      $('rawInput').value = '';
      $('knownInput').value = '';
      $('rhsInput').value = '';
      $('nonhomCheck').checked = false;
      $('rhsField').style.display = 'none';
      $('icCheck').checked = false;
      $('icBody').style.display = 'none';
      buildOrderButtons();
      buildCoefRows();
      buildICFields();
      clearErr();
      updatePreview();
      renderEmpty();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var fav = document.getElementById('favicon');
    if (fav) {
      fav.href = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f6feb"/><text x="32" y="45" font-size="22" text-anchor="middle" fill="#fff" font-family="monospace">pgu</text></svg>');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
