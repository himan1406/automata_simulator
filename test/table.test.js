import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTable } from '../src/core/table.js';
import { parse, warnings } from '../src/core/parse.js';
import { generate } from '../src/core/generate.js';
import { accepts, trace } from '../src/core/simulate.js';

const strings = (alpha, max) => {
  let cur = [''], out = [''];
  for (let i = 0; i < max; i++) { cur = cur.flatMap(s => alpha.map(c => s + c)); out.push(...cur); }
  return out;
};

const DFA = `State    a     b
->  q0   q1    q0
    q1   q1    q2
*   q2   q1    q0`;

test('a DFA table describes the same machine as its English description', () => {
  const M = parse(parseTable(DFA));
  const want = parse(generate({ desc: 'ends with ab' }));
  assert.equal(M.type, 'dfa');
  assert.equal(M.start, 'q0');
  assert.deepEqual(M.acc, ['q2']);
  assert.deepEqual(warnings(M), []);
  for (const s of strings(['a', 'b'], 7)) assert.equal(accepts(M, s), accepts(want, s), `"${s}"`);
});

test('tabs, pipes and single spaces parse like the aligned table', () => {
  const text = parse(parseTable(DFA)).tr.map(t => `${t.from},${t.sym}->${t.to.join(',')}`).sort();
  const variants = [
    'State\ta\tb\n-> q0\tq1\tq0\nq1\tq1\tq2\n* q2\tq1\tq0',
    '| State | a | b |\n|---|---|---|\n| -> q0 | q1 | q0 |\n| q1 | q1 | q2 |\n| * q2 | q1 | q0 |',
    'State a b\n-> q0 q1 q0\nq1 q1 q2\n* q2 q1 q0',
  ];
  for (const v of variants) {
    const got = parse(parseTable(v)).tr.map(t => `${t.from},${t.sym}->${t.to.join(',')}`).sort();
    assert.deepEqual(got, text, v);
  }
});

test('several targets in a cell (and an eps column) make an NFA', () => {
  const M = parse(parseTable(`State   a     b    eps
-> q0   q1    q0   -
*  q1   q1    q1   q0`));
  assert.equal(M.type, 'nfa');
  assert.deepEqual(M.alpha.sort(), ['a', 'b']);
  assert.equal(accepts(M, 'a'), true);
  assert.equal(accepts(M, 'b'), false);
  assert.equal(accepts(M, 'ba'), true);
});

test('an Output column makes a Moore machine', () => {
  const M = parse(parseTable(`State   a    b    Output
-> q0   q1   q0   0
   q1   q1   q2   0
*  q2   q1   q0   1`));
  assert.equal(M.type, 'moore');
  assert.deepEqual(M.out, { q0: '0', q1: '0', q2: '1' });
  assert.equal(trace(M, 'ab').output, '001');
});

test('state/output cells make a Mealy machine', () => {
  const M = parse(parseTable(`State   a      b
-> q0   q1/0   q0/0
   q1   q1/0   q2/1
*  q2   q1/0   q0/0`));
  assert.equal(M.type, 'mealy');
  assert.equal(trace(M, 'ab').output, '01');
});

test('a marker column of its own is accepted', () => {
  const M = parse(parseTable(`State   a    b
->  q0   q1   q0
    q1   q1   q2
*   q2   q1   q0`));
  assert.equal(M.start, 'q0');
  assert.deepEqual(M.acc, ['q2']);
});

test('unreadable tables explain what is wrong', () => {
  assert.throws(() => parseTable(''), /empty/);
  assert.throws(() => parseTable('a b\nq0 q1'), /must name the symbols/);
  assert.throws(() => parseTable('State a b\nq0 q1 q0'), /start state/);
  assert.throws(() => parseTable('State a\n-> q0 q1\n-> q1 q1'), /Only one state/);
  assert.throws(() => parseTable('State a\n-> q0 q1\nq0 q1'), /more than one row/);
  assert.throws(() => parseTable('State a Out\n-> q0 q1/1 0'), /not both/);
  assert.throws(() => parseTable('State a Out\n-> q0 q1'), /needs an output/);
  assert.throws(() => parseTable('State a b\n-> q0 q1 q2 q3'), /expected 3 columns/);
});
