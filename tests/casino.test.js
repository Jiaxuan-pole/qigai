import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, canStartCasino, startCasino, casinoAction, applyCasinoNpcChoice, nextCasinoHand, finishCasino, startCardNight, cardAction, nextHand, finishCardNight } from '../public/game/engine.js';
import { inviteCasino, assertConservation } from '../public/game/casino-contract.js';
import { validateSave } from '../public/game/save.js';
import { loadData } from '../public/game/data.js';

before(async () => { await loadData(); });

function hall(seed = 19) {
  const s = fresh(seed);
  s.pendingMorning = null;
  s.actors.xuan.location = 'cardhall';
  s.hour = 15; s.hourTick = 9; s.slot = 2; s.turn = 2;
  return inviteCasino(s, 'xuan').state;
}

test('hall Texas pays from NPC bankroll', () => {
  const before = hall();
  let s = startCasino(before, 'texas').state;
  assert.equal(s.cash, before.cash - 10);
  assert.equal(s.daily.bets, before.daily.bets + 1);
  for (let i = 0; i < 100 && !s.pending.casino.session.cur.over; i++) {
    const c = s.pending.casino;
    const a = c.allowedActions.find((x) => ['check', 'call'].includes(x.id)) || c.allowedActions.find((x) => x.id === 'fold') || c.allowedActions[0];
    const r = c.session.cur.turn === 'xuan' ? casinoAction(s, a) : applyCasinoNpcChoice(s, { action: a, sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq, stateRevision: s.stateRevision, npcId: c.session.cur.turn });
    assert.equal(r.error, undefined);
    s = r.state;
    assert.equal(validateSave(s).ok, true);
  }
  assert.equal(s.pending.casino.session.cur.over, true);
  s = finishCasino(s).state;
  assert.equal(Object.values(s.pending.casino.escrow).reduce((a, b) => a + b), 0);
  assert.equal(validateSave(s).ok, true);
  assert.deepEqual(assertConservation(before, s), { before: 232, after: 232 });
});

test('midhand exit settles once', () => {
  for (const game of ['blackjack', 'zjh', 'texas']) {
    const s = startCasino(hall(), game).state;
    const closed = finishCasino(s).state;
    assert.equal(validateSave(closed).ok, true);
    assert.equal(Object.values(closed.pending.casino.escrow).reduce((a, b) => a + b), 0);
    assert.equal(finishCasino(closed).state, closed);
  }
});

test('tampered seat chips cannot pass save or cash out', () => {
  const s = startCasino(hall(), 'zjh').state;
  const bad = structuredClone(s);
  bad.pending.casino.session.chips = { xuan: 27, hall_lan: 0, hall_qiao: 0 };
  assert.equal(validateSave(bad).ok, false);
  const closed = finishCasino(bad);
  assert.equal(closed.state, bad);
  assert.ok(closed.error);
  assert.equal(bad.cash, 62);
});

test('declined invitation keeps cash and daily cap and remains saveable', () => {
  const invited = hall();
  const out = finishCasino(invited);
  assert.equal(out.error, undefined);
  assert.equal(out.state.pending.casino, null);
  assert.equal(out.state.cash, invited.cash);
  assert.equal(out.state.daily.bets, invited.daily.bets);
  assert.equal(validateSave(out.state).ok, true);
});

