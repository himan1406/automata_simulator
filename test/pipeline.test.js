import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/core/parse.js';
import { generate } from '../src/core/generate.js';
import { fromRegex } from '../src/core/regex.js';
import { nfaToDfa, minimize, dfaToText } from '../src/core/dfa.js';
import { accepts } from '../src/core/simulate.js';

const strings = (alpha, max) => {
  let cur = [''], out = [''];
  for (let i = 0; i < max; i++) { cur = cur.flatMap(s => alpha.map(c => s + c)); out.push(...cur); }
  return out;
};
const ALL = strings(['a', 'b'], 8);
const size = text => parse(text).states.length;

// ---- regex -> NFA / minimal DFA, checked against JavaScript's own RegExp
const REGEXES = ['(a|b)*ab', 'a*b*', '(ab)*', 'a(a|b)*b', '(aa|bb)+', 'a?b?a?', '(a|b)*a(a|b)', 'b*(ab*ab*)*', '(a|)b*', '((a|b)(a|b))*', '(a|b)*', 'a|b|ab'];
for (const re of REGEXES) {
  for (const machine of ['nfa', 'dfa']) {
    test(`regex ${re} as ${machine} agrees with RegExp`, () => {
      const M = parse(fromRegex({ regex: re, machine }));
      const js = new RegExp('^(?:' + re + ')$');
      for (const s of ALL) assert.equal(accepts(M, s), js.test(s), `"${s}"`);
    });
  }
}

test('minimal DFA sizes', () => {
  assert.equal(size(fromRegex({ regex: '(a|b)*ab' })), 3);
  assert.equal(size(fromRegex({ regex: '((a|b)(a|b))*' })), 2);
  assert.equal(size(fromRegex({ regex: '(a|b)*' })), 1);
  assert.equal(size(generate({ desc: 'even number of a' })), 2);
});

test('ε in a regex', () => {
  const M = parse(fromRegex({ regex: 'aε|b', machine: 'nfa' }));
  assert.deepEqual(ALL.filter(s => accepts(M, s)), ['a', 'b']);
});

test('regex errors are readable', () => {
  assert.throws(() => fromRegex({ regex: '(a|b' }), /missing \)/);
  assert.throws(() => fromRegex({ regex: '*a' }), /nothing to repeat/);
  assert.throws(() => fromRegex({ regex: '  ' }), /Enter a regular expression/);
  assert.throws(() => fromRegex({ regex: 'a#' }), /can’t be used/);
});

test('NFA -> minimal DFA keeps the language', () => {
  const nfa = parse(generate({ desc: 'contains aab', machine: 'nfa' }));
  const text = dfaToText(minimize(nfaToDfa(nfa)));
  assert.equal(size(text), 4);
  const M = parse(text);
  for (const s of ALL) assert.equal(accepts(M, s), s.includes('aab'), `"${s}"`);
});

// ---- plain English: combined clauses, parity, negation
const ENGLISH = [
  ['ends with ab and starts with b', s => s.endsWith('ab') && s.startsWith('b')],
  ['contains aa or bb', s => s.includes('aa') || s.includes('bb')],
  ['starts with a and does not contain bb', s => s.startsWith('a') && !s.includes('bb')],
  ['even number of a and odd number of b', s => (s.split('a').length - 1) % 2 === 0 && (s.split('b').length - 1) % 2 === 1],
  ['odd number of b’s', s => (s.split('b').length - 1) % 2 === 1],
  ['doesn’t end with ab', s => !s.endsWith('ab')],
  ['does not end with ab', s => !s.endsWith('ab')],
  ['strings that begin with ab or end with ba.', s => s.startsWith('ab') || s.endsWith('ba')],
];
for (const [desc, pred] of ENGLISH) {
  for (const machine of ['dfa', 'nfa']) {
    test(`English: ${desc} (${machine})`, () => {
      const M = parse(generate({ desc, machine }));
      for (const s of ALL) assert.equal(accepts(M, s), pred(s), `"${s}"`);
    });
  }
}

test('English: patterns keep their case', () => {
  const M = parse(generate({ desc: 'strings ending with AB' }));
  assert.equal(accepts(M, 'bAB'), true);
  assert.equal(accepts(M, 'bab'), false);
});

test('English: unclear input is rejected instead of guessed', () => {
  assert.throws(() => generate({ desc: 'ends with ab and starts with b or contains a' }), /Mixing/);
  assert.throws(() => generate({ desc: 'ends with ab followed by b' }), /isn’t supported/);
  assert.throws(() => generate({ desc: 'strings that end with' }), /Couldn’t read/);
  assert.throws(() => generate({ desc: 'something else entirely' }), /Couldn’t read/);
  assert.throws(() => generate({ desc: 'even number of ab' }), /single symbol/);
});

test('bare "e" is an ordinary symbol, not ε', () => {
  const M = parse('type: nfa\nstart: q0\naccept: q1\nq0, e -> q1');
  assert.deepEqual(M.alpha, ['e']);
  assert.equal(accepts(M, 'e'), true);
  assert.equal(accepts(M, ''), false);
});
