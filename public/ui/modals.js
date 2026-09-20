// 弹层：店铺与购物车、刮刮乐、库存、愿望、健康护理、热点、路人、地图列表、章节、说明、存档。
import { sellFish } from '../game/engine.js';
import { showPendingWorkGame } from './work-game-flow.js';
import { $, esc, UI, toast, showModal, closeModal, apply } from './core.js';
import { NAMES, IDS, alive, active, reserve, buyNow, useItem, transferItem, respond, eventChoice, chat, setCare, careOptions, passersby, assign, SLOTS, begStep, acceptFavor, deliverFavor, favorStatus, activeFavors, deliverProject, binReveal, binForfeit, salvageDispose, salvageOptions, borrowFrom, returnLoanTo, extendLoanOf, uninstallFacility, campReport, FACILITIES, fuelCount, canInstall, LOANS } from '../game/engine.js';
import { REGULARS } from '../game/npcs.js';
import { TYPES, OPENINGS } from '../game/beg.js';
import { shopClosedReason, shopDef, scratchTicket, claimTicket, revealTicketCells } from '../game/shop.js';
import { groupItems, itemDef } from '../game/items.js';
import { wishSummary, activeWishes } from '../game/wishes.js';
import { diseaseLabel, DISEASES } from '../game/health.js';
import { wishStage, diseaseStage } from '../game/rules.js';
import { PACKS } from '../game/events.js';
import { windowLabel } from '../game/headlines.js';
import { STYLES } from '../game/tickets.js';
import { mountScratch } from './scratch.js';
import { itemArtMarkup, mountItemArt } from './item-art.js';
import { binCellArtMarkup, mountBinArt } from './bin-art.js';
import { bigPortrait, moodOf } from './pixel.js';
import { zoneName } from './render.js';
import { copy } from '../game/engine.js';
import { requestBegText, cancelBegText, presentBegLog } from './beg-ai.js';
import { DAY_END_HOUR, planIndex, slotOfHour } from '../game/clock.js';
import { showCooking } from './cooking-modal.js';
import { showFurniture } from './furniture-modal.js';
import { isFurniture } from '../game/furniture.js';
import { USABLE_ITEMS, usageLabel, useItemFromUI } from './quick-items.js';
import { showCombat } from './combat.js';

let begLast = null;
let begVisibleNpc = null;
const begDisplay = new Map();
const begSpoken = new Set();
const begChosen = new Map();

const CAT = { food: '吃喝', ingredient: '食材', fuel: '炭包', tobacco: '烟', alcohol: '酒', daily: '日常', medical: '护理', art: '兴趣工具', tool: '工具', device: '设备', lottery: '彩票', service: '服务', furniture: '家具' };
const CONTAINER = (c) => (c === 'camp' ? '营地箱' : c.startsWith('relic:') ? NAMES[c.slice(6)] + '的遗物' : NAMES[c] + '的包');

// 店铺：mode=plan 列采购单到排程；mode=now 人已在店所在街区，直接买。
export function showShop(shopId, actorId, mode, slotOverride = null) {
  const s = UI.state;
  const def = shopDef(shopId);
  const slot = slotOverride ?? (mode === 'now' ? s.slot : slotOfHour(Math.min(UI.sel.hour, DAY_END_HOUR)));
  const closed = shopClosedReason(s, shopId, slot);
  const p = s.actors[actorId];
  const here = p.location === def.district;
  const canNow = mode === 'now' && here && !closed;
  const stock = s.shops[shopId].stock;
  const items = UI.data.items.filter((i) => i.shopIds.includes(shopId));
  const cart = UI.cartDraft = (UI.cartDraft && UI.cartDraft.shopId === shopId ? UI.cartDraft : { shopId, lines: {} });
  const render = (restore = null) => {
    const total = Object.entries(cart.lines).reduce((t, [id, q]) => t + UI.data.items.find((i) => i.id === id).price * q, 0);
    const body = `<p>${esc(def.position)} · 营业：${def.openSlots.map((x) => SLOTS[x]).join('/')} · ${closed ? '<span class="bad">' + esc(closed) + '</span>' : '<span class="good">营业中</span>'}</p>
    <p class="small">执行者：<b>${NAMES[actorId]}</b>（现在在${zoneName(p.location)}）${canNow ? ' · 人在店里，可以直接买（钱够、有货就能一直买）' : mode === 'now' ? ' · 人不在这里：只能列清单加入采买路线' : ' · 清单会随「到店采买」在结算时购买'}</p>
    <div class="shop-grid">${items.map((it) => { const n = stock[it.id] || 0; const q = cart.lines[it.id] || 0; return `<div class="shopitem ${n <= 0 ? 'out' : ''}">${itemArtMarkup(it.id)}<div class="item-copy"><strong>${esc(it.name)} <span class="muted small">${CAT[it.category] || ''}</span></strong><span class="price">¥${it.price}${it.uses > 1 ? ' / ' + it.uses + '格' : ''}${it.shelfLifeDays ? ' · 保质' + it.shelfLifeDays + '天' : ''}</span><span class="eff">${esc(it.effectText)}</span><span class="eff">库存 ${n}</span><div class="qty"><button data-dec="${it.id}" ${q <= 0 ? 'disabled' : ''}>−</button><b data-qty="${it.id}" tabindex="-1">${q}</b><button data-inc="${it.id}" ${q >= n ? 'disabled' : ''}>＋</button></div></div></div>`; }).join('')}</div>
    <div class="cart-summary"><span>清单合计 <b>¥${total}</b>，购买后现金 <b>${s.cash - total}</b>，饭钱保护 <b>${reserve(s)}</b>${Object.keys(cart.lines).some((id) => itemDef(id)?.category === 'lottery') ? '，今日付费博彩 ' + s.daily.bets + '/2（购票占一次）' : ''}</span><span>${shopId === 'furniture_store' ? '家具统一快递到营地包裹，回营拆包后才能摆放。' : `送到：<label><input type="radio" name="dest" value="self" ${cart.dest !== 'camp' ? 'checked' : ''}> 带在身上</label> <label><input type="radio" name="dest" value="camp" ${cart.dest === 'camp' ? 'checked' : ''}> 送回营地箱（需之后回营地）</label>${Object.keys(cart.lines).some((id) => isFurniture(id)) ? ' · 家具单独快递到营地包裹' : ''}`}</span></div>
    <div class="modalbuttons">${canNow ? `<button class="primary" id="buyNow" ${total <= 0 ? 'disabled' : ''}>现在就买 ¥${total}</button>` : ''}<button id="toPlan" ${total <= 0 ? 'disabled' : ''}>加入${NAMES[actorId]}${String(UI.sel.hour).padStart(2, '0')}:00的采买路线</button><button onclick="document.getElementById('modalClose').click()">关闭</button></div>`;
    showModal(def.name, body, { wide: true });
    mountItemArt($('modalContent'));
    if (restore) {
      $('modal').scrollTop = restore.scrollTop;
      const target = $('modalContent').querySelector(`[data-${restore.action}="${restore.itemId}"]:not(:disabled)`) || $('modalContent').querySelector(`[data-qty="${restore.itemId}"]`) || $('modalContent').querySelector(`[data-dec="${restore.itemId}"]:not(:disabled)`);
      target?.focus({ preventScroll: true });
    }
    const refresh = (itemId, action) => render({ itemId, action, scrollTop: $('modal').scrollTop });
    $('modalContent').querySelectorAll('[data-inc]').forEach((b) => { b.onclick = () => { cart.lines[b.dataset.inc] = (cart.lines[b.dataset.inc] || 0) + 1; refresh(b.dataset.inc, 'inc'); }; });
    $('modalContent').querySelectorAll('[data-dec]').forEach((b) => { b.onclick = () => { cart.lines[b.dataset.dec] -= 1; if (cart.lines[b.dataset.dec] <= 0) delete cart.lines[b.dataset.dec]; refresh(b.dataset.dec, 'dec'); }; });
    $('modalContent').querySelectorAll('[name=dest]').forEach((r) => { r.onchange = () => { cart.dest = r.value; }; });
    const lines = () => Object.entries(cart.lines).map(([itemId, qty]) => ({ shopId, itemId, qty }));
    if ($('buyNow')) $('buyNow').onclick = () => {
      const r = buyNow(s, actorId, lines(), cart.dest || 'self', slotOverride);
      if (apply(r)) { const tickets = r.made.filter((x) => x.ticket); closeModal(); toast(r.parcelId ? `买好了，花${r.total}。包裹 ${r.parcelId} 已快递到营地，回营拆包。` : '买好了，花' + r.total + '。'); if (tickets.length) showTicket(tickets[0].uid, actorId); }
    };
    $('toPlan').onclick = () => {
      const merged = UI.sel.cart.filter((l) => l.shopId !== shopId).concat(lines());
      const zone = def.district;
      const r = assign(s, actorId, UI.sel.hour, 'shop', { zone, cart: merged, destination: cart.dest || 'self' });
      if (apply(r)) { UI.sel.cart = merged; UI.sel.zone = zone; UI.sel.action = 'shop'; closeModal(); toast(`已加入${NAMES[actorId]}${String(UI.sel.hour).padStart(2, '0')}:00的采买路线，推进后到店购买。`); }
    };
  };
  render();
}

