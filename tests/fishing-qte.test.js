import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, copy } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import * as fishing from '../public/game/fishing.js';

before(loadData);
function setup(seed, actorIds = ['ma']) {
  const state = fresh(seed);
  state.pendingMorning = null;
  state.day = 2;
  state.hourTick = 16;
  state.weatherKind = 'overcast';
  for (const actorId of actorIds) {
    state.actors[actorId].life = 'active';
    makeItem(state, 'fishing_rod_pro', actorId);
    makeItem(state, 'fish_bait', actorId);
  }
  return state;
}
function withBite(actorId = 'ma', predicate = () => true) {
  for (let seed = 1; seed <= 1000; seed++) {
    const state = setup(seed, [actorId]);
    fishing.fish(state, actorId, []);
    const bite = state.pending.fishingQte?.[0];
    if (bite && predicate(bite)) return { state, bite };
  }
  throw new Error('未找到咬钩种子');
}
function fishCount(state, actorId) {
  return state.items.filter(x => x.container === actorId && ['fish_common', 'fish_rare'].includes(x.itemId)).length;
}
test('bite is persisted with locked species and zone, but gives no fish until a hit', () => {
  const { state, bite } = withBite();
  assert.equal(bite.id, `fishQte:${state.seed}:${state.day}:${state.hourTick}:ma`);
  assert.equal(bite.actorId, 'ma');
  assert.equal(bite.skill, 60);
  assert.ok(['fish_common', 'fish_rare'].includes(bite.fishItemId));
  assert.ok(Number.isInteger(bite.zoneStart) && bite.zoneStart >= 0 && bite.zoneStart < 360);
  assert.equal(bite.zoneWidth, 88);
  assert.equal(fishCount(state, 'ma'), 0);
  assert.equal(state.actors.ma.fishingSkill, 61);
  assert.equal(state.actors.ma.fishingDryStreak, 0);
  const snapshot = copy(state);
  const hit = fishing.resolveFishingQte(state, bite.id, (bite.zoneStart + bite.zoneWidth / 2) % 360);
  assert.equal(hit.result.hit, true);
  assert.equal(hit.result.fishItemId, bite.fishItemId);
  assert.equal(fishCount(hit.state, 'ma'), 1);
  assert.equal(hit.state.actors.ma.fishingSkill, 62);
  assert.equal(hit.state.pending.fishingQte.length, 0);
  assert.deepEqual(state, snapshot);
  assert.equal(fishing.resolveFishingQte(hit.state, bite.id, bite.zoneStart).state, hit.state);
});
test('bad angles and wrong bite ids are atomic; null forfeits and counts a dry attempt', () => {
  const { state, bite } = withBite();
  const before = copy(state);
  for (const angle of [NaN, Infinity, -1, 361, '45']) {
    const result = fishing.resolveFishingQte(state, bite.id, angle);
    assert.ok(result.error);
    assert.equal(result.state, state);
  }
  assert.equal(fishing.resolveFishingQte(state, 'other', bite.zoneStart).state, state);
  assert.deepEqual(state, before);
  const missed = fishing.resolveFishingQte(state, bite.id, null);
  assert.equal(missed.result.hit, false);
  assert.equal(missed.result.forfeited, true);
  assert.equal(missed.state.actors.ma.fishingDryStreak, 1);
  assert.equal(missed.state.actors.ma.fishingSkill, 61);
  assert.equal(fishCount(missed.state, 'ma'), 0);
});
test('angle zone wraps over zero and width grows from skill 0 to 100', () => {
  const start = withBite('ma', bite => bite.zoneStart + bite.zoneWidth > 360);
  const { state, bite } = start;
  assert.equal(fishing.resolveFishingQte(state, bite.id, bite.zoneStart).result.hit, true);
  assert.equal(fishing.resolveFishingQte(state, bite.id, (bite.zoneStart + bite.zoneWidth) % 360).result.hit, true);
  assert.equal(fishing.resolveFishingQte(state, bite.id, 0).result.hit, true);
  assert.equal(fishing.resolveFishingQte(state, bite.id, (bite.zoneStart + bite.zoneWidth + 1) % 360).result.hit, false);
  const widths = [];
  for (const skill of [0, 60, 100]) {
    for (let seed = 1; seed <= 1000; seed++) {
      const state = setup(seed);
      state.actors.ma.fishingSkill = skill;
      fishing.fish(state, 'ma', []);
      if (state.pending.fishingQte?.length) {
        widths.push(state.pending.fishingQte[0].zoneWidth);
        break;
      }
    }
  }
  assert.deepEqual(widths, [40, 88, 120]);
});
test('queue holds distinct same-hour bites and resolves in order', () => {
  let queued;
  for (let seed = 1; seed <= 3000 && !queued; seed++) {
    const state = setup(seed, ['xuan', 'ma']);
    fishing.fish(state, 'xuan', []);
    fishing.fish(state, 'ma', []);
    if (state.pending.fishingQte?.length === 2) queued = state;
  }
  assert.ok(queued);
  const [first, second] = queued.pending.fishingQte;
  assert.notEqual(first.id, second.id);
  assert.equal(fishing.resolveFishingQte(queued, second.id, second.zoneStart).state, queued);
  const one = fishing.resolveFishingQte(queued, first.id, first.zoneStart).state;
  assert.equal(one.pending.fishingQte[0].id, second.id);
  const two = fishing.resolveFishingQte(one, second.id, second.zoneStart).state;
  assert.equal(two.pending.fishingQte.length, 0);
});
test('missed Ma bite completes dry streak and auto resolve is reproducible with hits and misses', () => {
  const { state, bite } = withBite();
  state.actors.ma.fishingDryStreak = 2;
  const missed = fishing.resolveFishingQte(state, bite.id, null);
  assert.equal(missed.state.pending.riverFight?.line, '这个鱼就是欠干');
  assert.equal(missed.state.actors.ma.fishingDryStreak, 0);
  let hits = 0, misses = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = setup(seed);
    fishing.fish(s, 'ma', []);
    if (!s.pending.fishingQte?.length) continue;
    const a = fishing.autoResolveFishingQte(s);
    const b = fishing.autoResolveFishingQte(s);
    assert.deepEqual(a, b);
    if (a.result.hit) hits++; else misses++;
  }
  assert.ok(hits > 0 && misses > 0, JSON.stringify({hits, misses}));
});
test('a submitted hit or forfeit advances revision and records a bounded log without mutating the input', () => {
  for (const angleFor of [bite => bite.zoneStart, () => null]) {
    const { state, bite } = withBite();
    state.log = Array.from({ length: 120 }, (_, index) => '旧日志' + index);
    const saved = JSON.parse(JSON.stringify(state));
    const result = fishing.resolveFishingQte(state, bite.id, angleFor(bite));
    assert.equal(result.error, undefined);
    assert.equal(result.state.stateRevision, state.stateRevision + 1);
    assert.equal(result.state.log.length, 120);
    assert.match(result.state.log[0], /收线/);
    assert.deepEqual(state, saved);
    assert.equal(fishing.resolveFishingQte(result.state, bite.id, bite.zoneStart).state, result.state);
  }
});
test('a downed or dead angler forfeits a restored bite without fish, skill, dry streak or river fight effects', () => {
  for (const life of ['downed', 'dead']) {
    const { state, bite } = withBite();
    const restored = JSON.parse(JSON.stringify(state));
    restored.actors.ma.life = life;
    restored.actors.ma.fishingDryStreak = 2;
    const before = JSON.parse(JSON.stringify(restored));
    const outcome = fishing.resolveFishingQte(restored, bite.id, bite.zoneStart);
    assert.equal(outcome.error, undefined);
    assert.deepEqual(outcome.result, { hit: false, biteId: bite.id, actorId: 'ma', fishItemId: null, forfeited: true });
    assert.equal(outcome.state.pending.fishingQte.length, 0);
    assert.equal(outcome.state.stateRevision, restored.stateRevision + 1);
    assert.equal(outcome.state.actors.ma.fishingSkill, before.actors.ma.fishingSkill);
    assert.equal(outcome.state.actors.ma.fishingDryStreak, 2);
    assert.equal(outcome.state.actors.ma.energy, before.actors.ma.energy);
    assert.deepEqual(outcome.state.actors.ma.clothes, before.actors.ma.clothes);
    assert.equal(outcome.state.pending.riverFight, null);
    assert.equal(fishCount(outcome.state, 'ma'), 0);
    assert.match(outcome.state.log[0], /收线/);
    assert.deepEqual(restored, before);
    assert.equal(fishing.resolveFishingQte(outcome.state, bite.id, bite.zoneStart).state, outcome.state);
  }
});
