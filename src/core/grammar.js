/**
 * DFA/NFA  -> right-linear grammar (A → aB, A → ε for accepting states; ε-moves become unit productions).
 * Moore/Mealy -> translation grammar with {emit …} actions.
 */
export function grammar(M) {
  const L = ['Start symbol: ' + M.start + (M.type === 'moore' ? '   {emit ' + (M.out[M.start] ?? '–') + '}' : '')];
  M.states.forEach(s => {
    const alts = [];
    M.tr.filter(t => t.from === s).forEach(t => t.to.forEach(d => {
      let x = (t.sym === 'ε' ? '' : t.sym + ' ') + d;
      if (M.type === 'mealy') x += '  {emit ' + t.o + '}';
      if (M.type === 'moore') x += '  {emit ' + (M.out[d] ?? '–') + '}';
      alts.push(x);
    }));
    if (M.acc.includes(s) && (M.type === 'dfa' || M.type === 'nfa')) alts.push('ε');
    L.push(s + ' → ' + (alts.join(' | ') || '∅'));
  });
  if (M.type === 'moore' || M.type === 'mealy') {
    L.push('', '(Output machines don’t accept a language, so this is a translation grammar: each production also emits the output in braces.)');
  }
  return L.join('\n');
}
