import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { getData, loadData } from '../public/game/data.js';
import { freshStock, validateCart } from '../public/game/shop.js';

before(loadData);

const FURNITURE = [
  ['bed_basic', 45, 2],
  ['bed_comfort', 90, 2],
  ['dining_table', 35, 2],
  ['chair', 12, 3],
  ['sofa', 70, 3],
  ['cabinet', 40, 3],
  ['lamp', 18, 3],
  ['rug', 25, 3],
];

const ORIGINAL_DISTRICT_NEIGHBORS = {
  camp: ['market', 'recycle', 'river'],
  market: ['camp', 'station', 'cinema', 'river', 'cafe'],
  recycle: ['camp', 'service'],
  station: ['market', 'service', 'cardhall'],
  cinema: ['market', 'service', 'cafe', 'cardhall'],
  service: ['recycle', 'station', 'cinema'],
  cafe: ['market', 'cinema'],
  river: ['camp', 'market'],
  cardhall: ['station', 'cinema'],
};

test('furniture catalog and stock', () => {
  const data = getData();
  const state = { day: 1, shops: freshStock(), actors: { xuan: { intox: 0 } } };
  const furniture = data.districts.find((district) => district.id === 'furniture');
  const store = data.shops.filter((shop) => shop.id === 'furniture_store');

  assert.equal(data.districts.length, 10);
  assert.deepEqual(furniture?.neighbors, ['service', 'recycle']);
  assert.deepEqual(store, [{
    id: 'furniture_store',
    name: '营地家具城',
    district: 'furniture',
    position: '服务站与回收巷之间的家具陈列店',
    openSlots: [1, 2],
    unlockDay: 1,
    categories: ['furniture'],
    note: '购买家具自动快递到营地包裹，无需运费和等待；不进入背包，须回营拆包摆放。',
  }]);

  for (const [id, price, stock] of FURNITURE) {
    const item = data.items.find((entry) => entry.id === id);
    assert.deepEqual(
      { id: item?.id, category: item?.category, price: item?.price, uses: item?.uses, isFictionalBalance: item?.isFictionalBalance, shopIds: item?.shopIds },
      { id, category: 'furniture', price, uses: 1, isFictionalBalance: true, shopIds: ['furniture_store'] },
    );
    assert.equal(state.shops.furniture_store.stock[id], stock, id);
    assert.equal(validateCart(state, 'xuan', 'furniture', 1, [{ shopId: 'furniture_store', itemId: id, qty: 1 }]).error, undefined, id);
  }
  for (const [id] of FURNITURE) assert.match(data.items.find((item) => item.id === id)?.effectText || '', /自动快递到营地包裹.*无需运费和等待.*不进入背包.*回营拆包摆放/, id);
  assert.match(data.items.find((item) => item.id === 'bed_basic')?.effectText || '', /摆放后睡眠每小时体力\+30，地铺每小时\+20；普通次日体力100、醉意\/宿醉次晨80不变/);
  assert.match(data.items.find((item) => item.id === 'bed_comfort')?.effectText || '', /与基础床同机械效果.*外观更精致，不额外提供数值/);
  assert.match(data.items.find((item) => item.id === 'dining_table')?.effectText || '', /营地成功消耗食物精神\+2，每人每日最多2次/);
  assert.match(data.items.find((item) => item.id === 'chair')?.effectText || '', /坐靠与美观陈列/);
  assert.match(data.items.find((item) => item.id === 'sofa')?.effectText || '', /坐靠与美观陈列/);
  assert.match(data.items.find((item) => item.id === 'cabinet')?.effectText || '', /收纳陈列与美观布置/);
  assert.match(data.items.find((item) => item.id === 'lamp')?.effectText || '', /美观陈列/);
  assert.match(data.items.find((item) => item.id === 'rug')?.effectText || '', /美观布置/);
  assert.equal(validateCart(state, 'xuan', 'furniture', 0, [{ shopId: 'furniture_store', itemId: 'bed_basic', qty: 1 }]).error, '营地家具城：本时段不营业');

  for (const [id, neighbors] of Object.entries(ORIGINAL_DISTRICT_NEIGHBORS)) {
    const actual = data.districts.find((district) => district.id === id)?.neighbors;
    assert.ok(neighbors.every((neighbor) => actual?.includes(neighbor)), id);
  }
  assert.deepEqual(
    Object.fromEntries(['coffee', 'espresso', 'charcoal_cheap', 'charcoal_quality', 'charcoal_smokeless', 'fish_bait', 'fishing_rod', 'cards'].map((id) => [id, data.items.find((item) => item.id === id)?.price])),
    { coffee: 6, espresso: 4, charcoal_cheap: 6, charcoal_quality: 12, charcoal_smokeless: 20, fish_bait: 3, fishing_rod: 20, cards: 8 },
  );
});

test('other shops reject furniture', () => {
  const state = { day: 1, cash: 73, shops: freshStock(), actors: { xuan: { intox: 0 } } };
  const before = structuredClone(state);

  const result = validateCart(state, 'xuan', 'market', 1, [{ shopId: 'convenience', itemId: 'bed_basic', qty: 1 }]);

  assert.equal(result.error, '阿旺便利店不卖这件东西');
  assert.deepEqual(state, before);
});
