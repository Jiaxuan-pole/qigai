import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import data from '../03_开发数据_商店物品愿望事件100日.json' with { type: 'json' };
import { EXTRA_ITEMS } from '../public/game/items.js';
import { drawItemArt, itemArtMarkup, missingItemArtIds } from '../public/ui/item-art.js';

function trace(id) {
  const calls = [];
  const canvas = { width: 32, height: 32, getContext: () => ({
    fillStyle: '',
    fillRect(x, y, width, height) { calls.push([this.fillStyle, x, y, width, height]); },
  }) };
  assert.equal(drawItemArt(canvas, id), true);
  return calls;
}

test('all configured and runtime inventory items have a non-empty registered pixel drawing', () => {
  const configured = data.items.map((item) => item.id);
  const runtime = Object.keys(EXTRA_ITEMS);
  assert.deepEqual(missingItemArtIds([...configured, ...runtime]), []);
  for (const id of [...configured, ...runtime]) assert.ok(trace(id).length > 0, `${id} rendered no pixels`);
});

test('rods, fish, and devices keep distinct pixel silhouettes', () => {
  const signature = (id) => JSON.stringify(trace(id));
  const compare = (ids) => assert.equal(new Set(ids.map(signature)).size, ids.length, ids.join(', '));
  compare(['fishing_rod_simple', 'fishing_rod', 'fishing_rod_pro']);
  compare(['fish_common', 'fish_rare']);
  compare(['phone', 'radio', 'camera', 'keyboard', 'tv']);
});

test('cooked foods have registered drawings distinct from their source ingredients', () => {
  const pairs = [
    ['fish_common', 'fish_common_cooked'],
    ['fish_rare', 'fish_rare_cooked'],
    ['meal', 'meal_hot'],
    ['bread', 'bread_toasted'],
    ['hot_soup', 'hot_soup_heated'],
  ];
  for (const [source, cooked] of pairs) {
    assert.deepEqual(missingItemArtIds([cooked]), [], cooked);
    assert.notDeepEqual(trace(source), trace(cooked), `${cooked} must not reuse ${source} art`);
  }
});

test('three charcoal packages have registered and distinct pixel drawings', () => {
  const ids = ['charcoal_cheap', 'charcoal_quality', 'charcoal_smokeless'];
  assert.deepEqual(missingItemArtIds(ids), []);
  assert.equal(new Set(ids.map((id) => JSON.stringify(trace(id)))).size, ids.length);
});

test('eight furniture SKUs and legacy bed have distinct pixel silhouettes', () => {
  const ids = ['bed_basic', 'bed_comfort', 'dining_table', 'chair', 'sofa', 'cabinet', 'lamp', 'rug', 'legacy_bed'];
  assert.deepEqual(missingItemArtIds(ids), []);
  assert.equal(new Set(ids.map((id) => JSON.stringify(trace(id)))).size, ids.length);
});

test('shop and inventory emit canvases and mount their static pixel art after modal content exists', async () => {
  const modalSource = await readFile(new URL('../public/ui/modals.js', import.meta.url), 'utf8');
  assert.match(itemArtMarkup('meal'), /^<canvas class="item-art" width="32" height="32" data-item-art="meal" aria-hidden="true"><\/canvas>$/);
  assert.match(modalSource, /itemArtMarkup\(it\.id\)/);
  assert.match(modalSource, /itemArtMarkup\(g\.itemId\)/);
  assert.match(modalSource, /mountItemArt\(/);
});
