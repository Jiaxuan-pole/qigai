import test from 'node:test';
import assert from 'node:assert/strict';
import { requestCardNpcChoice } from '../public/ui/card-npc.js';

function gameState() {
  return { cash: 20, ledger: { start: 20, income: 0, expense: 0 }, stateRevision: 4,
    casinoVenue: { casinoSeq: 1, bankrolls: { hall_lan: 30, hall_qiao: 30, hall_dealer: 100 } },
    pending: { casino: { phase: 'playing', sessionId: '1:7:3:xuan:1', seed: 1, day: 7,
      hourTick: 3, actorId: 'xuan', casinoSeq: 1, handSeq: 1, actionSeq: 2,
      appliedActionIds: [], game: 'blackjack', escrow: { xuan: 0, fan: 0, ma: 0, hall_lan: 0, hall_qiao: 0, hall_dealer: 0 },
      allowedActions: [{ id: 'hit' }], session: { game: 'blackjack', dealerId: 'hall_dealer',
        players: ['xuan', 'hall_lan'], chips: { xuan: 10, hall_lan: 10 },
        cur: { turn: 'hall_lan', over: false, hands: { hall_lan: [1, 2] }, bets: { hall_lan: 2 }, dealerCards: [3, 4] } } } } };
}
function aiPayload() {
  return { requestId: '1:7:3:xuan:1:1:2:4:hall_lan', sessionId: '1:7:3:xuan:1', handSeq: 1,
    actionSeq: 2, stateRevision: 4, npcId: 'hall_lan', action: { id: 'hit' }, line: '我再摸一张。' };
}

test('current NPC response acts once', async () => {
  const state = gameState();
  let count = 0;
  let request;
  const result = await requestCardNpcChoice(state, { getState: () => state,
    fetchImpl: async (_url, init) => { request = JSON.parse(init.body); return { ok: true, json: async () => ({ ok: true, payload: aiPayload() }) }; },
    apply: (action, meta) => { count++; assert.deepEqual(action, { id: 'hit' }); assert.deepEqual(meta, { source: 'ai', line: '我再摸一张。' }); state.stateRevision++; state.pending.casino.actionSeq++; } });
  assert.equal(count, 1);
  assert.equal(state.stateRevision, 5);
  assert.equal(result.source, 'ai');
  assert.equal(JSON.stringify(request).includes('deck'), false);
  assert.equal(JSON.stringify(request).includes('hands'), false);
  assert.equal(JSON.stringify(request).includes('otherHole'), false);
});

test('stale NPC response cannot act', async () => {
  const state = gameState();
  let release;
  let calls = 0;
  const pending = requestCardNpcChoice(state, { getState: () => state,
    fetchImpl: () => new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => ({ ok: true, payload: aiPayload() }) }); }),
    apply: () => { calls++; } });
  state.pending.casino.session.cur.turn = 'xuan';
  const before = structuredClone(state);
  release();
  assert.equal(await pending, null);
  assert.equal(calls, 0);
  assert.deepEqual(state, before);
});

test('timeout uses one local action', async () => {
  const state = gameState();
  let calls = 0;
  const result = await requestCardNpcChoice(state, { getState: () => state, timeoutMs: 5,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    apply: (action, meta) => { calls++; assert.deepEqual(action, { id: 'hit' }); assert.equal(meta.source, 'local'); } });
  assert.equal(calls, 1);
  assert.equal(result.source, 'local');
});
