import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadData } from '../public/game/data.js';
import { buyNow, fresh } from '../public/game/engine.js';
import { itemDef } from '../public/game/items.js';

before(loadData);

const CHARCOAL = [
  ['charcoal_cheap', 6, 4, 3],
  ['charcoal_quality', 12, 6, 1],
  ['charcoal_smokeless', 20, 6, 0],
];

test('three charcoal packages define their fictional fuel values and both stores stock them', () => {
  const state = fresh(920);
  for (const [id, price, uses, smokePerUnit] of CHARCOAL) {
    const item = itemDef(id);
    assert.deepEqual(
      { id: item.id, category: item.category, price: item.price, uses: item.uses, smokePerUnit: item.smokePerUnit, shopIds: item.shopIds },
      { id, category: 'fuel', price, uses, smokePerUnit, shopIds: ['convenience', 'art_hardware'] },
    );
    assert.equal(state.shops.convenience.stock[id], id === 'charcoal_cheap' ? 6 : id === 'charcoal_quality' ? 4 : 3);
    assert.equal(state.shops.art_hardware.stock[id], id === 'charcoal_cheap' ? 6 : id === 'charcoal_quality' ? 4 : 3);
  }
});

test('buyNow buys one charcoal package with its declared uses and decrements stock once', () => {
  for (const [id, price, uses] of CHARCOAL) {
    const state = fresh(921);
    state.cash = 100;
    state.ledger.income += 28;
    state.actors.xuan.location = 'market';
    const stock = state.shops.convenience.stock[id];

    const result = buyNow(state, 'xuan', [{ shopId: 'convenience', itemId: id, qty: 1 }]);

    assert.equal(result.error, undefined, id);
    assert.equal(result.total, price, id);
    assert.equal(result.made[0].uses, uses, id);
    assert.equal(result.state.shops.convenience.stock[id], stock - 1, id);
  }
});
