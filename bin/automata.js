#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parse, warnings } from '../src/core/parse.js';
import { generate } from '../src/core/generate.js';
import { fromRegex } from '../src/core/regex.js';
import { nfaToDfa, minimize, dfaToText } from '../src/core/dfa.js';
import { grammar } from '../src/core/grammar.js';
import { accepts, allStrings } from '../src/core/simulate.js';
import { tableText, edgesText } from '../src/core/format.js';

const HELP = `automata - build, convert and test finite automata from the command line

Usage:
  automata build   <source> [--format all|text|table|grammar|edges|json]
  automata convert <source>             DFA/NFA -> minimal DFA
  automata test    <source> [checks]    exit code 1 if any check fails

Source (exactly one):
  --english "ends with ab"     plain-English description ("moore: 1 when ends with ab, else 0")
  --regex "(a|b)*ab"           regular expression
  --file machine.txt           machine text file ("-" reads stdin)
  --text "type: dfa\\nstart: q0\\n..."   machine text inline

Options:
  --alphabet a,b       extra symbols for --english/--regex (default a,b)
  --machine dfa|nfa|moore|mealy   how to build --english/--regex (default dfa)
  --json               machine-readable output (same as --format json)

Checks for "test" (DFA/NFA, single-character symbols):
  --accept s1,s2       strings that must be accepted   ("" or eps = empty string)
  --reject s1,s2       strings that must be rejected
  --equals-regex RE    same language as JavaScript regex RE (brute force)
  --equals-english "." same language as another description
  --max-length N       brute-force length for --equals-* (default 8)
  --strict             also fail if the machine has warnings (e.g. missing transitions)

Exit codes: 0 ok | 1 a check failed | 2 bad usage or unreadable input`;

class CliError extends Error {}
const FLAGS = new Set(['json', 'strict', 'help']);

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const [k, v] = a.slice(2).split(/=(.*)/s);
    if (v !== undefined) o[k] = v;
    else if (!FLAGS.has(k) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
    else o[k] = true;
  }
  return o;
}

function source(o) {
  const opts = { alphabet: o.alphabet ?? 'a, b', machine: o.machine ?? 'dfa' };
  const given = ['english', 'regex', 'file', 'text'].filter(k => o[k] !== undefined);
  if (given.length !== 1) throw new CliError('give exactly one of --english, --regex, --file, --text');
  const v = o[given[0]];
  if (v === true) throw new CliError(`--${given[0]} needs a value`);
  if (given[0] === 'english') return generate({ desc: v, ...opts });
  if (given[0] === 'regex') return fromRegex({ regex: v, ...opts });
  if (given[0] === 'text') return v.replace(/\\n/g, '\n');
  try { return readFileSync(v === '-' ? 0 : v, 'utf8'); } catch (e) { throw new CliError(`can't read ${v}: ${e.code || e.message}`); }
}

function describe(text) {
  const M = parse(text);
  return {
    text, type: M.type, start: M.start, accept: M.acc, alphabet: M.alpha, states: M.states,
    transitions: M.tr.map(t => ({ from: t.from, symbol: t.sym, to: t.to, ...(t.o != null ? { output: t.o } : {}) })),
    outputs: M.out, warnings: warnings(M), table: tableText(M), grammar: grammar(M), edges: edgesText(M),
  };
}

function printMachine(text, o) {
  const d = describe(text), fmt = o.json ? 'json' : (o.format ?? 'all');
  if (fmt === 'json') console.log(JSON.stringify(d, null, 2));
  else if (fmt === 'text') console.log(text);
  else if (fmt === 'table') console.log(d.table);
  else if (fmt === 'grammar') console.log(d.grammar);
  else if (fmt === 'edges') console.log(d.edges);
  else if (fmt === 'all') {
    console.log(text + '\n\nTABLE\n' + d.table + '\n\nGRAMMAR\n' + d.grammar + '\n\nEDGES\n' + d.edges);
    d.warnings.forEach(w => console.log('warning: ' + w));
  } else throw new CliError(`unknown --format ${fmt}`);
}

const strList = v => (v === undefined || v === true ? [] : String(v).split(',').map(s => (s === '""' || s === "''" || s === 'eps' || s === 'ε' ? '' : s)));
const show = s => JSON.stringify(s);

