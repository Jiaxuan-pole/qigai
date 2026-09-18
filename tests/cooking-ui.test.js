import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { itemDef, makeItem } from '../public/game/items.js';
import { UI } from '../public/ui/core.js';
import { showCooking } from '../public/ui/cooking-modal.js';

before(loadData);

function modalHarness() {
  const buttons = [];
  const simple = { classList: { add() {}, remove() {}, toggle() {} }, style: {}, querySelector: () => null };
  const content = {
    innerHTML: '',
    querySelectorAll(selector) {
      if (selector !== '[data-cook]') return [];
      buttons.length = 0;
      for (const match of this.innerHTML.matchAll(/data-cook="([^"]+)"/g)) buttons.push({ dataset: { cook: match[1] }, onclick: null });
      return buttons;
    },
  };
  const cells = { toast: simple, modalContent: content, modal: simple, modalOverlay: simple, modalClose: {} };
  return { cells, content, buttons };
}

test('篝火弹层列出自己的包和营地箱原料，并将加工排入当前小时', () => {
  const { cells, content, buttons } = modalHarness();
  const priorDocument = globalThis.document;
  const state = fresh(91);
  const charcoal = makeItem(state, 'charcoal_smokeless', 'camp');
  charcoal.uses = 1;
  const own = makeItem(state, 'fish_common', 'xuan');
  const camp = makeItem(state, 'bread', 'camp');
  UI.state = state;
  UI.sel.actor = 'xuan';
  UI.sel.hour = 6;
  UI.night = null;
  globalThis.document = { getElementById: (id) => cells[id], body: { style: {} }, activeElement: null };
  try {
    showCooking();
    assert.match(content.innerHTML, /1小时.*20精力.*1份炭/);
    assert.match(content.innerHTML, /优先消耗无烟木炭/);
    assert.match(content.innerHTML, new RegExp(`data-cook="${own.uid}"`));
    assert.match(content.innerHTML, new RegExp(`data-cook="${camp.uid}"`));
    assert.match(content.innerHTML, /本人包/);
    assert.match(content.innerHTML, /营地箱/);
    assert.match(content.innerHTML, /data-item-art="fish_common_cooked"/);
    buttons.find((button) => button.dataset.cook === own.uid).onclick();
    const task = UI.state.plan.xuan[0];
    assert.equal(task.id, 'cook');
    assert.deepEqual(task.targets, [own.uid]);
    assert.equal(UI.state.items.find((item) => item.uid === own.uid).itemId, 'fish_common');
    assert.match(cells.toast.textContent, /已安排轩哥06:00加工/);
  } finally {
    globalThis.document = priorDocument;
    UI.night = null;
  }
});

test('篝火弹层在炭不足时只说明炭，并用物品定义展示购买入口', () => {
  const { cells, content } = modalHarness();
  const priorDocument = globalThis.document;
  const state = fresh(93);
  makeItem(state, 'fish_common', 'xuan');
  UI.state = state;
  UI.sel.actor = 'xuan';
  UI.night = null;
  globalThis.document = { getElementById: (id) => cells[id], body: { style: {} }, activeElement: null };
  try {
    showCooking();
    assert.match(content.innerHTML, /炭不足/);
    assert.match(content.innerHTML, /便利店或五金店/);
    assert.doesNotMatch(content.innerHTML, /纸板|木料/);
    for (const id of ['charcoal_cheap', 'charcoal_quality', 'charcoal_smokeless']) {
      const charcoal = itemDef(id);
      assert.match(content.innerHTML, new RegExp(`${charcoal.name}.*¥${charcoal.price}`));
    }
    assert.doesNotMatch(content.innerHTML, /data-cook=/);
  } finally {
    globalThis.document = priorDocument;
  }
});

test('篝火弹层在夜间结算后禁用加工，并说明清晨才能继续', () => {
  const { cells, content } = modalHarness();
  const priorDocument = globalThis.document;
  UI.state = fresh(92);
  UI.sel.actor = 'xuan';
  UI.night = { day: 1 };
  globalThis.document = { getElementById: (id) => cells[id], body: { style: {} }, activeElement: null };
  try {
    showCooking();
    assert.match(content.innerHTML, /夜间账已结算/);
    assert.match(content.innerHTML, /清晨再做/);
    assert.doesNotMatch(content.innerHTML, /data-cook=/);
  } finally {
    globalThis.document = priorDocument;
    UI.night = null;
  }
});
