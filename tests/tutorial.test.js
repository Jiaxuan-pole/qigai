// 导览的纯逻辑：步骤表的目标选择器必须在页面标记里真的存在；阶段只在第 1 回合与第 1 回合结算后出现。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEPS, CONTEXT_GUIDES, prepareTutorialTarget, stepsFor, stageOf } from '../public/ui/tutorial.js';

const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  + readFileSync(new URL('../public/ui/render.js', import.meta.url), 'utf8')
  + readFileSync(new URL('../public/ui/app.js', import.meta.url), 'utf8')
  // 战斗引导锚在战斗弹层自己的标记上
  + readFileSync(new URL('../public/ui/combat.js', import.meta.url), 'utf8');

function tokenExists(sel) {
  const id = sel.match(/#([\w-]+)/);
  if (id && !new RegExp(`id=["']${id[1]}["']|id = '${id[1]}'|\\.id = '${id[1]}'|id="${id[1]}"`).test(markup) && !markup.includes(`'${id[1]}'`)) return false;
  const cls = sel.match(/\.([\w-]+)/);
  if (cls && !new RegExp(`class=["'][^"']*\\b${cls[1]}\\b|className = '${cls[1]}'`).test(markup)) return false;
  const attr = sel.match(/\[data-open="([\w-]+)"\]/);
  if (attr && !markup.includes(`data-open="${attr[1]}"`)) return false;
  return true;
}

test('每一步的目标选择器都能在页面标记里找到对应的 id/class/data-open', () => {
  assert.equal(stepsFor(1).length, 6, '第一组恰好六步');
  assert.equal(stepsFor(2).length, 3, '第二组恰好三步');
  for (const stage of [1, 2]) {
    for (const step of stepsFor(stage)) assert.ok(tokenExists(step.sel), `${step.sel} 在 index.html/render.js/app.js 里不存在`);
  }
  // 情境引导锚在排程窗内部的按钮上时，窗没开就是 0x0 的空洞，卡片会压到左上角的引导条；一律锚到常显的 HUD 节点。
  for (const [id, steps] of Object.entries(CONTEXT_GUIDES)) for (const step of steps) {
    assert.ok(tokenExists(step.sel), `${id}: ${step.sel} 在页面标记里不存在`);
    assert.ok(!step.openDrawer, `${id}: ${step.sel} 不该依赖打开排程窗`);
    assert.ok(!/data-open="(health|wishes|inventory)"|#schedule|#nightSpot/.test(step.sel), `${id}: ${step.sel} 藏在排程窗里`);
  }
  assert.deepEqual(Object.keys(STEPS), ['1', '2']);
  assert.deepEqual(stepsFor(3), []);
});

test('每步标题不超过 10 字、正文不超过 55 字，全部收起抽屉、没有展开抽屉的步', () => {
  for (const stage of [1, 2]) {
    for (const step of stepsFor(stage)) {
      assert.ok(step.title.length <= 10, `${step.title} 标题过长`);
      assert.ok(step.text.length <= 55, `${step.title} 正文过长：${step.text.length}`);
      assert.equal(step.closeDrawer, true, `${step.title} 应收起抽屉`);
      assert.equal(step.openDrawer, undefined, `${step.title} 不该展开抽屉`);
    }
  }
});

test('阶段判断：第 1 回合第一组，结算一次后第二组，之后或已完成就没有', () => {
  const planning = (turn, day = 1) => ({ turn, day, phase: 'planning' });
  assert.equal(stageOf(planning(0), null), 1);
  assert.equal(stageOf(planning(0), '1'), null, '第一组看过就不再弹');
  assert.equal(stageOf(planning(1), '1'), 2);
  assert.equal(stageOf(planning(1), null), 2, '没看过第一组也能看第二组');
  assert.equal(stageOf(planning(2), '1'), null);
  assert.equal(stageOf(planning(0), 'done'), null);
  assert.equal(stageOf(planning(1), 'done'), null);
  assert.equal(stageOf({ turn: 0, day: 1, phase: 'meeting' }, null), null, '不在排程阶段不弹');
  assert.equal(stageOf(null, null), null);
});

test('前两章在需要时给出情境引导，看过的不会重复', () => {
  const base = { phase: 'planning', day: 11, turn: 40, actors: {} };
  assert.equal(stageOf(base, 'done'), 'chapter2');
  assert.equal(stageOf(base, 'done', ['chapter2']), null);
  assert.equal(stageOf({ ...base, day: 21, turn: 80 }, 'done'), null);
  assert.equal(stageOf({ ...base, day: 4, weatherKind: 'rain' }, 'done'), 'weather');
  assert.equal(stageOf({ ...base, day: 3, metMa: true }, 'done'), 'company');
  assert.equal(stageOf({ ...base, day: 9, items: [{ itemId: 'fishing_rod', container: 'ma' }] }, 'done'), 'fishing');
});

test('第一组对着 HUD 讲：顶栏、人物卡、街景、引导条、快捷栏、底部四个按钮', () => {
  const first = stepsFor(1);
  assert.deepEqual(first.map((step) => step.sel), ['.topstats', '#characters', '.stage-view', '#taskStrip', '#hotbar', '.hud-actions']);
  assert.ok(first.some((step) => step.sel === '#taskStrip' && /引导/.test(step.text)));
  assert.ok(first.some((step) => step.sel === '#characters' && /展开/.test(step.text)));
  assert.ok(first.some((step) => step.sel === '.stage-view' && /热点/.test(step.text)));
  assert.ok(first.some((step) => step.sel === '.hud-actions' && /结束今天/.test(step.text)));
  assert.deepEqual(stepsFor(2).map((step) => step.sel), ['.journal', '#btnMenu', '[data-open="events"]']);
  assert.ok(stepsFor(2).some((step) => step.sel === '#btnMenu' && /库存/.test(step.text)));
  assert.ok(stepsFor('combat').some((step) => /防守.*撤离/.test(step.text)));
});

test('收起抽屉的步会先把展开的抽屉关上，再定位目标', () => {
  const first = stepsFor(1);
  const toggle = { expanded: true, getAttribute() { return this.expanded ? 'true' : 'false'; }, click() { this.expanded = !this.expanded; } };
  const stage = { className: 'stage-view' };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: () => toggle, querySelector: (sel) => sel === '.stage-view' && !toggle.expanded ? stage : null };
  try {
    assert.equal(prepareTutorialTarget(first.find((step) => step.sel === '.stage-view')), stage);
    assert.equal(toggle.expanded, false);
    assert.equal(prepareTutorialTarget(first.find((step) => step.sel === '.stage-view')), stage, '已收起时不再点开关');
    assert.equal(toggle.expanded, false);
  } finally {
    globalThis.document = priorDocument;
  }
});
