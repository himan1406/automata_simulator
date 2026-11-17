import { edges } from './parse.js';

/** Table as plain data: { head: string[], rows: string[][] }. Shared by the HTML view and the CLI. */
export function tableData(M) {
  const cols = [...M.alpha];
  if (M.tr.some(t => t.sym === 'ε')) cols.push('ε');
  const moore = M.type === 'moore';
  const head = ['State', ...cols, ...(moore ? ['Output'] : [])];
  const rows = M.states.map(s => {
    const mark = (s === M.start ? '→ ' : '') + (M.acc.includes(s) ? '* ' : '');
    const cells = cols.map(c => {
      const ts = M.tr.filter(t => t.from === s && t.sym === c);
      const tg = [...new Set(ts.flatMap(t => t.to))];
      const o = ts.length && ts[0].o != null ? ' / ' + ts[0].o : '';
      return !tg.length ? '∅' : (M.type === 'nfa' || tg.length > 1 ? '{' + tg.join(', ') + '}' : tg[0]) + o;
    });
    return [mark + s, ...cells, ...(moore ? [String(M.out[s] ?? '–')] : [])];
  });
  return { head, rows };
}

/** Aligned plain-text table. → marks the start state, * accepting states. */
export function tableText(M) {
  const { head, rows } = tableData(M);
  const all = [head, ...rows];
  const w = head.map((_, i) => Math.max(...all.map(r => r[i].length)));
  const line = r => r.map((c, i) => c.padEnd(w[i])).join(' | ').trimEnd();
  return [line(head), w.map(n => '-'.repeat(n)).join('-+-'), ...rows.map(line)].join('\n');
}

/** One line per edge: "q0 --a, b--> q1" (text stand-in for the diagram). */
export function edgesText(M) {
  return edges(M).map(e => `${e.f} --${e.l.join(', ')}--> ${e.t}`).join('\n');
}
