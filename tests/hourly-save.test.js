import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setData } from '../public/game/data.js';
import { buyNow, fresh } from '../public/game/engine.js';
import { normalizeSave, validateSave } from '../public/game/save.js';

setData(JSON.parse(await readFile(new URL('../03_开发数据_商店物品愿望事件100日.json', import.meta.url), 'utf8')));

function oldSave() {
  const s = fresh(73);
  s.version = 3;
  for (const id of ['xuan', 'fan', 'ma']) s.plan[id] = [null, null, null, null];
  s.day = 7; s.slot = 2; s.turn = 26;
  s.cash = 41; s.ledger.expense = 31;
  s.plan.xuan = [
    { id: 'rest', eventUid: 'done' },
    { id: 'shop', cart: [{ shopId: 'convenience', itemId: 'ticket_10', qty: 1 }] },
    { id: 'shop', cart: [{ shopId: 'convenience', itemId: 'meal', qty: 1 }], group: 'same', eventUid: 'ev-2' },
    { id: 'care', care: { diseaseUid: 'd-1', itemUid: 'i-2' }, targets: ['fan'] },
  ];
  s.items.push({ uid: 'ticket-lock', itemId: 'ticket_10', container: 'xuan', face: { prize: 30 } });
  s.wishes.push({ uid: 'wish-lock', actorId: 'fan', kind: 'item', targetItem: 'coffee', source: 'local', reason: '想喝', indirectLine: '喝点。' });
  s.daily.errands['xuan:2'] = true;
  return s;
}

test('v3四槽只迁移当前及未来预约，旧经济物品愿望和票锁不变', () => {
  const old = oldSave();
  const before = structuredClone(old);
  assert.equal(validateSave(old).ok, true);
  const s = normalizeSave(old);
  assert.equal(s.version, 4);
  assert.equal(s.hour, 14);
  assert.equal(s.hourTick, 104);
  assert.equal(s.turn, 26);
  assert.equal(s.actionCount, 0);
  assert.deepEqual(s.daily.coffeeUnits, { xuan: 0, fan: 0, ma: 0 });
  assert.equal(s.plan.xuan.length, 16);
  assert.equal(s.plan.xuan[0], null);
  assert.equal(s.plan.xuan[4], null);
  assert.deepEqual(s.plan.xuan[8], { ...old.plan.xuan[2], hours: 1 });
  assert.deepEqual(s.plan.xuan[12], { ...old.plan.xuan[3], hours: 1 });
  assert.deepEqual(s.items, old.items);
  assert.deepEqual(s.wishes, old.wishes);
  assert.deepEqual(s.ledger, old.ledger);
  assert.equal(s.cash, old.cash);
  assert.equal(s.daily.errands['xuan:2'], true);
  for (const hour of [14, 15, 16, 17]) assert.equal(s.daily.errands[`xuan:${hour}`], true);
  const beforeBuy = structuredClone(s);
  s.actors.xuan.location = 'market';
  const first = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'meal', qty: 1 }]);
  assert.equal(first.error, undefined, '旧档的附带采买标记不再限制即时购买');
  const second = buyNow(first.state, 'xuan', [{ shopId: 'convenience', itemId: 'meal', qty: 1 }]);
  assert.equal(second.error, undefined, '人还在店旁就能继续买');
  assert.equal(second.state.cash, s.cash - first.total - second.total);
  s.actors.xuan.location = beforeBuy.actors.xuan.location;
  assert.deepEqual(s, beforeBuy);
  assert.equal(validateSave(s).ok, true);
  assert.deepEqual(normalizeSave(s), s);
  assert.deepEqual(old, before);
});

test('v4读档幂等且保留咖啡、宿醉、忙碌状态', () => {
  const s = normalizeSave(oldSave());
  s.actors.xuan.coffeeCredit = 40;
  s.actors.xuan.hangoverDay = 8;
  s.daily.coffeeCups.xuan = 3;
  s.daily.coffeeUnits = { xuan: 5, fan: 0, ma: 0 };
  s.busy.xuan = { jobId: 'job-1', startedHour: 13, remainingHours: 2, task: { id: 'shop', hours: 3 } };
  assert.equal(validateSave(s).ok, true);
  assert.deepEqual(normalizeSave(s), s);
});

