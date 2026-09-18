import test from 'node:test';
import assert from 'node:assert/strict';
import { cardNpcReply, checkCardNpcContext, validateCardNpcPayload } from '../server/card-npc-ai.js';

const context = () => ({
  requestId: 's:1:2:3:hall_lan', sessionId: 's', handSeq: 1, actionSeq: 2,
  stateRevision: 3, npcId: 'hall_lan', game: 'texas', ownCards: [1, 2],
  board: [3, 4, 5], dealerUpcard: null, publicChips: { hall_lan: 8, xuan: 9 },
  publicActions: [{ seq: 1, id: 'xuan', action: 'call', amount: 2 }],
  allowedActions: [{ id: 'call' }, { id: 'raise', amount: 4 }],
});
const choice = () => ({ requestId: 's:1:2:3:hall_lan', sessionId: 's', handSeq: 1, actionSeq: 2, stateRevision: 3, npcId: 'hall_lan', action: { id: 'raise', amount: 4 }, line: '这手跟你玩。' });

test('card NPC accepts exact legal action', () => {
  assert.equal(checkCardNpcContext(context()), null);
  assert.equal(validateCardNpcPayload(choice(), context()), true);
});

test('card NPC rejects hidden deck before model', () => {
  assert.match(checkCardNpcContext({ ...context(), deck: [0] }), /字段/);
  assert.match(checkCardNpcContext({ ...context(), publicChips: { ...context().publicChips, otherHole: [5] } }), /筹码/);
  assert.match(checkCardNpcContext({ ...context(), publicActions: [{ ...context().publicActions[0], hands: [1] }] }), /行动/);
});

test('card NPC rejects forged amounts, targets and stale echoes', () => {
  assert.equal(validateCardNpcPayload({ ...choice(), action: { id: 'raise', amount: 5 } }, context()), false);
  assert.equal(validateCardNpcPayload({ ...choice(), action: { id: 'call', target: 'xuan' } }, context()), false);
  assert.equal(validateCardNpcPayload({ ...choice(), stateRevision: 4 }, context()), false);
  assert.equal(validateCardNpcPayload({ ...choice(), cash: 500 }, context()), false);
  assert.equal(validateCardNpcPayload({ ...choice(), line: '<b>跟</b>' }, context()), false);
});

test('card NPC rejects hidden deck before model invocation', async () => {
  let calls = 0;
  const answer = await cardNpcReply({ ...context(), deck: [5] }, async () => { calls++; }, JSON.parse);
  assert.equal(answer.status, 400);
  assert.equal(calls, 0);
});

test('card NPC model timeout and extra prize never yield action', async () => {
  const timeout = await cardNpcReply(context(), async () => { throw new Error('timeout'); }, JSON.parse);
  assert.equal(timeout.status, 503);
  assert.equal(timeout.body.ok, false);
  const forged = await cardNpcReply(context(), async () => ({ text: JSON.stringify({ ...choice(), prize: 100 }), ms: 3 }), JSON.parse);
  assert.equal(forged.body.ok, false);
  assert.equal(Object.hasOwn(forged.body, 'payload'), false);
});