// 刮刮乐：玩家自己刮；全部刮开后核销。
export function showTicket(uid, actorId) {
  const s = UI.state;
  const inst = s.items.find((x) => x.uid === uid);
  if (!inst || !inst.ticket) return toast('没有这张票');
  const t = inst.ticket;
  const style = STYLES[t.face.style];
  const price = t.price ?? 5;
  const holder = inst.container;
  const body = `<p>${esc(style.name)} · ¥${price} · 购票人 ${NAMES[t.buyer]}（概率按他） · 现在在${CONTAINER(holder)}</p><p class="small">规则：${esc(style.rule)}。刮的方向、速度、由谁刮都不改变结果；结果在购买时已锁定。</p>
  <div class="scratch-wrap"><canvas id="scratch"></canvas></div>
  <div id="ticketResult" class="notebox ${t.scratched ? '' : 'hidden'}"></div>
  <div class="modalbuttons"><button id="revealAll">全部刮开</button><button id="claimBtn" class="primary ${t.scratched && !t.claimed ? '' : 'hidden'}">领取奖金</button><button onclick="document.getElementById('modalClose').click()">${t.scratched ? '先收起来' : '先不刮了'}</button></div>`;
  showModal('刮刮乐 · ' + style.name, body);
  const canvas = $('scratch');
  const ctl = mountScratch(canvas, t.face, t.revealed || [], (revealed, total) => {
    const r = revealTicketCells(UI.state, uid, revealed, total);
    if (r.ok) { UI.state.stateRevision += 1; if (r.scratched) { scratchTicket(UI.state, uid); showResult(); } }
    try { localStorage.setItem('jinwan-shui-naer-v3', JSON.stringify(UI.state)); } catch (_) { /* */ }
  });
  function showResult() {
    const net = t.payout - price;
    $('ticketResult').classList.remove('hidden');
    $('ticketResult').innerHTML = t.payout === 0 ? `没中。票钱${price}块，就当买了个念想。` : `返还 <b>${t.payout}</b>，${net > 0 ? '净赚 ' + net : net === 0 ? '回本' : '净亏 ' + (-net)}。${t.claimed ? '已核销。' : '点「领取奖金」在售票点核销（便利店或彩票亭营业中，且票在持票人手里）。'}`;
    $('claimBtn').classList.toggle('hidden', t.claimed || t.payout === 0);
    if (t.payout === 0 && !t.claimed) { const st = copy(UI.state); const r = claimTicket(st, holder, uid); if (!r.error) { UI.state = st; } else { t.claimed = true; UI.state.items = UI.state.items.filter((x) => x.uid !== uid); } UI.render(); }
  }
  $('revealAll').onclick = () => ctl.revealAll();
  $('claimBtn').onclick = () => {
    const st = copy(UI.state);
    const r = claimTicket(st, holder.startsWith('relic') ? actorId : holder, uid);
    if (r.error) return toast(r.error);
    UI.state = st; UI.state.stateRevision += 1; UI.render(); ctl.destroy(); closeModal();
    toast(`在${r.shop}核销：返还${r.payout}，现金现在${st.cash}。`);
    try { localStorage.setItem('jinwan-shui-naer-v3', JSON.stringify(UI.state)); } catch (_) { /* */ }
  };
  if (t.scratched) showResult();
}

