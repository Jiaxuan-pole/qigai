import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fresh, startCasino, finishCasino } from '../public/game/engine.js';
import { loadData } from '../public/game/data.js';
import { inviteCasino } from '../public/game/casino-contract.js';
import { blackjackAct } from '../public/game/blackjack.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { createSaveStore } from '../server/save-store.js';

before(async () => { await loadData(); });

function playing(game = 'zjh') {
  const state = fresh(19);
  state.pendingMorning = null;
  state.actors.xuan.location = 'cardhall';
  state.hour = 15; state.hourTick = 9; state.slot = 2; state.turn = 2;
  return startCasino(inviteCasino(state, 'xuan').state, game).state;
}

test('casino midway JSON roundtrip is exact', () => {
  const s = playing();
  assert.equal(validateSave(s).ok, true, validateSave(s).reason);
  const json = JSON.stringify(s);
  const loaded = normalizeSave(JSON.parse(json));
  assert.equal(JSON.stringify(loaded.pending.casino), JSON.stringify(s.pending.casino));
  assert.equal(loaded.pending.casino.session.cur.deck[loaded.pending.casino.session.cur.di], s.pending.casino.session.cur.deck[s.pending.casino.session.cur.di]);
  assert.deepEqual(normalizeSave(loaded), loaded);
  const closed = finishCasino(s).state;
  assert.equal(validateSave(closed).ok, true, validateSave(closed).reason);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(closed))).pending.casino.session, JSON.parse(JSON.stringify(closed.pending.casino.session)));
});

test('casino midway blackjack JSON roundtrip consumes next card once', () => {
  const s = playing('blackjack');
  const c = s.pending.casino;
  assert.equal(validateSave(s).ok, true, validateSave(s).reason);
  const loaded = normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(loaded.pending.casino.session, c.session);
  assert.equal(c.session.cur.turn, 'xuan');
  const before = c.session.cur.di;
  const expectedCard = c.session.cur.deck[before];
  const after = blackjackAct(loaded.pending.casino.session, 'hit').state;
  assert.equal(after.cur.di, before + 1);
  assert.equal(after.cur.hands.xuan.at(-1), expectedCard);
  const settled = finishCasino(s).state;
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(settled))).pending.casino, settled.pending.casino);
});

test('casino tampered escrow is invalid', () => {
  const s = playing();
  for (const change of [
    (x) => { x.pending.casino.escrow.xuan = -1; },
    (x) => { x.pending.casino.escrow.xuan = Infinity; },
    (x) => { x.pending.casino.escrow.xuan += 1; },
    (x) => { delete x.pending.casino.session.cur.deck; },
    (x) => { x.pending.casino.session.cur.di = 53; },
    (x) => { x.pending.casino.session.cur.deck[0] = x.pending.casino.session.cur.deck[1]; },
    (x) => { x.pending.casino.actionSeq = 2; },
  ]) {
    const bad = structuredClone(s); change(bad);
    assert.equal(validateSave(bad).ok, false);
  }
});

test('previous default hall sessions without amount fields still restore', () => {
  for (const game of ['zjh', 'texas', 'blackjack']) {
    const state = playing(game);
    const c = state.pending.casino;
    delete c.buyIn; delete c.baseBet;
    delete c.session.baseBet; delete c.session.bet;
    assert.equal(validateSave(state).ok, true, `${game}: ${validateSave(state).reason}`);
    const restored = normalizeSave(JSON.parse(JSON.stringify(state)));
    assert.equal(validateSave(restored).ok, true);
    assert.equal(finishCasino(restored).error, undefined);
  }
});

test('legacy venue and fishing queue normalize without changing cash or night cards', () => {
  const s = fresh(23);
  s.pending.cards = { game: 'legacy' };
  assert.equal(validateSave(s).ok, true);
  const loaded = normalizeSave(s);
  assert.deepEqual(loaded.casinoVenue.bankrolls, { hall_lan: 30, hall_qiao: 30, hall_dealer: 100 });
  assert.equal(loaded.pending.casino, null);
  assert.deepEqual(loaded.pending.fishingQte, []);
  assert.deepEqual(loaded.pending.cards, s.pending.cards);
  assert.equal(loaded.cash, s.cash);
});

test('fishing QTE queue rejects forged fields and persists resolved removal', () => {
  const s = normalizeSave(fresh(23));
  const bite = { id: 'fishQte:23:1:0:ma', actorId: 'ma', day: 1, hourTick: 0, skill: 60, fishItemId: 'fish_rare', zoneStart: 100, zoneWidth: 88 };
  s.pending.fishingQte = [bite];
  assert.equal(validateSave(s).ok, true);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(s))).pending.fishingQte, [bite]);
  for (const bad of [{ ...bite, id: 'forged' }, { ...bite, zoneWidth: 90 }, { ...bite, extra: true }, { ...bite, day: 2 }, { ...bite, skill: Infinity }]) {
    assert.equal(validateSave({ ...s, pending: { ...s.pending, fishingQte: [bad] } }).ok, false);
  }
  s.pending.fishingQte = [];
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(s))).pending.fishingQte, []);
});

test('shared casino save rejects stale payout revision', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cardhall-save-'));
  try {
    const store = createSaveStore(dir);
    const playingState = playing();
    const first = await store.create({ name: '牌局', state: playingState });
    const settled = finishCasino(playingState).state;
    const second = await store.update(first.id, { state: settled, expectedRevision: first.revision });
    assert.equal(second.revision, 2);
    await assert.rejects(store.update(first.id, { state: playingState, expectedRevision: first.revision }), { status: 409 });
    assert.equal((await store.get(first.id)).state.cash, settled.cash);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
