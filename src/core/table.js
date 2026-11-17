/**
 * Read a transition table and return machine text.
 *
 *   State    a     b
 *   ->  q0   q1    q0
 *       q1   q1    q2
 *   *   q2   q1    q0
 *
 * The first row names the symbols; every later row starts with a state, marked `->` (start) and/or `*` (accept).
 * Cells may hold several targets (`q1,q2`, an NFA), `eps`/`ε` in a column, or `q1/1` (Mealy output).
 * A column called Output/Out makes a Moore machine instead.
 */
const HEADER = /^(?:state|states|s|δ|delta|transition|transitions)?$/i;
const OUTPUT = /^(?:out|output|outputs|o)$/i;
const MARKERS = /^(?:(?:->|→)\*?|\*(?:->|→)?)$/;
const BAD = /[\s,|/#]/;
const EPS = /^(?:eps|epsilon|ε|λ)$/i;

const wide = l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(/\s*\|\s*|\t+|\s{2,}/).map(c => c.trim());
const fine = l => l.trim().split(/\s+/);
// single-space tables: keep a leading marker attached to its state ("-> q0" is one cell)
const fineCells = l => {
  const t = fine(l);
  while (t.length > 1 && MARKERS.test(t[0])) t.splice(0, 2, t[0] + t[1]);
  return t;
};

function targetsOf(cell) {
  if (!cell || /^[-–—∅]$/.test(cell)) return [];
  return cell.replace(/^\{/, '').replace(/\}$/, '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(t => {
    const i = t.indexOf('/');
    return i < 0 ? { to: t, o: null } : { to: t.slice(0, i).trim(), o: t.slice(i + 1).trim() || null };
  });
}

export function parseTable(input) {
  const lines = String(input).split('\n')
    .map(l => l.replace(/#.*/, '').trim())
    .filter(l => l && !/^[\s|:-]+$/.test(l));
  if (!lines.length) throw new Error('The table is empty. Start with a header row like “State  a  b”.');

  let head = wide(lines[0]);
  if (!(head.length >= 2 && HEADER.test(head[0]))) {
    const f = fine(lines[0]);
    if (f.length >= 2 && HEADER.test(f[0])) head = f;
    else throw new Error('The first row must name the symbols, e.g. “State  a  b”.');
  }
  const cols = head.length;
  let outCol = -1;
  const symbols = head.slice(1).map((c, k) => {
    if (OUTPUT.test(c)) { outCol = k + 1; return null; }
    return EPS.test(c) ? 'ε' : c;
  });
  const real = symbols.filter(s => s !== null);
  if (real.some(s => !s || BAD.test(s))) throw new Error('Symbol columns must be single symbols (no spaces, commas, / or #).');
  if (new Set(real).size !== real.length) throw new Error('Two columns use the same symbol.');

  const rows = [], seen = new Set();
  for (let n = 1; n < lines.length; n++) {
    let cells = wide(lines[n]);
    // a separate marker column ("->" / "*" on its own) joined onto the state cell
    if (cells.length === cols + 1 && MARKERS.test(cells[0])) cells = [cells[0] + cells[1], ...cells.slice(2)];
    if (cells.length !== cols) {
      const f = fineCells(lines[n]);
      if (f.length === cols) cells = f;
      else {
        if (f.length > cells.length) cells = f;
        if (cells.length < cols) while (cells.length < cols) cells.push('');
        else throw new Error(`Row ${n + 1}: expected ${cols} columns, found ${cells.length}.`);
      }
    }

    let label = cells[0], start = false, acc = false;
    for (let k = 0; k < 4; k++) {
      if (/^(?:->|→)/.test(label)) { start = true; label = label.replace(/^(?:->|→)/, '').trim(); }
      else if (label.startsWith('*')) { acc = true; label = label.slice(1).trim(); }
      else break;
    }
    if (!label) throw new Error(`Row ${n + 1}: the state name is missing.`);
    if (BAD.test(label)) throw new Error(`“${label}” can’t be a state name (no spaces, commas, / or #).`);
    if (seen.has(label)) throw new Error(`The state “${label}” has more than one row.`);
    seen.add(label);

    const row = { label, start, acc, out: null, trans: [] };
    for (let c = 1; c < cols; c++) {
      if (c === outCol) {
        const o = (cells[c] || '').trim();
        if (!o) throw new Error(`Row “${label}” needs an output value.`);
        row.out = o;
        continue;
      }
      const targets = targetsOf(cells[c]);
      if (targets.some(t => !t.to || BAD.test(t.to))) throw new Error(`Row “${label}”: “${cells[c]}” isn’t a state (no spaces, commas, / or #).`);
      if (targets.length > 1 && targets.some(t => t.o)) throw new Error(`Row “${label}”: a cell can’t hold several targets with outputs.`);
      row.trans.push({ sym: symbols[c - 1], targets });
    }
    rows.push(row);
  }

  const hasOut = rows.some(r => r.trans.some(t => t.targets.some(x => x.o)));
  if (outCol >= 0 && hasOut) throw new Error('Use either an Output column (Moore) or “state/output” cells (Mealy), not both.');
  const multi = rows.some(r => r.trans.some(t => t.targets.length > 1));
  const type = hasOut ? 'mealy' : outCol >= 0 ? 'moore' : (real.includes('ε') || multi) ? 'nfa' : 'dfa';

  const starts = rows.filter(r => r.start);
  if (!starts.length) throw new Error('Mark the start state with “->”, e.g. “-> q0”.');
  if (starts.length > 1) throw new Error('Only one state can be the start state.');

  const L = ['type: ' + type, '# read from a transition table', 'start: ' + starts[0].label];
  const acc = rows.filter(r => r.acc).map(r => r.label);
  if (acc.length) L.push('accept: ' + acc.join(', '));
  if (type === 'moore') rows.forEach(r => L.push(`out ${r.label} = ${r.out}`));
  rows.forEach(r => r.trans.forEach(t => {
    if (!t.targets.length) return;
    const o = t.targets[0].o;
    L.push(`${r.label}, ${t.sym} -> ${t.targets.map(x => x.to).join(', ')}${o ? ' / ' + o : ''}`);
  }));
  return L.join('\n');
}