export function showInventory(actorFocus = UI.sel.actor) {
  const s = UI.state;
  const containers = ['camp', ...IDS.filter((id) => s.actors[id].life !== 'unrecruited'), ...s.deaths.map((d) => 'relic:' + d.id)];
  const USABLE = USABLE_ITEMS;
  let body = `<p>公共现金 ¥${s.cash} · 瓶罐${s.bottles || 0} 零件${s.parts} 电量${s.battery}/5 木料${s.wood} 布料${s.cloth} · 救助券${s.vouchers} · 有效食物 ${s.effectiveFood} 份（正餐30/面包18/热汤26折算）</p><p class="small">谁能碰到什么：自己的包随时可用；营地箱要人在营地；交接要两人同地。瓶罐在老周回收铺按 1 元/个卖。</p><section><h3>家具与快递包裹</h3><p>密封包裹 ${s.camp.parcels.filter((p) => p.status === 'sealed').length} 件 · 营地箱家具 ${s.items.filter((item) => item.container === 'camp' && isFurniture(item.itemId)).length} 件</p><button id="inventoryFurniture" type="button">查看包裹与家具摆放</button></section>${UI.night ? '<p class="risk-note">这一晚的休息已结算，结束夜间活动后可在清晨使用物品。</p>' : ''}`;
  for (const c of containers) {
    const items = groupItems(s, c);
    body += `<h3>${CONTAINER(c)}${IDS.includes(c) ? ' · 在' + zoneName(s.actors[c].location) : ''}</h3>`;
    if (!items.length) { body += '<p class="muted small">空</p>'; continue; }
    body += '<div class="modal-grid">';
    for (const g of items) {
      const def = itemDef(g.itemId);
      const canUse = USABLE.includes(g.itemId);
      let ops = '';
      if (def.category === 'lottery') ops += g.uids.map((u, i) => `<button data-ticket="${u}">刮票${g.uids.length > 1 ? i + 1 : ''}</button>`).join('');
      if (canUse && IDS.includes(c)) ops += `<button data-use="${g.uids[0]}" data-actor="${c}" ${UI.night ? 'disabled' : ''}>${NAMES[c]}使用</button><span class="personal-usage">${usageLabel(s, c, g.itemId)}</span>`;
      if (['fish_common', 'fish_rare'].includes(g.itemId) && IDS.includes(c)) ops += `<button data-sellfish="${g.uids[0]}" data-actor="${c}" ${s.actors[c].location !== 'market' ? 'disabled' : ''} title="带到老街便利店出售">卖鱼 ¥${g.itemId === 'fish_rare' ? 14 : 6}</button>`;
      if (['fish_common', 'fish_rare'].includes(g.itemId) && !c.startsWith('relic:')) ops += `<button data-cook-open="${c === 'camp' ? actorFocus : c}" ${UI.night ? 'disabled' : ''}>到篝火加工</button>`;
      if (g.itemId.startsWith('broken_')) ops += '<span class="small muted">给轩哥安排「修旧电器」</span>';
      if (['phone', 'radio', 'headphones', 'tv'].includes(g.itemId) && IDS.includes(c)) { const so = salvageOptions(s, g.uids[0]); ops += so.options.map((o) => `<button data-dispose="${o.id}" data-uid="${g.uids[0]}" data-holder="${c}" ${o.enabled ? '' : 'disabled'} title="${esc(o.reason || o.detail)}">${esc(o.label)}</button>`).join(''); }
      const loanItem = s.items.find((x) => x.uid === g.uids[0] && x.loan);
      if (loanItem && IDS.includes(c)) ops += `<span class="small muted">借自${esc(LOANS[loanItem.loan.from]?.name || '')}，第${loanItem.loan.due}天前还</span><button data-return="${g.uids[0]}" data-actor="${c}">归还（人在对方街区）</button>${loanItem.loan.extended ? '' : `<button data-extend="${g.uids[0]}">说明延期2天</button>`}`;
      if (canUse && c === 'camp') ops += active(s).filter((id) => s.actors[id].location === 'camp').map((id) => `<button data-use="${g.uids[0]}" data-actor="${id}" ${UI.night ? 'disabled' : ''}>${NAMES[id]}用</button>`).join('');
      if (!isFurniture(g.itemId)) ops += containers.filter((x) => x !== c && !x.startsWith('relic')).map((x) => `<button data-move="${g.uids[0]}" data-to="${x}" data-from="${c}">→${x === 'camp' ? '营地箱' : NAMES[x]}</button>`).join('');
      const exp = g.expiresDay !== null && g.expiresDay !== undefined ? ' · D' + g.expiresDay + '前' : '';
      body += `<div class="invitem">${itemArtMarkup(g.itemId)}<div class="item-copy"><strong>${g.count}${def.uses > 1 ? ' <small class="muted">共' + g.uses + '格</small>' : ''}</strong><span>${esc(def.name)}${g.wet ? ' · 湿' : ''}${g.dirty ? ' · 来路不明' : ''}${exp}</span><div class="ops">${ops}</div></div></div>`;
    }
    body += '</div>';
  }
  showModal('库存与物品', body, { wide: true });
  const root = $('modalContent');
  mountItemArt(root);
  $('inventoryFurniture').onclick = () => showFurniture(actorFocus);
  root.querySelectorAll('[data-sellfish]').forEach((b) => { b.onclick = () => { if (apply(sellFish(UI.state, b.dataset.actor, b.dataset.sellfish, { controlledActorId: UI.sel.actor }))) { toast(UI.state.log[0]); closeModal(); if (!showPendingWorkGame()) showInventory(actorFocus); } }; });
  root.querySelectorAll('[data-cook-open]').forEach((b) => { b.onclick = () => showCooking(b.dataset.cookOpen); });
  root.querySelectorAll('[data-ticket]').forEach((b) => { b.onclick = () => showTicket(b.dataset.ticket, actorFocus); });
  root.querySelectorAll('[data-use]').forEach((b) => { b.onclick = () => useItemFromUI(b.dataset.actor, b.dataset.use, () => showInventory(actorFocus)); });
  root.querySelectorAll('[data-dispose]').forEach((b) => { b.onclick = () => { const choice = b.dataset.dispose; const holder = b.dataset.holder; if (choice === 'gift') { const here = REGULARS.filter((r) => r.district === s.actors[holder].location); if (!here.length) return toast('这里没有可回赠的熟人'); let npcId = here[0].id; if (here.length > 1) { const idx = Number(prompt('送给谁？输入编号：' + here.map((r, i) => (i + 1) + '=' + r.name).join('，'))); npcId = here[idx - 1]?.id; } if (!npcId) return; if (apply(salvageDispose(UI.state, b.dataset.uid, 'gift', { actorId: holder, npcId }))) { toast(UI.state.log[0]); showInventory(actorFocus); } return; } if (apply(salvageDispose(UI.state, b.dataset.uid, choice, { actorId: holder, controlledActorId: UI.sel.actor }))) { toast(UI.state.log[0]); closeModal(); if (!showPendingWorkGame()) showInventory(actorFocus); } }; });
  root.querySelectorAll('[data-return]').forEach((b) => { b.onclick = () => { if (apply(returnLoanTo(UI.state, b.dataset.return, b.dataset.actor))) { toast(UI.state.log[0]); showInventory(actorFocus); } }; });
  root.querySelectorAll('[data-extend]').forEach((b) => { b.onclick = () => { if (apply(extendLoanOf(UI.state, b.dataset.extend))) { toast(UI.state.log[0]); showInventory(actorFocus); } }; });
  root.querySelectorAll('[data-move]').forEach((b) => { b.onclick = () => { const from = b.dataset.from; const who = IDS.includes(from) ? from : (active(s).find((id) => s.actors[id].location === 'camp') || actorFocus); if (apply(transferItem(UI.state, who, b.dataset.move, b.dataset.to))) showInventory(actorFocus); }; });
}

