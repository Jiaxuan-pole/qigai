# Engine integration-test review

Scope: `tests/engine.test.js`, `tests/engine-fixtures.js` only.

## Verdict

- codeQualityStatus: CLEAR
- recommendation: APPROVE
- blockers: None in the reviewed test implementation.

## Evidence checked

- Ran `node --test tests/engine.test.js`: 26 tests; 23 pass and 3 fail.
- Ran `npm test`: 120 tests; 116 pass and 4 fail. The additional autoplay failure is outside this review scope.
- Read the fresh-state, scheduling, settlement, event, health, and planning paths in `public/game/`.
- The test-level `before(async () => await loadData())` at `tests/engine.test.js:15-17` runs before any call to `fresh()` through the fixtures. `ready()` creates every scenario from `fresh(seed)` at `tests/engine-fixtures.js:3-15`; its helpers only set the condition needed by the scenario.

## Expected engine-contract failures (not test defects)

1. **Cash preflight source location:** `tests/engine.test.js:27-44` correctly requires atomic state plus `{ actorId, slot }`. The cash aggregate error in `public/game/settle.js:90-93` omits that location, so `settle()` returns `at: null` at `public/game/settle.js:163-167`.
2. **Tail scheduler acceptance:** `tests/engine.test.js:338-344` correctly invokes the public `assign()` seam. `public/game/engine.js:121-123` rejects every non-`planning` phase before it can accept tail rescue actions.
3. **Stale already-spawned event cast:** `tests/engine.test.js:369-376` creates the event from `fresh(260916)`, kills the actor by a real settlement, then checks the observable cast state. `kill()` in `public/game/settle.js:115-124` does not update `state.events[*].cast`.

These are three genuine, deliberately preserved engine-contract failures. They are not false positives, tautological assertions, or defects in the tests.

## Coverage and quality assessment

The test file covers the requested integrated behavior through public engine seams: atomic preflight variants (`27-44`), meeting/night turn progression (`46-65`), downed/death/rescue lifecycle (`67-115`), teaching protection (`117-129`), ticket and shop constraints (`131-195`), shared NPC begging (`197-214`), wishes and crisis (`216-258`), disease/care and hygiene exposure (`260-300`), night-down recovery window (`302-315`), day-100 tail (`317-355`), dead-actor scheduling/event behavior (`357-388`), event expiry/rebooking (`392-408`), and deterministic JSON/repeated settlement (`410-415`). Assertions observe results and state transitions rather than copied production constants.

`tests/engine-fixtures.js` is a small, focused state-construction layer. It contains no production parsing, normalization, or extraction; it preserves use of public `assign()` for normal planning and reserves direct mutation for exceptional state setup. No deletion-only test, prompt-text test, implementation-mirroring test, untyped escape hatch, needless abstraction, or test-only production logic was found.

## Skill-perspective check

Ran both required perspectives:

- `remove-ai-slops`: no overfit/slop findings in tests or the reviewed production seams. The tests pin observable behavior and do not merely encode a requested removal.
- `programming`: no brittle prompt tests, implementation-mirroring assertions, untyped escape hatches, needless abstraction, or unnecessary boundary validation/parsing found in the reviewed test code.

## Findings by severity

- CRITICAL: None.
- HIGH: None in reviewed tests.
- MEDIUM: None.
- LOW: None.
