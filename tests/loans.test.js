import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { borrow, canBorrow, extendLoan, LOANS, returnLoan, tickLoans } from '../public/game/loans.js';

before(async () => {
  await loadData();
});

function trust(state, npcId, value = 2) {
  state.relations[npcId] = { trust: value };
}

function putLoan(state, { from = 'reg_lu', actorId = 'xuan', due = state.day + 3, extended = false } = {}) {
  const thingId = LOANS[from].thingId;
  state.itemSeq += 1;
  const uid = 'it' + state.itemSeq;
  state.items.push({
    uid, itemId: thingId, container: actorId, uses: 1, obtainedTurn: state.turn,
    expiresDay: null, wet: false, dirty: false, loan: { from, due, extended },
  });
  state.loans.push({ uid, from, due, actorId, extended });
  return uid;
}

test('借物要求熟人信任、同街区且同一熟人没有未归还物', () => {
  const state = fresh(11);
  trust(state, 'reg_lu', 2);
  state.actors.xuan.location = 'recycle';

  assert.equal(canBorrow(state, 'reg_lu', 'xuan').ok, true);
  const result = borrow(state, 'reg_lu', 'xuan');
  assert.equal(result.ok, true);
  assert.equal(result.item.itemId, 'toolkit');
  assert.equal(result.item.loan.due, state.day + 3);
  assert.equal(canBorrow(state, 'reg_lu', 'xuan').ok, false);
  assert.equal(canBorrow(state, 'reg_lu', 'fan').ok, false);

  const noTrust = fresh(12);
  noTrust.actors.xuan.location = 'recycle';
  assert.equal(canBorrow(noTrust, 'reg_lu', 'xuan').ok, false);
});

test('归还必须由本人在熟人街区完成，到期日仍算按时', () => {
  const state = fresh(13);
  trust(state, 'reg_chen', 2);
  state.actors.xuan.location = 'station';
  const uid = putLoan(state, { from: 'reg_chen', due: state.day });

  state.items.find((item) => item.uid === uid).container = 'camp';
  assert.equal(returnLoan(state, uid, 'xuan').ok, false);
  state.items.find((item) => item.uid === uid).container = 'xuan';
  state.actors.xuan.location = 'market';
  assert.equal(returnLoan(state, uid, 'xuan').ok, false);
  state.actors.xuan.location = 'station';
  assert.equal(returnLoan(state, uid, 'xuan').ok, true);
  assert.equal(state.relations.reg_chen.trust, 3);
  assert.equal(state.items.some((item) => item.uid === uid), false);
  assert.equal(state.loans.some((loan) => loan.uid === uid), false);
});

test('借物交给队友后，队友带到熟人街区也能归还', () => {
  const state = fresh(131);
  trust(state, 'reg_chen', 2);
  const uid = putLoan(state, { from: 'reg_chen', actorId: 'xuan', due: state.day });
  state.actors.fan.location = 'station';
  state.items.find((item) => item.uid === uid).container = 'fan';

  assert.equal(returnLoan(state, uid, 'fan').ok, true);
  assert.equal(state.relations.reg_chen.trust, 3);
});

test('借物只能延期一次，并同步实例与借用记录的期限', () => {
  const state = fresh(14);
  const uid = putLoan(state, { from: 'reg_xu', due: 8 });

  assert.equal(extendLoan(state, uid).ok, true);
  assert.equal(state.loans[0].due, 10);
  assert.equal(state.items.find((item) => item.uid === uid).loan.due, 10);
  assert.equal(extendLoan(state, uid).ok, false);

  state.loans[0].extended = false;
  assert.equal(extendLoan(state, uid).ok, false);
});

test('逾期每日扣信任，第三日收回且同日不会重复扣除', () => {
  const state = fresh(15);
  trust(state, 'reg_liu', 5);
  const uid = putLoan(state, { from: 'reg_liu', due: 4 });
  const events = [];

  state.day = 5;
  tickLoans(state, events);
  assert.equal(state.relations.reg_liu.trust, 4);
  tickLoans(state, events);
  assert.equal(state.relations.reg_liu.trust, 4);
  state.day = 6;
  tickLoans(state, events);
  assert.equal(state.relations.reg_liu.trust, 3);
  state.day = 7;
  tickLoans(state, events);
  assert.equal(state.relations.reg_liu.trust, 0);
  assert.equal(state.items.some((item) => item.uid === uid), false);
  assert.equal(state.loans.some((loan) => loan.uid === uid), false);
  assert.equal(state.flags.loanBroken.reg_liu, 7);
  assert.equal(events.length, 3);
});

test('失约后第30天可重新借，之前仍受限制', () => {
  const state = fresh(16);
  trust(state, 'reg_lu', 2);
  state.actors.xuan.location = 'recycle';
  state.flags.loanBroken = { reg_lu: 10 };

  state.day = 39;
  assert.equal(canBorrow(state, 'reg_lu', 'xuan').ok, false);
  state.day = 40;
  assert.equal(canBorrow(state, 'reg_lu', 'xuan').ok, true);
});

test('已有关系缺少 trust 时，归还与逾期从零计算而不写入 NaN', () => {
  const returned = fresh(17);
  returned.relations.reg_chen = {};
  returned.actors.xuan.location = 'station';
  const returnedUid = putLoan(returned, { from: 'reg_chen', due: returned.day });
  assert.equal(returnLoan(returned, returnedUid, 'xuan').ok, true);
  assert.equal(returned.relations.reg_chen.trust, 1);

  const overdue = fresh(18);
  overdue.relations.reg_lu = {};
  putLoan(overdue, { from: 'reg_lu', due: 1 });
  overdue.day = 2;
  tickLoans(overdue, []);
  assert.equal(overdue.relations.reg_lu.trust, 0);
});
