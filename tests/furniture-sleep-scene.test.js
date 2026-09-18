import test from 'node:test';
import assert from 'node:assert/strict';
import { sleepSurfaceFor } from '../public/game/furniture.js';
import { drawSleepers, drawFloorBubble, createSleepSequence, sleepSceneDisplayState, showSleepScene } from '../public/ui/sleep-scene.js';
import { loadData } from '../public/game/data.js';

await loadData();

const ids = ['xuan', 'fan', 'ma'];
const lines = {
  xuan: '这地板，比我上份工作还硬。',
  fan: '睡个觉，拍出了苦情片的质感。',
  ma: '这地凉得，翻个身都得咬牙。',
};
function state(count = 2) {
  return {
    actors: Object.fromEntries(ids.slice(0, count).map(id => [id, { life: 'active', location: 'camp' }])),
    camp: { bedPriority: ids, floorSheets: count, placements: [], parcels: [] }, items: [],
  };
}
function surfaces(s) {
  return Object.fromEntries(Object.keys(s.actors).map(id => [id, sleepSurfaceFor(s, id, 'camp', { sleepingIds: Object.keys(s.actors) })]));
}
function canvas() {
  const calls = [];
  const c = { calls, fillStyle: '', font: '', textAlign: '', textBaseline: '',
    fillRect(...args) { calls.push(['rect', ...args, this.fillStyle]); },
    fillText(...args) { calls.push(['text', ...args]); },
    measureText(text) { return { width: text.length * 18 }; },
    save() {}, restore() {}, translate() {},
  };
  return c;
}

test('zero beds put both sleepers at their own sheet anchors with real horizontal wardrobe poses', () => {
  const s = state();
  const assigned = surfaces(s);
  assert.deepEqual(Object.values(assigned).map(x => x.kind), ['floor', 'floor']);
  const c = canvas();
  assert.deepEqual(drawSleepers(c, assigned, { now: 0 }), ['xuan', 'fan']);
  for (const id of Object.keys(assigned)) {
    const a = assigned[id].anchor;
    assert.ok(c.calls.some(call => call[0] === 'rect' && call[1] >= a.x && call[1] <= a.x + 85 && call[2] >= a.y - 25 && call[2] <= a.y + 20), id);
  }
  const colors = new Set(c.calls.filter(x => x[0] === 'rect').map(x => x[5]));
  for (const color of ['#252b2e', '#ecc19a', '#c69a32', '#467aa1', '#b98358']) assert.ok(colors.has(color), color);
  assert.notDeepEqual(canvasDraw(assigned, 0), canvasDraw(assigned, 1100));
  assert.deepEqual(canvasDraw(assigned, 0, true), canvasDraw(assigned, 1100, true));
});

function canvasDraw(assigned, now, reduced = false) { const c = canvas(); drawSleepers(c, assigned, { now, reduced }); return c.calls; }

test('boxed and stored beds still complain on floor', () => {
  const s = state();
  s.items.push({ uid: 'box', itemId: 'bed_basic', container: 'parcel:p1' }, { uid: 'stored', itemId: 'bed_comfort', container: 'camp' });
  const assigned = surfaces(s);
  for (const id of ['xuan', 'fan']) {
    assert.equal(assigned[id].kind, 'floor');
    assert.equal(drawFloorBubble(canvas(), assigned, id)?.text, lines[id]);
  }
  const played = [];
  const sequence = createSleepSequence(assigned, 'xuan', { speak: (...args) => played.push(args) });
  sequence.show('xuan'); sequence.show('xuan'); sequence.show('fan'); sequence.show('fan');
  assert.deepEqual(played, [['xuan', lines.xuan], ['fan', lines.fan]]);
});

