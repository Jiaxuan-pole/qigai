import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { buyNow, assign, transferItem, unpackParcel } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { ready } from './engine-fixtures.js';

before(loadData);
const cart = (a = 'bed_basic', b = 'chair') => [
  { shopId: 'furniture_store', itemId: a, qty: 1 },
  { shopId: 'furniture_store', itemId: b, qty: 1 },
];
function atFurniture(cash = 200) {
  const s = ready(932, { slot: 1 });
  s.cash = cash;
  s.ledger.start = cash;
  s.actors.xuan.location = 'furniture';
  return s;
}

test('buyNow self destination creates one camp parcel', () => {
  const s = atFurniture();
  const result = buyNow(s, 'xuan', cart(), 'self');
  assert.equal(result.error, undefined);
  assert.equal(result.parcelId, 'p1');
  assert.equal(result.made.length, 2);
  assert.equal(new Set(result.made.map((it) => it.uid)).size, 2);
  assert.deepEqual(result.made.map((it) => it.container), ['parcel:p1', 'parcel:p1']);
  assert.deepEqual(result.state.camp.parcels[0].itemUids, result.made.map((it) => it.uid));
  assert.equal(result.state.camp.parcels.length, 1);
  assert.equal(result.state.camp.beds, 0);
  assert.equal(result.state.cash, s.cash - result.total);
  assert.equal(result.state.ledger.expense, s.ledger.expense + result.total);
  assert.equal(result.state.shops.furniture_store.stock.bed_basic, s.shops.furniture_store.stock.bed_basic - 1);
});

test('furniture purchase failure atomic', () => {
  for (const invalid of [atFurniture(1), atFurniture()]) {
    if (invalid.cash > 1) invalid.shops.furniture_store.stock.bed_basic = 0;
    const before = JSON.stringify(invalid);
    const result = buyNow(invalid, 'xuan', cart());
    assert.match(result.error, /现金不足|库存不足/);
    assert.equal(JSON.stringify(invalid), before);
    assert.equal(JSON.stringify(result.state), before);
  }
});

test('opened furniture stays in camp storage', () => {
  const s = atFurniture();
  const bought = buyNow(s, 'xuan', cart(), 'self');
  const uid = bought.made[0].uid;
  assert.ok(transferItem(bought.state, 'xuan', uid, 'xuan').error);
  bought.state.actors.xuan.location = 'camp';
  const opened = unpackParcel(bought.state, 'xuan', bought.parcelId);
  assert.equal(opened.error, undefined, opened.error);
  const before = JSON.stringify(opened.state);
  const moved = transferItem(opened.state, 'xuan', uid, 'xuan');
  assert.equal(moved.error, '家具留在营地，用摆放或收起整理');
  assert.equal(JSON.stringify(opened.state), before);
});

test('scheduled self and camp destinations create one parcel each', () => {
  for (const destination of ['self', 'camp']) {
    const s = atFurniture();
    const assigned = assign(s, 'xuan', s.hour, 'shop', { zone: 'furniture', cart: cart(), destination });
    assert.equal(assigned.error, undefined, assigned.error);
    const result = settle(assigned.state);
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.state.camp.parcels.length, 1);
    assert.equal(result.state.camp.parcels[0].itemUids.length, 2);
    assert.ok(result.state.camp.parcels[0].itemUids.every((uid) => result.state.items.find((it) => it.uid === uid).container === 'parcel:p1'));
    assert.equal(result.state.camp.beds, 0);
    assert.equal(result.state.cash, s.cash - 57);
    assert.equal(result.state.ledger.expense, s.ledger.expense + 57);
  }
});
