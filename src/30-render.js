/* ------------------------------ نمایش ریاضی (HTML) ------------------------------ */
(function (CAS) {
  'use strict';
  const { num, rat, simp, key } = CAS;

  const SUP = { '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '0': '⁰' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function frac(top, bot) {
    return '<span class="frac"><span class="fr-n">' + top + '</span><span class="fr-d">' + bot + '</span></span>';
  }
  function sqrtHtml(inner) {
    return '<span class="sqrt"><span class="sqrt-sign">√</span><span class="sqrt-ovl">' + inner + '</span></span>';
  }

  function numHtml(v, opts) {
    opts = opts || {};
    if (!isFinite(v)) return '?';
    if (Math.abs(v) < 1e-13) return '0';
    const sg = v < 0 ? '−' : '';
    const av = Math.abs(v);
    if (Math.abs(av - Math.round(av)) < 1e-10) return sg + String(Math.round(av));
    if (!opts.compact) {
      const r = rat(av);
      if (r && Math.abs(r.d) <= 24 && Math.abs(r.n) <= 2000) {
        return sg + frac(numHtml(r.n, { compact: true }), numHtml(r.d, { compact: true }));
      }
    }
    return sg + String(Number(av.toPrecision(7)));
  }

  function varHtml(n) {
    switch (n) {
      case 'yp': return '<i>y</i>′';
      case 'ypp': return '<i>y</i>″';
      case 'yppp': return '<i>y</i>‴';
      case 'ypppp': return '<i>y</i>⁗';
      case 'pi': return 'π';
      case 'e': return '<i>e</i>';
      case 'x': case 'y': case 'u': case 'v': case 't': case 's': case 'r':
        return '<i>' + n + '</i>';
      default: return esc(n);
    }
  }

  function signOf(t) {
    if (t.t === 'n') return t.v < 0 ? -1 : 0;
    if (t.t === '*') {
      const nf = t.a.find(x => x.t === 'n');
      if (nf) return nf.v < 0 ? -1 : 0;
    }
    return 0;
  }
  function absTerm(t) {
    if (t.t === 'n' && t.v < 0) return num(-t.v);
    if (t.t === '*') return CAS.simpMul(t.a.map(x => (x.t === 'n' ? num(Math.abs(x.v)) : x)));
    return t;
  }

  function kindOf(e) {
    if (e.t === 'n') return 'num';
    if (e.t === 'v' || e.t === 's') return 'var';
    if (e.t === 'f') return 'fn';
    if (e.t === '^') return 'pow';
    return 'other';
  }

  function joinFactors(fs) {
    let out = '';
    for (let i = 0; i < fs.length; i++) {
      if (i > 0) {
        const p = fs[i - 1].kind, c = fs[i].kind;
        if (p === 'num' || c === 'num') out += '';
        else if (p === 'var' && c === 'var') out += '\u2009';
        else out += '·';
      }
      out += fs[i].html;
    }
    return out;
  }

  function render(e, prec, opts) {
    prec = prec || 0;
    opts = opts || {};
    if (!e) return '0';
    switch (e.t) {
      case 'n': return numHtml(e.v, opts);
      case 'v': return varHtml(e.n);
      case 's': {
        const m = /^C(\d+)$/.exec(e.n);
        if (m) return '<i>C</i><sub>' + m[1] + '</sub>';
        return '<i>' + esc(e.n) + '</i>';
      }
      case '+': {
        let out = '';
        e.a.forEach((t, i) => {
          const sg = signOf(t);
          const body = render(sg < 0 ? absTerm(t) : t, 1, opts);
          if (i === 0) out += (sg < 0 ? '−' : '') + body;
          else out += (sg < 0 ? ' − ' : ' + ') + body;
        });
        return prec > 1 ? '<span class="paren">(</span>' + out + '<span class="paren">)</span>' : out;
      }
      case '*': return renderMul(e, prec, opts);
      case '^': {
        const B = e.b, E = e.e;
        if (E.t === 'n') {
          if (Math.abs(E.v + 1) < 1e-13) {
            if (B.t === 'v' && B.n === 'e') return '<i>e</i><sup>−1</sup>';
            return frac('1', render(B, 2, opts));
          }
          if (E.v < 0 && Number.isInteger(E.v)) {
            if (B.t === 'v' && B.n === 'e') return render(B, 4, opts) + '<sup>' + numHtml(E.v, { compact: true }) + '</sup>';
            return frac('1', render(CAS.pow(B, num(-E.v)), 2, opts));
          }
          if (Math.abs(E.v - 0.5) < 1e-13) return sqrtHtml(render(B, 2, opts));
        }
        const base = render(B, 4, opts);
        const ex = render(E, 0, Object.assign({}, opts, { compact: true }));
        const needParen = B.t === '+' || B.t === '*' || (B.t === 'n' && B.v < 0);
        return (needParen ? '<span class="paren">(</span>' + base + '<span class="paren">)</span>' : base) + '<sup>' + ex + '</sup>';
      }
      case 'f': {
        if (e.f === 'exp') return render(CAS.expNode(e.a), prec, opts);
        if (e.f === 'abs') {
          const inner = render(e.a, 0, opts);
          return '<span class="abs">|' + inner + '|</span>';
        }
        if (e.f === 'ln' && e.a.t === 'f' && e.a.f === 'abs') {
          return '<span class="op">ln</span>' + render(e.a, 2, opts);
        }
        const name = e.f === 'ln' ? 'ln' : e.f;
        return '<span class="fn">' + name + '</span><span class="paren">(</span>' + render(e.a, 0, opts) + '<span class="paren">)</span>';
      }
      case 'int': {
        const inner = render(e.a, 2, opts);
        const wrap = (e.a.t === '+' || e.a.t === '*') && false;
        return '<span class="int">∫</span>' + inner + ' d' + varHtml(e.v);
      }
    }
    return '?';
  }

  function renderMul(e, prec, opts) {
    const fs = e.a;
    let coef = 1;
    const pos = [], neg = [];
    for (const f0 of fs) {
      if (f0.t === 'n') { coef *= f0.v; continue; }
      if (f0.t === '^' && f0.e.t === 'n' && f0.e.v < 0 && Number.isInteger(f0.e.v)) {
        if (!(f0.b.t === 'v' && f0.b.n === 'e')) {
          neg.push({ base: f0.b, exp: -f0.e.v });
          continue;
        }
      }
      pos.push(f0);
    }
    const coefStr = Math.abs(Math.abs(coef) - 1) < 1e-13 ? '' : numHtml(Math.abs(coef), opts);
    const parts = [];
    if (coefStr) parts.push({ html: coefStr, kind: 'num' });
    for (const f0 of pos) {
      parts.push({ html: render(f0, 2, opts), kind: kindOf(f0) });
    }
    let numer;
    if (neg.length === 0) {
      if (parts.length === 0) numer = '1';
      else numer = joinFactors(parts);
    } else {
      const denParts = neg.map(o => ({
        html: Math.abs(o.exp - 1) < 1e-13 ? render(o.base, 2, opts) : render(CAS.pow(o.base, num(o.exp)), 2, opts),
        kind: kindOf(o.base)
      }));
      const numHtml2 = parts.length === 0 ? '1' : joinFactors(parts);
      const denHtml = joinFactors(denParts);
      numer = frac(numHtml2, denHtml);
    }
    const out = coef < 0 ? '−' + numer : numer;
    if (prec > 1 && (e.a.length > 1 || coef < 0)) return '<span class="paren">(</span>' + out + '<span class="paren">)</span>';
    return out;
  }

  CAS.render = (e, opts) => render(simp(e), 0, opts || {});
  CAS.renderRaw = render;
  CAS.fracHtml = frac;
  CAS._signOf = signOf;
  CAS._absTerm = absTerm;
  /* نمایش مجموع با ترتیب دلخواه (برای جواب عمومی: جمله‌های C1، C2، … سپس جواب خصوصی) */
  CAS.renderOrdered = function (terms, opts) {
    opts = opts || {};
    const parts = [];
    for (const t0 of terms) {
      const t = simp(t0);
      if (CAS.isNum(t, 0)) continue;
      if (t.t === '+') { for (const u of t.a) parts.push(u); }
      else parts.push(t);
    }
    let out = '';
    parts.forEach((t, i) => {
      const sg = signOf(t);
      const body = render(sg < 0 ? absTerm(t) : t, 1, opts);
      if (i === 0) out += (sg < 0 ? '−' : '') + body;
      else out += (sg < 0 ? ' − ' : ' + ') + body;
    });
    return out || '0';
  };
})(CAS);
