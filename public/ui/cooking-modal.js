import { ACTIONS } from '../game/actions.js';
import { cookingOptions, validateCooking } from '../game/cooking.js';
import { fuelCount, NAMES, assign } from '../game/engine.js';
import { itemDef } from '../game/items.js';
import { $, esc, UI, apply, closeModal, showModal, toast } from './core.js';
import { itemArtMarkup, mountItemArt } from './item-art.js';

const containerName = (actorId, container) => (container === actorId ? '本人包' : '营地箱');
const CHARCOAL_IDS = ['charcoal_cheap', 'charcoal_quality', 'charcoal_smokeless'];

function charcoalShopHint() {
  return CHARCOAL_IDS.map((id) => {
    const charcoal = itemDef(id);
    return `${charcoal.name}¥${charcoal.price}/${charcoal.uses}份`;
  }).join('；');
}

function fuelStatus(state) {
  const total = fuelCount(state);
  return total > 0
    ? `可用炭${total}份；结算时优先消耗无烟木炭。`
    : `炭不足：缺少1份。去便利店或五金店购买炭：${charcoalShopHint()}。`;
}

export function showCooking(actorId = UI.sel.actor) {
  const state = UI.state;
  if (!state?.actors?.[actorId]) return toast('没有可安排的角色。');
  if (UI.night) {
    showModal('篝火加工', '<p class="risk-note">夜间账已结算到下一次清晨。现在不能加工，清晨再做。</p><div class="modalbuttons"><button onclick="document.getElementById(\'modalClose\').click()">知道了</button></div>');
    return;
  }
  const action = ACTIONS.cook;
  const options = cookingOptions(state, actorId);
  const rows = options.map((option) => {
    const source = itemDef(option.itemId);
    const result = itemDef(option.resultItemId);
    return `<div class="shopitem"><div>${itemArtMarkup(option.itemId)}${itemArtMarkup(option.resultItemId)}</div><div class="item-copy"><strong>${esc(source.name)} → ${esc(result.name)}</strong><span class="eff">来源：${containerName(actorId, option.container)} · 消耗${option.fuel}份炭</span><button class="primary" data-cook="${esc(option.uid)}">安排加工</button></div></div>`;
  }).join('');
  const empty = fuelCount(state) < 1
    ? `<p class="risk-note">${esc(fuelStatus(state))}</p>`
    : '<p class="muted">没有可加工材料。去河岸钓鱼或购食品后再来。</p>';
  const body = `<p>由${esc(NAMES[actorId])}在${String(UI.sel.hour).padStart(2, '0')}:00回营地处理。${action.hours}小时 · ${action.energy}精力 · 1份炭。加工会排入计划；推进结算后才生成成品。</p><p class="small">${esc(fuelStatus(state))}</p>${rows ? `<div class="modal-grid">${rows}</div>` : empty}<div class="modalbuttons"><button onclick="document.getElementById('modalClose').click()">继续当前小时</button></div>`;
  showModal('篝火加工', body, { wide: true });
  const root = $('modalContent');
  mountItemArt(root);
  root.querySelectorAll('[data-cook]').forEach((button) => {
    button.onclick = () => {
      const uid = button.dataset.cook;
      const reason = validateCooking(UI.state, actorId, uid);
      if (reason) return toast(reason);
      const result = assign(UI.state, actorId, UI.sel.hour, 'cook', { targets: [uid] });
      if (!apply(result)) return;
      const option = options.find((item) => item.uid === uid);
      UI.sel.action = 'cook';
      UI.sel.targets = [uid];
      closeModal();
      toast(`已安排${NAMES[actorId]}${String(UI.sel.hour).padStart(2, '0')}:00加工${itemDef(option.itemId).name}；推进结算后才会得到${itemDef(option.resultItemId).name}。`);
    };
  });
}
