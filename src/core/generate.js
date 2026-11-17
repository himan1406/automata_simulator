import { complement, product, minimize, dfaToText } from './dfa.js';
import { toOutputMachine } from './output.js';

const HELP = 'Try “ends with ab”, “starts with ba”, “contains aab”, “even number of a”, and join clauses with and / or. For an output machine say what to emit, e.g. “moore: 1 when ends with ab, else 0”.';
const NEG = /\bnot\b|n't\b|\bnever\b|\bwithout\b/i;
const KINDS = [
  ['end', /\b(?:end|ends|ending)\b/i],
  ['start', /\b(?:start|starts|starting|begin|begins|beginning)\b/i],
  ['has', /\b(?:contain|contains|containing|substring|has|have|includes?)\b/i],
];
const UNSUPPORTED = /\b(?:followed by|then|before|after|twice|exactly|at least|at most|more than|fewer|length)\b/i;
const STOP = /^(?:with|by|of|in|that|which|string|strings|word|words|and|or)$/i;
const MY = '([^\\s,"\']+)';
// "moore: 1 when ends with ab, else 0" / "mealy machine that emits Y if starts with a"
const OUT = new RegExp(
  `^(moore|mealy)(?:\\s+machine)?\\s*(?:that|which)?\\s*[:,]?\\s*` +
  `(?:outputs?|emits?|prints?|writes?|gives?|produces?)?\\s*["']?${MY}["']?\\s+` +
  `(?:when|whenever|if|for|on|after)\\s+(.+?)(?:\\s*,?\\s*(?:else|otherwise)\\s+["']?${MY}["']?)?$`, 'i');