export function showWishes() {
  const s = UI.state;
  const CATN = { daily: '今天的小欲望', aspiration: '长目标', relational: '关系', comfort: '兴趣与舒适', personal: '兴趣与舒适' };
  let body = '';
  for (const id of IDS.filter((x) => s.actors[x].life === 'active')) {
    const ws = wishSummary(s, id);
    const latent = activeWishes(s, id).filter((w) => !w.revealed).length;
    body += `<h3>${NAMES[id]}${latent ? ' <small class="muted">另有' + latent + '个念头未说出口</small>' : ''}</h3>`;
    if (!ws.length) { body += '<p class="muted small">没有说出口的愿望。</p>'; continue; }
    for (const w of ws) {
      const st = wishStage(w.intensity);
      const promised = w.promise && s.turn < w.promise.until;
      const promiseText = promised ? ' · 已约定，' + (w.promise.until - s.turn) + '回合内不积压' : (w.promise && w.promise.expiredNoted ? ' · <span class="bad">约定已过期</span>' : '');
      const targets = w.tpl.targetItemIds.length ? w.tpl.targetItemIds.map((i) => esc(UI.data.items.find((x) => x.id === i).name)).join('/') + '（' + (w.tpl.owningItemAloneIsEnough ? '拿到即可' : '要实际使用/体验') + '）' : '需要一次真实的活动或交流';
      body += '<div class="wishcard">';
      body += `<div><b>${esc(w.tpl.name)}</b> <span class="muted small">${CATN[w.tpl.category] || ''} · ${st.label}</span></div>`;
      if (w.reason) body += `<p class="small">${esc(w.reason)} <span class="muted">· ${w.source === 'ai' ? '人物的新念头' : '本地物品建议'}</span></p>`;
      body += `<div class="meter"><i class="${w.intensity >= 60 ? 'hot' : ''}" style="width:${Math.round(w.intensity)}%"></i></div>`;
      body += `<div class="small">强度 ${Math.round(w.intensity)} · ${st.hint || '暂无精神损失'}${promiseText}${w.declined ? ' · 已明确拒绝过' : ''}</div>`;
      body += `<div class="small">他说：“${esc(w.tpl.indirectLine)}”</div>`;
      body += `<div class="small">直接满足：${targets} · 替代：${w.tpl.substitutes.map(esc).join('、')}</div>`;
      body += `<div class="modalbuttons" style="margin-top:6px"><button data-w="${w.uid}" data-r="promise" ${w.promise && w.promise.extensions >= 1 ? 'disabled' : ''}>明确延期（4回合缓冲，仅一次）</button><button data-w="${w.uid}" data-r="decline" ${w.declined ? 'disabled' : ''}>明确拒绝（一次精神-2）</button></div>`;
      body += '</div>';
    }
  }
  if (s.flags.project) body += `<h3>接力项目</h3><div class="small">商户宣传片：${['', '第一步 拍摄（凡哥「商户宣传拍摄」或「许可采访」）', '第二步 剪辑（「剪辑小委托」，可借许姐工作位）', '第三步 交付（任何人带成品到老街，路人面板里交给刘姐）'][s.flags.project.stage]}，第${s.flags.project.deadline}天前。</div>`;
  const favs = activeFavors(s);
  if (favs.length) body += '<h3>进行中的委托</h3>' + favs.map((f) => `<div class="small">${esc(f.chain.name)}：「${esc(f.step.title)}」 ${f.active.progress}/${f.step.kind === 'count' ? f.step.need : 1}，第${f.active.deadline}天前 → ${esc(f.step.reward.text)}</div>`).join('');
  body += '<p class="small">满足与替代通过真实行动发生：抽烟、喝酒、涂鸦、牌局、长谈、买到东西。延期到期未兑现会更失望；拒绝只失落一次，但长期不给替代仍会积压。多条愿望叠加每人每回合精神最多-3。</p>';
  showModal('愿望与约定', body, { wide: true });
  $('modalContent').querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { if (apply(respond(UI.state, b.dataset.w, b.dataset.r))) { toast(UI.state.log[0]); showWishes(); } }; });
}

export function showHealth() {
  const s = UI.state;
  const rules = UI.data.rules;
  let body = '';
  for (const id of IDS.filter((x) => ['active', 'downed'].includes(s.actors[x].life))) {
    const p = s.actors[id];
    const opts = s.phase === 'tail' ? [] : careOptions(s, id, UI.sel.hour);
    const t = s.plan[id][s.phase === 'tail' ? UI.sel.hour - DAY_END_HOUR : planIndex(UI.sel.hour)];
    const crisisText = p.crisis ? ' · <span class="bad">崩溃中：每天四次生存结算时健康-' + (p.mind === 0 ? 8 : 4) + '</span>' : (p.zeroTurns ? ' · 已连续' + p.zeroTurns + '回合精神0，第4回合起崩溃' : '');
    body += `<h3>${NAMES[id]} <small class="muted">健康${p.health} 卫生${p.hygiene} 精神${p.mind}${crisisText}</small></h3>`;
    if (p.life === 'downed') body += `<div class="risk-note">濒死：须在回合${p.deadline}结束前获救（现在回合${s.turn}）。安排「联系救助」（首张券免费，之后20）或同伴「陪同送援」（12）。</div>`;
    if (p.exposure.wound && !p.exposure.woundCovered) body += '<div class="risk-note">有未护理的伤口：今晚检定+10%感染风险。用绷带或清洁护理包在本小时护理。</div>';
    if (p.clothes.dirty || p.hygiene < 40) {
      const extra = p.hygiene >= 60 ? 0 : p.hygiene >= 40 ? 0.03 : p.hygiene >= 20 ? 0.08 : 0.16;
      body += `<p class="small">卫生${p.hygiene}${p.clothes.dirty ? '，衣服脏了' : ''}：今晚染病基础风险 ${Math.round(100 * (rules.hygiene.baseRisk + extra))}%。免费水点+15，肥皂+25，澡堂+55。</p>`;
    }
    if (!p.diseases.length) body += '<p class="muted small">没有病情。</p>';
    for (const d of p.diseases) {
      const st = diseaseStage(d.severity, rules);
      const planText = d.known ? (d.plan ? '已有治疗计划，计划用品可用。' : '已知病种，未建计划。') : '<span class="bad">待诊断：去诊所评估（18）建立计划，计划用品才生效。</span>';
      body += `<div class="wishcard"><b>${esc(diseaseLabel(d))}</b><div class="small">每天四次生存结算时健康-${st.damage}；不治疗每次生存结算严重度+3（卫生&lt;25或脏活再+2）；匹配护理-7、休整-3、干燥床位夜里轻症-2。只护理不休整净-4，护理+休整才净-7。</div><div class="small">${esc(DISEASES[d.kind].hint)}。${planText}</div></div>`;
    }
    if (p.diseases.length && p.life === 'active') {
      body += `<div class="small">本小时（${String(UI.sel.hour).padStart(2, '0')}:00）护理：${t ? '' : '先安排行动，护理附在行动上。'}</div><select data-care="${id}" ${t && s.phase !== 'tail' ? '' : 'disabled'}><option value="">不护理</option>`;
      opts.forEach((o, i) => {
        const selected = t && t.care && t.care.itemUid === o.itemUid && t.care.diseaseUid === o.diseaseUid ? 'selected' : '';
        body += `<option value="${i}" ${selected}>${esc(diseaseLabel(p.diseases.find((x) => x.uid === o.diseaseUid)))} ← ${esc(UI.data.items.find((x) => x.id === o.itemId).name)}（${o.container === 'camp' ? '营地箱' : NAMES[o.container] + '的包'}）</option>`;
      });
      body += '</select>';
      if (!opts.length) body += '<p class="muted small">用品够不着：要在他自己包里、营地箱（本小时在营地）或同小时同街区同伴包里。绷带只对重度以下伤口有效；计划用品需先诊所建计划。</p>';
    }
  }
  showModal('健康与护理', body, { wide: true });
  $('modalContent').querySelectorAll('[data-care]').forEach((sel) => { sel.onchange = () => { const id = sel.dataset.care; const opts = careOptions(UI.state, id, UI.sel.hour); const choice = sel.value === '' ? null : opts[Number(sel.value)]; if (apply(setCare(UI.state, id, UI.sel.hour, choice))) toast(choice ? '已挂上护理，推进时结算。' : '已取消护理。'); }; });
}

