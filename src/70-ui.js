/* ============================================================
   رابط کاربری برنامه — اتصال ورودی‌ها به موتور حل
   ============================================================ */
(function () {
  'use strict';
  var CAS = window.CAS;
  var $ = function (id) { return document.getElementById(id); };
  var PRIMES = ['', '′', '″', '‴', '⁗'];
  var YNAMES = ['y', 'y′', 'y″', 'y‴', 'y⁗'];
  var GREET = 'سلام';

  var state = {
    order: 2,
    icX0: '0',
    icVals: ['', '', '', '', ''],
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
  function buildICFields() {
    var wrap = $('icFields');
    wrap.innerHTML = '';
    var xrow = el('div', 'grid-2');
    var f1 = el('div', 'field');
    f1.innerHTML = '<label>نقطهٔ شروع <span class="math-inline"><i>x</i><sub>0</sub></span></label>';
    var i1 = document.createElement('input');
    i1.type = 'text'; i1.id = 'ic-x0'; i1.value = state.icX0;
    i1.className = 'math-input'; i1.dir = 'ltr'; i1.inputMode = 'none';
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
        inp.inputMode = 'none';
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

  /* ------------------------------ ورودی معادله و پیشنمایش ------------------------------ */
  var YVARS = ['y', 'yp', 'ypp', 'yppp', 'ypppp'];

  function equationText() {
    var box = $('previewBox');
    var t = box ? (box.getAttribute('data-raw') || '').trim() : '';
    if (t.indexOf('=') < 0 && $('nonhomCheck') && $('nonhomCheck').checked) {
      var rhs = fieldVal('rhsInput');
      if (rhs) t += ' = ' + rhs;
    }
    return t;
  }

  function equationExpr(text) {
    var parts = text.split('=');
    if (parts.length > 2) throw new Error('معادله فقط باید یک علامت «=» داشته باشد.');
    var left = CAS.parse(parts[0]);
    var right = (parts.length === 2 && parts[1].trim()) ? CAS.parse(parts[1]) : CAS.num(0);
    return CAS.simp(CAS.sub(left, right));
  }

  function equationOrder(expr) {
    var n = 1;
    for (var k = 1; k < YVARS.length; k++) if (CAS.depends(expr, YVARS[k])) n = k;
    return n;
  }

  function decomposeHigher(expr, order) {
    var zeroMap = {};
    YVARS.forEach(function (v) { zeroMap[v] = CAS.num(0); });
    var coeffs = [], rest = expr;
    for (var k = 0; k <= order; k++) {
      var c = CAS.simp(CAS.subs(CAS.diff(rest, YVARS[k]), zeroMap));
      coeffs.push(c);
      rest = CAS.simp(CAS.sub(rest, CAS.mul(c, CAS.vr(YVARS[k]))));
    }
    var leftover = YVARS.some(function (v) { return CAS.depends(rest, v); });
    if (leftover) throw new Error('معادلهٔ مرتبهٔ بالا باید نسبت به y و مشتقاتش خطی باشد.');
    return { coeffs: coeffs, rhs: CAS.simp(CAS.neg(rest)) };
  }

  function parseEquation(text) {
    if (!text) throw new Error('عبارت معادله را وارد کنید.');
    var expr = equationExpr(text);
    var order = equationOrder(expr);
    var cfg = { order: order, hasIC: false, x0: 0, y0s: [], knownExpr: null, rawExpr: null };
    if (order <= 1) {
      cfg.rawExpr = expr;
      cfg.coeffs = [CAS.num(0), CAS.num(1)];
      cfg.rhs = CAS.num(0);
    } else {
      var d = decomposeHigher(expr, order);
      cfg.coeffs = d.coeffs;
      cfg.rhs = d.rhs;
    }
    return cfg;
  }

  function syncEquation() {
    try {
      var cfg = parseEquation(equationText());
      if (cfg.order !== state.order) {
        state.order = cfg.order;
        buildICFields();
      }
    } catch (_) { /* ورودی ناقص هنگام تایپ نادیده گرفته میشود */ }
  }

  function previewEquation() {
    var txt = equationText();
    if (!txt) return '<span class="op" style="color:#8b98a9">معادله را وارد کنید…</span>';
    var parts = txt.split('=');
    try {
      var out = CAS.render(CAS.parse(parts[0]));
      if (parts.length === 2 && parts[1].trim()) {
        out += '<span class="op"> = </span>' + CAS.render(CAS.parse(parts[1]));
      }
      return out;
    } catch (e) {
      return esc(txt);
    }
  }

  function updatePreview() {
    var box = $('previewBox');
    if (!box) return;
    if (!box.hasAttribute('data-raw')) box.setAttribute('data-raw', '');
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
    var cfg = parseEquation(equationText());

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
      '<div class="icon">∫</div>' +
      '<h3>' + esc(title || 'آمادهٔ حل هستید') + '</h3>' +
      '<p>' + esc(text || 'ضرایب معادله را وارد کنید و دکمهٔ «حل گام‌به‌گام» را بزنید. برنامه نوع معادله را تشخیص می‌دهد و مراحل را به فارسی توضیح می‌دهد.') + '</p>' +
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

  /* ------------------------------ مثالها ------------------------------ */
  var EXAMPLES = [
    { label: 'خطی: y′ + 2y = e⁻ˣ', eq: "y' + 2*y = exp(-x)" },
    { label: 'برنولی: y′ + y = x y²', eq: "y' + y = x*y^2" },
    { label: 'تفکیکپذیر: y′ = x y', eq: "y' = x*y" },
    { label: 'همگن: y′ = (x+y)/x', eq: "y' = (x+y)/x" },
    { label: 'کامل: (2x+y) + (x+2y)y′ = 0', eq: "(2*x+y) + (x+2*y)*y' = 0" },
    { label: 'ریکاتی: y′ = y² − 1', eq: "y' = y^2 - 1", known: '1' },
    { label: 'کلرو: y = x y′ + y′²', eq: "y = x*y' + y'^2" },
    { label: 'کوشی‑اویلر: x²y″ − 2x y′ + 2y = 0', eq: "x^2*y'' - 2*x*y' + 2*y = 0" },
    { label: 'ناهمگن: y″ − y = e²ˣ', eq: "y'' - y = exp(2*x)" },
    { label: 'مرتبه ۴: y⁗ − 5y″ + 4y = 0', eq: "y'''' - 5*y'' + 4*y = 0" },
    { label: 'کاهش مرتبه: y″ − y′/x = 0', eq: "y'' - y'/x = 0", known: '1' },
    { label: 'مقدار اولیه: y″ − 3y′ + 2y = 0', eq: "y'' - 3*y' + 2*y = 0", ic: ['1', '0'] }
  ];

  function setEquation(text) {
    $('previewBox').setAttribute('data-raw', text || '');
    syncEquation();
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
        try {
          setEquation(ex.eq || '');
          known(ex.known || '');
          ic(!!ex.ic, 0, ex.ic || null);
        } catch (e) { /* ignore */ }
        $('icBody').style.display = $('icCheck').checked ? '' : 'none';
        updatePreview();
        solve();
      });
      wrap.appendChild(b);
    });
  }

  /* ------------------------------ شروع ------------------------------ */
  function init() {
    buildICFields();
    buildExamples();
    syncEquation();
    updatePreview();
    renderEmpty();

    $('nonhomCheck').addEventListener('change', function () {
      $('rhsField').style.display = this.checked ? '' : 'none';
      if (this.checked) { $('rhsInput').focus(); }
      syncEquation();
      updatePreview();
    });
    $('rhsInput').addEventListener('input', function () { syncEquation(); updatePreview(); });
    $('rhsInput').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
    });

    $('icCheck').addEventListener('change', function () {
      $('icBody').style.display = this.checked ? '' : 'none';
    });

    $('previewBox').addEventListener('input', function () { syncEquation(); updatePreview(); });

    $('knownInput').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); solve(); }
    });

    $('solveBtn').addEventListener('click', solve);
    $('resetBtn').addEventListener('click', function () {
      state.order = 2;
      state.icX0 = '0';
      state.icVals = ['', '', '', '', ''];
      state.primaryRes = null;
      setEquation('');
      $('knownInput').value = '';
      $('rhsInput').value = '';
      $('nonhomCheck').checked = false;
      $('rhsField').style.display = 'none';
      $('icCheck').checked = false;
      $('icBody').style.display = 'none';
      buildICFields();
      syncEquation();
      clearErr();
      updatePreview();
      renderEmpty();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var fav = document.getElementById('favicon');
    if (fav) {
      fav.href = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f6feb"/><text x="32" y="45" font-size="38" text-anchor="middle" fill="#fff" font-family="serif">∫</text></svg>');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
