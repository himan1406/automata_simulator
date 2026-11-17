import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/core/parse.js';
import { generate } from '../src/core/generate.js';
import { EXAMPLES } from '../src/examples.js';
import { accepts, trace, allStrings } from '../src/core/simulate.js';

const actives = r => r.steps.map(s => s.active.join(','));

test('DFA trace: one active state per step', () => {
  const r = trace(parse(generate({ desc: 'ends with ab' })), 'aab');
  assert.deepEqual(actives(r), ['q0', 'q1', 'q1', 'q2']);
  assert.equal(r.accepted, true);
  assert.equal(r.stuckAt, null);
  assert.equal(r.steps[0].read, null);
  assert.equal(r.steps[3].read, 'b');
});

test('NFA trace: several active states, ε-closed', () => {
  const M = parse(EXAMPLES.NFA);
  const r = trace(M, 'abab');
  assert.deepEqual(actives(r), ['q0', 'q0,q1', 'q0,q2', 'q0,q1', 'q0,q2']);
  assert.equal(r.accepted, true);
  assert.equal(trace(M, 'ba').accepted, false);
});

test('trace reports the first character with no transition', () => {
  const r = trace(parse(generate({ desc: 'ends with ab' })), 'abca');
  assert.equal(r.stuckAt, 2);
  assert.equal(r.accepted, false);
  assert.deepEqual(r.steps[3].active, []);
});

test('empty string', () => {
  const r = trace(parse(generate({ desc: 'even number of a' })), '');
  assert.equal(r.steps.length, 1);
  assert.equal(r.accepted, true);
});

test('Moore output includes the start state’s output', () => {
  assert.equal(trace(parse(EXAMPLES.Moore), '0110').output, '00010');
});

test('Mealy output is one symbol per transition', () => {
  const r = trace(parse(EXAMPLES.Mealy), '0110');
  assert.equal(r.output, '0010');
  assert.deepEqual(r.steps.map(s => s.output), ['', '0', '00', '001', '0010']);
});

test('trace agrees with accepts on every string up to length 6', () => {
  for (const desc of ['ends with ab', 'contains aab or bb', 'odd number of a and starts with b']) {
    for (const machine of ['dfa', 'nfa']) {
      const M = parse(generate({ desc, machine }));
      for (const s of allStrings(['a', 'b'], 6)) assert.equal(trace(M, s).accepted, accepts(M, s), `${desc} ${machine} "${s}"`);
    }
  }
});