export function showEvents() {
  const s = UI.state;
  const evs = s.events.filter((e) => e.status === 'open' || e.status === 'reserved');
  const body = evs.length ? evs.map((e) => eventCard(s, e)).join('') : '<p class="muted">现在没有热点。热点按地点与时段出现，1—2回合到期。</p>';
  showModal('热点与机会', body + '<p class="small">「占本小时」选项会占用该人本小时的主行动并把他派到该街区；「需在场」选项的执行者本小时必须在那个街区，推进时结算。</p>', { wide: true });
  bindEventCards();
}

export function eventCard(s, e) {
  const pack = PACKS[e.templateId];
  const cast = e.cast ? e.cast.filter((id) => s.actors[id].life === 'active') : active(s);
  const meta = zoneName(e.district) + ' · ' + windowLabel(e, s) + (e.major ? ' · 主要事件' : '') + (e.status === 'reserved' ? ' · 已由' + NAMES[e.reserved.actorId] + '预约' : '');
  let html = `<div class="evcard" data-ev="${e.uid}"><h4>${esc(e.title)}</h4><p>${esc(e.setup)}</p><div class="meta">${meta}</div>`;
  html += `<label class="choice-label">谁来处理<select data-evactor="${e.uid}">`;
  for (const id of cast) html += `<option value="${id}" ${UI.sel.actor === id ? 'selected' : ''}>${NAMES[id]}（在${zoneName(s.actors[id].location)}）</option>`;
  html += '</select></label><div class="choices">';
  const early = Boolean(e.window) && s.hour < e.window.from;
  for (const c of pack.choices) html += `<button data-evchoice="${c.id}" data-evuid="${e.uid}" ${early ? 'disabled' : ''}>${esc(c.label)}${c.kind === 'book' ? ' · 占本小时' : c.kind === 'present' ? ' · 需在场' : ''}${early ? `（${e.window.from}点开始）` : ''}</button>`;
  html += '</div></div>';
  return html;
}

export function bindEventCards() {
  $('modalContent').querySelectorAll('[data-evchoice]').forEach((b) => { b.onclick = () => { const uid = b.dataset.evuid; const sel = $('modalContent').querySelector('[data-evactor="' + uid + '"]'); const actor = sel ? sel.value : UI.sel.actor; const r = eventChoice(UI.state, uid, b.dataset.evchoice, actor); if (apply(r)) { closeModal(); if (UI.state.pending.combat) { void showCombat(); return; } toast(r.booked ? '已预约并占用本小时。' : ((r.events && r.events[0]) || '已处理。')); } }; });
}

export function showEvent(uid) {
  const s = UI.state;
  const e = s.events.find((x) => x.uid === uid);
  if (!e) return;
  showModal(e.title, eventCard(s, e));
  bindEventCards();
}

// focusId：街景里点到的那个人，只列他一个；其余路人仍可从「问路人」看全表。
// 街上点到路人要能当场求助：app.js 把「立即执行一小时」的入口挂在这里，弹层自己不碰时钟。
export const npcHandlers = {};

export function showNpcs(district, focusId = null) {
  const s = UI.state;
  const everyone = passersby(s, district, s.slot);
  const list = focusId ? everyone.filter((n) => n.id === focusId) : everyone;
  let body = `<p class="small">${zoneName(district)} · ${SLOTS[s.slot]}。乞讨要占一个主行动（最多问3人）；短聊每人每天一次，精神+2，不给钱。</p>`;
  if (focusId && !list.length) body += '<p class="muted">这个人已经走远了。</p>';
  for (const n of list) {
    const tag = (n.regular ? ' <span class="gold small">熟人' + (n.trust ? '·信任' + n.trust : '') + '</span>' : '');
    body += `<div class="npcrow"><div><b>${esc(n.name)}</b>${tag} <span class="tags">${esc(n.job || '')} · ${esc(n.mood.label)}${n.tags.length ? ' · ' + n.tags.map(esc).join('/') : ''}${n.asked ? ' · 今天全队已问过' : ''}</span></div><div><button data-beg="${n.id}" ${n.asked || !npcHandlers.begNow ? 'disabled' : ''}>${NAMES[UI.sel.actor]}向他求助 · 占一小时</button><button data-chat="${n.id}">${NAMES[UI.sel.actor]}短聊</button></div></div>`;
    if (n.regular) {
      const st = favorStatus(s, n.id);
      if (st && st.active) { const need = st.step.kind === 'count' ? st.step.need : 1; body += `<div class="small" style="margin:-2px 0 8px 10px">委托中：「${esc(st.step.title)}」 ${st.active.progress}/${need}，第${st.active.deadline}天前${st.step.kind === 'deliver' ? ` <button data-deliver="${n.id}" style="min-height:30px;padding:2px 8px">交付${esc(itemDef(st.step.item).name)}</button>` : ''}</div>`; }
      else if (st && st.step) body += `<div class="small" style="margin:-2px 0 8px 10px">可接委托：「${esc(st.step.title)}」${esc(st.step.text)}（${st.step.days}天内，需信任${st.step.trustMin}）→ ${esc(st.step.reward.text)} <button data-accept="${n.id}" style="min-height:30px;padding:2px 8px">接下</button></div>`;
      else if (st) body += '<div class="small muted" style="margin:-2px 0 8px 10px">三件委托都做完了。</div>';
      if (LOANS[n.id]) { const lent = s.loans?.some((l) => l.from === n.id); body += `<div class="small" style="margin:-2px 0 8px 10px">借物：${esc(itemDef(LOANS[n.id].thingId).name)}（${LOANS[n.id].days}天，需信任2）${lent ? ' · 已借出' : ` <button data-borrow="${n.id}" style="min-height:30px;padding:2px 8px" ${n.trust >= 2 ? '' : 'disabled'}>${NAMES[UI.sel.actor]}借</button>`}</div>`; }
    }
  }
  if (district === 'market' && s.flags.project && s.flags.project.stage === 3) body += `<div class="notebox">宣传片成品已剪好，第${s.flags.project.deadline}天前交给刘姐。<button id="deliverProject" style="margin-left:8px;min-height:32px">${NAMES[UI.sel.actor]}交付</button></div>`;
  body += `<div class="modalbuttons"><button class="primary" id="begHere">${npcHandlers.begNow ? `${NAMES[UI.sel.actor]}在这里向路人求助（最多三人，占一小时）` : `安排${NAMES[UI.sel.actor]}在这里乞讨`}</button></div>`;
  showModal((focusId && list[0] ? list[0].name : '路人') + ' · ' + zoneName(district), body);
  $('modalContent').querySelectorAll('[data-chat]').forEach((b) => { b.onclick = () => { if (apply(chat(UI.state, UI.sel.actor, b.dataset.chat))) toast('聊了两句，精神+2。'); }; });
  $('modalContent').querySelectorAll('[data-borrow]').forEach((b) => { b.onclick = () => { if (apply(borrowFrom(UI.state, b.dataset.borrow, UI.sel.actor))) { toast(UI.state.log[0]); showNpcs(district, focusId); } }; });
  $('modalContent').querySelectorAll('[data-accept]').forEach((b) => { b.onclick = () => { if (apply(acceptFavor(UI.state, b.dataset.accept, UI.sel.actor))) { toast(UI.state.log[0]); showNpcs(district, focusId); } }; });
  $('modalContent').querySelectorAll('[data-deliver]').forEach((b) => { b.onclick = () => { if (apply(deliverFavor(UI.state, b.dataset.deliver, UI.sel.actor))) { toast('送到了，推进后结算。'); showNpcs(district, focusId); } }; });
  if ($('deliverProject')) $('deliverProject').onclick = () => { if (apply(deliverProject(UI.state, UI.sel.actor, { controlledActorId: UI.sel.actor }))) { closeModal(); toast(UI.state.log[0]); showPendingWorkGame(); } };
  $('modalContent').querySelectorAll('[data-beg]').forEach((b) => { b.onclick = () => { closeModal(); npcHandlers.begNow?.(district, b.dataset.beg); }; });
  $('begHere').onclick = () => { closeModal(); if (npcHandlers.begNow) npcHandlers.begNow(district); else { UI.sel.zone = district; UI.sel.action = 'beg'; UI.render(); } };
}

