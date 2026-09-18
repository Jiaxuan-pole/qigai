import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, getData } from '../public/game/data.js';
import { assign, fresh, travelTo, buyNow, useItem, sellFish } from '../public/game/engine.js';
import { makeItem, FOOD_VALUE } from '../public/game/items.js';
import { settle } from '../public/game/settle.js';
import { generateBoard, revealCell } from '../public/game/bins.js';
import { ready, plan } from './engine-fixtures.js';
import { validateSave } from '../public/game/save.js';
import * as saveModule from '../public/game/save.js';

before(loadData);
function equipped(seed, actor = 'xuan', rod = 'fishing_rod') {
  let s = ready(seed, { ma: true, turn: 4, slot: 0 });
  makeItem(s, rod, actor); makeItem(s, 'fish_bait', actor);
  s = plan(s, actor, 'fish');
  return s;
}
test('river travel charges each edge and rejects invalid moves atomically', () => {
  const a = fresh(1); a.pendingMorning = null;
  assert.equal(travelTo(a, 'xuan', 'river').state.actors.xuan.location, 'river');
  const b = travelTo(a, 'xuan', 'river').state;
  assert.equal(b.actors.xuan.energy, a.actors.xuan.energy - 2);
  assert.equal(travelTo(b, 'xuan', 'camp').state.actors.xuan.energy, a.actors.xuan.energy - 4);
  assert.equal(travelTo(b, 'xuan', 'station').state, b);
  assert.equal(travelTo(b, 'xuan', 'river').state.actors.xuan.energy, b.actors.xuan.energy);
});
test('fishing needs own rod and bait and failure is atomic', () => {
  let s = ready(2, { ma: true, turn: 4, slot: 0 });
  s = plan(s, 'xuan', 'fish');
  assert.match(settle(s).error, /鱼竿/);
  makeItem(s, 'fishing_rod', 'fan');
  assert.match(settle(s).error, /鱼竿/);
  makeItem(s, 'fishing_rod', 'xuan');
  assert.match(settle(s).error, /鱼饵/);
  assert.equal(settle(s).state, s);
});
test('fishing consumes one bait, grows skill, is deterministic, and yields cooking ingredients', () => {
  const s = equipped(31);
  const a = settle(s), b = settle(s);
  assert.deepEqual(a.state, b.state);
  assert.equal(a.state.items.filter(x => x.itemId === 'fish_bait' && x.container === 'xuan').length, 0);
  assert.ok(a.state.actors.xuan.fishingSkill > 0);
  assert.match(a.events.join(' '), /钓鱼/);
  assert.equal(FOOD_VALUE.fish_common, undefined);
  assert.ok(FOOD_VALUE.fish_rare_cooked > FOOD_VALUE.fish_common_cooked);
});
test('Ma starts advanced; other actors can improve; legacy missing field falls back', () => {
  const s = fresh(4);
  assert.equal(s.actors.ma.fishingSkill, 60);
  assert.equal(s.actors.xuan.fishingSkill, 0);
  let old = equipped(5, 'ma'); delete old.actors.ma.fishingSkill;
  const r = settle(old);
  assert.ok(r.state.actors.ma.fishingSkill >= 61);
  let ma = 0, xuan = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (const [who, add] of [['ma', () => ma++], ['xuan', () => xuan++]]) {
      const out = settle(equipped(seed, who), { controlledActorId: who });
      if (out.state.pending.fishingQte?.some(x => x.actorId === who)) add();
    }
  }
  assert.ok(ma > xuan + 15 && ma < 200);
});
test('shop inventory sells equipment; bins can generate a simple rod', () => {
  let s = fresh(9); s.pendingMorning = null; s.actors.xuan.location = 'market';
  const bought = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'fish_bait', qty: 1 }]);
  assert.equal(bought.error, undefined);
  assert.ok(bought.state.items.some(x => x.itemId === 'fish_bait'));
  let found = false;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const b = generateBoard(fresh(seed), 'xuan', 'market_bin');
    const i = b.cells.findIndex(c => c.loot?.id === 'fishing_rod_simple');
    if (i >= 0) { const state = fresh(seed); revealCell(state, b, i); found = state.items.some(x => x.itemId === 'fishing_rod_simple'); }
  }
  assert.ok(found);
});
test('raw fish must be cooked before eating and can still be sold through the ledger', () => {
  const s = fresh(6); s.pendingMorning = null;
  const fish = makeItem(s, 'fish_common', 'xuan');
  const eaten = useItem(s, 'xuan', fish.uid);
  assert.match(eaten.error, /加工/);
  assert.equal(eaten.state, s);
  s.actors.xuan.location = 'market'; s.slot = 1;
  const sold = sellFish(s, 'xuan', fish.uid);
  assert.equal(sold.state.cash, s.cash + 6);
  assert.equal(sold.state.ledger.income, s.ledger.income + 6);
  assert.ok(!sold.state.items.some(x => x.uid === fish.uid));
});
test('save accepts missing legacy skill but rejects an invalid present skill', () => {
  const s = fresh(17);
  delete s.actors.ma.fishingSkill;
  assert.equal(validateSave(s).ok, true);
  s.actors.ma.fishingSkill = 101;
  assert.equal(validateSave(s).ok, false);
});
test('legacy v3 inventory hydrates fishing stock and skill before buying', () => {
  const old = fresh(18);
  old.pendingMorning = null;
  old.actors.xuan.location = 'market';
  delete old.shops.convenience.stock.fish_bait;
  delete old.shops.convenience.stock.fishing_rod;
  delete old.shops.art_hardware.stock.fishing_rod_pro;
  for (const actor of Object.values(old.actors)) delete actor.fishingSkill;
  const snapshot = JSON.stringify(old);
  const hydrated = saveModule.normalizeSave(old);
  assert.equal(JSON.stringify(old), snapshot);
  assert.notEqual(hydrated, old);
  assert.equal(hydrated.shops.convenience.stock.fish_bait, 8);
  assert.equal(hydrated.shops.convenience.stock.fishing_rod, 2);
  assert.equal(hydrated.shops.art_hardware.stock.fishing_rod_pro, 1);
  assert.deepEqual(Object.fromEntries(Object.entries(hydrated.actors).map(([id, actor]) => [id, actor.fishingSkill])), { xuan: 0, fan: 0, ma: 60 });
  const bought = buyNow(hydrated, 'xuan', [{ shopId: 'convenience', itemId: 'fish_bait', qty: 1 }, { shopId: 'convenience', itemId: 'fishing_rod', qty: 1 }]);
  assert.equal(bought.error, undefined);
  assert.ok(bought.state.items.some(x => x.itemId === 'fishing_rod' && x.container === 'xuan'));
});
test('hydration preserves sold-out stock and existing skill', () => {
  const old = fresh(19);
  old.shops.convenience.stock.fish_bait = 0;
  old.shops.convenience.stock.fishing_rod = 0;
  old.shops.art_hardware.stock.fishing_rod_pro = 0;
  old.actors.ma.fishingSkill = 73;
  const hydrated = saveModule.normalizeSave(old);
  assert.equal(hydrated.shops.convenience.stock.fish_bait, 0);
  assert.equal(hydrated.shops.convenience.stock.fishing_rod, 0);
  assert.equal(hydrated.shops.art_hardware.stock.fishing_rod_pro, 0);
  assert.equal(hydrated.actors.ma.fishingSkill, 73);
});
