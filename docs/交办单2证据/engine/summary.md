# Engine integration evidence

- Scenario: baseline regression. Invocation: `npm test`. PASS observable: 85 tests, 85 pass, 0 fail. Artifact: `baseline.log`.
- Scenario: syntax. Invocation: `node --check tests/engine.test.js` and `node --check tests/engine-fixtures.js`. PASS observable: exit 0. Artifacts: `node-check.log`, `fixtures-node-check.log`.
- Scenario: full engine contract suite. Invocation: `node --test tests/engine.test.js`. Observable: 26 tests, 23 pass, 3 contract failures. Artifact: `engine-test.log`.
- Contract failure 1: cash preflight atomic result has `at=null`, expected `{actorId:'xuan',slot:0}`.
- Contract failure 2: tail `assign(...,'aid')` returns a phase error.
- Contract failure 3: a retained event cast still contains a dead actor.
- Mutation scenarios: turn progression, ticket quota, matching care, event expiry, wish pressure each fail under one isolated regression mutation and pass against current source. Artifacts: `mutation-*-red.log`, `mutation-*-green.log`.
- Reviewer scenario: read-only code review. Observable: APPROVE, no test blockers. Artifact: `code-review.md`.
- Cleanup: no persistent runtime resources were created.
