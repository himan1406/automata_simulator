import { parse } from './parse.js';
import { nfaToDfa, minimize, dfaToText } from './dfa.js';
import { toOutputMachine } from './output.js';

/**
 * Regex syntax: symbols, | (alternation), * + ? (repetition), ( ) grouping,
 * ε or an empty group/branch for the empty string, \x to use a special character literally.
 */
export function parseRegex(src) {
  let i = 0;
  const peek = () => src[i];
  const err = m => { throw new Error(`Regex: ${m} (position ${i + 1})`); };

  function alt() {
    const parts = [cat()];
    while (peek() === '|') { i++; parts.push(cat()); }
    return parts.length === 1 ? parts[0] : { t: 'alt', parts };
  }
  function cat() {
    const parts = [];
    while (i < src.length && peek() !== '|' && peek() !== ')') parts.push(rep());
    return parts.length === 0 ? { t: 'eps' } : parts.length === 1 ? parts[0] : { t: 'cat', parts };
  }
  function rep() {
    let a = atom();
    for (let c; (c = peek()) && '*+?'.includes(c); i++) a = { t: c === '*' ? 'star' : c === '+' ? 'plus' : 'opt', a };
    return a;
  }
  function atom() {
    const c = peek();
    if (c === '(') {
      i++;
      const r = alt();
      if (peek() !== ')') err('missing )');
      i++;
      return r;
    }
    if (c === '*' || c === '+' || c === '?') err(`nothing to repeat before "${c}"`);
    if (c === '\\') { i++; if (i >= src.length) err('dangling \\'); return { t: 'sym', c: src[i++] }; }
    i++;
    return c === 'ε' ? { t: 'eps' } : { t: 'sym', c };
  }

  const ast = alt();
  if (i < src.length) err('unexpected ")"');
  return ast;
}

export function symbolsOf(ast, out = new Set()) {
  if (ast.t === 'sym') out.add(ast.c);
  (ast.parts || []).forEach(p => symbolsOf(p, out));
  if (ast.a) symbolsOf(ast.a, out);
  return out;
}

/** Thompson construction. Start state is always node 0. */
export function thompson(ast) {
  let n = 0;
  const E = [], node = () => n++;
  const build = a => {
    if (a.t === 'eps' || a.t === 'sym') { const s = node(), e = node(); E.push([s, a.t === 'sym' ? a.c : null, e]); return [s, e]; }
    if (a.t === 'cat') {
      let [s, e] = build(a.parts[0]);
      for (const p of a.parts.slice(1)) { const [s2, e2] = build(p); E.push([e, null, s2]); e = e2; }
      return [s, e];
    }
    const s = node(), e = node();
    if (a.t === 'alt') {
      for (const p of a.parts) { const [s2, e2] = build(p); E.push([s, null, s2], [e2, null, e]); }
      return [s, e];
    }
    const [s2, e2] = build(a.a);
    E.push([s, null, s2], [e2, null, e]);
    if (a.t === 'star' || a.t === 'plus') E.push([e2, null, s2]);
    if (a.t === 'star' || a.t === 'opt') E.push([s, null, e]);
    return [s, e];
  };
  const [, end] = build(ast);
  return { E, end };
}

function nfaText({ E, end }, label) {
  const groups = new Map();
  for (const [f, c, t] of E) {
    const sym = c ?? 'eps', k = f + ' ' + sym;
    if (!groups.has(k)) groups.set(k, [f, sym, []]);
    groups.get(k)[2].push(t);
  }
  const lines = ['type: nfa', '# ' + label, 'start: q0', 'accept: q' + end];
  [...groups.values()].sort((x, y) => x[0] - y[0]).forEach(([f, c, ts]) => lines.push(`q${f}, ${c} -> ${ts.map(t => 'q' + t).join(', ')}`));
  return lines.join('\n');
}

/** machine: 'nfa' -> Thompson ε-NFA, 'moore'/'mealy' -> output machine, anything else -> minimal DFA. */
export function fromRegex({ regex, alphabet = 'a, b', machine = 'dfa' }) {
  const src = regex.replace(/\s+/g, '');
  if (!src) throw new Error('Enter a regular expression, e.g. (a|b)*ab');
  const ast = parseRegex(src);
  const syms = symbolsOf(ast);
  for (const c of syms) {
    if (/[#,/]/.test(c)) throw new Error(`The symbol “${c}” can’t be used (reserved by the text format).`);
  }
  const label = regex.trim();
  const nfa = nfaText(thompson(ast), label);
  if (machine === 'nfa') return nfa;
  const extra = [...new Set([...alphabet.split(/[\s,]+/).filter(Boolean), ...syms])];
  const A = minimize(nfaToDfa(parse(nfa), extra));
  if (machine === 'moore' || machine === 'mealy') {
    return toOutputMachine(A, { type: machine, comment: `${label} — output 1 when the string so far matches, else 0` });
  }
  return dfaToText(A, label + '  (minimal DFA)');
}
