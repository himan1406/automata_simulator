/** ε-closure of a set of states (returns a Set). */
export function epsClosure(M, S) {
  const stack = [...S], seen = new Set(S);
  while (stack.length) {
    const s = stack.pop();
    for (const t of M.tr) {
      if (t.from === s && t.sym === 'ε') {
        for (const d of t.to) if (!seen.has(d)) { seen.add(d); stack.push(d); }
      }
    }
  }
  return seen;
}

/** Does a DFA/NFA (with ε-moves) accept the string? */
export function accepts(M, str) {
  let cur = epsClosure(M, [M.start]);
  for (const c of str) {
    const next = new Set();
    for (const s of cur) for (const t of M.tr) if (t.from === s && t.sym === c) t.to.forEach(d => next.add(d));
    cur = epsClosure(M, [...next]);
  }
  return [...cur].some(s => M.acc.includes(s));
}

/**
 * Step-by-step run, for the "Test a string" panel.
 * Works for DFA/NFA (sets of active states, ε-closed) and Moore/Mealy (one state + output string).
 * Returns { steps: [{ read, active[], output }], accepted, stuckAt, output }.
 * steps[0] is the start; steps[k] is the situation after reading k characters.
 * stuckAt = index of the first character with no transition (null if none).
 */
export function trace(M, str) {
  const chars = [...str], out = M.type === 'moore' || M.type === 'mealy';
  const order = (a, b) => M.states.indexOf(a) - M.states.indexOf(b);
  let cur = out ? [M.start] : [...epsClosure(M, [M.start])].sort(order);
  let output = M.type === 'moore' ? String(M.out[M.start] ?? '') : '';
  const steps = [{ read: null, active: cur, output }];
  let stuckAt = null;
  chars.forEach((c, k) => {
    let next = [];
    if (out) {
      const t = cur.length ? M.tr.find(x => x.from === cur[0] && x.sym === c) : null;
      if (t) { next = [t.to[0]]; output += M.type === 'moore' ? String(M.out[t.to[0]] ?? '') : String(t.o ?? ''); }
    } else {
      const set = new Set();
      for (const s of cur) for (const t of M.tr) if (t.from === s && t.sym === c) t.to.forEach(d => set.add(d));
      next = [...epsClosure(M, [...set])].sort(order);
    }
    if (!next.length && cur.length && stuckAt === null) stuckAt = k;
    cur = next;
    steps.push({ read: c, active: cur, output });
  });
  return { steps, accepted: !out && cur.some(s => M.acc.includes(s)), stuckAt, output };
}

/** Every string over `alpha` (single-character symbols) up to length `max`, shortest first. */
export function allStrings(alpha, max) {
  let cur = [''];
  const out = [''];
  for (let i = 0; i < max; i++) { cur = cur.flatMap(s => alpha.map(c => s + c)); out.push(...cur); }
  return out;
}