test('早期v4缺提神份数按旧现制杯数补齐且不重复发额度', () => {
  const old = normalizeSave(oldSave());
  delete old.daily.coffeeUnits;
  old.daily.coffeeCups.xuan = 3;
  old.actors.xuan.coffeeCredit = 20;
  const before = structuredClone(old);
  assert.equal(validateSave(old).ok, true);
  const loaded = normalizeSave(old);
  assert.equal(loaded.daily.coffeeUnits.xuan, 6);
  assert.equal(loaded.actors.xuan.coffeeCredit, 20);
  assert.deepEqual(normalizeSave(loaded), loaded);
  assert.deepEqual(old, before);
});

test('旧档补空钩与待演事件默认值，新事件原样保存不重判', () => {
  const legacy = oldSave();
  for (const actor of Object.values(legacy.actors)) delete actor.fishingDryStreak;
  delete legacy.pending.riverFight;
  const old = structuredClone(legacy);
  const migrated = normalizeSave(legacy);
  for (const actor of Object.values(migrated.actors)) assert.equal(actor.fishingDryStreak, 0);
  assert.equal(migrated.pending.riverFight, null);
  assert.deepEqual(legacy, old);

  const olderV4 = structuredClone(migrated);
  delete olderV4.actors.ma.fishingDryStreak;
  delete olderV4.pending.riverFight;
  assert.equal(validateSave(olderV4).ok, true);
  assert.equal(normalizeSave(olderV4).actors.ma.fishingDryStreak, 0);
  assert.equal(normalizeSave(olderV4).pending.riverFight, null);

  migrated.actors.ma.fishingDryStreak = 2;
  migrated.pending.riverFight = { id: 'riverFight:73:7:104:ma', kind: 'riverFight', actorId: 'ma', seed: 73, day: 7, hourTick: 104, line: '这个鱼就是欠干' };
  migrated.flags.riverFightDay = 7;
  assert.equal(validateSave(migrated).ok, true);
  assert.deepEqual(normalizeSave(migrated), migrated);
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeSave(migrated))).pending.riverFight, migrated.pending.riverFight);
});

test('河边待演事件拒绝伪造ID、未来时间与HTML文本', () => {
  const state = normalizeSave(oldSave());
  const event = { id: 'riverFight:73:7:104:ma', kind: 'riverFight', actorId: 'ma', seed: 73, day: 7, hourTick: 104, line: '这个鱼就是欠干' };
  for (const invalid of [
    { ...event, id: 'riverFight:73:7:103:ma' },
    { ...event, seed: 74 },
    { ...event, day: 8 },
    { ...event, hourTick: 105, id: 'riverFight:73:7:105:ma' },
    { ...event, line: '<img src=x onerror=alert(1)>' },
    { ...event, actorId: 'fan' },
  ]) assert.equal(validateSave({ ...state, pending: { ...state.pending, riverFight: invalid } }).ok, false);
  for (const value of [-1, 10001, 1.5, Infinity]) {
    const actors = { ...state.actors, ma: { ...state.actors.ma, fishingDryStreak: value } };
    assert.equal(validateSave({ ...state, actors }).ok, false);
  }
});

test('旧库存仅补缺失咖啡商品，已有零库存不回填', () => {
  const old = oldSave();
  old.shops.coffee_shop = { stock: { espresso: 0 }, soldOut: {}, closedSlots: [] };
  const s = normalizeSave(old);
  assert.equal(s.shops.coffee_shop.stock.espresso, 0);
  assert.ok(s.shops.coffee_shop.stock.americano > 0);
  assert.equal(old.shops.coffee_shop.stock.americano, undefined);
});

test('旧D100救援尾声按明确小时迁移', () => {
  const old = oldSave();
  old.day = 100; old.slot = 0; old.turn = 401; old.phase = 'tail'; old.tailTurns = 1;
  const s = normalizeSave(old);
  assert.equal(s.hour, 23);
  assert.equal(s.hourTick, 1600);
  assert.equal(s.slot, 3);
  assert.equal(validateSave(s).ok, true);
  const ended = { ...s, phase: 'gameover', hour: 24, turn: 402 };
  assert.equal(validateSave(ended).ok, true);
});

test('非法小时、派生槽、精力额度和v2拒绝', () => {
  const s = normalizeSave(oldSave());
  for (const changed of [
    { ...s, hour: 15, slot: 1 },
    { ...s, hour: 24 },
    { ...s, hourTick: 1 },
    { ...s, turn: 27 },
    { ...s, actors: { ...s.actors, xuan: { ...s.actors.xuan, coffeeCredit: Infinity } } },
    { ...s, daily: { ...s.daily, coffeeUnits: { xuan: 37, fan: 0, ma: 0 } } },
  ]) assert.equal(validateSave(changed).ok, false);
  assert.match(validateSave({ ...oldSave(), version: 2 }).reason, /28 日原型/);
});
