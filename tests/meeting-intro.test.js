import test from 'node:test';
import assert from 'node:assert/strict';
import { departureLayout, departureScene } from '../public/ui/intro-art.js';
import { drawMeetingScene } from '../public/ui/meeting-art.js';
import { createMeetingLifecycle, MEETING_BEATS, meetingChoreo } from '../public/ui/meeting-intro.js';

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
    createRadialGradient: () => ({ addColorStop: noop }),
  };
  return context;
}

test('第一幕同时画出两人、两只拖箱和肩扛尿素袋', () => {
  const context = fakeContext();
  departureScene(context, { tick: 8, sceneAge: 1800 });
  const colors = context.pixels.map((pixel) => pixel.color);

  assert.ok(colors.includes('#252b2e'), '轩哥黑衬衫应可见');
  assert.ok(colors.includes('#c69a32'), '凡哥黄外套应可见');
  assert.ok(colors.filter((color) => color === '#4a4a52').length >= 2, '两只不同的行李箱应可见');
  assert.ok(colors.includes('#d7cfaa'), '尿素编织袋应可见');
  const layout = departureLayout(1800);
  assert.equal(layout.xuanCaseX - layout.xuanX, 34, '轩哥拉杆必须从前伸手臂连到他的箱子');
  assert.equal(layout.fanCaseX - layout.fanX, 34, '凡哥拉杆必须从前伸手臂连到他的箱子');
  assert.equal(layout.sackX - layout.fanX, -9, '尿素袋必须压在凡哥肩侧');
});

test('相遇短片在认出后收成三人拥抱，并让烟在松开后出现', () => {
  const hug = meetingChoreo(16000, 0);
  const smoke = meetingChoreo(22000, 0);

  assert.equal(hug.phase, 'hug');
  assert.ok(Math.max(hug.xuanX, hug.fanX, hug.maX) - Math.min(hug.xuanX, hug.fanX, hug.maX) < 36, '拥抱时三人应重叠靠拢');
  assert.equal(smoke.phase, 'smoke');
  assert.equal(smoke.cigarette, true);
});

test('相遇短片在拥抱时落箱滑袋，坐下抽烟时有烟和烟雾', () => {
  const hug = fakeContext();
  drawMeetingScene(hug, { beat: 'hug', tick: 4, choreo: meetingChoreo(16000, 4) });
  assert.ok(hug.pixels.some((pixel) => pixel.color === '#8fc3e6'), '拥抱时应有泪点');
  assert.ok(hug.pixels.some((pixel) => pixel.color === '#d7cfaa' && pixel.y >= 200), '拥抱时尿素袋应滑到地上');

  const smoke = fakeContext();
  drawMeetingScene(smoke, { beat: 'smoke', tick: 8, choreo: meetingChoreo(22000, 8) });
  assert.ok(smoke.pixels.some((pixel) => pixel.color === '#e9e2d2'), '坐下后应有烟纸');
  assert.ok(smoke.pixels.some((pixel) => pixel.color === '#aeb6b6'), '坐下后应有烟雾');
});

test('相遇前的桶边和冲过去两拍都保留三个人与行李', () => {
  for (const age of [4500, 7500]) {
    const context = fakeContext();
    const choreo = meetingChoreo(age, 8);
    drawMeetingScene(context, { beat: choreo.phase, tick: 8, choreo });
    const colors = context.pixels.map((pixel) => pixel.color);
    assert.ok(colors.includes('#252b2e'), `${choreo.phase} 应画出轩哥`);
    assert.ok(colors.includes('#c69a32'), `${choreo.phase} 应画出凡哥`);
    assert.ok(colors.includes('#252b2e'), `${choreo.phase} 应画出马哥`);
    assert.ok(colors.includes('#4a4a52'), `${choreo.phase} 应保留行李箱`);
  }
});

test('相遇字幕在 1× 留出自然阅读时间，拥抱至少三秒', () => {
  const ends = MEETING_BEATS.map((beat) => beat.end);
  const spans = ends.map((end, index) => end - (ends[index - 1] || 0));
  assert.ok(ends.at(-1) >= 27000 && ends.at(-1) <= 29000, '整段应在 27 到 29 秒');
  assert.ok(spans.every((span) => span >= 2000), '每句字幕至少保留两秒');
  assert.equal(spans[6], 4000, '三人拥抱哭必须保留四秒');
});

test('三人互喊名字后下一拍立刻拥抱，擦泪拍没有角色台词', () => {
  const dialogueWho = MEETING_BEATS.filter((beat) => beat.line.type === 'line').map((beat) => beat.line.who);
  assert.deepEqual(dialogueWho, ['凡哥', '轩哥', '凡哥', '马哥']);
  assert.equal(MEETING_BEATS[6].phase, 'hug');
  assert.notEqual(MEETING_BEATS[7].line.type, 'line');
});

test('三人依次传同一根烟，不会同时各自抽烟', () => {
  const first = meetingChoreo(21300, 0);
  const handoffOne = meetingChoreo(21850, 0);
  const second = meetingChoreo(22600, 0);
  const handoffTwo = meetingChoreo(22850, 0);
  const last = meetingChoreo(23400, 0);

  assert.equal(first.cigaretteCarrier, 'xuan');
  assert.deepEqual(handoffOne.cigaretteTransfer, ['xuan', 'ma']);
  assert.equal(second.cigaretteCarrier, 'ma');
  assert.deepEqual(handoffTwo.cigaretteTransfer, ['ma', 'fan']);
  assert.equal(last.cigaretteCarrier, 'fan');

  const passing = fakeContext();
  drawMeetingScene(passing, { beat: 'smoke', tick: 8, choreo: handoffOne });
  assert.equal(
    passing.pixels.filter((pixel) => pixel.color === '#e9e2d2' && pixel.w === 5).length,
    1,
    '传递中只应有一根在两只手之间飞行的烟',
  );
});

test('相遇短片跳过和自然结束都只回调一次，并清理动画', () => {
  let done = 0;
  let cleaned = 0;
  const lifecycle = createMeetingLifecycle(() => { done += 1; }, () => { cleaned += 1; });

  lifecycle.finish();
  lifecycle.finish();

  assert.equal(done, 1);
  assert.equal(cleaned, 1);
});
