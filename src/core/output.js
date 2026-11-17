const VALUE = /^[A-Za-z0-9_+-]+$/;

/**
 * Render a complete DFA as a Moore or Mealy machine.
 * A state (Moore) or transition target (Mealy) that accepts gets `out`, every other one gets `other`.
 */
export function toOutputMachine(A, { type, out = '1', other = '0', comment = '' } = {}) {
  if (type !== 'moore' && type !== 'mealy') throw new Error(`“${type}” is not an output machine type.`);
  const val = String(out), alt = String(other);
  if (!VALUE.test(val) || !VALUE.test(alt)) throw new Error('Outputs must be single words or numbers, e.g. 1, 0 or yes.');
  const L = ['type: ' + type];
  if (comment) L.push('# ' + comment);
  L.push('start: ' + A.start);
  if (type === 'moore') A.states.forEach(s => L.push(`out ${s} = ${A.acc.includes(s) ? val : alt}`));
  for (const s of A.states) {
    for (const c of A.alpha) {
      const t = A.d[s][c];
      L.push(type === 'mealy' ? `${s}, ${c} -> ${t} / ${A.acc.includes(t) ? val : alt}` : `${s}, ${c} -> ${t}`);
    }
  }
  return L.join('\n');
}