export function showMapList() {
  const s = UI.state;
  let body = '';
  for (const d of UI.data.districts) {
    body += `<h3>${esc(d.name)} <small class="muted">通往：${d.neighbors.map((n) => zoneName(n)).join('、')}</small></h3><p class="small">${d.hotspots.map(esc).join(' · ')}</p><div class="modalbuttons">`;
    for (const sh of UI.data.shops.filter((x) => x.district === d.id)) { const closed = shopClosedReason(s, sh.id, s.slot); body += `<button data-shop="${sh.id}">${esc(sh.name)}${closed ? ' · ' + esc(closed) : ' · 营业中'}</button>`; }
    body += `<button data-dist="${d.id}">在这里安排行动</button></div>`;
  }
  showModal(`地图 · ${UI.data.districts.length}个街区`, body, { wide: true });
  $('modalContent').querySelectorAll('[data-shop]').forEach((b) => { b.onclick = () => showShop(b.dataset.shop, UI.sel.actor, 'now'); });
  $('modalContent').querySelectorAll('[data-dist]').forEach((b) => { b.onclick = () => { UI.sel.zone = b.dataset.dist; closeModal(); UI.render(); }; });
}

export function showChapters() {
  const s = UI.state;
  let body = '';
  for (const c of UI.data.chapters) body += `<div class="chapteritem ${s.day >= c.startDay && s.day <= c.endDay ? 'now' : ''}"><div class="range">D${c.startDay}—${c.endDay}</div><div><strong>第${c.number}章 ${esc(c.title)}</strong><p>${esc(c.objective)}。节点：${esc(c.anchor)}。</p><p class="muted">${esc(c.branch)}</p></div></div>`;
  showModal('十章 · 三个人的街头100日', body, { wide: true });
}

export function showHelp() {
  showModal('玩法说明', `<h3>06:00—22:00，三个人同一时钟</h3><p>点人物或排程格选人，右侧选行动，或直接点地图上的街区/店铺。推进一次经过一小时。每人每小时可行动、睡眠或等待；标准行动消耗20体力，睡一小时恢复20。10、14、18、22点结算饥寒与病情等生存变化；10点和22点按存活人数吃饭，22点之后结算过夜。</p>
  <h3>店在哪，人就得在哪</h3><p>购物要人在店所在街区且店开门。安排「到店采买」推进后人会走过去，到店当场买；如果人已经在那个街区，可以直接买，次数不限。彩票购买即锁结果，自己刮开，在售票点核销一次。</p>
  <h3>工作挑战与人物日报</h3><p>只对当前操控的人弹工作挑战，基础收入保留，表现最多加25%；随时可放弃奖金。队友自动工作，日终可展开人物日报查看收入、指标与愿望。日报的自动收入不含尚未领取的玩家奖金。</p>
  <h3>咖啡与醉意</h3><p>便利店速溶咖啡每杯加1份提神值，咖啡店现制咖啡每杯加2份；每积满4份增加20点独立的当日行动额度，不计入基础体力条。两种咖啡合计杯数，第6杯起每杯须先确认游戏内死亡风险；达到醉意2时，次日基础体力最多80。</p>
  <h3>愿望、精神、疾病、卫生</h3><p>人物会有愿望，不回应会积压并扣精神；精神连续4回合归零进入崩溃并掉健康。卫生低、吃来路不明的东西、伤口不护理会在夜里染病；病要诊所建计划，用品要护理时够得着。护理只减增量，不是回血药。</p>
  <h3>濒死与死亡</h3><p>健康归零进入濒死，普通人到下一回合末、马哥首次多一回合。濒死者可自己「联系救助」，同伴可「陪同送援」。到期不救永久死亡，游戏继续。第100天末夜濒死先给救援尾声。</p>
  <h3>快捷键</h3><p>1/2/3 选人，空格推进，Esc 关闭弹层。</p>
  <p class="small">所有数值、药品作用、心理危机和博彩分布都是虚构游戏规则。无充值无真钱。</p><div class="modalbuttons"><button id="helpTutorial">重看新手引导</button></div>`, { wide: true });
  // 引导模块挂在调试钩子上，说明弹窗只负责把它叫起来。
  const b = $('helpTutorial');
  if (b) b.onclick = () => { closeModal(); window.jwsn?.tutorial?.restart?.(); };
}

