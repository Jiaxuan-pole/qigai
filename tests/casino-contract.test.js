import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from '../public/game/engine.js';
import { loadData } from '../public/game/data.js';
import { freshCasinoVenue, inviteCasino, applyCasinoTransaction, casinoObservation, validateCasinoState, assertConservation, MAX_CASINO_MONEY } from '../public/game/casino-contract.js';

before(async () => { await loadData(); });

function invited() {
  const state = fresh(19);
  state.pendingMorning = null;
  return inviteCasino(state, 'xuan').state;
}

test('invitation creates persistent identity and funded venue without charging', () => {
  const original = fresh(19);
  original.pendingMorning = null;
  const { state, events } = inviteCasino(original, 'xuan');
  assert.equal(state.cash, original.cash);
  assert.deepEqual(state.casinoVenue, { casinoSeq: 1, bankrolls: { hall_lan: 30, hall_qiao: 30, hall_dealer: 100 } });
  assert.equal(state.pending.casino.sessionId, '19:1:0:xuan:1');
  assert.equal(state.pending.casino.phase, 'invited');
  assert.equal(events[0].type, 'casinoInvited');
  assert.equal(original.casinoVenue, undefined);
  assert.deepEqual(assertConservation({ ...original, casinoVenue: freshCasinoVenue() }, state), { before: 232, after: 232 });
});

test('observation includes only acting NPC cards', () => {
  const state = invited();
  state.pending.casino.phase = 'playing';
  state.pending.casino.game = 'texas';
  state.pending.casino.handSeq = 1;
  state.pending.casino.allowedActions = [{ id: 'call', amount: 2, secret: 'omit' }];
  state.pending.casino.session = {
    chips: { xuan: 10, hall_lan: 8, hall_qiao: 12 },
    events: [{ seq: 1, id: 'xuan', action: 'bet', amount: 2, hidden: 'omit' }],
    cur: { deck: [0, 1, 2, 3], hole: { hall_lan: [4, 5], hall_qiao: [6, 7], xuan: [8, 9] }, board: [10, 11, 12], turn: 'hall_lan' },
  };
  const view = casinoObservation(state, 'hall_lan');
  assert.deepEqual(view.ownCards, [4, 5]);
  assert.deepEqual(view.board, [10, 11, 12]);
  assert.equal(view.requestId, `${view.sessionId}:1:0:${state.stateRevision}:hall_lan`);
  assert.deepEqual(view.allowedActions, [{ id: 'call', amount: 2 }]);
  assert.deepEqual(view.publicActions, [{ seq: 1, id: 'xuan', action: 'bet', amount: 2 }]);
  const json = JSON.stringify(view);
  for (const secret of ['deck', 'hands', 'hole', '6,7', '8,9', 'secret', 'hidden']) assert.equal(json.includes(secret), false, secret);
  assert.equal(Object.hasOwn(view, 'session'), false);
});

test('unseen ZJH and dealer blackjack observation conceal private cards', () => {
  const state = invited();
  state.pending.casino.phase = 'playing';
  state.pending.casino.game = 'zjh';
  state.pending.casino.session = { chips: {}, events: [], cur: { seen: {}, hands: { hall_lan: [1, 2, 3] }, deck: [4] } };
  assert.deepEqual(casinoObservation(state, 'hall_lan').ownCards, []);
  state.pending.casino.session.cur.seen.hall_lan = true;
  assert.deepEqual(casinoObservation(state, 'hall_lan').ownCards, [1, 2, 3]);
  state.pending.casino.game = 'blackjack';
  state.pending.casino.session.cur = { hands: { hall_lan: [1, 2], hall_qiao: [3, 4] }, dealerCards: [5, 6], deck: [7] };
  const view = casinoObservation(state, 'hall_dealer');
  assert.deepEqual(view.ownCards, []);
  assert.equal(view.dealerUpcard, 5);
  assert.equal(JSON.stringify(view).includes('dealerCards'), false);
});

