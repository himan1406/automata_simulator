/**
 * Parse the text format into a machine object:
 * { type, start, acc[], out{}, tr[{from,sym,to[],o}], states[], alpha[], err[] }
 * "ε" is the epsilon symbol (written eps, epsilon, ε or λ; a bare "e" is an ordinary symbol).
 */
export function parse(text) {
  const M = { type: 'dfa', start: null, acc: [], out: {}, tr: [], states: [], alpha: [], err: [] };
  const add = s => { if (s && !M.states.includes(s)) M.states.push(s); };
  for (const raw of text.split('\n')) {
    const l = raw.replace(/#.*/, '').trim();
    if (!l) continue;
    let m;
    if ((m = l.match(/^type\s*:\s*(\w+)/i))) M.type = m[1].toLowerCase();
    else if ((m = l.match(/^start\s*:\s*(\S+)/i))) { M.start = m[1]; add(m[1]); }
    else if ((m = l.match(/^accept\s*:\s*(.*)/i))) { M.acc = m[1].split(/[,\s]+/).filter(Boolean); M.acc.forEach(add); }
    else if ((m = l.match(/^out(?:put)?\s+(\S+)\s*=\s*(\S+)/i))) { M.out[m[1]] = m[2]; add(m[1]); }
    else if ((m = l.match(/^(.+?)(?:->|→)(.*)$/))) {
      const L = m[1].split(',').map(x => x.trim());
      const R = m[2].split('/');
      if (L.length < 2 || !L[0] || !L[1]) { M.err.push('Couldn’t read: ' + l); continue; }
      let a = L[1];
      if (/^(eps|epsilon|ε|λ)$/i.test(a)) a = 'ε';
      const to = R[0].split(',').map(x => x.trim()).filter(Boolean);
      add(L[0]); to.forEach(add);
      if (a !== 'ε' && !M.alpha.includes(a)) M.alpha.push(a);
      M.tr.push({ from: L[0], sym: a, to, o: R[1] ? R[1].trim() : null });
    } else M.err.push('Couldn’t read: ' + l);
  }
  if (!M.start) M.start = M.states[0];
  return M;
}

/** Merge transitions into one edge per (from, to) pair with combined labels. */
export function edges(M) {
  const E = {};
  M.tr.forEach(t => t.to.forEach(d => {
    const k = t.from + '\u0001' + d;
    (E[k] = E[k] || { f: t.from, t: d, l: [] }).l.push(t.sym + (t.o != null ? '/' + t.o : ''));
  }));
  return Object.values(E);
}

/** Human-readable problems with the machine (shown above the diagram). */
export function warnings(M) {
  const w = [...M.err];
  if (M.type !== 'nfa') {
    if (M.tr.some(t => t.sym === 'ε')) w.push('ε-transitions need type: nfa.');
    if (M.tr.some(t => t.to.length > 1)) w.push('Some transitions have several targets; that makes it an NFA.');
    M.states.forEach(s => M.alpha.forEach(a => {
      if (!M.tr.some(t => t.from === s && t.sym === a)) w.push(`${s} has no transition on ${a}.`);
    }));
  }
  return w.slice(0, 5);
}