// 读人乞讨：一位一位来。开场白四选一，看反应再开口要东西。
export function showBegSession(index) {
  const s = UI.state;
  const session = s.pending.beg[index];
  if (!session) return;
  const actor = session.actorId;
  const cur = session.npcs.find((n) => n.stage !== 'done');
  const sessionKey = `${s.seed}:${s.day}:${actor}:${session.district}`;
  const last = begLast?.sessionKey === sessionKey ? session.npcs.find((n) => n.id === begLast.npcId) : null;
  const target = last?.stage === 'done' && begLast.action ? last : last?.stage === 'ask' && begLast.opening ? last : cur;
  const aiStage = target?.stage === 'done' ? 'result' : target?.stage === 'ask' ? 'reaction' : 'open';
  if (begVisibleNpc !== target?.id) { window.jwsnAudio?.stopSpeech?.(); begVisibleNpc = target?.id; }
  let body = `<div class="talk-heads"><div class="talk-head"><canvas data-head="${actor}" width="48" height="56" aria-hidden="true"></canvas><span>${NAMES[actor]}</span></div></div><p class="small">${NAMES[actor]}在${zoneName(session.district)}。读人：先看对方的样子挑一句开场白，说对了对方才有耐心听你开口；说错了人就走了。每个人今天只有这一次机会。</p>`;
  for (const n of session.npcs) {
    const t = TYPES[n.type];
    const npc = { name: n.name || n.id, job: n.job || '' };
    const saved = begDisplay.get(`${sessionKey}:${n.id}:${n.stage === 'done' ? 'result' : n.stage === 'ask' ? 'reaction' : 'open'}`);
    const shownLog = presentBegLog(n.log, NAMES[actor], begChosen.get(`${sessionKey}:${n.id}`));
    body += `<div class="npcrow" style="display:block"><div><b>${esc(npc.name)}</b> <span class="tags">${esc(npc.job || '')} · 看上去：${esc(t.hint)}${n.revealed ? ' · <span class="gold">' + esc(t.label) + '</span>' : ''}${n.stage !== 'done' ? ' · 耐心 ' + '●'.repeat(Math.max(0, n.patience)) + '○'.repeat(Math.max(0, 3 - n.patience)) : ''}</span></div>`;
    const aiTarget = n === target && (aiStage === 'open' || aiStage === 'reaction' && begLast?.opening || aiStage === 'result' && begLast?.action);
    const log = (aiTarget && aiStage !== 'open' || saved?.line) ? shownLog.slice(0, -1) : shownLog;
    if (log.length) body += `<div class="dialogue" style="margin:6px 0;font-size:14px;line-height:1.8">${log.map(esc).join('<br>')}</div>`;
    if (aiTarget || saved?.line) body += `<div class="dialogue" style="margin:6px 0;font-size:14px;line-height:1.8" ${aiTarget ? 'data-beg-ai' : ''}><span ${aiTarget ? 'data-beg-text' : ''}>${esc(saved?.observation || saved?.line || (aiStage === 'open' ? t.hint : n.log.at(-1) || ''))}</span>${aiTarget && UI.ai.enabled && !saved ? '<small class="muted" data-beg-loading> · 正在听路人说话，可直接继续</small>' : ''}</div>`;
    if (n === cur && n.stage === 'open') body += `<div class="choices" style="display:grid;gap:6px;margin-top:6px">${Object.entries(OPENINGS).map(([k, o]) => `<button data-open="${k}" data-npc="${n.id}">${esc(o.label)}：${esc(saved?.choiceLabels?.find((line) => line.optionId === k)?.text || `“${o.text[actor]}”`)}</button>`).join('')}</div>`;
    if (n === cur && n.stage === 'ask') body += `<div class="choices" style="display:grid;gap:6px;margin-top:6px"><button data-ask="cash" data-npc="${n.id}">要点零钱</button><button data-ask="food" data-npc="${n.id}">要口吃的</button><button data-ask="tip" data-npc="${n.id}">问哪儿有活</button></div>`;
    if (n.stage === 'done' && n.result) body += `<div class="small muted">${n.result.kind === 'refusal' ? '被拒了' : n.result.kind === 'cash' ? '得到零钱 ' + n.result.cash : n.result.kind === 'food' ? '得到一份饭' : n.result.kind === 'job_tip' ? '得到一条工作线索' : '没开口'}</div>`;
    body += '</div>';
  }
  body += `<div class="modalbuttons">${cur ? `<button id="begSkip">跳过剩下的人</button>` : `<button id="begDone" class="primary">收工</button>`}</div>`;
  showModal('路边求助 · ' + NAMES[actor], body, { lock: true, tag: 'STREET TALK', wide: true });
  const root = $('modalContent');
  root.querySelectorAll('[data-head]').forEach((cv) => bigPortrait(cv, cv.dataset.head, moodOf(s.actors[cv.dataset.head])));
  root.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => { const r = begStep(UI.state, index, b.dataset.npc, 'open', b.dataset.open); if (apply(r, { noRender: true })) { const chosen = begDisplay.get(`${sessionKey}:${b.dataset.npc}:open`)?.choiceLabels?.find((line) => line.optionId === b.dataset.open)?.text || OPENINGS[b.dataset.open].text[actor]; begChosen.set(`${sessionKey}:${b.dataset.npc}`, chosen); begLast = { sessionKey, npcId: b.dataset.npc, opening: b.dataset.open, action: null }; showBegSession(index); } }; });
  root.querySelectorAll('[data-ask]').forEach((b) => { b.onclick = () => { const r = begStep(UI.state, index, b.dataset.npc, 'ask', b.dataset.ask); if (apply(r, { noRender: true })) { begLast = { ...begLast, sessionKey, npcId: b.dataset.npc, action: b.dataset.ask }; showBegSession(index); } }; });
  if (target && root.querySelector('[data-beg-text]') && UI.ai.enabled) {
    const opening = begLast?.npcId === target.id ? begLast.opening : null;
    const action = aiStage === 'result' ? begLast.action : null;
    const reaction = aiStage === 'open' ? null : target.log.some((line) => line.includes('对方走了')) ? 'hate' : target.revealed ? 'like' : 'neutral';
    const context = { requestId: `beg_${s.day}_${actor}_${target.id}_${aiStage}_${s.stateRevision}`.slice(0, 90), seed: s.seed, day: s.day, actorId: actor, npcId: target.id, npcName: target.name || target.id, job: target.job || '', hint: TYPES[target.type].hint, district: zoneName(session.district), weather: s.weatherKind, food: s.actors[actor].food, hygiene: s.actors[actor].hygiene, recentLines: presentBegLog(target.log, NAMES[actor], begChosen.get(`${sessionKey}:${target.id}`)).slice(-4), stage: aiStage, opening, action, reaction, resultKind: aiStage === 'result' ? target.result?.kind : null };
    const revision = s.stateRevision;
    const marker = root.querySelector('[data-beg-text]');
    requestBegText(context, () => UI.state.seed === s.seed && UI.state.day === s.day && UI.state.stateRevision === revision && UI.state.pending.beg[index]?.actorId === actor && UI.state.pending.beg[index]?.npcs.some((n) => n.id === target.id && n.stage === target.stage) && marker.isConnected && $('modalOverlay').classList.contains('open'), (payload) => {
      begDisplay.set(`${sessionKey}:${target.id}:${aiStage}`, payload);
      marker.textContent = payload.observation || payload.line;
      root.querySelector('[data-beg-loading]')?.remove();
      if (payload.choiceLabels) for (const label of payload.choiceLabels) { const button = root.querySelector(`[data-open="${label.optionId}"]`); if (button) button.textContent = `${OPENINGS[label.optionId].label}：${label.text}`; }
      const spokenKey = `${sessionKey}:${target.id}:${aiStage}:${revision}`;
      if (!begSpoken.has(spokenKey)) { begSpoken.add(spokenKey); window.jwsnAudio?.speak?.(aiStage === 'open' ? actor : target.id, marker.textContent); }
      if (aiStage === 'result') { begLast = null; showBegSession(index); }
    }).finally(() => {
      root.querySelector('[data-beg-loading]')?.remove();
      if (aiStage === 'result' && begLast?.npcId === target.id && UI.state.stateRevision === revision && $('modalOverlay').classList.contains('open')) { begLast = null; showBegSession(index); }
    });
  } else cancelBegText();
  const done = () => { cancelBegText(); window.jwsnAudio?.stopSpeech?.(); begVisibleNpc = null; begLast = null; const r = begStep(UI.state, index, null, 'finish'); if (apply(r)) { closeModal(true); toast(UI.state.log[0]); } };
  if ($('begSkip')) $('begSkip').onclick = done;
  if ($('begDone')) $('begDone').onclick = done;
}

