import test from 'node:test';
import assert from 'node:assert/strict';
import * as table from '../public/ui/cardtable.js';

test('deal timeline exposes a hidden moving card before the first 150ms arrival', () => {
  const frames = [];
  const rafs = [];
  const motion = table.createMotionTimeline?.({
    raf: (fn) => { rafs.push(fn); return rafs.length; },
    cancelRaf: () => {},
    now: () => 0,
    reduced: false,
    frame: (state) => frames.push(state),
  });
  assert.ok(motion, 'card table must provide a frame-driven motion timeline');
  motion.deal([{ id: 'xuan', index: 0 }]);
  assert.equal(frames.at(-1).kind, 'deal');
  assert.equal(frames.at(-1).progress, 0);
  assert.equal(frames.at(-1).arrived, 0);
  rafs.shift()(75);
  assert.ok(frames.at(-1).progress > 0 && frames.at(-1).progress < 1);
  rafs.shift()(150);
  assert.equal(frames.at(-1).arrived, 1);
  motion.cancel();
});

test('cancelled timeline cannot paint a replacement table', async () => {
  const frames = [];
  const rafs = [];
  const motion = table.createMotionTimeline?.({ raf: (fn) => { rafs.push(fn); return rafs.length; }, cancelRaf: () => {}, now: () => 0, reduced: false, frame: (state) => frames.push(state) });
  assert.ok(motion);
  motion.chips('xuan', 2);
  const before = frames.length;
  motion.cancel();
  for (const fn of rafs) fn(500);
  await new Promise((resolve) => setTimeout(resolve, 170));
  assert.equal(frames.length, before);
});

test('cards arrive in order and reduced motion settles without a frame request', async () => {
  const frames = [];
  const motion = table.createMotionTimeline({ raf: () => { throw new Error('reduced motion must not request a frame'); }, cancelRaf: () => {}, now: () => 0, reduced: true, frame: (state) => frames.push(state) });
  assert.equal(await motion.deal([{ id: 'ma', index: 0 }, { id: 'xuan', index: 0 }]), true);
  assert.deepEqual(frames.map(({ card, arrived }) => [card.id, arrived]), [['ma', 1], ['xuan', 2]]);
});


test('a frozen animation frame queue still reaches its deadline', async () => {
  const frames = [];
  const motion = table.createMotionTimeline({ raf: () => 1, cancelRaf: () => {}, now: () => 0, reduced: false, frame: (state) => frames.push(state) });
  assert.equal(await motion.deal([{ id: 'fan', index: 0 }]), true);
  assert.equal(frames.at(-1).progress, 1);
  assert.equal(frames.at(-1).card.id, 'fan');
});

test('an engine AI see event keeps its hand hidden to the controller', async () => {
  const { newSession, startHand, act } = await import('../public/game/cards.js');
  const state = { day: 3, seed: 41 };
  const session = newSession(state, { game: 'zjh', controller: 'ma' });
  startHand(state, session);
  const actor = session.cur.turn;
  assert.notEqual(actor, session.controller);
  assert.equal(act(state, session, 'see').error, undefined);
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const view = { chips: { ...session.chips }, pot: session.cur.pot, revealed: {}, seen: {}, folded: {}, streetBets: {} };
  const projected = projectCardEvent(view, session.events.at(-1), session.cur, 'zjh', session.controller).view;
  assert.equal(projected.seen[actor], true);
  assert.equal(projected.revealed[actor], undefined);
});

test('a real Texas raise moves only its unpaid street balance', async () => {
  const { newSession, startHand, act, legalActions, TEXAS } = await import('../public/game/cards.js');
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const state = { day: 3, seed: 48 };
  const session = newSession(state, { game: 'texas', controller: null });
  startHand(state, session);
  const actor = session.cur.turn;
  const before = session.cur.streetBets[actor];
  const raise = legalActions(session).find((item) => item.id === 'raise');
  assert.ok(raise);
  assert.equal(act(state, session, 'raise', raise.min).error, undefined);
  const event = session.events.at(-1);
  const view = { chips: { [actor]: 10 - before }, pot: TEXAS.smallBlind + TEXAS.bigBlind, revealed: {}, seen: {}, folded: {}, streetBets: { [actor]: before }, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order: [...session.cur.order] };
  const projected = projectCardEvent(view, event, session.cur, 'texas', null);
  assert.equal(projected.cost, event.to - before);
  assert.equal(projected.view.chips[actor], 10 - event.to);
});

test('real Texas preflop settlement resets bets before a flop bet and schedules board first', async () => {
  const { newSession, startHand, act, runAI } = await import('../public/game/cards.js');
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const state = { day: 3, seed: 2 };
  const session = newSession(state, { game: 'texas', controller: 'ma' });
  startHand(state, session);
  runAI(state, session);
  assert.equal(act(state, session, 'call').error, undefined);
  runAI(state, session);
  assert.deepEqual(session.events.slice(1, 6).map(({ id, action }) => [id, action]), [['ma', 'call'], ['xuan', 'call'], ['fan', 'check'], ['xuan', 'check'], ['fan', 'bet']]);
  const view = { chips: { xuan: 9, fan: 8, ma: 10 }, pot: 3, revealed: {}, seen: {}, folded: {}, streetBets: { xuan: 1, fan: 2, ma: 0 }, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order: [...session.cur.order] };
  let current = view;
  for (const event of session.events.slice(1, 4)) current = projectCardEvent(current, event, session.cur, 'texas', session.controller).view;
  assert.equal(current.boardTarget, 3, 'the flop must be queued after the preflop check');
  assert.deepEqual(current.streetBets, { xuan: 0, fan: 0, ma: 0 });
  current = projectCardEvent(current, session.events[4], session.cur, 'texas', session.controller).view;
  const flopBet = projectCardEvent(current, session.events[5], session.cur, 'texas', session.controller);
  assert.equal(flopBet.cost, 3);
  assert.equal(flopBet.view.chips.fan, 5);
  assert.equal(flopBet.view.pot, session.cur.pot);
});

