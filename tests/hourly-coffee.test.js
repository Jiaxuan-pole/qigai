import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadData } from '../public/game/data.js';
import { assign, fresh, useItem } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { normalizeSave, validateSave } from '../public/game/save.js';
import { settle } from '../public/game/settle.js';

before(loadData);

function start(seed = 44) {
  const state = fresh(seed);
  state.pendingMorning = null;
  state.plan = { xuan: Array(16).fill(null), fan: Array(16).fill(null), ma: Array(16).fill(null) };
  return state;
}

function addCoffee(state, itemId = 'coffee') {
  return makeItem(state, itemId, 'xuan').uid;
}

test('速溶与六种单杯咖啡都走同一使用路径', () => {
  for (const itemId of ['coffee', 'espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew']) {
    const state = start();
    const uid = addCoffee(state, itemId);
    const result = useItem(state, 'xuan', uid);

    assert.equal(result.error, undefined, itemId);
    assert.equal(result.state.daily.coffeeCups.xuan, 1, itemId);
    assert.equal(result.state.daily.coffeeUnits.xuan, itemId === 'coffee' ? 1 : 2, itemId);
    assert.equal(result.state.actors.xuan.mind, state.actors.xuan.mind + 2, itemId);
    assert.equal(result.state.items.find((item) => item.uid === uid)?.uses ?? 0, itemId === 'coffee' ? 2 : 0, itemId);
  }
});

test('每两杯增加额度，第六杯未确认保持输入完全不变', () => {
  let state = start();
  for (let count = 0; count < 5; count++) {
    const used = useItem(state, 'xuan', addCoffee(state));
    assert.equal(used.error, undefined);
    state = used.state;
  }
  assert.equal(state.daily.coffeeUnits.xuan, 5);
  assert.equal(state.actors.xuan.coffeeCredit, 20);
  const uid = addCoffee(state);
  const before = structuredClone(state);
  const refused = useItem(state, 'xuan', uid);

  assert.strictEqual(refused.state, state);
  assert.equal(refused.requiresConfirmation, true);
  assert.deepEqual(refused.coffeeRisk, { risk: 0.08, nextCups: 6 });
  assert.deepEqual(state, before);

  const confirmed = useItem(state, 'xuan', uid, { confirmRisk: true });
  assert.equal(confirmed.error, undefined);
  assert.equal(confirmed.state.daily.coffeeCups.xuan, 6);
  assert.equal(confirmed.state.daily.coffeeUnits.xuan, 6);
  assert.equal(confirmed.state.actors.xuan.coffeeCredit, 20);
  assert.equal(confirmed.state.stateRevision, state.stateRevision + 1);
  assert.equal(confirmed.state.items.find((item) => item.uid === uid)?.uses, 2);
});

test('咖啡额度不超过配置上限', () => {
  const state = start();
  state.daily.coffeeCups.xuan = 1;
  state.daily.coffeeUnits.xuan = 3;
  state.actors.xuan.coffeeCredit = 170;
  const result = useItem(state, 'xuan', addCoffee(state));

  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.xuan.coffeeCredit, 180);
});

test('速溶四次或现制两次才各获得一次行动额度，混喝连续累计', () => {
  for (const drinks of [['coffee', 'coffee', 'coffee', 'coffee'], ['espresso', 'latte'], ['espresso', 'coffee', 'coffee']]) {
    let state = start();
    for (const itemId of drinks) state = useItem(state, 'xuan', addCoffee(state, itemId)).state;
    assert.equal(state.daily.coffeeUnits.xuan, 4, drinks.join(','));
    assert.equal(state.actors.xuan.coffeeCredit, 20, drinks.join(','));
  }
});

test('五次标准劳动后两杯咖啡可支付第六次标准劳动', () => {
  let state = start(99);
  for (const [actionId, options] of [['scavenge', {}], ['scavenge', {}], ['scavenge', {}], ['bottles', { zone: 'market' }], ['bottles', { zone: 'market' }]]) {
    const assigned = assign(state, 'xuan', state.hour, actionId, options);
    assert.equal(assigned.error, undefined, actionId);
    const result = settle(assigned.state);
    assert.equal(result.error, undefined, actionId);
    state = result.state;
  }
  assert.equal(state.actors.xuan.energy, 0);
  for (let count = 0; count < 2; count++) state = useItem(state, 'xuan', addCoffee(state, 'espresso')).state;
  assert.equal(state.actors.xuan.coffeeCredit, 20);
  const assigned = assign(state, 'xuan', state.hour, 'bottles', { zone: 'market' });
  const result = settle(assigned.state);

  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.xuan.energy, 0);
  assert.equal(result.state.actors.xuan.coffeeCredit, 0);
  assert.equal(result.state.actionCount, 6);
});

test('固定种子死亡会留下遗物、清理排程并在读档后保持结果', () => {
  let state = start(1);
  state.actors.fan.life = 'dead';
  const scheduled = assign(state, 'xuan', 8, 'rest');
  assert.equal(scheduled.error, undefined);
  state = scheduled.state;
  const relic = makeItem(state, 'bread', 'xuan');
  for (let count = 0; count < 5; count++) state = useItem(state, 'xuan', addCoffee(state)).state;
  const uid = addCoffee(state);
  const result = useItem(state, 'xuan', uid, { confirmRisk: true });

  assert.equal(result.error, undefined);
  assert.equal(result.state.actors.xuan.life, 'dead');
  assert.equal(result.state.phase, 'gameover');
  assert.ok(result.state.ending);
  assert.equal(result.state.items.find((item) => item.uid === relic.uid).container, 'relic:xuan');
  assert.equal(result.state.plan.xuan[2], null);
  assert.equal(result.state.daily.coffeeCups.xuan, 6);
  assert.equal(validateSave(result.state).ok, true);
  assert.deepEqual(normalizeSave(result.state).deaths, result.state.deaths);
  assert.strictEqual(useItem(result.state, 'xuan', uid, { confirmRisk: true }).state, result.state);
});
