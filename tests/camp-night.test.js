import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCampNightActivities, createCampNightSession } from '../public/ui/camp-night.js';
import { CAMP_SPOTS, renderCampStreet } from '../public/ui/camp-art.js';

const state = () => ({ actors: { xuan: { life: 'active', mind: 42 }, fan: { life: 'active', mind: 31 }, ma: { life: 'dead', mind: 0 } }, daily: { bets: 0 }, cash: 30 });

test('night activities hide an absent screening and dead actors', () => {
  const options = availableCampNightActivities(state(), { day: 2 });
  assert.equal(options.activities.some((item) => item.id === 'tv'), false);
  assert.deepEqual(options.actors.map((item) => item.id), ['xuan', 'fan']);
});

test('night session locks duplicate async actions and can release them', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const session = createCampNightSession({ state: state(), night: { day: 2 }, onCards: () => { calls++; return pending; } });
  const first = session.run('cards');
  assert.equal(session.busy, true);
  assert.equal(await session.run('cards'), false);
  assert.equal(calls, 1);
  release(true);
  assert.equal(await first, true);
  assert.equal(session.busy, false);
  assert.equal(session.cardsUsed, true);
});

test('skipping the card invitation keeps it available; settled cards cannot reopen', async () => {
  const s = state();
  const session = createCampNightSession({ state: s, night: { day: 2 }, onCards: async () => false });
  assert.equal(await session.run('cards'), true);
  assert.equal(session.cardsUsed, false);
  s.flags = { cardNightDay: s.day = 2 };
  assert.equal(await session.run('cards'), false);
});

test('sitting by the fire is visual only, and a stopped session ignores actions', async () => {
  const s = state();
  let poses = 0;
  const session = createCampNightSession({ state: s, night: { day: 2 }, onSit: () => { poses++; } });
  assert.equal(await session.run('fire'), true);
  assert.equal(poses, 1);
  assert.equal(s.actors.xuan.mind, 42);
  session.stop();
  assert.equal(await session.run('fire'), false);
  assert.equal(poses, 1);
});

test('camp street fills the long world and reacts to built facilities and television', () => {
  const pixels = [];
  const canvas = { fillStyle: '', fillRect(x, y, w, h) { pixels.push({ x, y, w, h, color: this.fillStyle }); }, save() {}, restore() {} };
  const s = { ...state(), camp: { rain: 3, beds: 3, facilities: ['repair_table', 'drying_rack'] }, wood: 0, art: 2, items: [{ itemId: 'tv' },{itemId:'charcoal_smokeless',container:'camp',uses:2}] };
  renderCampStreet(canvas, { state: s, tick: 0, width: 1600, height: 540, night: true });
  assert.equal(CAMP_SPOTS.length, 5);
  assert.ok(pixels.some((pixel) => pixel.x >= 1500));
  assert.ok(pixels.some((pixel) => pixel.color === '#749197'));
  assert.ok(pixels.some((pixel) => pixel.color === '#efac58'));
  pixels.length = 0;
  renderCampStreet(canvas, { state: { camp: { rain: 1, beds: 2, facilities: [] }, wood: 4, cardboard: 4, items: [] }, tick: 0, night: true });
  assert.equal(pixels.some((pixel) => pixel.color === '#749197'), false);
  assert.equal(pixels.some((pixel) => pixel.color === '#efac58'), false);
});
