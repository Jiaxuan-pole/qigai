import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, copy } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { fish } from '../public/game/fishing.js';
import { rng } from '../public/game/rng.js';

before(loadData);
function gear(seed, actorId = 'ma') {
  const state = fresh(seed);
  state.pendingMorning = null;
  state.day = 2;
  state.hour = 6;
  state.hourTick = 16;
  state.weatherKind = 'overcast';
  state.actors[actorId].life = 'active';
  makeItem(state, 'fishing_rod_simple', actorId);
  for (let i = 0; i < 9; i++) makeItem(state, 'fish_bait', actorId);
  return state;
}
function attempt(state, actorId, tick) {
  state.hourTick = tick;
  const events = [];
  const catchId = fish(state, actorId, events);
  return { catchId, events };
}
test('200 fixed seeds lower catches for both actors than prior formula while Ma keeps an edge', () => {
  const count = { ma: 0, xuan: 0 };
  const baseline = { ma: 0, xuan: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    for (const actorId of ['ma', 'xuan']) {
      const state = gear(seed, actorId);
      const oldSkill = actorId === 'ma' ? 60 : 0;
      const oldChance = Math.min(88, Math.max(8, 28 + Math.floor(oldSkill * 0.42) + 4));
      if (rng(seed, `fish:${state.turn + 1}:${actorId}`) < oldChance / 100) baseline[actorId]++;
      if (attempt(state, actorId, 16).catchId) count[actorId]++;
    }
  }
  assert.ok(count.ma < baseline.ma, JSON.stringify({count, baseline}));
  assert.ok(count.xuan < baseline.xuan, JSON.stringify({count, baseline}));
  assert.ok(count.ma > count.xuan, JSON.stringify({count, baseline}));
});
test('three dry attempts trigger one persistent Ma river fight with exact line and cost', () => {
  const state = gear(1);
  const energy = state.actors.ma.energy;
  for (const tick of [16, 17, 18]) {
    const result = attempt(state, 'ma', tick);
    assert.equal(result.catchId, null);
  }
  assert.equal(state.actors.ma.fishingDryStreak, 0);
  assert.equal(state.actors.ma.energy, energy - 5);
  assert.equal(state.actors.ma.clothes.wet, true);
  assert.deepEqual(state.pending.riverFight, {
    id: 'riverFight:1:2:18:ma', kind: 'riverFight', actorId: 'ma', seed: 1, day: 2, hourTick: 18, line: '这个鱼就是欠干',
  });
  assert.equal(state.flags.riverFightDay, 2);
  const saved = copy(state);
  assert.deepEqual(saved.pending.riverFight, state.pending.riverFight);
  for (const tick of [19, 20, 21]) attempt(state, 'ma', tick);
  assert.equal(state.actors.ma.energy, energy - 5);
  assert.deepEqual(state.pending.riverFight, saved.pending.riverFight);
});
test('other actors never create river fight and same seed/hour replay matches', () => {
  const a = gear(1, 'xuan');
  const b = copy(a);
  for (const tick of [16, 17, 18]) {
    attempt(a, 'xuan', tick);
    attempt(b, 'xuan', tick);
  }
  assert.deepEqual(a, b);
  assert.equal(a.pending.riverFight, null);
  assert.ok(a.actors.xuan.fishingDryStreak >= 0);
});
