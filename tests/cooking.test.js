import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem, isFood, foodFresh, FOOD_VALUE, discardExpired } from '../public/game/items.js';
import { ACTIONS } from '../public/game/actions.js';
import { cookingOptions, validateCooking, cookFood } from '../public/game/cooking.js';

before(loadData);

test('camp cooking converts every source once with one fuel and fixed food values', () => {
  const recipes = [
    ['fish_common', 'fish_common_cooked', 32],
    ['fish_rare', 'fish_rare_cooked', 46],
    ['meal', 'meal_hot', 35],
    ['bread', 'bread_toasted', 23],
    ['hot_soup', 'hot_soup_heated', 31],
  ];
  for (const [source, result, value] of recipes) {
    const state = fresh(1);
    const coal = makeItem(state, 'charcoal_smokeless', 'camp');
    coal.uses = 1;
    const item = makeItem(state, source, 'camp');
    const originalExpiry = item.expiresDay;
    item.dirty = true;
    const events = [];
    assert.deepEqual(cookingOptions(state, 'ma').find((x) => x.uid === item.uid), {
      uid: item.uid, itemId: source, resultItemId: result, fuel: 1, container: 'camp',
    });
    assert.equal(validateCooking(state, 'ma', item.uid), null);
    assert.equal(cookFood(state, 'ma', item.uid, events), item);
    assert.equal(item.itemId, result);
    assert.equal(item.container, 'ma');
    assert.equal(item.uses, 1);
    assert.equal(item.expiresDay, originalExpiry);
    assert.equal(item.dirty, true);
    assert.equal(state.items.some((x) => x.uid === coal.uid), false);
    assert.equal(FOOD_VALUE[result], value);
    assert.equal(foodFresh(state, item), true);
    assert.equal(events.length, 1);
    const snapshot = structuredClone(state);
    assert.match(validateCooking(state, 'ma', item.uid), /加工/);
    assert.equal(cookFood(state, 'ma', item.uid, events), null);
    assert.deepEqual(state, snapshot);
  }
  assert.equal(ACTIONS.cook.zone, 'camp');
  assert.equal(ACTIONS.cook.hours, 1);
  assert.equal(ACTIONS.cook.energy, 20);
});

test('raw fish remains expirable and saleable inventory, but is never edible food', () => {
  const state = fresh(2);
  const fish = makeItem(state, 'fish_common', 'ma');
  assert.equal(isFood(fish.itemId), false);
  assert.equal(foodFresh(state, fish), false);
  state.day = fish.expiresDay + 1;
  assert.ok(discardExpired(state) >= 1);
  assert.equal(state.items.some((x) => x.uid === fish.uid), false);
});

test('cooking rejects no fuel, inaccessible inventory, expired and spent source atomically', () => {
  const state = fresh(3);
  const own = makeItem(state, 'fish_common', 'ma');
  const others = makeItem(state, 'fish_rare', 'fan');
  const relic = makeItem(state, 'meal', 'relic:fan');
  const before = structuredClone(state);
  assert.match(validateCooking(state, 'ma', own.uid), /燃料/);
  assert.equal(cookFood(state, 'ma', own.uid, []), null);
  assert.deepEqual(state, before);
  const coal = makeItem(state, 'charcoal_smokeless', 'camp');
  coal.uses = 1;
  for (const item of [others, relic]) {
    const snapshot = structuredClone(state);
    assert.match(validateCooking(state, 'ma', item.uid), /自己包|营地/);
    assert.equal(cookFood(state, 'ma', item.uid, []), null);
    assert.deepEqual(state, snapshot);
  }
  own.expiresDay = state.day - 1;
  assert.match(validateCooking(state, 'ma', own.uid), /过期/);
  own.expiresDay = state.day;
  own.uses = 0;
  assert.match(validateCooking(state, 'ma', own.uid), /用完/);
  assert.equal(cookingOptions(state, 'ma').some((x) => x.uid === own.uid), false);
});
