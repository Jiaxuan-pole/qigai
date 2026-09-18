import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { assign, fresh, task } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { planIndex, slotOfHour } from '../public/game/clock.js';

before(loadData);

function stateAt(hour) {
  const state = fresh(614);
  state.pendingMorning = null;
  state.hour = hour;
  state.slot = slotOfHour(hour);
  state.hourTick = hour - 6;
  state.plan = { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) };
  state.actors.xuan.location = 'cardhall';
  return state;
}

function scheduleCasino(state, actorId = 'xuan') {
  const scheduled = assign(state, actorId, state.hour, 'casino');
  assert.equal(scheduled.error, undefined, scheduled.error);
  return scheduled.state;
}

function forceCasino(state, actorId = 'xuan', zone = 'cardhall') {
  state.plan[actorId][planIndex(state.hour)] = task('casino', [actorId], { zone });
  return state;
}

test('casino action spends one hour but no cash', () => {
  const state = scheduleCasino(stateAt(14));
  const cash = state.cash;
  const ledger = structuredClone(state.ledger);
  const bets = state.daily.bets;
  const revision = state.stateRevision;

  const result = settle(state);

  assert.equal(result.error, undefined);
  assert.equal(result.state.hour, 15);
  assert.equal(result.state.hourTick, 9);
  assert.equal(result.state.actors.xuan.energy, 80);
  assert.equal(result.state.cash, cash);
  assert.deepEqual(result.state.ledger, ledger);
  assert.equal(result.state.daily.bets, bets);
  assert.equal(result.state.pending.casino.phase, 'invited');
  assert.equal(result.state.pending.casino.sessionId, '614:1:9:xuan:1');
  assert.equal(result.state.stateRevision, revision + 1);
});

test('casino closed slot is atomic', () => {
  const state = forceCasino(stateAt(13));
  const before = JSON.stringify(state);
  const result = settle(state);

  assert.match(result.error, /开放/);
  assert.equal(JSON.stringify(result.state), before);
  assert.equal(JSON.stringify(state), before);
});

test('casino rejects the last hour, wrong district, intoxication, and an unfinished invitation atomically', () => {
  const cases = [
    { hour: 21, setup: (state) => state, error: /最晚|营业/ },
    { hour: 14, setup: (state) => forceCasino(state, 'xuan', 'station'), error: /棋牌馆/ },
    { hour: 14, setup: (state) => { state.actors.xuan.intox = 1; return state; }, error: /醉意/ },
    { hour: 14, setup: (state) => { state.pending.casino = { phase: 'invited' }; return state; }, error: /棋牌馆牌局/ },
  ];
  for (const { hour, setup, error } of cases) {
    let state = stateAt(hour);
    state = hour === 14 ? scheduleCasino(state) : forceCasino(state);
    state = setup(state);
    const before = JSON.stringify(state);
    const result = settle(state);
    assert.match(result.error, error);
    assert.equal(JSON.stringify(result.state), before);
    assert.equal(JSON.stringify(state), before);
  }
});

test('only one casino invitation can be created in one hour', () => {
  let state = scheduleCasino(stateAt(14), 'xuan');
  state.actors.fan.location = 'cardhall';
  state = scheduleCasino(state, 'fan');
  const before = JSON.stringify(state);
  const result = settle(state);

  assert.match(result.error, /一桌|一位|棋牌馆/);
  assert.equal(JSON.stringify(result.state), before);
  assert.equal(JSON.stringify(state), before);
});

test('casino uses coffee credit exactly as a standard twenty-energy action', () => {
  let state = stateAt(14);
  state.actors.xuan.energy = 10;
  state.actors.xuan.coffeeCredit = 10;
  state = scheduleCasino(state);

  const result = settle(state);

  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.xuan.energy, 0);
  assert.equal(result.state.actors.xuan.coffeeCredit, 0);
});

test('unresolved fishing and river events block the next hour atomically', () => {
  for (const pending of [
    { fishingQte: [{ id: 'fishQte:614:1:8:xuan' }] },
    { riverFight: { id: 'riverFight:614:1:8:ma' } },
  ]) {
    let state = stateAt(14);
    state.pending = { ...state.pending, ...pending };
    state = scheduleCasino(state);
    const before = JSON.stringify(state);
    const result = settle(state);
    assert.match(result.error, /收竿|河边事件/);
    assert.equal(JSON.stringify(result.state), before);
  }
});
