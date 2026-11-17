import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, warnings } from '../src/core/parse.js';
import { generate } from '../src/core/generate.js';
import { accepts, trace } from '../src/core/simulate.js';
import { fromRegex } from '../src/core/regex.js';
import { grammar } from '../src/core/grammar.js';

const strings = (alpha, max) => {
  let cur = [''], out = [''];
  for (let i = 0; i < max; i++) { cur = cur.flatMap(s => alpha.map(c => s + c)); out.push(...cur); }
  return out;
};

const cases = [
  ['strings ending with ab', s => s.endsWith('ab')],
  ['strings starting with ba', s => s.startsWith('ba')],
  ['strings that contain aab', s => s.includes('aab')],
  ['strings ending with a', s => s.endsWith('a')],
  ['strings containing abab', s => s.includes('abab')],
  ['strings that do not end with ab', s => !s.endsWith('ab')],
  ['strings that do not contain bb', s => !s.includes('bb')],
];

for (const [desc, pred] of cases) {
  for (const machine of ['dfa', 'nfa']) {
    if (machine === 'nfa' && /not/.test(desc)) continue; // complement is DFA-only
    test(`${desc} (${machine}) accepts exactly the right strings up to length 8`, () => {
      const M = parse(generate({ desc, machine }));
      for (const s of strings(['a', 'b'], 8)) assert.equal(accepts(M, s), pred(s), `"${s}"`);
    });
  }
}

test('generated DFAs are complete (no warnings)', () => {
  for (const d of ['ends with ab', 'starts with ba', 'contains aab']) {
    assert.deepEqual(warnings(parse(generate({ desc: d }))), []);
  }
});

test('unknown descriptions throw a helpful error', () => {
  assert.throws(() => generate({ desc: 'palindromes over a and b' }), /Try/);
});

test('descriptions must be a single line', () => {
  assert.throws(() => generate({ desc: 'ends with ab\nfoo' }), /one line/);
});

test('prompt-driven Moore/Mealy machines emit the right output for every prefix', () => {
  for (const type of ['moore', 'mealy']) {
    for (const [cond, pred, yes, no] of [
      ['ends with ab', s => s.endsWith('ab'), '1', '0'],
      ['does not contain bb', s => !s.includes('bb'), 'yes', 'no'],
    ]) {
      const M = parse(generate({ desc: `${type}: ${yes} when ${cond}, else ${no}` }));
      assert.equal(M.type, type);
      assert.deepEqual(warnings(M), []);
      const pre = type === 'moore' ? 0 : 1; // Moore shows an output for the empty prefix too
      for (const s of strings(['a', 'b'], 6)) {
        const want = Array.from({ length: s.length + 1 - pre }, (_, k) =>
          pred(s.slice(0, k + pre)) ? yes : no).join('');
        assert.equal(trace(M, s).output, want, `${type} “${s}”`);
      }
    }
  }
});

test('an output prompt wins over the machine option, and bad ones are rejected', () => {
  assert.equal(parse(generate({ desc: 'mealy: 1 when starts with a', machine: 'nfa' })).type, 'mealy');
  assert.ok(Object.values(parse(generate({ desc: 'moore machine that emits Y if ends with ab' })).out).includes('Y'));
  const d = parse(generate({ desc: 'moore: 1 when ends with ab' })).out; // other output defaults to 0
  assert.equal(d.q2, '1');
  assert.equal(d.q0, '0');
  assert.throws(() => generate({ desc: 'moore: 1 when palindromes' }), /Couldn’t read/);
  assert.throws(() => generate({ desc: 'ends with ab', machine: 'oops' }), /Unknown machine type/);
  assert.throws(() => generate({ desc: 'moore: 1 when ends with ab, else two words' }), /Couldn’t read/);
});

test('a regex prompt can produce an output machine', () => {
  const M = parse(fromRegex({ regex: '(a|b)*ab', machine: 'mealy' }));
  assert.equal(M.type, 'mealy');
  assert.equal(trace(M, 'ab').output, '01');
});

test('parse: NFA with ε and multiple targets', () => {
  const M = parse('type: nfa\nstart: q0\naccept: q2\nq0, a -> q0, q1\nq2, eps -> q0');
  assert.equal(M.tr[0].to.length, 2);
  assert.equal(M.tr[1].sym, 'ε');
  assert.deepEqual(M.alpha, ['a']);
});

test('grammar: DFA is right-linear with ε for accepting states', () => {
  const g = grammar(parse(generate({ desc: 'ends with ab' })));
  assert.match(g, /q2 → a q1 \| b q0 \| ε/);
});

test('grammar: Mealy emits outputs', () => {
  const g = grammar(parse('type: mealy\nstart: q0\nq0, 1 -> q0 / 1'));
  assert.match(g, /q0 → 1 q0 {2}\{emit 1\}/);
});
