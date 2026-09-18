import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { UI } from '../public/ui/core.js';
import * as render from '../public/ui/render.js';

function mount() {
  const nodes = {};
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  const root = {
    html: '',
    set innerHTML(value) {
      this.html = value;
      this.buttons = [...value.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => {
        const values = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, content]) => [key, content]));
        return { dataset: { characterToggle: values['data-character-toggle'] }, attrs: values, setAttribute(key, content) { this.attrs[key] = content; }, getAttribute(key) { return this.attrs[key]; } };
      });
      for (const [, id, attrs] of value.matchAll(/<div class="char-details" id="([^"]+)"([^>]*)>/g)) nodes[id] = { hidden: /\bhidden\b/.test(attrs) };
    },
    get innerHTML() { return this.html; },
    querySelectorAll() { return this.buttons; },
  };
  const old = globalThis.document;
  globalThis.document = { getElementById(id) { return id === 'characters' ? root : id.startsWith('portrait-') ? { getContext: () => context } : nodes[id]; } };
  return { root, nodes, restore() { globalThis.document = old; delete UI.characterExpanded; } };
}

test('人物默认收起详情，紧凑状态保留健康、体力、精神和疾病警告', async () => {
  await loadData();
  const state = fresh(719);
  state.actors.xuan.diseases.push({ uid: 'd1', kind: 'chill', known: true, severity: 70 });
  const dom = mount();
  try {
    assert.equal(typeof render.renderCharacters, 'function');
    render.renderCharacters(state);
    const summary = dom.root.innerHTML.split('class="char-details"')[0];
    assert.match(summary, /健康/);
    assert.match(summary, /体力/);
    assert.match(summary, /精神/);
    assert.match(summary, /病情重度/);
    assert.doesNotMatch(summary, /今日咖啡/);
    assert.equal(dom.nodes['character-details-xuan'].hidden, true);
    assert.equal(dom.root.buttons[0].getAttribute('aria-expanded'), 'false');
    assert.match(dom.root.innerHTML, /type="button"[^>]*data-character-toggle="xuan"/);
  } finally { dom.restore(); }
});

test('独立展开按钮不选择人物，切换人物与重绘后仍保留各自展开状态', async () => {
  await loadData();
  const state = fresh(720);
  UI.sel.actor = 'xuan';
  const dom = mount();
  try {
    assert.equal(typeof render.renderCharacters, 'function');
    render.renderCharacters(state);
    dom.root.buttons[1].onclick();
    assert.equal(UI.sel.actor, 'xuan');
    assert.equal(dom.nodes['character-details-fan'].hidden, false);
    assert.equal(dom.nodes['character-details-xuan'].hidden, true);
    assert.equal(dom.root.buttons[1].getAttribute('aria-expanded'), 'true');
    UI.sel.actor = 'fan';
    render.renderCharacters(state);
    assert.equal(dom.nodes['character-details-fan'].hidden, false);
    assert.equal(dom.root.buttons[1].getAttribute('aria-expanded'), 'true');
    dom.root.buttons[1].onclick();
    assert.equal(dom.nodes['character-details-fan'].hidden, true);
  } finally { dom.restore(); UI.sel.actor = 'xuan'; }
});
