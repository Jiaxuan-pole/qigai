import { $, UI, esc, apply, closeModal, showModal, toast } from './core.js';
import { NAMES, useItem, itemUsage } from '../game/engine.js';
import { accessibleItems, itemDef } from '../game/items.js';
import { playItemAnimation, viewStreet } from './map.js';

export const USABLE_ITEMS = ['cigarette', 'cigarette_regular', 'cigarette_premium', 'butts', 'beer', 'beer_bottle', 'spirit', 'baijiu', 'vodka', 'tea', 'coffee', 'espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew', 'soda', 'wipes', 'symptom_relief', 'rehydration', 'clean_clothes', 'underwear', 'socks', 'bread', 'meal', 'hot_soup', 'fish_common_cooked', 'fish_rare_cooked', 'meal_hot', 'bread_toasted', 'hot_soup_heated'];

export function usageLabel(state, actorId, itemId) {
  const usage = itemUsage(state, actorId, itemId);
  return usage ? `${NAMES[actorId]}今日 ${usage.used}/${usage.limit}${usage.unit}` : '';
}

export function useItemFromUI(actorId, uid, returnTo = () => {}, confirmRisk = false) {
  if (UI.night) return toast('结束夜间活动后可在清晨使用物品。');
  const before = UI.state;
  const item = before.items.find(x => x.uid === uid);
  const result = useItem(before, actorId, uid, { confirmRisk });
  if (result.requiresConfirmation) {
    const { risk, nextCups } = result.coffeeRisk;
    showModal('确认饮用咖啡', `<p>${NAMES[actorId]}今天将喝第${nextCups}杯。饮用当下有${Math.round(risk * 100)}%的游戏内死亡风险。</p><div class="modalbuttons"><button id="confirmCoffeeRisk" class="danger">确认饮用</button><button id="cancelCoffeeRisk">取消</button></div>`);
    $('confirmCoffeeRisk').onclick = () => useItemFromUI(actorId, uid, returnTo, true);
    $('cancelCoffeeRisk').onclick = returnTo;
    return;
  }
  if (!apply(result)) return;
  UI.sel.actor = actorId;
  closeModal();
  viewStreet(UI.state.actors[actorId].location);
  UI.render();
  if (item) playItemAnimation(actorId, item.itemId);
  const coffee = item && ['coffee', 'espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew'].includes(item.itemId);
  const cue = coffee ? 'coffee_sip' : item && itemDef(item.itemId).category === 'food' ? 'meal' : null;
  if (cue) window.jwsnAudio?.play?.(cue, { scope: 'inventory' });
  toast(UI.state.log[0]);
}

export function showQuickItems(actorId, onInventory, onPlan) {
  const s = UI.state, actor = s.actors[actorId];
  if (!actor || actor.life !== 'active') return;
  const groups = new Map();
  for (const item of accessibleItems(s, actorId)) if (USABLE_ITEMS.includes(item.itemId) && !groups.has(item.itemId)) groups.set(item.itemId, item);
  const items = [...groups.values()];
  showModal(NAMES[actorId], `<p>香烟 ${actor.smokes || 0}/2次 · 醉意 ${actor.intox || 0}/2 · 今日咖啡 ${s.daily.coffeeCups?.[actorId] || 0}杯</p><div class="quick-items">${items.map(item => {
    const usage = itemUsage(s, actorId, item.itemId);
    return `<button data-quick-use="${item.uid}" ${UI.night || usage?.remaining === 0 ? 'disabled' : ''}><b>${esc(itemDef(item.itemId).name)}</b><small>${usageLabel(s, actorId, item.itemId) || (item.container === 'camp' ? '营地箱' : '随身物品')}</small></button>`;
  }).join('') || '<p class="muted">手边没有可直接使用的物品。</p>'}</div><div class="modalbuttons"><button id="quickInventory">${NAMES[actorId]}的物品</button><button id="quickPlan" class="primary">安排行动</button></div>`);
  $('modalContent').querySelectorAll('[data-quick-use]').forEach(button => { button.onclick = () => useItemFromUI(actorId, button.dataset.quickUse, () => showQuickItems(actorId, onInventory, onPlan)); });
  $('quickInventory').onclick = () => onInventory(actorId);
  $('quickPlan').onclick = () => { closeModal(); onPlan(actorId); };
}