test('duplicate transaction is inert', () => {
  const before = invited();
  before.pending.casino.phase = 'playing';
  before.pending.casino.game = 'texas';
  before.pending.casino.session = { cur: {} };
  const once = applyCasinoTransaction(before, { actionId: 'buy:1', from: 'cash', to: 'escrow:xuan', amount: 10 }).state;
  const twice = applyCasinoTransaction(once, { actionId: 'buy:1', from: 'cash', to: 'escrow:xuan', amount: 10 });
  assert.equal(twice.state, once);
  assert.deepEqual(twice.events, []);
  assert.equal(once.cash, before.cash - 10);
  assert.equal(once.pending.casino.escrow.xuan, 10);
  assert.equal(once.pending.casino.actionSeq, 1);
  assert.deepEqual(assertConservation(before, once), { before: 232, after: 232 });
  const createdMoney = structuredClone(once);
  createdMoney.casinoVenue.bankrolls.hall_lan += 1;
  assert.throws(() => assertConservation(before, createdMoney), /资金不守恒/);
  assert.equal(before.cash, 72);
});

test('dealer reserve moves to escrow and returns exactly once', () => {
  const before = invited();
  before.pending.casino.phase = 'playing';
  before.pending.casino.game = 'blackjack';
  before.pending.casino.session = { cur: {}, bank: 0 };
  assert.equal(before.pending.casino.escrow.hall_dealer, 0);
  const reserved = applyCasinoTransaction(before, { actionId: 'reserve:1', from: 'dealerBank', to: 'escrow:hall_dealer', amount: 20 }).state;
  assert.equal(reserved.casinoVenue.bankrolls.hall_dealer, 80);
  assert.equal(reserved.pending.casino.escrow.hall_dealer, 20);
  assert.deepEqual(assertConservation(before, reserved), { before: 232, after: 232 });
  const returned = applyCasinoTransaction(reserved, { actionId: 'return:1', from: 'escrow:hall_dealer', to: 'dealerBank', amount: 20 }).state;
  assert.equal(returned.casinoVenue.bankrolls.hall_dealer, 100);
  assert.equal(returned.pending.casino.escrow.hall_dealer, 0);
  assert.deepEqual(assertConservation(before, returned), { before: 232, after: 232 });
  const retry = applyCasinoTransaction(returned, { actionId: 'return:1', from: 'escrow:hall_dealer', to: 'dealerBank', amount: 20 });
  assert.equal(retry.state, returned);
  assert.deepEqual(retry.events, []);
  assert.equal(retry.state.pending.casino.actionSeq, 2);
  assert.equal(before.casinoVenue.bankrolls.hall_dealer, 100);
});

test('invalid funds and duplicate IDs fail without mutation', () => {
  const s = invited();
  const snapshot = structuredClone(s);
  assert.throws(() => applyCasinoTransaction(s, { actionId: 'bad', from: 'cash', to: 'escrow:xuan', amount: -1 }), /无效的交易/);
  assert.throws(() => applyCasinoTransaction(s, { actionId: 'bad', from: 'cash', to: 'escrow:xuan', amount: 999 }), /交易资金不足/);
  assert.deepEqual(s, snapshot);
  s.pending.casino.appliedActionIds = ['a', 'a'];
  s.pending.casino.actionSeq = 2;
  assert.throws(() => validateCasinoState(s), /重复或无效交易 ID/);
  s.pending.casino.appliedActionIds = [];
  s.cash = -1;
  assert.throws(() => validateCasinoState(s), /无效的玩家现金/);
  s.cash = MAX_CASINO_MONEY + 1;
  assert.throws(() => validateCasinoState(s), /无效的玩家现金/);
  s.cash = 72;
  s.casinoVenue.bankrolls.hall_qiao = -1;
  assert.throws(() => validateCasinoState(s), /无效的 NPC 资金/);
});