const tidy = t => t.replace(/^["']+/, '').replace(/["'.,;!?]+$/, '');
const norm = t => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
const TYPES = ['dfa', 'nfa', 'moore', 'mealy'];

/** Split "moore: 1 when ends with ab, else 0" into { type, out, other, rest }. */
function outputPrompt(desc) {
  const m = norm(desc).replace(/[.!?]+$/, '').match(OUT);
  if (!m) return null;
  const rest = m[3].trim();
  return rest ? { type: m[1].toLowerCase(), out: m[2], other: m[4], rest } : null;
}

function parseClause(clause, prev) {
  const neg = NEG.test(clause);
  const par = clause.match(/\b(even|odd)\s+(?:number|count|amount)\s+of\s+(\S+)\s*$/i);
  if (par) {
    let s = tidy(par[2]).replace(/'s$/i, '');
    if (s.length === 2 && /s$/i.test(s)) s = s[0];
    if (s.length !== 1) throw new Error('Say which single symbol to count, e.g. “even number of a”.');
    return { kind: 'parity', odd: par[1].toLowerCase() === 'odd', sym: s, neg };
  }
  const hit = KINDS.find(([, re]) => re.test(clause));
  const words = clause.trim().split(/\s+/);
  const pat = tidy(words[words.length - 1]);
  const bad = () => new Error(`Couldn’t read “${clause}”. ${HELP}`);
  if (!/^[A-Za-z0-9]+$/.test(pat) || STOP.test(pat) || KINDS.some(([, re]) => re.test(pat))) throw bad();
  if (hit) return { kind: hit[0], pat, neg };
  // "contains aa or bb": a bare pattern reuses the previous clause's kind
  if (prev && prev.kind !== 'parity' && words.length === 1) return { kind: prev.kind, pat, neg: false };
  throw bad();
}

function clauseDFA(cl, alpha) {
  if (cl.kind === 'parity') {
    const d = { q0: {}, q1: {} };
    for (const a of alpha) { d.q0[a] = a === cl.sym ? 'q1' : 'q0'; d.q1[a] = a === cl.sym ? 'q0' : 'q1'; }
    return { alpha, start: 'q0', states: ['q0', 'q1'], acc: [cl.odd ? 'q1' : 'q0'], d };
  }
  const p = cl.pat.split(''), n = p.length;
  // delta(i, c): longest prefix of the pattern that is a suffix of (pattern[0..i) + c)
  const D = (i, c) => {
    if (cl.kind === 'start') return i < 0 ? -1 : i === n ? n : (p[i] === c ? i + 1 : -1);
    if (cl.kind === 'has' && i === n) return n;
    const s = p.slice(0, i).join('') + c;
    for (let k = Math.min(n, s.length); k >= 0; k--) if (s.endsWith(p.slice(0, k).join(''))) return k;
  };
  const nm = i => (i < 0 ? 'qdead' : 'q' + i);
  const idx = [...Array(n + 1).keys()];
  if (cl.kind === 'start') idx.push(-1);
  const d = {};
  idx.forEach(i => { d[nm(i)] = {}; alpha.forEach(c => { d[nm(i)][c] = nm(D(i, c)); }); });
  return { alpha, start: 'q0', states: idx.map(nm), acc: ['q' + n], d };
}

function nfaText(cl, al, desc) {
  const p = cl.pat.split(''), n = p.length, T = [];
  if (cl.kind === 'start') {
    for (let i = 0; i < n; i++) T.push([i, p[i], [i + 1]]);
  } else {
    al.forEach(c => T.push([0, c, c === p[0] ? [0, 1] : [0]]));
    for (let i = 1; i < n; i++) T.push([i, p[i], [i + 1]]);
  }
  if (cl.kind !== 'end') al.forEach(c => T.push([n, c, [n]]));
  return ['type: nfa', '# ' + desc.trim(), 'start: q0', 'accept: q' + n,
    ...T.map(([i, c, t]) => `q${i}, ${c} -> ${t.map(x => 'q' + x).join(', ')}`)].join('\n');
}

/**
 * Build machine text from a plain-English description.
 * Clauses: "ends with X", "starts with X", "contains X", "even/odd number of X", each optionally negated,
 * joined with "and" or "or" (not mixed).
 * Prefix the description with "moore:" or "mealy:" and an output, e.g.
 * "moore: 1 when ends with ab, else 0", to get a machine that emits values instead of accepting.
 * Throws an Error with a user-facing message when unsure.
 */
export function generate({ desc, alphabet = 'a, b', machine = 'dfa' }) {
  if (/[\r\n]/.test(desc)) throw new Error('Keep the description on one line.');
  const out = outputPrompt(desc);
  const type = out ? out.type : machine;
  if (!TYPES.includes(type)) throw new Error(`Unknown machine type “${type}”. Use dfa, nfa, moore or mealy.`);
  const text = (out ? out.rest : norm(desc)).replace(/[.!?]+$/, '');
  if (!text) throw new Error(HELP);
  if (UNSUPPORTED.test(text)) throw new Error(`That kind of condition isn’t supported yet. ${HELP}`);
  const parts = text.split(/\s+(and|or)\s+/i);
  const conns = parts.filter((_, i) => i % 2).map(s => s.toLowerCase());
  if (new Set(conns).size > 1) throw new Error('Mixing “and” and “or” isn’t supported yet; use one at a time.');
  const clauses = [];
  parts.filter((_, i) => i % 2 === 0).forEach(c => clauses.push(parseClause(c, clauses[clauses.length - 1])));

  const al = [...new Set([
    ...alphabet.split(/[\s,]+/).filter(Boolean),
    ...clauses.flatMap(c => (c.kind === 'parity' ? [c.sym] : c.pat.split(''))),
  ])];
  if (type === 'nfa' && clauses.length === 1 && !clauses[0].neg && clauses[0].kind !== 'parity') {
    return nfaText(clauses[0], al, text);
  }
  const dfa = clauses
    .map(c => { const A = clauseDFA(c, al); return c.neg ? complement(A) : A; })
    .reduce((a, b) => product(a, b, conns[0]));
  const A = minimize(dfa);
  if (type === 'moore' || type === 'mealy') {
    const yes = out ? out.out : '1';
    const no = out && out.other ? out.other : (yes === '0' ? '1' : '0');
    const comment = `output ${yes} when ${text}, else ${no}`;
    return toOutputMachine(A, { type, out: yes, other: no, comment });
  }
  const note = type === 'nfa' ? 'NFA form only exists for one positive ends/starts/contains clause, so this is a minimal DFA' : null;
  return dfaToText(A, text, note);
}