test('replay rejects seat, deck, turn and action journal tampering', () => {
  const base = startCasino(hall(), 'texas').state;
  const first = base.pending.casino.allowedActions[0];
  const c = base.pending.casino;
  const acted = c.session.cur.turn === c.actorId ? casinoAction(base, first).state
    : applyCasinoNpcChoice(base, { action: first, sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq, stateRevision: base.stateRevision, npcId: c.session.cur.turn }).state;
  const mutations = [
    (s) => { s.pending.casino.session.chips.xuan++; s.pending.casino.session.chips.hall_lan--; },
    (s) => { const d = s.pending.casino.session.cur.deck; [d[0], d[1]] = [d[1], d[0]]; },
    (s) => { s.pending.casino.session.cur.turn = s.pending.casino.session.cur.turn === 'xuan' ? 'hall_lan' : 'xuan'; },
    (s) => { s.pending.casino.playLog[1].actor = 'wrong'; },
    (s) => { delete s.pending.casino.playLog; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(acted);
    mutate(bad);
    assert.equal(validateSave(bad).ok, false);
    const closed = finishCasino(bad);
    assert.equal(closed.state, bad);
    assert.ok(closed.error);
  }
});

test('three funded games replay across seeds and JSON restores', () => {
  for (const game of ['zjh', 'texas', 'blackjack']) for (const seed of [1, 19, 67]) {
    let s = startCasino(hall(seed), game).state;
    for (let i = 0; i < 500; i++) {
      const c = s.pending.casino;
      if (c.session.cur.over) {
        if (c.session.done || c.handSeq >= 5) break;
        const next = nextCasinoHand(s);
        if (next.error) break;
        s = JSON.parse(JSON.stringify(next.state));
        assert.equal(validateSave(s).ok, true, `${game}/${seed}/hand: ${validateSave(s).reason}`);
        continue;
      }
      const action = c.allowedActions.find((a) => ['check', 'call', 'stand'].includes(a.id)) || c.allowedActions.find((a) => a.id === 'fold') || c.allowedActions[0];
      const r = c.session.cur.turn === c.actorId ? casinoAction(s, action)
        : applyCasinoNpcChoice(s, { action, sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq, stateRevision: s.stateRevision, npcId: c.session.cur.turn });
      assert.equal(r.error, undefined, `${game}/${seed}/${i}`);
      s = JSON.parse(JSON.stringify(r.state));
      assert.equal(validateSave(s).ok, true, `${game}/${seed}/${i}: ${validateSave(s).reason}`);
    }
    assert.equal(s.pending.casino.session.cur.over, true, `${game}/${seed}`);
    const done = finishCasino(s);
    assert.equal(done.error, undefined);
    assert.equal(validateSave(done.state).ok, true);
    assert.equal(finishCasino(done.state).state, done.state);
  }
});

test('hall ZJH refuses stale NPC choice and restores same deck', () => {
  let s = startCasino(hall(), 'zjh').state;
  const saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(saved.pending.casino.session.cur.deck, s.pending.casino.session.cur.deck);
  const c = s.pending.casino;
  const wrong = applyCasinoNpcChoice(s, { action: c.allowedActions[0], sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq + 1, stateRevision: s.stateRevision, npcId: c.session.cur.turn });
  assert.equal(wrong.state, s);
  assert.ok(wrong.error);
  s = finishCasino(s).state;
  assert.equal(validateSave(s).ok, true);
});

test('hall blackjack completes a hand and pays funded dealer', () => {
  const before = hall();
  let s = startCasino(before, 'blackjack').state;
  for (let i = 0; i < 40 && !s.pending.casino.session.cur.over; i++) {
    const c = s.pending.casino;
    const action = c.allowedActions.find((a) => a.id === 'stand') || c.allowedActions.find((a) => a.id === 'hit');
    const result = c.session.cur.turn === c.actorId ? casinoAction(s, action) : applyCasinoNpcChoice(s, { action, sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq, stateRevision: s.stateRevision, npcId: c.session.cur.turn });
    assert.equal(result.error, undefined);
    s = result.state;
    assert.equal(validateSave(s).ok, true);
  }
  assert.equal(s.pending.casino.session.cur.over, true);
  const handOne = s.pending.casino.session.cur.deck;
  const again = nextCasinoHand(s);
  if (!again.error) {
    s = again.state;
    assert.equal(s.pending.casino.handSeq, 2);
    assert.notDeepEqual(s.pending.casino.session.cur.deck, handOne);
  }
  s = finishCasino(s).state;
  assert.equal(validateSave(s).ok, true);
  assert.equal(s.pending.casino.escrow.hall_dealer, 0);
  assert.deepEqual(assertConservation(before, s), { before: 232, after: 232 });
});

test('invalid amount and missing NPC identity leave funds untouched', () => {
  const s = startCasino(hall(), 'texas').state;
  const action = s.pending.casino.allowedActions.find((a) => a.amount !== undefined);
  const bad = action ? casinoAction(s, { ...action, amount: action.amount + 99 }) : casinoAction(s, { id: 'bet', amount: 999 });
  assert.equal(bad.state, s);
  assert.ok(bad.error);
  const noId = applyCasinoNpcChoice(s, { action: s.pending.casino.allowedActions[0], npcId: null });
  assert.equal(noId.state, s);
  assert.ok(noId.error);
  const nullAction = casinoAction(s, null);
  assert.equal(nullAction.state, s);
  assert.ok(nullAction.error);
});

test('custom hall buy-in and base bet fund all three games and restore', () => {
  for (const game of ['zjh', 'texas', 'blackjack']) {
    const invited = hall();
    const started = startCasino(invited, game, { buyIn: 25, baseBet: 3 });
    assert.equal(started.error, undefined, game);
    const s = started.state;
    const c = s.pending.casino;
    assert.equal(s.cash, invited.cash - 25);
    assert.equal(s.casinoVenue.bankrolls.hall_lan, 5);
    assert.equal(s.casinoVenue.bankrolls.hall_qiao, 5);
    assert.equal(c.buyIn, 25);
    assert.equal(c.baseBet, 3);
    assert.equal(c.session.buyIn ?? 25, 25);
    if (game === 'zjh') { assert.equal(c.session.cur.stake, 3); assert.equal(c.session.cur.pot, 6); }
    if (game === 'texas') assert.equal(c.session.cur.pot, 4);
    if (game === 'blackjack') {
      assert.equal(c.session.cur.bets.xuan, 3);
      assert.equal(c.escrow.hall_dealer, 36);
      assert.equal(s.casinoVenue.bankrolls.hall_dealer, 64);
    }
    assert.equal(validateSave(JSON.parse(JSON.stringify(s))).ok, true, game);
    const closed = finishCasino(JSON.parse(JSON.stringify(s))).state;
    assert.equal(validateSave(closed).ok, true, game);
    assert.equal(finishCasino(closed).state, closed);
  }
});

test('custom amounts reject invalid or unfunded values atomically', () => {
  const invited = hall();
  for (const options of [{ buyIn: 0, baseBet: 2 }, { buyIn: 25.5, baseBet: 3 }, { buyIn: 25, baseBet: 0 },
    { buyIn: 25, baseBet: 3.5 }, { buyIn: 31, baseBet: 3 }, { buyIn: 25, baseBet: 26 }, { buyIn: '', baseBet: 3 },
    { buyIn: 25, baseBet: 1_000_001 }]) {
    const result = startCasino(invited, 'texas', options);
    assert.equal(result.state, invited);
    assert.ok(result.error);
  }
  assert.equal(invited.pending.casino.phase, 'invited');
  assert.equal(invited.cash, 72);
  assert.equal(startCasino(invited, 'blackjack', { buyIn: 25, baseBet: 9 }).state, invited);
  const richNpcs = structuredClone(invited);
  richNpcs.casinoVenue.bankrolls.hall_lan = 100;
  richNpcs.casinoVenue.bankrolls.hall_qiao = 100;
  assert.equal(startCasino(richNpcs, 'texas', { buyIn: 73, baseBet: 3 }).state, richNpcs);
});

test('custom Texas raise amount is legal beyond AI candidates and replays exactly', () => {
  let s = startCasino(hall(), 'texas', { buyIn: 25, baseBet: 3 }).state;
  const c = s.pending.casino;
  assert.equal(c.session.cur.turn, c.actorId);
  assert.equal(c.allowedActions.some((a) => a.id === 'raise' && a.amount === 7), false);
  const r = casinoAction(s, { id: 'raise', amount: 7 });
  assert.equal(r.error, undefined);
  s = JSON.parse(JSON.stringify(r.state));
  assert.equal(validateSave(s).ok, true, validateSave(s).reason);
  assert.deepEqual(s.pending.casino.playLog.at(-1).action, { id: 'raise', amount: 7 });
  const bad = structuredClone(s);
  bad.pending.casino.baseBet = 4;
  assert.equal(validateSave(bad).ok, false);
  const changedBuyIn = structuredClone(s);
  changedBuyIn.pending.casino.buyIn = 24;
  assert.equal(validateSave(changedBuyIn).ok, false);
});

test('custom table key binds amount configuration to deterministic deck', () => {
  const invited = hall();
  const a = startCasino(invited, 'texas', { buyIn: 25, baseBet: 3 }).state.pending.casino.session;
  const b = startCasino(invited, 'texas', { buyIn: 20, baseBet: 3 }).state.pending.casino.session;
  assert.equal(a.sessionId, b.sessionId);
  assert.notEqual(a.tableKey, b.tableKey);
  assert.notDeepEqual(a.cur.deck, b.cur.deck);
});

test('night blackjack retains three-person internal cash and free mode', () => {
  for (const stakes of ['cash', 'free']) {
    const base = fresh(24);
    base.pendingMorning = null;
    base.metMa = true;
    base.actors.ma.life = 'active';
    base.items.push({ uid: 'qa-cards', itemId: 'cards', container: 'camp' });
    const started = startCardNight(base, { game: 'blackjack', stakes, controller: 'xuan' });
    assert.equal(started.error, undefined);
    let s = started.state;
    assert.notEqual(s.pending.cards.dealerId, 'xuan');
    assert.equal(s.pending.cards.players.includes('xuan'), true);
    for (let i = 0; i < 30 && !s.pending.cards.cur.over; i++) {
      s = cardAction(s, 'stand').state;
    }
    assert.equal(s.pending.cards.cur.over, true);
    s = finishCardNight(s).state;
    assert.equal(s.cash, base.cash);
    assert.equal(s.pending.cards, null);
  }
});
