export const EXAMPLES = {
  DFA: `type: dfa
# strings ending in 01
start: q0
accept: q2
q0, 0 -> q1
q0, 1 -> q0
q1, 0 -> q1
q1, 1 -> q2
q2, 0 -> q1
q2, 1 -> q0`,
  NFA: `type: nfa
start: q0
accept: q2
q0, a -> q0, q1
q0, b -> q0
q1, b -> q2
q2, eps -> q0`,
  Moore: `type: moore
# output 1 after seeing 11
start: q0
out q0 = 0
out q1 = 0
out q2 = 1
q0, 0 -> q0
q0, 1 -> q1
q1, 0 -> q0
q1, 1 -> q2
q2, 0 -> q0
q2, 1 -> q2`,
  Mealy: `type: mealy
# output 1 when the last two bits are 11
start: q0
q0, 0 -> q0 / 0
q0, 1 -> q1 / 0
q1, 0 -> q0 / 0
q1, 1 -> q1 / 1`,
};

// A string worth trying on each example (clicking an example button fills the tester with it).
export const PROBES = { DFA: '1101', NFA: 'abab', Moore: '0110', Mealy: '0110' };

// Sample for the "Transition table" input mode: symbols ending with ab, written as a table.
export const TABLE_EXAMPLE = `State    a    b
->  q0   q1   q0
    q1   q1   q2
*   q2   q1   q0`;
