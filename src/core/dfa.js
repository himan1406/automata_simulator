/**
 * Internal complete-DFA representation used by the generators and converters:
 * { alpha: string[], start: string, states: string[], acc: string[], d: { [state]: { [sym]: state } } }
 */

export function complement(A) {
  return { ...A, acc: A.states.filter(s => !A.acc.includes(s)) };
}

/** Product construction; A and B must be complete over the same alphabet. mode: 'and' | 'or'. */
export function product(A, B, mode) {
  const alpha = A.alpha, key = (a, b) => a + '|' + b;
  const start = key(A.start, B.start);
  const states = [start], pair = { [start]: [A.start, B.start] }, d = {};
  for (let i = 0; i < states.length; i++) {
    const [a, b] = pair[states[i]];
    d[states[i]] = {};
    for (const c of alpha) {
      const na = A.d[a][c], nb = B.d[b][c], k = key(na, nb);
      if (!(k in pair)) { pair[k] = [na, nb]; states.push(k); }
      d[states[i]][c] = k;
    }
  }
  const ok = (x, y) => (mode === 'and' ? x && y : x || y);
  const acc = states.filter(s => ok(A.acc.includes(pair[s][0]), B.acc.includes(pair[s][1])));
  return { alpha, start, states, acc, d };
}

/** Subset construction (handles ε). Result is complete; unreachable subsets are never created. */
export function nfaToDfa(M, extraAlphabet = []) {
  if (!M.start) throw new Error('The machine has no start state.');
  const alpha = [...new Set([...M.alpha, ...extraAlphabet])];
  if (!alpha.length) throw new Error('The machine has no transitions to convert.');
  const closure = S => {
    const stack = [...S], seen = new Set(S);
    while (stack.length) {
      const s = stack.pop();
      for (const t of M.tr) if (t.from === s && t.sym === 'ε') for (const x of t.to) if (!seen.has(x)) { seen.add(x); stack.push(x); }
    }
    return [...seen].sort();
  };
  const key = S => '{' + S.join(',') + '}';
  const s0 = closure([M.start]);
  const states = [key(s0)], sets = { [key(s0)]: s0 }, d = {};
  for (let i = 0; i < states.length; i++) {
    const k = states[i];
    d[k] = {};
    for (const c of alpha) {
      const next = new Set();
      for (const s of sets[k]) for (const t of M.tr) if (t.from === s && t.sym === c) t.to.forEach(x => next.add(x));
      const T = closure([...next]), kt = key(T);
      if (!(kt in sets)) { sets[kt] = T; states.push(kt); }
      d[k][c] = kt;
    }
  }
  return { alpha, start: states[0], states, acc: states.filter(k => sets[k].some(s => M.acc.includes(s))), d };
}

/**
 * Remove unreachable states, merge equivalent ones (partition refinement) and rename
 * states q0, q1… in breadth-first order. A non-accepting sink is called "qd".
 */
export function minimize(A) {
  const reach = [A.start], seen = new Set(reach);
  for (let i = 0; i < reach.length; i++) {
    for (const c of A.alpha) { const t = A.d[reach[i]][c]; if (!seen.has(t)) { seen.add(t); reach.push(t); } }
  }
  let cls = {};
  reach.forEach(s => { cls[s] = A.acc.includes(s) ? 1 : 0; });
  let count = new Set(Object.values(cls)).size;
  for (;;) {
    const ids = {}, next = {};
    let n = 0;
    for (const s of reach) {
      const k = cls[s] + '#' + A.alpha.map(c => cls[A.d[s][c]]).join(',');
      if (!(k in ids)) ids[k] = n++;
      next[s] = ids[k];
    }
    cls = next;
    if (n === count) break;
    count = n;
  }
  const rep = {};
  reach.forEach(s => { if (!(cls[s] in rep)) rep[cls[s]] = s; });
  const step = (k, c) => cls[A.d[rep[k]][c]];
  const order = [cls[A.start]], inOrder = new Set(order);
  for (let i = 0; i < order.length; i++) {
    for (const c of A.alpha) { const t = step(order[i], c); if (!inOrder.has(t)) { inOrder.add(t); order.push(t); } }
  }
  const accC = new Set(reach.filter(s => A.acc.includes(s)).map(s => cls[s]));
  const sink = order.find(k => !accC.has(k) && A.alpha.every(c => step(k, c) === k));
  const name = {};
  let n = 0;
  order.forEach(k => { name[k] = k === sink ? 'qd' : 'q' + n++; });
  const d = {};
  order.forEach(k => { d[name[k]] = {}; A.alpha.forEach(c => { d[name[k]][c] = name[step(k, c)]; }); });
  return { alpha: A.alpha, start: name[cls[A.start]], states: order.map(k => name[k]), acc: order.filter(k => accC.has(k)).map(k => name[k]), d };
}

export function dfaToText(A, comment, note) {
  const L = ['type: dfa'];
  if (comment) L.push('# ' + comment);
  if (note) L.push('# ' + note);
  L.push('start: ' + A.start);
  if (A.acc.length) L.push('accept: ' + A.acc.join(', '));
  for (const s of A.states) for (const c of A.alpha) L.push(`${s}, ${c} -> ${A.d[s][c]}`);
  return L.join('\n');
}
