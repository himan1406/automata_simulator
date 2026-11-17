import { esc } from '../util.js';
import { tableData } from '../core/format.js';

export function tableHTML(M) {
  const { head, rows } = tableData(M);
  return '<table><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>'
    + rows.map(([state, ...cells]) => `<tr><th>${esc(state)}</th>` + cells.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
    + '</table>';
}
