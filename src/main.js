import './style.css';
import { parse, warnings } from './core/parse.js';
import { parseTable } from './core/table.js';
import { generate } from './core/generate.js';
import { fromRegex } from './core/regex.js';
import { nfaToDfa, minimize, dfaToText } from './core/dfa.js';
import { grammar } from './core/grammar.js';
import { diagramSVG } from './render/diagram.js';
import { tableHTML } from './render/table.js';
import { esc } from './util.js';
import { EXAMPLES, PROBES, TABLE_EXAMPLE } from './examples.js';
import { trace } from './core/simulate.js';

const $ = id => document.getElementById(id);

// The editor holds machine text, except in "Transition table" mode where it holds a table.
const source = () => ($('mode').value === 'table' ? parseTable($('src').value) : $('src').value);

function render() {
  let M;
  try { M = parse(source()); } catch (e) {
    $('warn').innerHTML = `<p class="warn">${esc(e.message)}</p>`;
    return;
  }
  $('badge').textContent = M.type.toUpperCase();
  if ([...$('mt').options].some(o => o.value === M.type)) $('mt').value = M.type;
  $('warn').innerHTML = warnings(M).map(x => `<p class="warn">${esc(x)}</p>`).join('');
  $('tab').innerHTML = tableHTML(M);
  $('gra').textContent = grammar(M);
  probeReset(M); // also (re)draws the diagram
}

// ---- Test a string: step through a run and highlight the active states in the diagram
const probe = { M: null, run: null, i: 0, timer: null };
const probeStr = () => $('probe').value.trim();
const stateSet = a => (a.length ? '{' + a.join(', ') + '}' : '∅');

function stopPlay() {
  clearInterval(probe.timer);
  probe.timer = null;
  $('pplay').textContent = 'Play';
}

function probeReset(M) {
  stopPlay();
  probe.M = M;
  probe.i = 0;
  const multi = M.alpha.some(a => [...a].length > 1);
  probe.run = M.start && !multi && ['dfa', 'nfa', 'moore', 'mealy'].includes(M.type) ? trace(M, probeStr()) : null;
  drawProbe();
}

function drawProbe() {
  const { M, run, i } = probe;
  const step = run && run.steps[i];
  $('dia').innerHTML = diagramSVG(M, step ? step.active : []);
  const v = $('pverdict');
  if (!run) {
    $('tape').innerHTML = '';
    $('pstat').textContent = '';
    v.className = 'verdict';
    v.textContent = M.alpha.some(a => [...a].length > 1) ? 'The string tester needs single-character symbols.' : 'Add a start state to test strings.';
    $('pprev').disabled = $('pnext').disabled = true;
    return;
  }
  const chars = [...probeStr()], n = chars.length, out = M.type === 'moore' || M.type === 'mealy';
  $('tape').innerHTML = n
    ? chars.map((c, k) => `<span class="${k < i ? 'done' : k === i ? 'cur' : ''}">${esc(c)}</span>`).join('')
    : '<span class="empty">ε (empty string)</span>';
  if (out) {
    v.className = 'verdict ok';
    v.textContent = 'Output: ' + (run.output || '(empty)');
  } else if (run.accepted) {
    v.className = 'verdict ok';
    v.textContent = '✓ Accepted';
  } else {
    v.className = 'verdict bad';
    v.textContent = '✗ Rejected' + (run.stuckAt != null ? ` (no transition on “${chars[run.stuckAt]}”)` : '');
  }
  $('pstat').textContent = `Step ${i}/${n}: ` + (i ? `read “${chars[i - 1]}”, now in ` : 'start, in ') + stateSet(step.active)
    + (out ? `, output so far: ${step.output || '(none)'}` : '');
  $('pprev').disabled = i === 0;
  $('pnext').disabled = i >= run.steps.length - 1;
}

