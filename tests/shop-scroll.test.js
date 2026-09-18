import assert from 'node:assert/strict';
import test from 'node:test';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { UI } from '../public/ui/core.js';
import { showShop } from '../public/ui/modals.js';

function shopHarness() {
  const toast = { classList: { add() {}, remove() {} }, textContent: '' };
  const overlay = { classList: { add() {}, remove() {} } };
  const modal = {
    classList: { toggle() {} },
    scrollTop: 0,
    querySelector(selector) {
      if (selector === 'button:not(:disabled):not(.close)') return content.nodes.find((node) => node.tag === 'button' && !node.disabled) || null;
      return null;
    },
  };
  const content = {
    nodes: [],
    querySelectorAll(selector) {
      if (selector === '[data-item-art]') return [];
      const attr = selector.match(/^\[data-([a-z]+)\]$/)?.[1];
      return attr ? this.nodes.filter((node) => node.dataset[attr] !== undefined) : [];
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-([a-z]+)="([^"]+)"\](?::not\(:disabled\))?$/);
      if (!match) return null;
      const [, attr, value] = match;
      return this.nodes.find((node) => node.dataset[attr] === value && (!selector.endsWith(':not(:disabled)') || !node.disabled)) || null;
    },
    set innerHTML(html) {
      this.html = html;
      this.nodes = [];
      for (const match of html.matchAll(/<(button|b)\b([^>]*)>/g)) {
        const dataset = Object.fromEntries([...match[2].matchAll(/data-([a-z]+)="([^"]+)"/g)].map(([, key, value]) => [key, value]));
        const id = match[2].match(/\sid="([^"]+)"/)?.[1];
        if (!Object.keys(dataset).length && !id) continue;
        const node = {
          tag: match[1],
          id,
          dataset,
          disabled: /\sdisabled(?:\s|>|$)/.test(match[2]),
          focus(options) {
            document.activeElement = this;
            this.focusOptions = options;
            if (!options?.preventScroll) modal.scrollTop = 0;
          },
        };
        this.nodes.push(node);
      }
    },
    get innerHTML() { return this.html || ''; },
  };
  const cells = { toast, modalContent: content, modal, modalOverlay: overlay, modalClose: {} };
  return { cells, content, modal };
}

test('商店加减重绘后保留同一商品的焦点和弹层滚动位置', async () => {
  const { cells, content, modal } = shopHarness();
  const priorDocument = globalThis.document;
  const data = await loadData();
  const state = fresh(260917);
  const vodka = data.items.find((item) => item.id === 'vodka');
  state.shops.convenience.stock.vodka = 2;
  state.shops.convenience.stock.charcoal_smokeless = 0;
  UI.state = state;
  UI.data = data;
  UI.cartDraft = null;
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: (id) => cells[id] || content.nodes.find((node) => node.id === id) || null };
  try {
    showShop('convenience', 'xuan', 'plan');
    assert.equal(content.querySelector('[data-dec="charcoal_smokeless"]').disabled, true, '空库存继续禁用减号');
    assert.equal(content.querySelector('[data-inc="charcoal_smokeless"]').disabled, true, '空库存继续禁用加号');
    modal.scrollTop = 480;
    content.querySelector('[data-inc="vodka"]').onclick();

    assert.equal(modal.scrollTop, 480, '数量变更不能把商店弹层拉回顶部');
    assert.equal(document.activeElement, content.querySelector('[data-inc="vodka"]'), '还有库存时焦点仍留在同一商品加号');
    assert.deepEqual(document.activeElement.focusOptions, { preventScroll: true });

    modal.scrollTop = 360;
    content.querySelector('[data-inc="vodka"]').onclick();

    assert.equal(modal.scrollTop, 360, '到库存上限时也不能把商店弹层拉回顶部');
    const quantity = content.querySelector('[data-qty="vodka"]');
    assert.equal(document.activeElement, quantity, '到库存上限后焦点仍留在伏特加数量区');
    assert.deepEqual(quantity.focusOptions, { preventScroll: true });
    assert.match(content.innerHTML, new RegExp(`清单合计 <b>¥${vodka.price * 2}</b>`));
    assert.equal(state.shops.convenience.stock.vodka, 2, '列清单不会改动库存');
    assert.equal(content.querySelector('[data-inc="vodka"]').disabled, true, '库存上限继续禁用加号');
  } finally {
    globalThis.document = priorDocument;
    UI.cartDraft = null;
  }
});
