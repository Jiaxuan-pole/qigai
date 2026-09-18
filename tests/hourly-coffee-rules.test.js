import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getData, loadData } from '../public/game/data.js';
import { coffeeQuote, COFFEE_IDS } from '../public/game/coffee-rules.js';
import { buyNow, fresh } from '../public/game/engine.js';
import { itemDef } from '../public/game/items.js';
import { executeCart, freshStock, validateCart } from '../public/game/shop.js';

before(loadData);

test('咖啡店目录将六款一杯咖啡放在 cafe 街区', () => {
  const data = getData();
  const ids = ['espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew'];
  const cafe = data.districts.find((district) => district.id === 'cafe');
  const shop = data.shops.find((entry) => entry.id === 'coffee_shop');

  assert.deepEqual(cafe?.neighbors, ['market', 'cinema']);
  assert.equal(shop?.district, 'cafe');
  assert.deepEqual(shop?.openSlots, [0, 1, 2, 3]);
  assert.deepEqual(data.items.filter((item) => ids.includes(item.id)).map((item) => item.id), ids);
});

function coffeeState() {
  return { day: 1, turn: 0, seed: 1942, itemSeq: 0, items: [], shops: freshStock(), actors: { xuan: { intox: 0 } } };
}

test('咖啡店库存通过真实商店校验购买，六杯均是一用实例', () => {
  const state = coffeeState();
  for (const itemId of COFFEE_IDS) {
    const cart = [{ shopId: 'coffee_shop', itemId, qty: 1 }];
    const before = state.shops.coffee_shop.stock[itemId];
    assert.equal(validateCart(state, 'xuan', 'cafe', 1, cart).error, undefined, itemId);
    const [made] = executeCart(state, 'xuan', cart, 'self');
    assert.equal(state.shops.coffee_shop.stock[itemId], before - 1, itemId);
    assert.equal(made.uses, 1, itemId);
    assert.equal(itemDef(itemId).shopIds[0], 'coffee_shop', itemId);
  }
});

test('咖啡店六款都能由即时购买入口购得', () => {
  for (const itemId of COFFEE_IDS) {
    const state = fresh(1942);
    state.actors.xuan.location = 'cafe';
    const before = state.shops.coffee_shop.stock[itemId];
    const bought = buyNow(state, 'xuan', [{ shopId: 'coffee_shop', itemId, qty: 1 }]);

    assert.equal(bought.error, undefined, itemId);
    assert.equal(bought.state.shops.coffee_shop.stock[itemId], before - 1, itemId);
    assert.equal(bought.made[0].uses, 1, itemId);
  }
});

test('咖啡店闭店时校验不改变库存', () => {
  const state = coffeeState();
  state.shops.coffee_shop.closedSlots.push(1);
  const before = structuredClone(state);
  const result = validateCart(state, 'xuan', 'cafe', 1, [{ shopId: 'coffee_shop', itemId: 'espresso', qty: 1 }]);

  assert.match(result.error, /今天提前关门/);
  assert.deepEqual(state, before);
});

function quote(input) {
  return coffeeQuote({ ...input, coffeeRules: getData().rules.coffee });
}

test('第五杯安全，第六杯要求确认并按提神单位给额度', () => {
  assert.deepEqual(quote({ count: 4, units: 8, strengthUnits: 2, seed: 77, day: 3, actorId: 'xuan', confirmRisk: false }), {
    requiresConfirmation: false, nextCups: 5, nextUnits: 10, creditGain: 0, fatal: false, risk: 0, riskKey: 'coffee-risk:3:xuan:5',
  });
  assert.deepEqual(quote({ count: 5, units: 10, strengthUnits: 2, seed: 77, day: 3, actorId: 'xuan', confirmRisk: false }), {
    requiresConfirmation: true, nextCups: 6, nextUnits: 12, creditGain: 20, fatal: false, risk: 0.08, riskKey: 'coffee-risk:3:xuan:6',
  });
  assert.equal(quote({ count: 6, units: 12, strengthUnits: 2, seed: 77, day: 3, actorId: 'xuan', confirmRisk: true }).risk, 0.16);
});

test('确认后的风险结果按固定种子重读一致，报价不计数两次', () => {
  const input = { count: 5, units: 10, strengthUnits: 2, seed: 918, day: 9, actorId: 'fan', confirmRisk: true };
  const before = structuredClone(input);
  const first = quote(input);

  assert.deepEqual(quote(input), first);
  assert.deepEqual(input, before);
  assert.equal(first.nextCups, 6);
  assert.equal(first.creditGain, 20);
});

test('非法或满杯计数被拒绝', () => {
  for (const count of [-1, 1.5, 18]) assert.deepEqual(quote({ count, units: 0, strengthUnits: 1, seed: 1, day: 1, actorId: 'xuan', confirmRisk: true }), { error: '咖啡杯数无效' });
});

test('速溶与现制按不同单位累计同一行动额度', () => {
  const rules = getData().rules.coffee;
  assert.deepEqual({ unitsPerCredit: rules.unitsPerCredit, instantUnits: rules.instantUnits, freshUnits: rules.freshUnits }, { unitsPerCredit: 4, instantUnits: 1, freshUnits: 2 });
  assert.equal(quote({ count: 1, units: 3, strengthUnits: 1, seed: 1, day: 1, actorId: 'xuan', confirmRisk: true }).creditGain, 20);
  assert.equal(quote({ count: 1, units: 2, strengthUnits: 2, seed: 1, day: 1, actorId: 'xuan', confirmRisk: true }).creditGain, 20);
});