function build() {
  try {
    const opts = { alphabet: $('alpha').value, machine: $('mt').value };
    $('src').value = $('mode').value === 'regex'
      ? fromRegex({ regex: $('desc').value, ...opts })
      : generate({ desc: $('desc').value, ...opts });
    render();
  } catch (e) {
    $('warn').innerHTML = `<p class="warn">${esc(e.message)}</p>`;
  }
}

Object.entries(EXAMPLES).forEach(([name, text]) => {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => { $('src').value = text; $('mode').value = 'text'; modeChrome(); $('probe').value = PROBES[name]; render(); };
  $('ex').appendChild(b);
});
$('src').addEventListener('input', () => {
  if ($('mode').value === 'english' || $('mode').value === 'regex') { $('mode').value = 'text'; modeChrome(); }
  render();
});
$('go').onclick = build;
$('desc').addEventListener('keydown', e => { if (e.key === 'Enter') build(); });
const MODES = {
  english: { sample: 'strings ending with ab', hint: 'Try “ends with ab”, “starts with ba”, “contains aab”, “even number of a”, “does not contain bb”. Join clauses with and / or (one kind at a time). For a Moore/Mealy machine pick the type and add outputs, or write a prompt like “moore: 1 when ends with ab, else 0”.' },
  regex: { sample: '(a|b)*ab', hint: 'Symbols, | (or), * + ? and ( ). Write ε or an empty () for the empty string and \\ to escape. DFA gives the minimal DFA; NFA gives the Thompson ε-NFA.' },
  table: { hint: 'Paste or type a table: the first row names the symbols, and every row starts with a state — mark it -> for start and * to accept. Cells can be q1, q1,q2 (NFA), eps, or q1/1 (Mealy); an Output column makes a Moore machine. Missing cells mean no transition.' },
  text: { hint: 'The machine text format: type:, start:, accept:, transitions, out lines. Edit it and the diagram follows.' },
};
function modeChrome() {
  const k = $('mode').value;
  $('prompt-fields').hidden = k === 'table' || k === 'text';
  $('dhint').textContent = MODES[k].hint;
}
function setMode() {
  const k = $('mode').value;
  modeChrome();
  if (k === 'table') { $('src').value = TABLE_EXAMPLE; render(); }
  else if (k === 'text') { if (!parse($('src').value).states.length) $('src').value = EXAMPLES.DFA; render(); }
  else { $('desc').value = MODES[k].sample; build(); }
}
$('mode').addEventListener('change', setMode);
$('conv').onclick = () => {
  try {
    const M = parse(source());
    if (M.type !== 'dfa' && M.type !== 'nfa') throw new Error('Only DFAs and NFAs can be converted.');
    $('src').value = dfaToText(minimize(nfaToDfa(M)), 'minimal DFA');
    $('mode').value = 'text';
    modeChrome();
    render();
  } catch (e) {
    $('warn').innerHTML = `<p class="warn">${esc(e.message)}</p>`;
  }
};
$('probe').addEventListener('input', () => probeReset(probe.M));
$('probe').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  probeReset(probe.M);
  if (probe.run) probe.i = probe.run.steps.length - 1;
  drawProbe();
});
$('pnext').onclick = () => { stopPlay(); if (probe.run && probe.i < probe.run.steps.length - 1) probe.i++; drawProbe(); };
$('pprev').onclick = () => { stopPlay(); if (probe.i > 0) probe.i--; drawProbe(); };
$('preset').onclick = () => probeReset(probe.M);
$('pplay').onclick = () => {
  if (probe.timer) return stopPlay();
  if (!probe.run) return;
  if (probe.i >= probe.run.steps.length - 1) probe.i = 0;
  $('pplay').textContent = 'Pause';
  drawProbe();
  probe.timer = setInterval(() => {
    if (probe.i < probe.run.steps.length - 1) probe.i++;
    drawProbe();
    if (probe.i >= probe.run.steps.length - 1) stopPlay();
  }, 700);
};
setMode();
build();
