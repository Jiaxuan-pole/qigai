import assert from 'node:assert/strict';
import test from 'node:test';
import { playFishingQte, cancelFishingQte, fishingQteAngle, fishingQteGeometry } from '../public/ui/fishing-qte.js';

const bite = { id: 'bite-1', actorId: 'ma', day: 1, hourTick: 6, skill: 80, fishItemId: 'fish_rare', zoneStart: 340, zoneWidth: 104 };

function harness() {
  const previous = { document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let now = 0;
  let frame;
  const listeners = new Map();
  const parts = new Map();
  const make = () => ({ style: {}, dataset: {}, textContent: '', hidden: false, className: '', parentNode: null, focus() { globalThis.document.activeElement = this; }, remove() { this.parentNode?.removeChild(this); }, setAttribute() {}, addEventListener(type, fn) { this[`on${type}`] = fn; }, removeEventListener(type) { this[`on${type}`] = null; }, querySelector(selector) { return parts.get(selector); }, classList: { add() {}, remove() {} } });
  const body = make();
  body.children = [];
  body.appendChild = (child) => { child.parentNode = body; body.children.push(child); };
  body.removeChild = (child) => { body.children.splice(body.children.indexOf(child), 1); child.parentNode = null; };
  const head = make();
  head.appendChild = (child) => { child.parentNode = head; };
  head.removeChild = (child) => { child.parentNode = null; };
  const doc = { body, head, hidden: false, activeElement: null, createElement: () => make(), addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); }, querySelector: () => null };
  for (const name of ['ring', 'needle', 'status', 'button', 'panel', 'skill']) parts.set(`[data-qte="${name}"]`, make());
  globalThis.document = doc;
  globalThis.window = { addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { vibrate: (value) => { vibration.push(value); return true; } } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.requestAnimationFrame = (cb) => { frame = cb; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = null; };
  const vibration = [];
  return { parts, body, doc, listeners, vibration, tick(time) { now = time; frame?.(time); }, click() { parts.get('[data-qte="button"]').onclick({ preventDefault() {} }); }, key(key) { const event = { key, repeat: false, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} }; listeners.get('keydown')?.(event); return event; }, hide() { doc.hidden = true; listeners.get('visibilitychange')?.(); }, show() { doc.hidden = false; listeners.get('visibilitychange')?.(); }, restore() { for (const [key, value] of Object.entries(previous)) globalThis[key] = value; Object.defineProperty(globalThis, 'navigator', previousNavigator); Object.defineProperty(globalThis, 'performance', previousPerformance); } };
}

test('geometry uses rule width and wraps from top clockwise', () => {
  assert.deepEqual(fishingQteGeometry({ ...bite, skill: 0, zoneWidth: 40 }), { start: 340, width: 40 });
  assert.deepEqual(fishingQteGeometry(bite), { start: 340, width: 104 });
  assert.equal(fishingQteAngle(2250, 2000, 1500), 60);
});

test('low and high skill bites paint different visible ring widths', async () => {
  const h = harness();
  try {
    const low = playFishingQte({ ...bite, skill: 0, zoneWidth: 40 }, () => ({ result: { hit: false } }));
    assert.match(h.parts.get('[data-qte="ring"]').style.background, /0deg 40deg/);
    cancelFishingQte(); h.tick(0); h.tick(500); await low;
    const high = playFishingQte(bite, () => ({ result: { hit: false } }));
    assert.match(h.parts.get('[data-qte="ring"]').style.background, /0deg 104deg/);
    cancelFishingQte(); h.tick(1000); await high;
  } finally { cancelFishingQte(); h.restore(); }
});

test('ready clock, key angle and double input resolve once with concealed fish', async () => {
  const h = harness();
  const calls = [];
  try {
    const done = playFishingQte(bite, (angle) => { calls.push(angle); return { result: { hit: true } }; });
    assert.doesNotMatch(h.body.children[0].innerHTML, /fish_rare/);
    h.tick(0); h.tick(2000); h.tick(2250);
    const event = h.key(' ');
    h.click();
    assert.equal(event.prevented, true);
    assert.deepEqual(calls, [60]);
    h.tick(2800);
    assert.equal((await done).hit, true);
    assert.equal(h.body.children.length, 0);
    assert.equal(h.listeners.size, 0);
    assert.deepEqual(h.vibration, [60, 0]);
  } finally { cancelFishingQte(); h.restore(); }
});

test('hidden page pauses countdown and resume keeps the angle', async () => {
  const h = harness();
  const calls = [];
  try {
    const done = playFishingQte(bite, (angle) => { calls.push(angle); return { result: { hit: false } }; });
    h.tick(0); h.tick(2000); h.hide(); h.tick(9000); h.show(); h.tick(9250);
    h.click();
    h.tick(9800);
    await done;
    assert.deepEqual(calls, [60]);
    assert.deepEqual(h.vibration, [[30, 60, 90], 0]);
  } finally { cancelFishingQte(); h.restore(); }
});

test('three missed rotations submit null and clean up', async () => {
  const h = harness();
  const calls = [];
  try {
    const done = playFishingQte(bite, (angle) => { calls.push(angle); return { result: { hit: false, forfeited: true } }; });
    h.tick(0); h.tick(6501); h.tick(7100);
    assert.equal((await done).forfeited, true);
    assert.deepEqual(calls, [null]);
    assert.equal(h.body.children.length, 0);
  } finally { cancelFishingQte(); h.restore(); }
});
