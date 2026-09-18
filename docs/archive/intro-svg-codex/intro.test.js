// 开场契约：锁定原始分拍、无 DOM 场景与随文案推进的涂鸦。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, drawingStep } from '../public/ui/intro.js';
import { buildScene, sceneForBeat } from '../public/ui/intro-scene.js';

const receipt = readFileSync(new URL('../docs/交办单6回执.md', import.meta.url), 'utf8');
const original = JSON.parse(receipt.match(/```json intro-original-beats\n([\s\S]*?)\n```/)[1]);
const svg = buildScene();
const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

test('原始 27 拍文案、顺序、场景指令与停留值逐拍相等', () => {
  assert.equal(BEATS.length, 27);
  for (let beat = 0; beat < 27; beat += 1) assert.deepEqual(BEATS[beat], original[beat], `第 ${beat} 拍`);
});

test('开场舞台是无需 DOM 的内联 SVG，使用原始 16:9 坐标系', () => {
  assert.match(svg, /^\s*<svg\b/);
  assert.match(svg, /\bid="introScene"/);
  assert.match(svg, /viewBox="0 0 480 270"/);
  assert.doesNotMatch(svg, /<(?:canvas|image|script|foreignObject)\b/i);
  assert.doesNotMatch(svg, /(?:href|src)="(?!#)/i);
  assert.equal(buildScene(), svg, '重复构建必须确定，不能使用随机数或时间');
});

test('27 拍都有对应场景类、有效镜头和真实存在的动作元素', () => {
  for (let beat = 0; beat < 27; beat += 1) {
    const scene = sceneForBeat(beat);
    assert.ok(scene.className.split(' ').includes(`scene-${BEATS[beat].scene}`), `第 ${beat} 拍场景类`);
    assert.ok(scene.className.split(' ').includes(`beat-${beat}`), `第 ${beat} 拍类`);
    assert.ok(scene.ids.length > 0, `第 ${beat} 拍未关联动作`);
    for (const id of scene.ids) assert.ok(ids.includes(id), `第 ${beat} 拍缺少 ${id}`);
    assert.equal(scene.camera.length, 4);
    assert.ok(scene.camera.every(Number.isFinite));
    assert.ok(scene.camera[2] > 0 && scene.camera[3] > 0);
    assert.ok(Math.abs(scene.camera[2] / scene.camera[3] - 16 / 9) < 0.001);
    assert.ok(scene.duration > 0 && scene.duration <= 5000, `第 ${beat} 拍镜头时长不能误用标题 hold`);
  }
});

test('非法拍序不能输出一个错位的场景', () => {
  for (const beat of [-1, 27, NaN, 1.5, '1', null]) assert.throws(() => sceneForBeat(beat), RangeError);
});

test('SVG 所有 id 唯一，局部引用都指向已声明元素', () => {
  assert.equal(new Set(ids).size, ids.length);
  const references = [...svg.matchAll(/(?:url\(#|href="#)([\w-]+)/g)].map((match) => match[1]);
  for (const id of references) assert.ok(ids.includes(id), `未定义 SVG 引用 ${id}`);
});

test('拉远镜头扩大可见范围且标题继承最终画面', () => {
  const close = sceneForBeat(24).camera;
  const wide = sceneForBeat(25).camera;
  assert.ok(wide[2] > close[2] * 1.2, '拉远不能只做微小缩放');
  assert.deepEqual(sceneForBeat(26).camera, wide);
});

test('第19拍随原文先框、再两人、最后屋顶，下一行不能提前画', () => {
  assert.equal(drawingStep(18, 7, 100), 0);
  assert.equal(drawingStep(19, 0, 100), 0);
  assert.equal(drawingStep(19, 1, 0), 0);
  assert.equal(drawingStep(19, 1, '他把纸箱翻了个面，画了一个方框'.length), 1);
  assert.equal(drawingStep(19, 2, '框里两个'.length), 1);
  assert.equal(drawingStep(19, 2, '框里两个人'.length), 2);
  assert.equal(drawingStep(19, 3, 0), 2);
  assert.equal(drawingStep(19, 3, '然后在他们头顶，加了一个屋顶'.length), 3);
});

test('第20拍读到扩框才扩框，第21拍接笔不新增笔画；加速补全本拍', () => {
  assert.equal(drawingStep(20, 0, 0), 3);
  assert.equal(drawingStep(20, 4, '凡哥把方框往外'.length), 3);
  assert.equal(drawingStep(20, 4, '凡哥把方框往外扩了一点'.length), 4);
  assert.equal(drawingStep(21, 0, 0), 4);
  assert.equal(drawingStep(19, BEATS[19].lines.length), 3);
  assert.equal(drawingStep(20, BEATS[20].lines.length), 4);
});
