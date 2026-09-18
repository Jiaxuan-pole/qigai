import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { SALVAGE, canRepair, dispose, disposeOptions, giftTargets, repair } from '../public/game/salvage.js';

before(async () => {
  await loadData();
});

test('修复保留实例身份并扣除零件', () => {
  const state = fresh(4);
  state.parts = 1;
  state.items.push({ uid: 'salvage-phone', itemId: 'broken_phone', container: 'xuan', origin: 'bin:station:0' });
  const result = repair(state, 'salvage-phone', 'xuan');

  assert.equal(result.item.itemId, 'phone');
  assert.equal(result.item.uid, 'salvage-phone');
  assert.equal(result.item.origin, 'bin:station:0');
  assert.equal(state.parts, 0);
});

test('维修只按容器可及性判断，不限制角色身份或生命状态', () => {
  const state = fresh(5);
  state.parts = 1;
  state.items.push({ uid: 'camp-radio', itemId: 'broken_radio', container: 'camp' });
  state.actors.ma.location = 'camp';
  assert.equal(canRepair(state, 'camp-radio', 'ma').ok, true);
  state.actors.ma.location = 'market';
  assert.match(canRepair(state, 'camp-radio', 'ma').reason, /营地箱/);
});

test('电视维修需要修理桌且失败不扣零件', () => {
  const state = fresh(6);
  state.parts = 2;
  state.items.push({ uid: 'tv-1', itemId: 'broken_tv', container: 'xuan', origin: 'xu' });
  const before = JSON.stringify(state);
  assert.match(repair(state, 'tv-1', 'xuan').error, /修理桌/);
  assert.equal(JSON.stringify(state), before);
  state.camp.facilities[0] = 'repair_table';
  const result = repair(state, 'tv-1', 'xuan');
  assert.equal(result.item.itemId, 'tv');
  assert.equal(state.parts, 0);
});

test('售出只允许持有者在回收巷，并记录收入', () => {
  const state = fresh(7);
  state.items.push({ uid: 'phone-1', itemId: 'phone', container: 'xuan' });
  const before = JSON.stringify(state);
  assert.match(dispose(state, 'phone-1', 'sell', { actorId: 'xuan' }).error, /回收巷/);
  assert.equal(JSON.stringify(state), before);
  state.actors.xuan.location = 'recycle';
  const result = dispose(state, 'phone-1', 'sell', { actorId: 'xuan' });
  assert.equal(result.cash, 24);
  assert.equal(state.cash, 96);
  assert.equal(state.ledger.income, 24);
  assert.equal(state.items.some((item) => item.uid === 'phone-1'), false);
});

test('三种处置在同一实例上互斥，未修好也不能处置', () => {
  const state = fresh(8);
  state.items.push({ uid: 'radio-1', itemId: 'broken_radio', container: 'xuan' });
  const options = disposeOptions(state, 'radio-1');
  assert.equal(options.every((option) => option.enabled === false), true);
  assert.match(dispose(state, 'radio-1', 'keep', { actorId: 'xuan' }).error, /没有修好/);
  state.items.find((item) => item.uid === 'radio-1').itemId = 'radio';
  const kept = dispose(state, 'radio-1', 'keep', { actorId: 'xuan' });
  assert.equal(kept.effectKey, 'camp_radio_broadcast');
  assert.match(dispose(state, 'radio-1', 'sell', { actorId: 'xuan' }).error, /留作自用/);
  assert.match(dispose(state, 'radio-1', 'gift', { actorId: 'xuan', npcId: 'reg_chen' }).error, /留作自用/);
});

test('回赠只给同街区熟人，信任封顶并列出可加信任的 ID', () => {
  const state = fresh(9);
  state.items.push({ uid: 'headphones-1', itemId: 'headphones', container: 'xuan' });
  state.actors.xuan.location = 'station';
  state.relations.reg_chen = { trust: 4 };
  assert.equal(SALVAGE.broken_phone.repaired, 'phone');
  assert.deepEqual(giftTargets(state), ['reg_chen', 'reg_liu', 'reg_zhao', 'reg_wang', 'reg_lu', 'reg_xu']);
  const result = dispose(state, 'headphones-1', 'gift', { actorId: 'xuan', npcId: 'reg_chen' });
  assert.equal(result.trust, 5);
  assert.equal(state.items.some((item) => item.uid === 'headphones-1'), false);
  state.items.push({ uid: 'phone-2', itemId: 'phone', container: 'xuan' });
  state.relations.reg_lu = { trust: 1 };
  const before = JSON.stringify(state);
  assert.match(dispose(state, 'phone-2', 'gift', { actorId: 'xuan', npcId: 'reg_lu' }).error, /街区/);
  assert.equal(JSON.stringify(state), before);
});

test('自用只标记实例且可从营地箱推断回赠许姐解锁放映场地', () => {
  const state = fresh(10);
  state.items.push({ uid: 'tv-keep', itemId: 'tv', container: 'xuan' });
  state.actors.xuan.location = 'recycle';
  const kept = dispose(state, 'tv-keep', 'keep', { actorId: 'xuan' });
  assert.equal(kept.effectKey, 'camp_tv_screening');
  assert.equal(state.items.find((item) => item.uid === 'tv-keep').kept, true);
  assert.deepEqual(state.camp.facilities, [null, null]);
  state.items.push({ uid: 'radio-camp', itemId: 'radio', container: 'camp' });
  state.actors.xuan.location = 'camp';
  assert.equal(dispose(state, 'radio-camp', 'keep', { actorId: 'xuan' }).effectKey, 'camp_radio_broadcast');
  state.items.push({ uid: 'phone-infer', itemId: 'phone', container: 'xuan' });
  assert.equal(dispose(state, 'phone-infer', 'keep').effectKey, 'phone_remote_chat');
  state.items.push({ uid: 'tv-gift', itemId: 'tv', container: 'xuan' });
  state.actors.xuan.location = 'cinema';
  state.relations.reg_xu = { trust: 1 };
  const gifted = dispose(state, 'tv-gift', 'gift', { actorId: 'xuan', npcId: 'reg_xu' });
  assert.equal(gifted.trust, 4);
  assert.equal(state.flags.screeningVenueUnlocked, true);

  const fallback = fresh(11);
  fallback.parts = 1;
  fallback.items.push({ uid: 'fallback-phone', itemId: 'broken_phone', container: 'xuan' });
  delete fallback.ledger;
  delete fallback.relations;
  delete fallback.camp.facilities;
  assert.equal(canRepair(fallback, 'fallback-phone', 'xuan').ok, true);
  assert.equal(disposeOptions(fallback, 'fallback-phone').length, 3);
  assert.equal(repair(fallback, 'fallback-phone', 'xuan').item.itemId, 'phone');
});