// 翻垃圾桶：一格一格翻。脏物格会扣卫生；带手套或翻熟了能看到警告。
export function showBinBoard(index) {
  const s = UI.state;
  const board = s.pending.bins[index];
  if (!board) return;
  const name = board.name || board.binId;
  let grid = '<div class="bin-grid">';
  board.cells.forEach((c, i) => {
    const qty = c.loot?.qty ?? 1;
    const label = !c.revealed ? '未翻开' : c.kind === 'dirt' ? '脏物' : c.kind === 'empty' ? '空桶' : c.loot?.type === 'cash' ? qty + '块零钱' : c.loot?.type === 'resource' ? ({ bottles: '瓶罐', cloth: '布料', parts: '零件', cardboard: '纸板' }[c.loot.id] || '未知物') + '×' + qty : (itemDef(c.loot?.id)?.name || '未知物') + (c.loot?.qty ? '×' + qty : '');
    const aria = !c.revealed ? `未翻开的格子${i + 1}` : c.kind === 'dirt' ? '脏物，卫生损失6' : label;
    const style = !c.revealed ? (c.warned ? 'bin-cell--warning' : 'bin-cell--hidden') : c.kind === 'dirt' ? 'bin-cell--dirt' : c.kind === 'empty' ? 'bin-cell--empty' : 'bin-cell--loot';
    grid += `<button class="bin-cell ${style}" data-cell="${i}" aria-label="${esc(aria)}" ${c.revealed || board.done ? 'disabled' : ''}>${binCellArtMarkup(c)}<span class="bin-cell-label">${esc(label)}</span></button>`;
  });
  grid += '</div>';
  const body = `<p class="small">${NAMES[board.actorId]}在翻「${esc(name)}」。还能翻 <b>${board.digsLeft}</b> 格；踩到脏物卫生-6、衣服变脏（已踩${board.dirtHits}次）。${board.cells.some((c) => c.warned) ? '带“!”的格子是脏物警告。' : '买副劳保手套（小何文具五金）能多翻2格并看到脏物警告。'}</p>${grid}<div class="modalbuttons"><button id="binQuit">${board.done ? '收工' : '不翻了，收工'}</button></div>`;
  showModal('翻垃圾桶 · ' + name, body, { lock: true, tag: 'DUMPSTER' });
  mountBinArt($('modalContent'));
  $('modalContent').querySelectorAll('[data-cell]').forEach((b) => { b.onclick = () => { const r = binReveal(UI.state, index, Number(b.dataset.cell)); if (!apply(r, { noRender: true })) return; if (r.board) showBinBoard(index); else { closeModal(true); UI.render(); toast(UI.state.log[0]); } }; });
  $('binQuit').onclick = () => { if (apply(binForfeit(UI.state, index))) { closeModal(true); toast(UI.state.log[0]); } };
}

// 营地：功能位、篝火燃料、床位顺序。
export function showCamp() {
  const s = UI.state;
  const who = UI.sel.actor;
  const atCamp = s.actors[who]?.location === 'camp';
  let body = `<p>${esc(campReport(s))} 木料${s.wood}、纸板${s.cardboard || 0}留作材料。篝火只用商店购买的炭：每晚2份，寒冷天3份；炭够保暖+10，少量炭+4，无炭不保暖。</p><p class="small">优先烧无烟炭，其次优质炭、廉价炭。有烟炭烧多了，烟会引来城管或小混混。便利店和五金店均有炭包。</p>`;
  body += '<h3>功能位（2个）</h3>';
  [0, 1].forEach((slot) => {
    const kind = s.camp.facilities?.[slot];
    if (kind) body += `<div class="summaryrow"><span>第${slot + 1}位：<b>${esc(FACILITIES[kind].name)}</b></span><button data-uninstall="${slot}" ${atCamp ? '' : 'disabled'}>拆下（退一半材料）</button></div>`;
    else body += `<div class="summaryrow"><span>第${slot + 1}位：空</span><span>${Object.entries(FACILITIES).map(([k, f]) => { const c = canInstall(s, slot, k); return `<button data-install="${k}" data-slot="${slot}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason || '')}" style="margin-left:4px">${esc(f.name)}（${Object.entries(f.cost).map(([r, q]) => ({ wood: '木', cloth: '布', parts: '零件' }[r]) + q).join('')}）</button>`; }).join('')}</span></div>`;
  });
  body += '<p class="small">修理桌：修坏电视要它，修旧电器更顺手。展架：挂上作品后凡哥每晚精神+1、更容易有人来看。晾晒架：湿衣服湿物一晚必干，下雨也行。安装会把「营地施工」排到' + NAMES[who] + '的' + String(UI.sel.hour).padStart(2, '0') + ':00。</p>';
  body += `<button id="campCooking" type="button" ${!UI.night && s.phase === 'planning' && atCamp ? '' : 'disabled'}>篝火加工 / 加热</button><p class="small">06:00—22:00可在营地安排篝火加工；已经结算的夜间活动不能再消耗食物。</p>`;
  body += `<button id="campFurniture" type="button">家具与快递包裹</button><button id="campInventory" type="button">打开营地物资箱</button>`;
  body += '<h3>今晚床位顺序</h3>' + s.camp.bedPriority.filter((x) => alive(s).includes(x)).map((x) => `<div class="summaryrow"><span>${NAMES[x]}</span><button data-bed="${x}">优先给床位</button></div>`).join('');
  body += `<div class="modal-grid"><div class="invitem"><strong>${s.camp.rain}/3</strong><span>防雨等级</span></div><div class="invitem"><strong>${s.camp.beds}/3</strong><span>干燥床位</span></div><div class="invitem"><strong>${s.camp.dirt}</strong><span>营地脏污</span></div></div>`;
  showModal('旧桥营地', body, { wide: true });
  const root = $('modalContent');
  $('campCooking').onclick = () => showCooking(who);
  $('campFurniture').onclick = () => showFurniture(who);
  $('campInventory').onclick = () => showInventory(who);
  root.querySelectorAll('[data-install]').forEach((b) => { b.onclick = () => { const r = assign(UI.state, who, UI.sel.hour, 'facility', { facility: { slot: Number(b.dataset.slot), kind: b.dataset.install } }); if (apply(r)) { closeModal(); toast(`已把「营地施工·${FACILITIES[b.dataset.install].name}」排到${NAMES[who]}的${String(UI.sel.hour).padStart(2, '0')}:00。`); } }; });
  root.querySelectorAll('[data-uninstall]').forEach((b) => { b.onclick = () => { if (apply(uninstallFacility(UI.state, Number(b.dataset.uninstall), who))) showCamp(); }; });
  root.querySelectorAll('[data-bed]').forEach((b) => { b.onclick = () => { const c = copy(UI.state); c.camp.bedPriority = [b.dataset.bed, ...c.camp.bedPriority.filter((x) => x !== b.dataset.bed)]; UI.state = c; UI.render(); showCamp(); }; });
}
