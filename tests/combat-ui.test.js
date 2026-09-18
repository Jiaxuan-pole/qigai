import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCombatScene } from '../public/ui/combat.js';

function canvasRecording() {
  const pixels = [];
  const c = { fillStyle: '', pixels, fillRect(...args) { pixels.push([this.fillStyle, ...args]); },
    save() {}, restore() {}, translate(...args) { pixels.push(['translate', ...args]); }, scale(...args) { pixels.push(['scale', ...args]); } };
  return c;
}

test('战斗绘图使用玩家身份并区分出拳、防守、撤离和敌方形象', () => {
  const state = { actors: { ma: {} } }, combat = { actorId: 'ma', kind: 'thugs', playerStamina: 70, opponentStamina: 60, allies: [], phase: 'fighting' };
  const frames = ['attack', 'defend', 'flee'].map(action => {
    const c = canvasRecording();
    drawCombatScene(c, state, combat, { action, dealt: 24, received: 9, escaped: action === 'flee' }, 0.4);
    assert.ok(c.pixels.length > 100);
    return c.pixels;
  });
  assert.notDeepEqual(frames[0], frames[1]);
  assert.notDeepEqual(frames[0], frames[2]);
  const before = structuredClone(combat), c = canvasRecording();
  drawCombatScene(c, state, combat, { action: 'attack', dealt: 24, received: 9 }, 0.8);
  assert.notDeepEqual(c.pixels, frames[0]);
  assert.deepEqual(combat, before);
  const uniformed = canvasRecording();
  drawCombatScene(uniformed, state, { ...combat, kind: 'chengguan' }, null, 1);
  const thug = canvasRecording();
  drawCombatScene(thug, state, combat, null, 1);
  assert.notDeepEqual(uniformed.pixels, thug.pixels);
});
