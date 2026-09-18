// 引导的纯逻辑：步骤表的目标选择器必须在页面标记里真的存在；阶段只在第 1 回合与第 1 回合结算后出现。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEPS, prepareTutorialTarget, stepsFor, stageOf } from '../public/ui/tutorial.js';

const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  + readFileSync(new URL('../public/ui/render.js', import.meta.url), 'utf8')
  + readFileSync(new URL('../public/ui/app.js', import.meta.url), 'utf8');

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
  for (const stage of [1, 2]) {
    assert.ok(stepsFor(stage).length >= 5, `第${stage}组至少五步`);
    for (const step of stepsFor(stage)) assert.ok(tokenExists(step.sel), `${step.sel} 在 index.html/render.js/app.js 里不存在`);
  }
  assert.deepEqual(Object.keys(STEPS), ['1', '2']);
  assert.deepEqual(stepsFor(3), []);
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

test('引导先提示地图栏按钮，再展开行动抽屉定位具体步骤', () => {
  const first = stepsFor(1);
  const buttonIndex = first.findIndex((step) => step.sel === '#planToggle');
  const drawerIndex = first.findIndex((step) => step.sel === '#drawer .ctx');
  assert.ok(buttonIndex >= 0 && drawerIndex > buttonIndex);
  assert.ok(first.find((step) => step.sel === '#schedule')?.openDrawer);
  assert.ok(first.find((step) => step.sel === '#mapWrap')?.closeDrawer);
  assert.ok(first.find((step) => step.sel === '#btnAdvance')?.openDrawer);
  assert.ok(stepsFor(2).find((step) => step.sel === '#planStatus')?.openDrawer);
  assert.ok(stepsFor(2).find((step) => step.sel === '#nightSpot')?.openDrawer);
  const toggle = { expanded: false, getAttribute() { return this.expanded ? 'true' : 'false'; }, click() { this.expanded = !this.expanded; } };
  const drawer = { id: 'drawer' };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: () => toggle, querySelector: (sel) => sel === '#drawer .ctx' && toggle.expanded ? drawer : sel === '#mapWrap' && !toggle.expanded ? {} : null };
  try {
    assert.equal(prepareTutorialTarget(first[drawerIndex]), drawer);
    assert.equal(toggle.expanded, true);
    assert.ok(prepareTutorialTarget(first.find((step) => step.sel === '#mapWrap')));
    assert.equal(toggle.expanded, false);
  } finally {
    globalThis.document = priorDocument;
  }
});
