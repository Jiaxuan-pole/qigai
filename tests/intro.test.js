import test from 'node:test';
import assert from 'node:assert/strict';
import { person, personAnchors, tossCig } from '../public/ui/intro-art.js';
import { announceIntroLine, choreo, INTRO_LAYOUT } from '../public/ui/intro.js';

function fakeContext() {
  const pixels = [];
  const noop = () => {};
  const context = {
    pixels,
    fillStyle: '',
    globalAlpha: 1,
    fillRect: (x, y, w, h) => pixels.push({ x, y, w, h, color: context.fillStyle }),
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
  };
  return context;
}

test('第9拍的烟有纸管、滤嘴和明暗烟头', () => {
  const context = fakeContext();
  person(context, 0, 0, 'fan', 'stand', 0, { cig: true, ember: 1 });

  assert.ok(context.pixels.some((pixel) => pixel.color === '#e9e2d2'), '纸管应可见');
  assert.ok(context.pixels.some((pixel) => pixel.color === '#c89b65'), '滤嘴应可见');
  assert.ok(context.pixels.some((pixel) => pixel.color === '#ffb060'), '点着后的烟头应可见');
});

test('开场人物使用统一的新衣着、肤色和鞋型，不再给轩哥画眼镜', () => {
  const xuan = fakeContext();
  person(xuan, 0, 0, 'xuan', 'stand');
  assert.ok(xuan.pixels.some((pixel) => pixel.color === '#252b2e'), '轩哥应穿黑衬衫');
  assert.ok(xuan.pixels.some((pixel) => pixel.color === '#ecc19a'), '轩哥应为白皮肤');
  assert.equal(xuan.pixels.some((pixel) => pixel.color === '#1a1d22'), false, '轩哥不应再戴眼镜');

  const fan = fakeContext();
  person(fan, 0, 0, 'fan', 'stand');
  for (const color of ['#c69a32', '#467aa1', '#456784', '#b8832d']) assert.ok(fan.pixels.some((pixel) => pixel.color === color), `凡哥缺少 ${color} 材质`);

  const ma = fakeContext();
  person(ma, 0, 0, 'ma', 'stand');
  for (const color of ['#252b2e', '#626b70', '#d8d6cf']) assert.ok(ma.pixels.some((pixel) => pixel.color === color), `马哥缺少 ${color} 材质`);
});

test('第9拍的烟嘴、打火机和火焰锚点跟随翻转与姿势', () => {
  const standing = personAnchors(100, 150, 'stand', 0, { flip: true });
  const crouched = personAnchors(100, 150, 'crouch', 0, { flip: true });
  const seated = personAnchors(100, 150, 'sit', 0, { flip: false });

  assert.equal(crouched.cigarette[1] - standing.cigarette[1], 10, '蹲下时烟嘴必须跟随头部下移');
  assert.equal(crouched.lighter[1] - standing.lighter[1], 10, '蹲下时打火机必须跟随手下移');
  assert.equal(seated.cigarette[1], 169, '坐姿烟嘴必须落在坐姿头部');
  assert.ok(Math.abs(standing.cigarette[0] - standing.lighter[0]) <= 1, '火苗必须贴近烟头，不得飘到头顶');
});

test('凡哥坐姿贴右桥柱但不会穿进柱体', () => {
  assert.ok(
    INTRO_LAYOUT.seatedFanX + INTRO_LAYOUT.seatedFanFootprint <= INTRO_LAYOUT.rightPillarX,
    '凡哥坐姿的最右像素不能遮住右桥柱',
  );
});

test('第9拍三次火星后才稳定点着，且同一时刻只有一人持打火机', () => {
  const world = {};
  for (const age of [2950, 3450, 3950]) assert.equal(choreo(9, age, 0, world).fxp.sparks, true, `${age}ms 应有火星`);
  assert.equal(choreo(9, 4100, 0, world).fxp.sparks, false, '第三次火星结束后才出现稳定火焰');
  assert.equal(choreo(9, 4200, 0, world).fxp.flame, true, '第三次火星后应稳定点着凡哥的烟');
  assert.equal(choreo(9, 4800, 0, world).fan.arm, 'throw', '凡哥点完才离手抛出打火机');
  assert.equal(choreo(9, 4800, 0, world).xuan.arm, 'reach', '轩哥在接住前不能持有打火机');
  assert.equal(choreo(9, 5300, 0, world).fan.arm, 'none', '凡哥交接后不能继续持有打火机');
  assert.equal(choreo(9, 5300, 0, world).xuan.arm, 'cup', '轩哥接到后自己点烟');
});

test('第9拍抛出的打火机从凡哥手边起飞，弧线落向轩哥', () => {
  const context = fakeContext();
  tossCig(context, 302, 196, 222, 196, 0, '#8a9aa6', 2, 4);
  tossCig(context, 302, 196, 222, 196, 0.5, '#8a9aa6', 2, 4);
  tossCig(context, 302, 196, 222, 196, 1, '#8a9aa6', 2, 4);

  assert.deepEqual(context.pixels.map(({ x, y }) => [x, y]), [[302, 196], [262, 178], [222, 196]]);
});

test('开场角色台词只在新行开始时朗读，并先停止上一句', () => {
  const before = globalThis.window;
  const calls = [];
  globalThis.window = { jwsnAudio: { stopSpeech: () => calls.push('stop'), speak: (who, text) => calls.push([who, text]) } };

  try {
    announceIntroLine({ type: 'narr', text: '旁白不朗读' });
    announceIntroLine({ type: 'line', who: '轩哥', text: '学习一下。' });

    assert.deepEqual(calls, ['stop', ['轩哥', '学习一下。']]);
  } finally {
    globalThis.window = before;
  }
});
