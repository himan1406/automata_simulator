import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/automata.js', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', input });

test('build --json describes the machine', () => {
  const r = run(['build', '--english', 'strings ending with ab', '--json']);
  assert.equal(r.status, 0);
  const d = JSON.parse(r.stdout);
  assert.equal(d.type, 'dfa');
  assert.deepEqual(d.accept, ['q2']);
  assert.deepEqual(d.alphabet, ['a', 'b']);
  assert.match(d.grammar, /q2 → a q1 \| b q0 \| ε/);
  assert.deepEqual(d.warnings, []);
});

test('build prints text, table, grammar and edges by default', () => {
  const r = run(['build', '--regex', '(a|b)*ab']);
  assert.equal(r.status, 0);
  for (const part of ['type: dfa', 'TABLE', 'GRAMMAR', 'EDGES', '--a-->']) assert.ok(r.stdout.includes(part), part);
});

test('build --format table is a plain aligned table', () => {
  const r = run(['build', '--english', 'ends with ab', '--format', 'table']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^State\s+\| a\s+\| b/);
  assert.match(r.stdout, /→ q0/);
  assert.match(r.stdout, /\* q2/);
});

test('test: passing accept/reject checks exit 0', () => {
  const r = run(['test', '--english', 'ends with ab', '--accept', 'ab,aab,bab', '--reject', 'a,ba,abb,""']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /7\/7 checks passed/);
});

test('test: a wrong expectation exits 1 and says which one', () => {
  const r = run(['test', '--english', 'ends with ab', '--accept', 'ab,aa']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL accept "aa" - machine rejects it/);
});

test('test: --equals-regex and --equals-english', () => {
  assert.equal(run(['test', '--english', 'ends with ab', '--equals-regex', '(a|b)*ab']).status, 0);
  const bad = run(['test', '--english', 'ends with ab', '--equals-regex', '(a|b)*ba']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /differs on/);
  assert.equal(run(['test', '--regex', 'b*(ab*ab*)*', '--equals-english', 'even number of a']).status, 0);
  assert.equal(run(['test', '--regex', 'a*', '--equals-english', 'even number of a']).status, 1);
  const out = run(['test', '--regex', 'a*', '--equals-english', 'moore: 1 when ends with a']);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /language description/);
});

test('test --json is machine readable', () => {
  const r = run(['test', '--english', 'contains aab', '--accept', 'aab', '--reject', 'ab', '--json']);
  const d = JSON.parse(r.stdout);
  assert.equal(d.ok, true);
  assert.equal(d.passed, 2);
  assert.equal(d.checks[0].name, 'accept "aab"');
});

test('test --strict fails on a partial DFA', () => {
  const text = 'type: dfa\nstart: q0\naccept: q1\nq0, a -> q1\nq1, a -> q1\nq1, b -> q1';
  assert.equal(run(['test', '--text', text, '--accept', 'a']).status, 0);
  const r = run(['test', '--text', text, '--accept', 'a', '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL no warnings/);
});

test('convert: NFA -> minimal DFA, from a literal \\n text argument and from stdin', () => {
  const lit = 'type: nfa\\nstart: q0\\naccept: q1\\nq0, a -> q0, q1\\nq0, b -> q0';
  const a = JSON.parse(run(['convert', '--text', lit, '--json']).stdout);
  assert.equal(a.type, 'dfa');
  assert.equal(a.states.length, 2);
  const b = JSON.parse(run(['convert', '--file', '-', '--json'], lit.replace(/\\n/g, '\n')).stdout);
  assert.equal(b.states.length, 2);
});

test('errors exit 2 with a readable message on stderr', () => {
  let r = run(['build', '--english', 'something else entirely']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Couldn’t read/);
  r = run(['build']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /exactly one of/);
  r = run(['build', '--file', '/nonexistent/x.txt']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /can't read/);
  r = run(['test', '--text', 'type: mealy\nstart: q0\nq0, a -> q0 / 1', '--accept', 'a']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /DFA\/NFA only/);
  r = run(['frobnicate']);
  assert.equal(r.status, 2);
});

test('test: multi-character symbols are rejected with a usage error', () => {
  const text = 'type: dfa\nstart: q0\naccept: q1\nq0, ab -> q1';
  const r = run(['test', '--text', text, '--accept', 'ab']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /single-character/);
});

test('test: --max-length must be a non-negative integer', () => {
  for (const v of ['nope', '-1', '1.5']) {
    const r = run(['test', '--english', 'ends with ab', '--equals-regex', '(a|b)*ab', '--max-length', v]);
    assert.equal(r.status, 2, v);
    assert.match(r.stderr, /non-negative integer/);
  }
});

test('build --english understands an output prompt', () => {
  const r = run(['build', '--english', 'moore: 1 when ends with ab, else 0', '--json']);
  assert.equal(r.status, 0);
  const d = JSON.parse(r.stdout);
  assert.equal(d.type, 'moore');
  assert.deepEqual(d.outputs, { q0: '0', q1: '0', q2: '1' });
  assert.deepEqual(d.warnings, []);
});

test('build --machine mealy works for a regex', () => {
  const r = run(['build', '--machine', 'mealy', '--regex', '(a|b)*ab', '--format', 'text']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^type: mealy/);
  assert.match(r.stdout, /q1, b -> q2 \/ 1/);
});

test('build: unreadable machine text is a usage error', () => {
  const r = run(['build', '--text', 'this is not a machine']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Couldn’t read/);
});

test('--help and no arguments', () => {
  assert.equal(run(['--help']).status, 0);
  assert.match(run(['--help']).stdout, /Exit codes/);
  assert.equal(run([]).status, 2);
});
