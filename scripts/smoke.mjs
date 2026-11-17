// Loads the BUILT site (website/index.html) in a DOM, runs its scripts and clicks through the main flows.
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
let failed = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) failed++; };

check('self-contained: no external script/stylesheet/asset references',
  !/<script\b[^>]*\bsrc=/.test(html) && !/<link\b[^>]*rel="stylesheet"/.test(html) && !/(?:src|href)="(?:https?:)?\/\//.test(html) && !/assets\//.test(html));

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));
vc.on('error', m => errors.push(String(m)));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const d = dom.window.document;
const $ = id => d.getElementById(id);
const fire = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));

check('page scripts run without errors', errors.length === 0);
check('initial build draws diagram, table and grammar',
  !!$('dia').querySelector('svg') && $('tab').textContent.includes('q2') && $('gra').textContent.includes('q2 → a q1 | b q0 | ε'));
check('machine text box is filled', $('src').value.startsWith('type: dfa'));

check('string tester: default string accepted, one state highlighted',
  $('pverdict').textContent.includes('Accepted') && d.querySelectorAll('#dia circle.on').length === 1);
$('pnext').click(); $('pnext').click(); $('pnext').click();
check('stepping reaches the end and reports the state',
  $('pstat').textContent.startsWith('Step 3/3') && $('pstat').textContent.includes('q2') && $('pnext').disabled);
$('pprev').click();
check('back button steps backwards', $('pstat').textContent.startsWith('Step 2/3') && !$('pnext').disabled);
$('probe').value = 'aba'; fire($('probe'), 'input');
check('typing a new string re-runs it from the start', $('pverdict').textContent.includes('Rejected') && $('pstat').textContent.startsWith('Step 0/3'));
$('probe').value = ''; fire($('probe'), 'input');
check('empty string is handled', $('tape').textContent.includes('ε') && $('pverdict').textContent.includes('Rejected'));
$('probe').value = 'abc'; fire($('probe'), 'input');
check('missing transition is explained', $('pverdict').textContent.includes('no transition on “c”'));
$('probe').value = 'aab'; fire($('probe'), 'input');

$('mode').value = 'regex'; fire($('mode'), 'change');
check('regex mode loads its sample and builds', $('desc').value === '(a|b)*ab' && $('src').value.startsWith('type: dfa'));
$('mt').value = 'nfa'; $('go').click();
check('regex -> Thompson NFA has an ε column', $('src').value.startsWith('type: nfa') && $('tab').textContent.includes('ε'));
$('conv').click();
check('"Convert to minimal DFA" works', $('src').value.startsWith('type: dfa') && $('src').value.includes('minimal DFA'));

$('mode').value = 'english'; fire($('mode'), 'change'); $('desc').value = 'gibberish'; $('go').click();
check('unreadable description shows a message', $('warn').textContent.includes('Couldn’t read'));
$('desc').value = 'starts with a and does not contain bb'; $('go').click();
check('combined English clauses build a DFA', $('src').value.startsWith('type: dfa') && $('warn').textContent === '');

[...d.querySelectorAll('#ex button')].find(b => b.textContent === 'NFA').click();
$('pnext').click();
check('NFA example: several states highlighted at once', d.querySelectorAll('#dia circle.on').length === 2 && $('pverdict').textContent.includes('Accepted'));
[...d.querySelectorAll('#ex button')].find(b => b.textContent === 'Moore').click();
check('Moore example: tester shows the output string', $('pverdict').textContent === 'Output: 00010');
check('Moore example shows an Output column', $('tab').textContent.includes('Output') && !!$('dia').querySelector('svg'));
$('src').value = 'type: dfa\nstart: s\naccept: s\ns, x -> s'; fire($('src'), 'input');
check('editing the machine text re-renders everything', $('gra').textContent.includes('s → x s | ε'));

$('mode').value = 'english'; fire($('mode'), 'change');
$('mt').value = 'moore'; $('desc').value = 'ends with ab'; $('go').click();
check('Moore prompt builds an output machine', $('src').value.startsWith('type: moore') && $('badge').textContent === 'MOORE');
check('Moore prompt: diagram carries state outputs', $('dia').querySelectorAll('text.ou').length >= 2);
$('probe').value = 'ab'; fire($('probe'), 'input');
check('Moore prompt: tester shows the output string', $('pverdict').textContent === 'Output: 001');
$('mt').value = 'mealy'; $('desc').value = 'mealy: 1 when ends with ab, else 0'; $('go').click();
check('Mealy prompt builds an output machine', $('src').value.startsWith('type: mealy') && $('badge').textContent === 'MEALY');
check('Mealy prompt: tester shows the output string', $('pverdict').textContent === 'Output: 01');

$('mode').value = 'table'; fire($('mode'), 'change');
check('table mode loads its sample table', $('src').value.startsWith('State') && $('badge').textContent === 'DFA');
check('a table draws the diagram, table and grammar', !!$('dia').querySelector('svg') && $('tab').textContent.includes('q2') && $('gra').textContent.includes('q2 → a q1'));
$('src').value = 'State\ta\tb\n-> q0\tq0,q1\tq0\n* q1\tq1\tq1'; fire($('src'), 'input');
check('editing a table with several targets makes it an NFA', $('badge').textContent === 'NFA' && $('tab').textContent.includes('q0'));
$('src').value = 'State\ta\tb\tOutput\n-> q0\tq1\tq0\t0\nq1\tq1\tq2\t0\n* q2\tq1\tq0\t1'; fire($('src'), 'input');
check('an Output column makes it a Moore machine', $('badge').textContent === 'MOORE' && $('tab').textContent.includes('Output'));

console.log(failed ? `\n${failed} smoke check(s) failed` : '\nall smoke checks passed');
process.exit(failed ? 1 : 0);
