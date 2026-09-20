// 底部快捷栏：当前操控人物手边能直接用的物品，一种一格，点一下就用，省去先开人物弹层再选物品。
import { $, esc, UI } from './core.js';
import { itemUsage } from '../game/engine.js';
import { accessibleItems, itemDef } from '../game/items.js';
import { USABLE_ITEMS, usageLabel, useItemFromUI } from './quick-items.js';
import { itemArtMarkup, mountItemArt } from './item-art.js';

export function renderHotbar(state, actorId, { slots = 8 } = {}) {
  const root = $('hotbar');
  if (!root) return;
  const groups = new Map();
  // 引擎只让 active 的人用物品，非 active 直接给空栏，免得点了只收到报错提示。
  if (state?.actors?.[actorId]?.life === 'active') {
    for (const item of accessibleItems(state, actorId)) {
      if (!USABLE_ITEMS.includes(item.itemId)) continue;
      const group = groups.get(item.itemId);
      if (group) group.count += 1; else groups.set(item.itemId, { item, count: 1 });
    }
  }
  const cells = [...groups.values()].map(({ item, count }) => {
    const usage = itemUsage(state, actorId, item.itemId);
    const label = usageLabel(state, actorId, item.itemId) || (item.container === 'camp' ? '营地箱' : '随身物品');
    return `<button type="button" class="hotslot" data-quick-use="${item.uid}" title="${esc(itemDef(item.itemId).name)} · ${esc(label)}" ${UI.night || usage?.remaining === 0 ? 'disabled' : ''}><span class="hotslot-art">${itemArtMarkup(item.itemId)}</span><small class="hotslot-count">${count > 1 ? count : item.uses > 1 ? item.uses : count}</small></button>`;
  });
  while (cells.length < slots) cells.push('<span class="hotslot empty" aria-hidden="true"></span>');
  root.innerHTML = cells.join('');
  mountItemArt(root);
  root.onclick = (event) => {
    const uid = event.target?.closest?.('[data-quick-use]')?.dataset.quickUse;
    if (uid) useItemFromUI(actorId, uid);
  };
}