test('real all-check flop opens a fresh turn balance before all-in', async () => {
  const { newSession, startHand, act, legalActions } = await import('../public/game/cards.js');
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const state = { day: 3, seed: 2 };
  const session = newSession(state, { game: 'texas', controller: null });
  startHand(state, session);
  const order = [...session.cur.order];
  const small = order[0], big = order[1];
  let view = { chips: { xuan: 10, fan: 10, ma: 10 }, pot: 3, revealed: {}, seen: {}, folded: {}, streetBets: { [small]: 1, [big]: 2, [order[2]]: 0 }, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order };
  view.chips[small] -= 1; view.chips[big] -= 2;
  const actAndProject = (action, amount = 0) => { assert.equal(act(state, session, action, amount).error, undefined); const out = projectCardEvent(view, session.events.at(-1), session.cur, 'texas', null); view = out.view; return out; };
  while (session.cur.stage === 'preflop') {
    const available = legalActions(session);
    actAndProject(available.some((item) => item.id === 'check') ? 'check' : 'call');
  }
  assert.equal(view.boardTarget, 3);
  while (session.cur.stage === 'flop') actAndProject('check');
  assert.equal(view.boardTarget, 4);
  assert.deepEqual(Object.values(view.streetBets), [0, 0, 0]);
  const actor = session.cur.turn;
  const allIn = legalActions(session).find((item) => item.id === 'allin');
  assert.ok(allIn);
  const before = view.chips[actor];
  const projected = actAndProject('allin');
  assert.equal(projected.cost, before);
  assert.equal(view.chips[actor], 0);
  assert.ok(view.pot >= 0);
});

test('real checked streets and turn betting reset the river balance', async () => {
  const { newSession, startHand, act, legalActions } = await import('../public/game/cards.js');
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const state = { day: 3, seed: 2 };
  const session = newSession(state, { game: 'texas', controller: null });
  startHand(state, session);
  const order = [...session.cur.order];
  let view = { chips: { xuan: 10, fan: 10, ma: 10 }, pot: 3, revealed: {}, seen: {}, folded: {}, streetBets: { [order[0]]: 1, [order[1]]: 2, [order[2]]: 0 }, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order };
  view.chips[order[0]]--; view.chips[order[1]] -= 2;
  const move = (action, amount = 0) => { assert.equal(act(state, session, action, amount).error, undefined); const out = projectCardEvent(view, session.events.at(-1), session.cur, 'texas', null); view = out.view; return out; };
  while (session.cur.stage === 'preflop') move(legalActions(session).some((item) => item.id === 'check') ? 'check' : 'call');
  assert.equal(view.boardTarget, 3);
  while (session.cur.stage === 'flop') move('check');
  assert.equal(view.boardTarget, 4);
  const bettor = session.cur.turn;
  move('bet', 2);
  while (session.cur.stage === 'turn') move(legalActions(session).some((item) => item.id === 'check') ? 'check' : 'call');
  assert.equal(view.boardTarget, 5);
  assert.deepEqual(Object.values(view.streetBets), [0, 0, 0]);
  const riverBettor = session.cur.turn;
  const before = view.chips[riverBettor];
  const firstRiverBet = move('bet', 2);
  assert.equal(firstRiverBet.cost, 2);
  assert.equal(view.chips[riverBettor], before - 2);
  assert.ok(view.pot >= 0);
});

test('real all-check preflop flop and turn reveal board targets in order', async () => {
  const { newSession, startHand, act, legalActions } = await import('../public/game/cards.js');
  const { projectCardEvent } = await import('../public/ui/card-motion.js');
  const state = { day: 3, seed: 2 };
  const session = newSession(state, { game: 'texas', controller: null });
  startHand(state, session);
  const order = [...session.cur.order];
  let view = { chips: { xuan: 10, fan: 10, ma: 10 }, pot: 3, revealed: {}, seen: {}, folded: {}, streetBets: { [order[0]]: 1, [order[1]]: 2, [order[2]]: 0 }, acted: {}, allin: {}, stage: 'preflop', boardTarget: 0, order };
  view.chips[order[0]]--; view.chips[order[1]] -= 2;
  for (const [street, expected] of [['preflop', 3], ['flop', 4], ['turn', 5]]) {
    while (session.cur.stage === street) { const action = legalActions(session).some((item) => item.id === 'check') ? 'check' : 'call'; assert.equal(act(state, session, action).error, undefined); view = projectCardEvent(view, session.events.at(-1), session.cur, 'texas', null).view; }
    assert.equal(view.boardTarget, expected);
    assert.deepEqual(Object.values(view.streetBets), [0, 0, 0]);
  }
});