test('bed users do not complain', () => {
  const s = state(3);
  s.items = [{ uid: 'b1', itemId: 'bed_basic', container: 'camp' }, { uid: 'b2', itemId: 'bed_comfort', container: 'camp' }];
  s.camp.placements = [{ uid: 'b1', slot: 'upper_1', rotation: 0 }, { uid: 'b2', slot: 'upper_2', rotation: 0 }];
  const assigned = surfaces(s);
  assert.deepEqual(ids.map(id => assigned[id].kind), ['bed', 'bed', 'floor']);
  assert.equal(drawFloorBubble(canvas(), assigned, 'xuan'), null);
  assert.equal(drawFloorBubble(canvas(), assigned, 'fan'), null);
  assert.equal(drawFloorBubble(canvas(), assigned, 'ma')?.text, lines.ma);
  const rendered = canvasDraw(assigned, 0);
  for (const id of ids) assert.ok(rendered.some(call => call[0] === 'rect' && call[1] >= assigned[id].anchor.x && call[1] < assigned[id].anchor.x + 85));
});

test('night display restores the settled bed slot after a later move without mutating live state', () => {
  const live = state();
  live.items = [{ uid: 'b1', itemId: 'bed_basic', container: 'camp' }];
  live.camp.placements = [{ uid: 'b1', slot: 'upper_2', rotation: 0 }];
  const settled = { xuan: { kind: 'bed', uid: 'b1', slot: 'upper_1', anchor: { x: 213, y: 283 } } };
  const display = sleepSceneDisplayState(live, settled);
  assert.equal(display.camp.placements.find(p => p.uid === 'b1').slot, 'upper_1');
  assert.equal(live.camp.placements[0].slot, 'upper_2');
});

test('switching sleeper keeps one animation frame chain', async () => {
  const oldDocument = globalThis.document, oldRAF = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame, oldPerformance = globalThis.performance;
  const oldMatchMedia = globalThis.matchMedia;
  const buttons = [];
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.dataset = {}; this.listeners = {}; this.attributes = {}; this.textWrites = 0; }
    set textContent(value) { this._textContent = value; this.textWrites += 1; }
    get textContent() { return this._textContent; }
    append(...children) { this.children.push(...children); }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    click() { this.listeners.click?.(); }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelectorAll(selector) { return selector === '[data-actor]' ? buttons : []; }
    remove() {}
    getContext() { return { ...canvas(), clearRect() {}, rotate() {}, imageSmoothingEnabled: false }; }
  }
  let scheduled = 0;
  const frames = [];
  globalThis.document = { body: new Element('body'), createElement(tag) { const element = new Element(tag); if (tag === 'button') buttons.push(element); return element; } };
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return ++scheduled; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.performance = { now: () => 0 };
  globalThis.matchMedia = () => ({ matches: false });
  try {
    const s = state();
    s.items = [{ uid: 'b1', itemId: 'bed_basic', container: 'camp' }];
    s.camp.placements = [{ uid: 'b1', slot: 'upper_1', rotation: 0 }];
    const night = { day: 1, sleepSurfaces: surfaces(s) };
    const done = showSleepScene({ state: s, night, selectedId: 'xuan' });
    const caption = globalThis.document.body.children[0].children[0].children.find(child => child.tag === 'p');
    assert.ok(caption, 'readable DOM sleep caption');
    assert.equal(caption.textContent, '轩哥睡在床上。');
    assert.equal(caption.attributes.role, 'status');
    assert.match(caption.style.cssText, /font-size:16px/);
    assert.equal(scheduled, 1);
    buttons.find(button => button.dataset.actor === 'fan').click();
    assert.equal(caption.textContent, '凡哥：睡个觉，拍出了苦情片的质感。');
    assert.equal(scheduled, 1);
    assert.equal(caption.textWrites, 2);
    frames.shift()();
    assert.equal(scheduled, 2);
    assert.equal(caption.textWrites, 2);
    buttons.find(button => button.textContent === '继续').click();
    await done;
  } finally {
    globalThis.document = oldDocument;
    globalThis.requestAnimationFrame = oldRAF;
    globalThis.cancelAnimationFrame = oldCancel;
    globalThis.performance = oldPerformance;
    globalThis.matchMedia = oldMatchMedia;
  }
});
