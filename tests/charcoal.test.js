import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { makeItem } from '../public/game/items.js';
import { burnFuel, fuelCount } from '../public/game/camp.js';
import { directorTick, chooseEvent, settleReserved } from '../public/game/events.js';

before(loadData);

test('one charcoal pack burns to empty, preserves wood, and records smoke per unit', () => {
  const state = fresh(101);
  const wood = state.wood;
  const paper = state.cardboard;
  const coal = makeItem(state, 'charcoal_cheap', 'camp');
  assert.equal(fuelCount(state), 4);
  assert.equal(burnFuel(state, 4), 4);
  assert.equal(state.items.some((item) => item.uid === coal.uid), false);
  assert.deepEqual([state.wood, state.cardboard], [wood, paper]);
  assert.deepEqual([state.flags.fireSmoke, state.flags.smokeSeq], [12, 4]);
});

test('fuel priority is smokeless, quality, cheap; dead and relic packs do not burn', () => {
  const state = fresh(102);
  state.actors.ma.life = 'dead';
  makeItem(state, 'charcoal_cheap', 'ma');
  makeItem(state, 'charcoal_cheap', 'relic:fan');
  const cheap = makeItem(state, 'charcoal_cheap', 'fan');
  const quality = makeItem(state, 'charcoal_quality', 'camp');
  const quiet = makeItem(state, 'charcoal_smokeless', 'camp');
  assert.equal(fuelCount(state), 16);
  assert.equal(burnFuel(state, 7), 7);
  assert.equal(state.items.some((item) => item.uid === quiet.uid), false);
  assert.equal(quality.uses, 5);
  assert.equal(cheap.uses, 4);
  assert.deepEqual([state.flags.fireSmoke, state.flags.smokeSeq], [1, 1]);
});

for (const [seed, templateId] of [[13, 'chengguan_sweep'], [10, 'street_thugs']]) {
  test(`smoke summons ${templateId} at camp once and old choices settle`, () => {
    const state = fresh(seed);
    state.day = 8;
    state.slot = 1;
    state.turn = 30;
    state.events = [];
    state.flags.fireSmoke = 6;
    state.flags.smokeSeq = 6;
    const lines = [];
    directorTick(state, lines);
    const found = state.events.find((event) => event.templateId === templateId && event.district === 'camp');
    assert.ok(found);
    assert.match(found.setup, /烟/);
    assert.equal(state.flags.fireSmoke, 0);
    assert.equal(state.flags.smokeProcessedSeq, 6);
    const choiceId = templateId === 'chengguan_sweep' ? 'leave' : 'run';
    const choice = chooseEvent(state, found.uid, choiceId, 'xuan');
    assert.equal(choice.error, undefined);
    settleReserved(state, { xuan: 'camp' }, lines);
    assert.equal(found.status, 'resolved');
  });
}

test('same smoke sequence cannot reroll and smokeless fuel adds no smoke', () => {
  const state = fresh(11);
  state.day = 8;
  state.slot = 1;
  state.turn = 30;
  state.events = [];
  const quiet = makeItem(state, 'charcoal_smokeless', 'camp');
  assert.equal(burnFuel(state, 6), 6);
  assert.equal(state.items.some((item) => item.uid === quiet.uid), false);
  assert.equal(state.flags.fireSmoke ?? 0, 0);
  state.flags.smokeSeq = 6;
  directorTick(state, []);
  assert.equal(state.events.some((event) => event.district === 'camp' && ['chengguan_sweep', 'street_thugs'].includes(event.templateId)), false);
  state.flags.fireSmoke = 6;
  directorTick(state, []);
  assert.equal(state.flags.smokeProcessedSeq, 6);
  const saved = JSON.stringify(state);
  const restored = JSON.parse(saved);
  const snapshot = structuredClone(restored);
  directorTick(restored, []);
  assert.deepEqual(restored, snapshot);
  assert.equal(JSON.stringify(restored), saved);
});

test('old smoke fades by day and a triggered camp trouble is capped to one per day', () => {
  const state = fresh(13);
  state.day = 8;
  state.slot = 1;
  state.turn = 30;
  state.events = [];
  state.flags.fireSmoke = 8;
  state.flags.smokeSeq = 6;
  state.flags.fireSmokeDay = 8;
  directorTick(state, []);
  assert.equal(state.flags.fireSmoke, 2);
  state.flags.fireSmoke = 12;
  state.flags.smokeSeq = 7;
  state.events = [];
  directorTick(state, []);
  assert.equal(state.flags.smokeProcessedSeq, 6);
  assert.equal(state.events.length, 0);
  state.flags.smokeProcessedSeq = 7;
  state.day = 9;
  state.turn += 4;
  directorTick(state, []);
  assert.equal(state.flags.fireSmoke, 10);
});
