# Automata Studio

> **Demo it in 10 seconds:** open **`website/index.html`** in any browser. No install, no server, no internet needed.
> Everything (this source code, the finished website, the CLI and the tests) is in this one folder.

Describe a machine, get its **state diagram**, **transition table** and **grammar**.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # brute-force checks every generated machine against an independent oracle
npm run build   # the website: website/index.html (one self-contained file)
```

## Test a string (live demo)

Under the diagram, type a string and press **Step ▶** (or **Play**): the active state(s) light up in the diagram, the tape shows
what has been read, and the verdict says *Accepted* / *Rejected* (with the reason if a transition is missing). NFAs light up
several states at once; Moore/Mealy machines show their output string. **Enter** jumps to the end.

## Deploy as a website

`npm run build` produces **`website/index.html`**: one self-contained file (HTML + CSS + JS inlined, no external requests,
all processing happens in the visitor's browser). Put it anywhere that serves static files, or just double-click it.

| Where | How |
| --- | --- |
| Any static host / S3 / your own server | upload `website/index.html` |
| Netlify | drag the `website` folder onto app.netlify.com/drop, or connect the repo (`netlify.toml` is included) |
| Vercel | import the repo; framework preset "Vite" (build `npm run build`, output `website`) |
| GitHub Pages | push to `main`; enable Settings → Pages → Source: GitHub Actions (`.github/workflows/pages.yml` builds, tests and deploys) |

`npm run verify` runs the tests, builds the site and smoke-tests the built page (loads it in a DOM and clicks through the main flows).

## Command line

The same engine runs headless (handy for scripts and CI):

```bash
node bin/automata.js build   --english "ends with ab"              # machine text + table + grammar + edges
node bin/automata.js build   --english "moore: 1 when ends with ab, else 0"   # Moore/Mealy output machine
node bin/automata.js build   --regex "(a|b)*ab" --machine mealy     # dfa | nfa | moore | mealy
node bin/automata.js build   --regex "(a|b)*ab" --format table      # text | table | grammar | edges | json
node bin/automata.js convert --file machine.txt                      # DFA/NFA -> minimal DFA
node bin/automata.js test    --english "ends with ab" --accept ab,aab --reject a,ba
node bin/automata.js test    --regex "(a|b)*ab" --equals-english "ends with ab"
npm link && automata --help                                          # optional: install as `automata`
```

`test` exits `0` when every check passes, `1` when one fails, `2` on bad usage; add `--json` for machine-readable
results. `npm run verify` runs the whole test suite plus a production build. See `AGENTS.md` for the agent-oriented summary.

## Input

**Plain English** — "strings ending with ab", "starts with ba", "contains aab", "even number of a",
"does not contain bb". Join clauses with `and` or `or` (one kind per sentence):
"starts with a and does not contain bb". Anything it can't read is rejected with a message rather than guessed.

**Moore / Mealy from a prompt** — say what to emit when the condition holds: `moore: 1 when ends with ab, else 0`,
`mealy: Y if starts with a, otherwise N`. A Moore machine shows one output per prefix (including the empty prefix);
a Mealy machine shows one output per transition. Without an `else` the other output defaults to `0` (or `1` when the
main output is `0`). Works for regexes too, or pick Moore/Mealy in the UI with a plain condition.

**Regular expression** — symbols, `|`, `*`, `+`, `?`, `( )`; `ε` or an empty group for the empty string; `\` escapes.
*NFA* gives the Thompson ε-NFA, *Minimal DFA* gives subset construction + minimisation.

**Machine text** — type it directly (or edit what was generated):

```
type: nfa            # dfa | nfa | moore | mealy
start: q0
accept: q2
q0, a -> q0, q1      # several targets = nondeterminism
q1, b -> q2
q2, eps -> q0        # eps (or ε / λ / epsilon) = empty move; a bare "e" is a normal symbol
```

Mealy: `q0, 1 -> q1 / 0` (output after the slash). Moore: `out q1 = 1`.
"Convert to minimal DFA" turns any DFA/NFA in the text box into its minimal DFA.

## Layout

```
src/core/parse.js      text format -> machine object, edge merging, warnings
src/core/generate.js   plain English -> machine text (clauses, and/or, negation, parity)
src/core/regex.js      regex parser, Thompson construction, regex -> NFA / minimal DFA
src/core/dfa.js        product, complement, subset construction, minimisation
src/core/grammar.js    machine -> right-linear / translation grammar
src/core/simulate.js   accepts() and trace() (step-by-step run behind the "Test a string" panel)
src/render/*.js        SVG diagram and HTML table (strings, no framework)
src/main.js            wires the DOM
test/*.test.js         node:test suites
```

`src/core` has no DOM code, so it can be reused from a CLI or an API.

## Ideas for next steps

Test-a-string box using `simulate.js`, better graph layout (elkjs/dagre), TikZ and JFLAP export,
DFA → regex, left-linear grammars, PDA / Turing machines, TypeScript.
