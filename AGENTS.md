# Notes for coding agents

Node >= 20. No build step is needed to run tests or the CLI.

## Verify your changes
```bash
npm install
npm run verify        # tests + build of website/index.html + DOM smoke test of the built site; exit 0 = good
npm run test:quiet    # tests only, compact
npm test              # tests only, one line per test
```

## Use the CLI to check a machine
```bash
node bin/automata.js build   --english "ends with ab" --json
node bin/automata.js build   --regex "(a|b)*ab" --format table      # text|table|grammar|edges|json|all
node bin/automata.js convert --file machine.txt                      # NFA/DFA -> minimal DFA
node bin/automata.js test    --english "ends with ab" --accept ab,aab --reject a,ba,"" --json
node bin/automata.js test    --regex "(ab)*" --equals-english "even number of a" ; echo $?
```
Exit codes: `0` ok, `1` a check failed, `2` bad usage / unreadable input (message on stderr).
`test --json` prints `{ ok, passed, failed, checks: [{ name, pass, detail }], machine }`.
In `--accept/--reject` lists, `""` or `eps` is the empty string. `--equals-*` brute-forces all strings up to `--max-length` (default 8).

## Where things live
`src/core/*` is pure logic (no DOM): parse, generate (English), regex, dfa (product/subset/minimise), grammar, simulate (accepts, trace), format.
`src/index.js` re-exports it for programmatic use. `src/render/*` + `src/main.js` are the browser UI. Tests: `test/*.test.js` (`node:test`).
Machine text format: see README.
