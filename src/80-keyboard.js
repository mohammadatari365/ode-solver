/* ============================================================
   صفحه کلید ریاضی داخلی — ساختارهای تصویری + نیازی به کیبورد دستگاه
   ============================================================ */
(function () {
  'use strict';
  var YNAMES = ['y', "y'", "y''", "y'''", "y''''"];

  var dock = document.getElementById('kbDock');
  var toggle = document.getElementById('kbToggle');
  var openBtn = document.getElementById('kbOpenBtn');
  var closeBtn = document.getElementById('kbClose');
  var solveBtn = document.getElementById('kbSolve');
  var keys = document.getElementById('kbKeys');
  var targetLabel = document.getElementById('kbTarget');
  var composer = document.getElementById('kbComposer');
  var compBody = document.getElementById('kbCompBody');
  var compTitle = document.getElementById('kbCompTitle');
  var compInsert = document.getElementById('kbCompInsert');
  var compCancel = document.getElementById('kbCompCancel');
  var compClose = document.getElementById('kbCompClose');
  if (!dock || !keys) return;

  var active = null;
  var selStart = 0;
  var selEnd = 0;
  var coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    (navigator.maxTouchPoints || 0) > 0;

  var returnTarget = null;
  var returnStart = 0;
  var returnEnd = 0;
  var compType = null;
  var selectedFn = 'exp';

  var TITLES = {
    power: 'توان — عبارت بالا نوشته می‌شود',
    frac: 'کسر — صورت بالا و مخرج پایین',
    sqrt: 'ریشه — عبارت داخل رادیکال',
    abs: 'قدر مطلق',
    paren: 'پرانتز',
    func: 'تابع — ورودی داخل پرانتز'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isField(el) {
    if (!el || el.disabled) return false;
    return !!(el.classList && el.classList.contains('math-input')) ||
      !!(el.getAttribute && el.getAttribute('data-math-field') === '1');
  }
  function visible(el) {
    return !!(el && !el.disabled && el.offsetParent !== null);
  }
  function allFields() {
    return Array.prototype.slice.call(document.querySelectorAll('.math-input, [data-math-field="1"]'));
  }
  function fieldValue(el) {
    if (!el) return '';
    if (el.getAttribute && el.getAttribute('data-math-field') === '1') {
      return el.getAttribute('data-raw') || '';
    }
    return String(el.value || '');
  }
  function setFieldValue(el, v) {
    var text = String(v == null ? '' : v);
    if (el.getAttribute && el.getAttribute('data-math-field') === '1') {
      el.setAttribute('data-raw', text);
    } else {
      el.value = text;
    }
  }
  function firstVisible() {
    var list = allFields();
    for (var i = 0; i < list.length; i++) if (visible(list[i])) return list[i];
    return null;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function saveSel() {
    if (!active) return;
    try {
      var s = active.selectionStart, e = active.selectionEnd;
      if (typeof s === 'number' && typeof e === 'number') { selStart = s; selEnd = e; }
    } catch (_) { /* برخی مرورگرها روی برخی فیلدها محدودیت دارند */ }
  }

  function labelFor(inp) {
    var lab = inp.getAttribute && inp.getAttribute('data-label');
    if (lab) return lab;
    var id = inp.id || '';
    if (id === 'rhsInput') return 'سمت راست معادله';
    if (id === 'previewBox') return 'نمایش عبارت معادله';
    if (id === 'ic-x0') return 'x₀';
    if (id.indexOf('ic-') === 0) {
      var j = Number(id.slice(3));
      return (YNAMES[j] || ('y' + j)) + '(x₀)';
    }
    if (id === 'knownInput') return 'جواب معلوم';
    return 'فیلد ورودی';
  }

  function refreshTarget() {
    if (targetLabel) targetLabel.textContent = active ? labelFor(active) : 'فیلدی را انتخاب کنید';
  }

  function pickTarget() {
    var ae = document.activeElement;
    if (isField(ae)) { active = ae; saveSel(); }
    if (!active || !document.contains(active) || !visible(active)) {
      var f = firstVisible();
      active = f;
      selStart = selEnd = f ? fieldValue(f).length : 0;
    }
    refreshTarget();
    return active;
  }

  function focusActive() {
    if (!active) return;
    try { active.focus({ preventScroll: true }); } catch (_) { active.focus(); }
    try { active.setSelectionRange(selStart, selEnd); } catch (_) { /* نادیده */ }
  }

  function fireInput(inp) {
    try {
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {
      var ev = document.createEvent('Event');
      ev.initEvent('input', true, true);
      inp.dispatchEvent(ev);
    }
  }

  function insertText(inp, text, caretOffset) {
    if (!inp) return;
    active = inp;
    focusActive();
    var cur = fieldValue(inp);
    var s = clamp(selStart, 0, cur.length);
    var e = clamp(selEnd, s, cur.length);
    var next = cur.charAt(s);
    var closers = [')', ']', '}', '|'];
    var operators = ['+', '-', '*', '/', '^', '=', ','];
    if (s === e && closers.indexOf(next) >= 0) {
      if (text === next) {
        selStart = selEnd = s + 1;
        try { inp.setSelectionRange(s + 1, s + 1); } catch (_) { /* نادیده */ }
        refreshTarget();
        return;
      }
      if (operators.indexOf(text.charAt(0)) >= 0) {
        var skip = 1;
        if (next === ')' && cur.charAt(s + 1) === '/' && cur.charAt(s + 2) === '(') skip = 3;
        else if (next === ')' && cur.charAt(s + 1) === '/') skip = 2;
        s = e = Math.min(cur.length, s + skip);
      }
    }
    var before = cur.slice(0, s);
    var after = cur.slice(e);
    setFieldValue(inp, before + text + after);
    var pos = clamp(s + text.length + (caretOffset || 0), 0, fieldValue(inp).length);
    selStart = selEnd = pos;
    try { inp.setSelectionRange(pos, pos); } catch (_) { /* نادیده */ }
    refreshTarget();
    fireInput(inp);
  }

  function insert(text, caretOffset) {
    var inp = pickTarget();
    if (inp) insertText(inp, text, caretOffset);
  }

  function edit(action) {
    var inp = pickTarget();
    if (!inp) return;
    focusActive();
    var s = clamp(selStart, 0, fieldValue(inp).length);
    var e = clamp(selEnd, s, fieldValue(inp).length);
    var v = fieldValue(inp);
    var pos = s;
    var changed = false;

    switch (action) {
      case 'back':
        if (e > s) { v = v.slice(0, s) + v.slice(e); pos = s; }
        else if (s > 0) { v = v.slice(0, s - 1) + v.slice(s); pos = s - 1; }
        changed = true;
        break;
      case 'delete':
        if (e > s) { v = v.slice(0, s) + v.slice(e); }
        else if (s < v.length) { v = v.slice(0, s) + v.slice(s + 1); }
        changed = true;
        break;
      case 'clear':
        v = ''; pos = 0; changed = true;
        break;
      case 'left':
        pos = (e > s) ? s : Math.max(0, s - 1);
        break;
      case 'right':
        pos = (e > s) ? e : Math.min(v.length, s + 1);
        break;
      case 'home':
        pos = 0;
        break;
      case 'end':
        pos = v.length;
        break;
    }

    if (changed) setFieldValue(inp, v);
    selStart = selEnd = pos;
    try { inp.setSelectionRange(pos, pos); } catch (_) { /* نادیده */ }
    refreshTarget();
    if (changed) fireInput(inp);
  }

  /* ---------------------------- ساختارهای تصویری ---------------------------- */
  function slot(slotName, label, value, cls) {
    return '<input type="text" class="math-input tpl-slot ' + (cls || '') + '" ' +
      'data-slot="' + slotName + '" data-label="' + esc(label) + '" ' +
      'dir="ltr" inputmode="none" spellcheck="false" value="' + esc(value) + '" placeholder="' + esc(label) + '">';
  }

  function templateHtml(type) {
    switch (type) {
      case 'power':
        return '<div class="tpl-row tpl-power">' +
          slot('base', 'پایه', 'x') +
          '<span class="tpl-caret">^</span>' +
          '<span class="tpl-sup">' + slot('exp', 'توان', '2', 'tpl-small') + '</span>' +
          '</div>';
      case 'frac':
        return '<div class="tpl-row tpl-frac">' +
          slot('num', 'صورت', '1') +
          '<div class="tpl-line"></div>' +
          slot('den', 'مخرج', 'x') +
          '</div>';
      case 'sqrt':
        return '<div class="tpl-row tpl-sqrt">' +
          '<span class="tpl-radical">√</span>' +
          slot('arg', 'زیر ریشه', 'x', 'tpl-root') +
          '</div>';
      case 'abs':
        return '<div class="tpl-row tpl-abs"><span class="tpl-caret">|</span>' +
          slot('arg', 'داخل قدر مطلق', 'x') +
          '<span class="tpl-caret">|</span></div>';
      case 'paren':
        return '<div class="tpl-row tpl-paren"><span class="tpl-caret">(</span>' +
          slot('arg', 'داخل پرانتز', 'x') +
          '<span class="tpl-caret">)</span></div>';
      case 'func':
        return '<div class="tpl-row" style="flex-direction:column">' +
          '<div class="tpl-fnbtns">' +
          ['exp', 'ln', 'sin', 'cos', 'tan'].map(function (f) {
            return '<button type="button" class="tpl-fn' + (f === selectedFn ? ' active' : '') + '" data-fn="' + f + '">' + f + '</button>';
          }).join('') +
          '</div>' +
          '<div class="tpl-row tpl-funcbody">' +
          '<span class="tpl-fnname">' + selectedFn + '</span>' +
          '<span class="tpl-caret">(</span>' +
          slot('arg', 'ورودی تابع', 'x') +
          '<span class="tpl-caret">)</span>' +
          '</div></div>';
    }
    return '';
  }

  function openComposer(type) {
    if (!composer || !compBody || !TITLES[type]) return;
    if (compType) closeComposer(true);
    var target = pickTarget();
    if (!target) return;
    returnTarget = target;
    returnStart = selStart;
    returnEnd = selEnd;
    compType = type;
    if (compTitle) compTitle.textContent = TITLES[type];
    compBody.innerHTML = templateHtml(type);
    composer.hidden = false;
    var first = compBody.querySelector('.tpl-slot');
    if (first) {
      active = first;
      selStart = selEnd = first.value.length;
      focusActive();
    }
    refreshTarget();
  }

  function closeComposer(silent) {
    if (!composer) return;
    composer.hidden = true;
    compType = null;
    if (!silent && returnTarget && document.contains(returnTarget)) {
      active = returnTarget;
      selStart = returnStart;
      selEnd = returnEnd;
      focusActive();
    }
    returnTarget = null;
    refreshTarget();
  }

  function wrapExpr(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return '';
    if (/^[A-Za-z0-9.]+$/.test(s)) return s;
    if (/^(sin|cos|tan|exp|ln|sqrt|abs)\([^()]*\)$/.test(s)) return s;
    if (/^\|[^|]*\|$/.test(s)) return s;
    return '(' + s + ')';
  }

  function insertComposed() {
    if (!compType || !returnTarget || !compBody) { closeComposer(); return; }
    var vals = {};
    Array.prototype.forEach.call(compBody.querySelectorAll('[data-slot]'), function (el) {
      vals[el.getAttribute('data-slot')] = String(el.value || '').trim();
    });
    var text = '';
    if (compType === 'power') {
      if (vals.base && vals.exp) text = wrapExpr(vals.base) + '^' + wrapExpr(vals.exp);
      else text = vals.base || vals.exp || '';
    } else if (compType === 'frac') {
      if (vals.num && vals.den) text = wrapExpr(vals.num) + '/' + wrapExpr(vals.den);
      else text = vals.num || vals.den || '';
    } else if (compType === 'sqrt') {
      text = 'sqrt(' + (vals.arg || 'x') + ')';
    } else if (compType === 'abs') {
      text = '|' + (vals.arg || '') + '|';
    } else if (compType === 'paren') {
      text = '(' + (vals.arg || '') + ')';
    } else if (compType === 'func') {
      text = selectedFn + '(' + (vals.arg || 'x') + ')';
    }

    var target = returnTarget;
    var s = returnStart;
    var e = returnEnd;
    returnTarget = null;
    compType = null;
    if (composer) composer.hidden = true;
    active = target;
    selStart = s;
    selEnd = e;
    focusActive();
    if (text) insertText(active, text, 0);
    else refreshTarget();
  }

  function measure() {
    document.documentElement.style.setProperty('--kb-h', dock.offsetHeight + 'px');
  }
  function isOpen() { return !dock.hidden; }
  function openKb() {
    dock.hidden = false;
    document.body.classList.add('kb-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    measure();
    pickTarget();
    if (active) focusActive();
  }
  function closeKb() {
    if (compType) {
      if (composer) composer.hidden = true;
      compType = null;
      returnTarget = null;
    }
    dock.hidden = true;
    document.body.classList.remove('kb-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  function toggleKb() { if (isOpen()) closeKb(); else openKb(); }

  function runSolve() {
    var sb = document.getElementById('solveBtn');
    if (sb && !sb.disabled) sb.click();
  }

  keys.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!b || !keys.contains(b)) return;
    var po = b.getAttribute('data-prime-order');
    if (po != null) {
      var n = clamp(parseInt(po, 10) || 1, 1, 4);
      var v = b.getAttribute('data-prime-var') === 'x' ? 'x' : 'y';
      var marks = '';
      for (var i = 0; i < n; i++) marks += "'";
      insert(v + marks);
      Array.prototype.forEach.call(keys.querySelectorAll('.kb-prime-host.open'), function (h) {
        h.classList.remove('open');
      });
      return;
    }
    var tpl = b.getAttribute('data-tpl');
    if (tpl) { openComposer(tpl); return; }
    var act = b.getAttribute('data-act');
    if (act) { edit(act); return; }
    var text = b.getAttribute('data-ins');
    if (text == null) return;
    var caret = parseInt(b.getAttribute('data-caret') || '0', 10);
    insert(text, isNaN(caret) ? 0 : caret);
  });

  /* نگه داشتن طولانی روی x / y هم منوی مشتق را باز میکند (برای لمسی) */
  var pressTimer = null;
  keys.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse') return;
    var host = ev.target && ev.target.closest ? ev.target.closest('.kb-prime-host') : null;
    if (!host) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () { host.classList.add('open'); }, 320);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
    keys.addEventListener(name, function () { clearTimeout(pressTimer); });
  });
  document.addEventListener('pointerdown', function (ev) {
    if (keys.contains(ev.target)) return;
    Array.prototype.forEach.call(keys.querySelectorAll('.kb-prime-host.open'), function (h) {
      h.classList.remove('open');
    });
  });

  if (compBody) {
    compBody.addEventListener('click', function (ev) {
      var fb = ev.target && ev.target.closest ? ev.target.closest('.tpl-fn') : null;
      if (!fb) return;
      selectedFn = fb.getAttribute('data-fn') || 'exp';
      Array.prototype.forEach.call(compBody.querySelectorAll('.tpl-fn'), function (b) {
        b.classList.toggle('active', b === fb);
      });
      var name = compBody.querySelector('.tpl-fnname');
      if (name) name.textContent = selectedFn;
      var arg = compBody.querySelector('[data-slot="arg"]');
      if (arg) { active = arg; selStart = selEnd = arg.value.length; focusActive(); refreshTarget(); }
    });
    compBody.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        insertComposed();
      }
    });
  }
  if (compInsert) compInsert.addEventListener('click', insertComposed);
  if (compCancel) compCancel.addEventListener('click', function () { closeComposer(); });
  if (compClose) compClose.addEventListener('click', function () { closeComposer(); });

  document.addEventListener('focusin', function (ev) {
    if (!isField(ev.target)) return;
    if (compType && composer && !composer.contains(ev.target)) {
      if (composer) composer.hidden = true;
      compType = null;
      returnTarget = null;
    }
    active = ev.target;
    saveSel();
    refreshTarget();
    if (coarse && !isOpen()) openKb();
  }, true);

  ['keyup', 'mouseup', 'select', 'input', 'click'].forEach(function (name) {
    document.addEventListener(name, function (ev) {
      if (isField(ev.target)) { active = ev.target; saveSel(); refreshTarget(); }
    }, true);
  });

  window.addEventListener('resize', function () { if (isOpen()) measure(); });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (compType) { ev.preventDefault(); closeComposer(); }
      else if (isOpen()) { ev.preventDefault(); closeKb(); }
      return;
    }
    if (ev.altKey && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); toggleKb(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      runSolve();
    }
  });

  if (toggle) toggle.addEventListener('click', toggleKb);
  if (openBtn) openBtn.addEventListener('click', openKb);
  if (closeBtn) closeBtn.addEventListener('click', closeKb);
  if (solveBtn) solveBtn.addEventListener('click', function () {
    runSolve();
    if (coarse) closeKb();
  });

  /* صفحه کلید بهطور پیشفرض روی صفحه باز است */
  openKb();
  measure();
  refreshTarget();
})();
