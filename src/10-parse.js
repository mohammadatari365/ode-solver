/* ------------------------------ تجزیه‌گر ورودی ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, vr, sy, add, mul, pow, fn, sub } = CAS;

  const FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'sqrt', 'abs'];
  const VARS = ['x', 'y', 'yp', 'ypp', 'yppp', 'ypppp', 'e', 'pi', 'u', 'v', 't', 's'];

  function normalize(src) {
    let s = String(src);
    s = s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    s = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    s = s.replace(/[−–—]/g, '-').replace(/[×·∙•]/g, '*').replace(/÷/g, '/');
    s = s.replace(/π/g, 'pi').replace(/√/g, 'sqrt');
    s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
    /* تاگهای مرکب یونیکی (″ ‴ ⁗) را به پرایمهای ساده تبدیل میکنیم */
    s = s.replace(/[″‴⁗]/g, function (m) {
      var n = { '″': 2, '‴': 3, '⁗': 4 }[m] || 1;
      var out = '';
      for (var q = 0; q < n; q++) out += '′';
      return out;
    });
    /* y' → yp , y'' → ypp , ... (همان نامگذاری موتور حل) */
    /* x' = dx/dx = 1 و x'' = 0 (متغیر مستقل است) */
    s = s.replace(/([xy])\s*((?:′|’|'|`)+)/g, function (m, v, marks) {
      var n = marks.length;
      if (v === 'x') return n === 1 ? '(1)' : '(0)';
      var name = 'y';
      for (var q = 0; q < n; q++) name += 'p';
      return name;
    });
    s = s.replace(/\s+/g, '');
    return s;
  }

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i, dot = false;
        while (j < src.length && (/[0-9]/.test(src[j]) || src[j] === '.')) {
          if (src[j] === '.') { if (dot) break; dot = true; }
          j++;
        }
        out.push({ k: 'num', v: parseFloat(src.slice(i, j)) });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
        out.push({ k: 'id', v: src.slice(i, j) });
        i = j;
        continue;
      }
      if ('+-*/^(),|'.includes(c)) { out.push({ k: c }); i++; continue; }
      if (c === '=') { out.push({ k: '=' }); i++; continue; }
      throw new Error('کاراکتر ناشناخته «' + c + '» در ورودی.');
    }
    return out;
  }

  function isFunc(name) { return FUNCS.indexOf(name) >= 0; }
  function isVar(name) { return VARS.indexOf(name) >= 0; }

  /* شناسه‌های به‌هم‌چسبیده مثل 2xsin(x) را به اجزا می‌شکند */
  function identNode(id, toks, pos) {
    if (id === 'log') return { func: 'ln' };
    if (isFunc(id)) return { func: id };
    if (isVar(id)) return { expr: vr(id) };
    if (/^C[1-9]$/.test(id)) return { expr: sy(id) };
    /* تلاش برای شکستن */
    let rest = id;
    const parts = [];
    let guard = 0;
    while (rest.length && guard++ < 20) {
      let matched = false;
      for (const f of FUNCS) {
        if (rest.startsWith(f) && rest.length > f.length) {
          parts.push({ func: f === 'log' ? 'ln' : f });
          rest = rest.slice(f.length);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      for (const v of VARS) {
        if (v.length === 1 && rest.startsWith(v)) {
          parts.push({ expr: vr(v) });
          rest = rest.slice(1);
          matched = true;
          break;
        }
      }
      if (!matched) break;
    }
    if (rest.length || parts.length === 0) {
      throw new Error('عبارت «' + id + '» شناخته نشد. متغیرها: x و y (و y′ برای حالت ضمنی).');
    }
    if (parts.length === 1) return parts[0];
    /* اگر آخرین جزء تابع بود، پرانتز بعدی آرگومان آن است */
    return { pieces: parts };
  }

  function parse(src, opts) {
    opts = opts || {};
    let s = normalize(src);
    if (!s) return num(0);
    let eqSplit = null;
    const eqIdx = s.indexOf('=');
    if (eqIdx >= 0) {
      eqSplit = [s.slice(0, eqIdx), s.slice(eqIdx + 1)];
      s = eqSplit[0];
    }
    if (s === '' || s === '+') s = '0';
    const toks = tokenize(s);
    let pos = 0;

    const peek = () => toks[pos];
    const next = () => toks[pos++];
    const expect = k => {
      if (!peek() || peek().k !== k) throw new Error('انتظار «' + k + '» بود.');
      return next();
    };

    function startsPrimary(t) {
      return t && (t.k === 'num' || t.k === 'id' || t.k === '(' || t.k === '|');
    }

    function buildPiece(p) {
      if (p.expr) return p.expr;
      if (p.func) {
        if (!peek() || peek().k !== '(') throw new Error('تابع ' + p.func + ' باید پرانتز داشته باشد، مثل ' + p.func + '(x).');
        next();
        const arg = parseExpr();
        expect(')');
        return fn(p.func, arg);
      }
      if (p.pieces) {
        let out = null;
        for (let i = 0; i < p.pieces.length; i++) {
          const piece = p.pieces[i];
          let node;
          if (piece.func) {
            if (!peek() || peek().k !== '(') throw new Error('تابع ' + piece.func + ' باید پرانتز داشته باشد.');
            next();
            const arg = parseExpr();
            expect(')');
            node = fn(piece.func, arg);
          } else {
            node = piece.expr;
          }
          out = out === null ? node : mul(out, node);
        }
        return out;
      }
      throw new Error('عبارت نامعتبر.');
    }

    function parsePrimary() {
      const t = peek();
      if (!t) throw new Error('عبارت ناقص است.');
      if (t.k === 'num') { next(); return num(t.v); }
      if (t.k === 'id') { next(); return buildPiece(identNode(t.v, toks, pos)); }
      if (t.k === '(') { next(); const e = parseExpr(); expect(')'); return e; }
      if (t.k === '|') {
        next();
        const e = parseExpr();
        expect('|');
        return fn('abs', e);
      }
      throw new Error('عبارت نامعتبر نزدیک «' + t.k + '».');
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().k === '^') { next(); const ex = parseUnary(); return pow(base, ex); }
      return base;
    }

    function parseUnary() {
      if (peek() && peek().k === '-') { next(); return mul(num(-1), parseUnary()); }
      if (peek() && peek().k === '+') { next(); return parseUnary(); }
      return parsePower();
    }

    function parseTerm() {
      let left = parseUnary();
      while (peek()) {
        const t = peek();
        if (t.k === '*' || t.k === '/') {
          next();
          const right = parseUnary();
          left = t.k === '*' ? mul(left, right) : CAS.div(left, right);
        } else if (startsPrimary(t)) {
          const right = parseUnary();
          left = mul(left, right);
        } else break;
      }
      return left;
    }

    function parseExpr() {
      let left = parseTerm();
      while (peek() && (peek().k === '+' || peek().k === '-')) {
        const op = next().k;
        const right = parseTerm();
        left = op === '+' ? add(left, right) : sub(left, right);
      }
      return left;
    }

    const expr = parseExpr();
    if (pos < toks.length) {
      throw new Error('عبارت اضافی در ورودی: «' + toks.slice(pos).map(t => t.id || t.k).join(' ') + '»');
    }
    if (eqSplit) {
      const right = parse(eqSplit[1], opts);
      return sub(expr, right);
    }
    return expr;
  }

  function tryParse(src) {
    try { return { ok: true, expr: parse(src) }; }
    catch (err) { return { ok: false, error: err.message }; }
  }

  CAS.parse = parse;
  CAS.tryParse = tryParse;
  CAS.normalize = normalize;
})(CAS);