function diffs(A, B, alpha, max) {
  if (alpha.some(a => [...a].length !== 1)) throw new CliError('--equals-* needs single-character symbols');
  if (Math.pow(Math.max(alpha.length, 1), max) > 2e6) throw new CliError('alphabet/--max-length too large for brute force');
  const bad = [];
  for (const s of allStrings(alpha, max)) {
    const a = A(s), b = B(s);
    if (a !== b) { bad.push(`${show(s)} (machine ${a ? 'accepts' : 'rejects'}, expected ${b ? 'accept' : 'reject'})`); if (bad.length >= 5) break; }
  }
  return bad;
}

function runTest(text, o) {
  const M = parse(text);
  if (M.err.length) throw new CliError(M.err[0]);
  if (M.type !== 'dfa' && M.type !== 'nfa') throw new CliError('test supports DFA/NFA only');
  if (!M.start) throw new CliError('the machine has no start state');
  if (M.alpha.some(a => [...a].length !== 1)) throw new CliError('test works with single-character symbols only; this machine uses multi-character symbols');
  const max = o['max-length'] === undefined ? 8 : Number(o['max-length']);
  if (!Number.isInteger(max) || max < 0) throw new CliError('--max-length needs a non-negative integer');
  const checks = [], add = (name, pass, detail = '') => checks.push({ name, pass, detail: pass ? '' : detail });
  for (const s of strList(o.accept)) add(`accept ${show(s)}`, accepts(M, s), 'machine rejects it');
  for (const s of strList(o.reject)) add(`reject ${show(s)}`, !accepts(M, s), 'machine accepts it');
  if (o['equals-regex'] !== undefined) {
    if (o['equals-regex'] === true) throw new CliError('--equals-regex needs a value');
    const re = new RegExp('^(?:' + o['equals-regex'] + ')$');
    const bad = diffs(s => accepts(M, s), s => re.test(s), M.alpha, max);
    add(`equals regex ${o['equals-regex']} (length <= ${max})`, !bad.length, 'differs on ' + bad.join('; '));
  }
  if (o['equals-english'] !== undefined) {
    if (o['equals-english'] === true) throw new CliError('--equals-english needs a value');
    const M2 = parse(generate({ desc: o['equals-english'], alphabet: [...M.alpha].join(','), machine: 'dfa' }));
    if (M2.type !== 'dfa' && M2.type !== 'nfa') throw new CliError('--equals-english needs a language description, not an output prompt');
    const alpha = [...new Set([...M.alpha, ...M2.alpha])];
    const bad = diffs(s => accepts(M, s), s => accepts(M2, s), alpha, max);
    add(`equals “${o['equals-english']}” (length <= ${max})`, !bad.length, 'differs on ' + bad.join('; '));
  }
  const w = warnings(M);
  if (o.strict) add('no warnings', !w.length, w.join('; '));
  const failed = checks.filter(c => !c.pass).length;
  if (o.json) {
    console.log(JSON.stringify({ ok: !failed, passed: checks.length - failed, failed, checks, machine: describe(text) }, null, 2));
  } else {
    console.log(`machine: ${M.type}, ${M.states.length} states, alphabet ${M.alpha.join(',') || '-'}`);
    checks.forEach(c => console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.pass ? '' : ' - ' + c.detail}`));
    if (!checks.length) console.log('no checks given (use --accept, --reject, --equals-regex, --equals-english, --strict)');
    else console.log(`${checks.length - failed}/${checks.length} checks passed`);
    if (!o.strict) w.forEach(x => console.log('warning: ' + x));
  }
  return failed ? 1 : 0;
}

function main(o) {
  const cmd = o._[0];
  if (o.help || cmd === 'help') { console.log(HELP); return 0; }
  if (!cmd) { console.error(HELP); return 2; }
  if (!['build', 'convert', 'test'].includes(cmd)) throw new CliError(`unknown command "${cmd}" (try --help)`);
  let text = source(o);
  if (cmd === 'convert') {
    const M = parse(text);
    if (M.err.length) throw new CliError(M.err[0]);
    if (M.type !== 'dfa' && M.type !== 'nfa') throw new CliError('only DFA/NFA can be converted');
    const extra = o.alphabet && (o.file !== undefined || o.text !== undefined) ? String(o.alphabet).split(/[\s,]+/).filter(Boolean) : [];
    text = dfaToText(minimize(nfaToDfa(M, extra)), 'minimal DFA');
  }
  if (cmd !== 'test') {
    const errs = parse(text).err;
    if (errs.length) throw new CliError(errs[0]);
  }
  if (cmd === 'test') return runTest(text, o);
  printMachine(text, o);
  return 0;
}

try {
  process.exitCode = main(parseArgs(process.argv.slice(2)));
} catch (e) {
  console.error('error: ' + e.message);
  process.exitCode = 2;
}
