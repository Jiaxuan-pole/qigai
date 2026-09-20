// 主界面渲染：顶栏、人物卡、地图覆盖层、行动抽屉、排程、记事。
import { $, esc, UI } from './core.js';
import { ACTIONS, actionDuration, BEG_ZONES, BINS_ZONES, OUT_ZONES } from '../game/actions.js';
import { actionEstimate, available, reserve, SLOTS, NAMES, IDS, alive, active, weather, careOptions, passersby, binsAvailable } from '../game/engine.js';
import { wishSummary, activeWishes } from '../game/wishes.js';
import { diseaseLabel } from '../game/health.js';
import { forecast, chapterOf, dayNode, weatherOf } from '../game/story.js';
import { windowLabel } from '../game/headlines.js';
import { shopClosedReason, shopDef } from '../game/shop.js';
import { morningLine } from '../game/text.js';
import { portrait, moodOf } from './pixel.js';
import { updateOverlay, setMapState } from './map.js';
import { DAY_END_HOUR, currentTask, planIndex, slotOfHour } from '../game/clock.js';
import { fishingGear } from '../game/fishing.js';
import { setPlannerWindowOpen } from './planner-window.js';
import { renderHotbar } from './hotbar.js';

const COLORS = { xuan: 'var(--x)', fan: 'var(--f)', ma: 'var(--m)' };
const ROLES = { xuan: '程序员 / 爱玩烂梗', fan: '电影导演 / 爱涂鸦', ma: '跑腿短工 / 好赌命硬' };
const ZONE_NAME = { camp: '旧桥营地', market: '老街早夜市', recycle: '电子回收巷', station: '站前街', cinema: '旧影院与广场', service: '公共服务站街区', river: '河岸步道', cafe: '咖啡街区', cardhall: '棋牌馆', furniture: '家具城' };
export const zoneName = (z) => ZONE_NAME[z] || z;

export function setDrawerExpanded(open) {
  setPlannerWindowOpen(open);
}

export function plannerToggleOwnsSpace(event) {
  return event.code === 'Space' && Boolean(event.target?.closest?.('button, input, select, textarea, a, [role="button"]'));
}

export function renderAll() {
  const s = UI.state;
  UI.sel.hour = s.hour;
  renderTop(s);
  renderCharacters(s);
  renderHotbar(s, UI.sel.actor);
  renderMap(s);
  renderDrawer(s);
  renderSchedule(s);
  renderJournal(s);
}

function renderTop(s) {
  const displayDay = UI.night?.day ?? s.day;
  const wx = UI.night ? weatherOf(s.seed, displayDay) : weather(s);
  $('game').classList.toggle('camp-night-active', Boolean(UI.night));
  $('tDay').textContent = `${displayDay}/100`;
  $('tTurn').textContent = `${s.turn}/400`;
  $('tSlot').textContent = UI.night ? '营地夜间' : `${String(s.hour).padStart(2, '0')}:00${s.phase === 'tail' ? ' · 救援尾声' : ''}`;
  $('tWeather').textContent = `${wx.label} ${wx.temp}°`;
  $('tCash').textContent = '¥' + s.cash;
  $('tFood').textContent = `${s.effectiveFood}份/需${alive(s).length * 2}`;
  $('tFood').title = `木料${s.wood} 纸板${s.cardboard || 0} 零件${s.parts} 瓶罐${s.bottles || 0}`;
  const care = alive(s).filter((id) => s.actors[id].life === 'downed' || s.actors[id].diseases.some((d) => d.severity >= 30) || s.actors[id].crisis).length;
  $('tCare').textContent = String(care);
  $('tCareChip').classList.toggle('hidden', care === 0);
  const ch = chapterOf(displayDay);
  const node = dayNode(displayDay);
  const headline = s.flags.headline?.day === displayDay ? `<span class="headline-today">今日事：${esc(s.flags.headline.title)}</span> ` : '';
  $('chapterLine').innerHTML = `<span class="dot"></span>第${ch.number}章 · ${esc(ch.title)} ${headline}<span class="muted">｜ D${displayDay} ${esc(node?.title || '')} ｜ ${esc(node?.worldNote || '')}</span> <span class="muted">｜ 预报：${forecast(s.seed, displayDay).map((f) => 'D' + f.day + f.label).join(' ')}</span>`;
}

function card(s, id) {
  const p = s.actors[id];
  if (p.life === 'unrecruited') return `<div class="section-tag">桥下的空位</div><div class="char-name">还空着</div><p class="muted small">街上来来往往，也许会碰到愿意搭伙的人。</p>`;
  const life = p.life === 'dead' ? '已死亡 · 第' + s.deaths.find((d) => d.id === id)?.day + '天' : p.life === 'downed' ? '濒死 · 剩' + (p.deadline - s.turn) + '回合' : p.crisis ? '精神崩溃' : p.mind < 20 ? '心力不足' : p.mind < 40 ? '精神低迷' : '可行动';
  const wishes = wishSummary(s, id);
  const top = wishes[0];
  const latent = activeWishes(s, id).some((w) => !w.revealed);
  const cond = [];
  cond.push(`<span class="chip hyg ${p.hygiene < 30 ? 'low' : ''}" title="卫生">卫生 ${p.hygiene}</span>`);
  cond.push(`<span class="chip ${p.warmth <= 20 ? 'cold' : ''}" title="保暖">暖 ${p.warmth}</span>`);
  cond.push(`<span class="chip" title="钓鱼会逐渐提高熟练度">钓鱼 ${p.fishingSkill ?? (id === 'ma' ? 60 : 0)}</span>`);
  if (p.clothes.wet) cond.push('<span class="chip wet">湿衣</span>');
  if (p.clothes.dirty) cond.push('<span class="chip">脏衣</span>');
  if (p.intox) cond.push(`<span class="chip">醉意${p.intox}</span>`);
  cond.push(`<span class="chip" title="速溶每杯1份、现制每杯2份；每积满4份增加20点额度">今日咖啡${s.daily.coffeeCups?.[id] || 0}杯 · 提神${(s.daily.coffeeUnits?.[id] || 0) % 4}/4 · 额外行动额度${p.coffeeCredit || 0}</span>`);
  if (p.hangoverDay === s.day) cond.push('<span class="chip ill">今日宿醉：基础体力最多80</span>');
  if (p.hangoverDay === s.day + 1 || p.intox >= 2) cond.push('<span class="chip ill">明日基础体力最多80</span>');
  const cups = s.daily.coffeeCups?.[id] || 0;
  if (cups >= 4 && cups < 6) cond.push(`<span class="chip ill">今日已喝${cups}杯；第6杯起有死亡风险</span>`);
  if (p.exposure.wound && !p.exposure.woundCovered) cond.push('<span class="chip ill">伤口未护理</span>');
  for (const d of p.diseases) cond.push(`<span class="chip ill">${esc(diseaseLabel(d))}</span>`);
  if (p.zeroTurns > 0 && !p.crisis) cond.push(`<span class="chip ill">精神0×${p.zeroTurns}</span>`);
  if (p.grief) cond.push('<span class="chip">哀伤</span>');
  const warning = p.diseases.length ? `${p.diseases.some(d => d.severity >= 60) ? '病情重度' : '患病'} · ${p.diseases.map(d => diseaseLabel(d)).join('、')}` : p.exposure.wound && !p.exposure.woundCovered ? '伤口未护理' : '';
  return `<div class="char-head"><canvas class="portrait" id="portrait-${id}" width="32" height="38" aria-hidden="true"></canvas><div><div class="char-name">${NAMES[id]}</div><span class="badge ${p.life !== 'active' || p.crisis ? 'bad' : ''}">${life}</span></div></div>
  <div class="char-compact-stats">${[['健康', 'health'], ['体力', 'energy'], ['精神', 'mind']].map(([label, k]) => `<span class="char-summary-stat ${p[k] < 30 ? 'bad' : ''}"><span>${label}</span><b>${p[k]}</b></span>`).join('')}</div>
  ${warning ? `<div class="char-warning">${esc(warning)}</div>` : ''}
  <div class="char-details" id="character-details-${id}"${UI.characterExpanded?.[id] ? '' : ' hidden'}>
  <div class="role">${ROLES[id]}</div>
  <div class="stats">${[['健康', 'health'], ['饱食', 'food'], ['体力', 'energy'], ['精神', 'mind']].map(([label, k]) => `<div class="stat"><span>${label}</span><div class="track"><div class="fill ${p[k] < 30 ? 'low' : ''}" style="width:${p[k]}%"></div></div><span class="value">${p[k]}</span></div>`).join('')}</div>
  <div class="condrow">${cond.join('')}</div>
  ${p.life === 'active' && p.energy + (p.coffeeCredit || 0) < 20 ? '<p class="energy-hint">当前行动额度不足20：睡1小时恢复20；便利店速溶4杯或咖啡店现制2杯补20（混饮累计）。</p>' : ''}
  ${top ? `<div class="wishbubble">${esc(top.tpl.indirectLine)}<small>可能在想：${esc(top.tpl.name)} · 强度${Math.round(top.intensity)}${top.lastLoss ? ' · 上次生存结算精神-' + top.lastLoss : ''}${wishes.length > 1 ? ' · 另有' + (wishes.length - 1) + '项' : ''}</small></div>` : latent ? '<div class="wishbubble"><small>有个念头还没说出口</small></div>' : ''}
  <div class="locline">现在在：${zoneName(p.location)}</div></div>`;
}

export function renderCharacters(s) {
  const root = $('characters');
  UI.characterExpanded ||= {};
  root.innerHTML = IDS.map((id) => `<div class="character-shell"><div class="char-card ${UI.sel.actor === id ? 'selected' : ''} ${s.actors[id].life === 'dead' ? 'dead' : ''} ${s.actors[id].life === 'downed' ? 'downed' : ''}" style="--who:${COLORS[id]}" data-actor="${id}" tabindex="0" role="button">${card(s, id)}</div>${s.actors[id].life !== 'unrecruited' ? `<button type="button" class="char-expand" data-character-toggle="${id}" aria-controls="character-details-${id}" aria-expanded="${Boolean(UI.characterExpanded[id])}" aria-label="${UI.characterExpanded[id] ? '收起' : '展开'}${NAMES[id]}的完整状态" title="${UI.characterExpanded[id] ? '收起' : '展开'}完整状态"><span aria-hidden="true" class="char-chevron"></span></button>` : ''}</div>`).join('');
  root.querySelectorAll('[data-character-toggle]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.characterToggle;
      const expanded = !UI.characterExpanded[id];
      UI.characterExpanded[id] = expanded;
      $('character-details-' + id).hidden = !expanded;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? '收起' : '展开'}${NAMES[id]}的完整状态`);
      button.title = `${expanded ? '收起' : '展开'}完整状态`;
    };
  });
  for (const id of IDS) if (s.actors[id].life !== 'unrecruited') portrait($('portrait-' + id), id, moodOf(s.actors[id]));
}

function renderMap(s) {
  setMapState(s);
  if (!UI.night) $('mapTitle').textContent = `雾城 · ${UI.data.districts.length}个街区`;
  const shops = UI.data.shops.map((sh) => ({ id: sh.id, name: sh.name, district: sh.district, unlockDay: sh.unlockDay, closed: shopClosedReason(s, sh.id, s.slot) }));
  const districts = UI.data.districts.map((d) => ({ id: d.id, name: d.name }));
  const evs = s.events.filter((e) => e.status === 'open' || e.status === 'reserved').map((e, i) => ({ uid: e.uid, title: e.title + (e.status === 'reserved' ? '（已预约）' : ''), district: e.district, left: windowLabel(e, s), i }));
  updateOverlay(s, UI.sel, shops, districts, evs);
  $('eventCount').textContent = String(evs.length);
  const speakerId = UI.sel.actor && s.actors[UI.sel.actor].life === 'active' ? UI.sel.actor : active(s)[0];
  const line = speakerId ? morningLine(s, speakerId) : null;
  $('speaker').textContent = speakerId ? NAMES[speakerId] : '';
  $('quote').textContent = line || '';
  $('mapHint').textContent = UI.sel.zone ? `已选排程街区：${zoneName(UI.sel.zone)} · 右侧选行动` : '街道可走路，边缘跨区；总览点街区安排行动';
}

function actionGroup(a) {
  if (a.rescue || a.aid || a.downedOnly) return '救援';
  if (a.min || a.fixed) return '合作';
  if (a.work || a.begging || a.bins) return '挣钱';
  if (a.leisure || a.wishPartial || a.wishExact) return '爱好与社交';
  return '生活';
}

function zoneOf(a, sel) {
  if (a.zone !== 'pick') return a.zone;
  return sel.zone;
}

export function renderDrawer(s) {
  const root = $('drawer');
  const selectedPartner = root.querySelector?.('#partner')?.value;
  const selectedStyle = root.querySelector?.('#begStyle')?.value;
  const id = UI.sel.actor;
  const p = s.actors[id];
  const hour = s.hour;
  if (s.phase !== 'planning' && s.phase !== 'tail') { root.innerHTML = '<section class="panel"><div class="section-tag">NOW</div><h3>先处理当前画面</h3></section>'; return; }
  const index = s.phase === 'tail' ? hour - DAY_END_HOUR : planIndex(hour);
  const slot = slotOfHour(Math.min(hour, DAY_END_HOUR));
  if (p.life === 'unrecruited' || p.life === 'dead') { root.innerHTML = `<section class="panel"><div class="section-tag">ARRANGE</div><h3>${NAMES[id]}</h3><p class="muted">${p.life === 'dead' ? '已死亡。遗物在营地可整理。' : '尚未入队。'}</p></section>`; return; }
  const possible = available(s, id).filter((k) => {
    const a = ACTIONS[k];
    if (s.phase === 'tail' && !['aid', 'rescue', 'wait', 'rest'].includes(k)) return false;
    if (!UI.sel.zone) return true;
    if (a.zone === UI.sel.zone) return true;
    if (a.zone === 'pick') return (a.begging ? BEG_ZONES : a.bins ? BINS_ZONES : OUT_ZONES).includes(UI.sel.zone) && (a.shopping ? UI.data.shops.some((sh) => sh.district === UI.sel.zone) : true);
    return false;
  });
  if (!possible.includes(UI.sel.action)) UI.sel.action = possible[0] || '';
  const a = ACTIONS[UI.sel.action];
  const groups = {};
  for (const k of possible) { const g = actionGroup(ACTIONS[k]); (groups[g] = groups[g] || []).push(k); }
  const list = Object.entries(groups).map(([g, ks]) => `<div class="section-tag" style="margin-top:6px">${g}</div>` + ks.map((k) => { const x = ACTIONS[k]; const timing = actionDuration(k); const hours = timing.defaultHours ?? timing.default; const mind = x.mind || 0; return `<button class="actionoption ${UI.sel.action === k ? 'active' : ''}" data-action="${k}"><span>${x.min || x.fixed ? '↔ ' : ''}${esc(x.name)}</span><small>${hours}小时 · 精神${mind > 0 ? '+' : ''}${mind}/小时</small></button>`; }).join('')).join('');
  let detail = '';
  if (a) {
    const timing = actionDuration(a.id);
    const durations = timing.options.filter(h => h + hour <= (s.phase === 'tail' ? 24 : DAY_END_HOUR));
    if (!durations.includes(UI.sel.duration)) UI.sel.duration = durations.includes(timing.defaultHours ?? timing.default) ? (timing.defaultHours ?? timing.default) : durations[0] || 1;
    const duration = UI.sel.duration;
    const period = `${String(hour).padStart(2, '0')}:00 → ${String(hour + duration).padStart(2, '0')}:00`;
    const zone = zoneOf(a, UI.sel);
    const cost = a.cost ? Object.entries(a.cost).map(([k, v]) => ({ cash: '现金', parts: '零件', battery: '电量', wood: '木料', cloth: '布料' }[k]) + v).join('、') : '无';
    const limit = a.limit ? `本日已用${s.daily.orders[UI.sel.action] || 0}/${a.limit}` : '';
    let chooser = '';
    const planned = s.plan[id][index];
    const plannedPartner = planned?.participants?.find((x) => x !== id);
    let partner = selectedPartner || (a.rescue ? planned?.target : plannedPartner) || '';
    if (a.rescue) {
      const targets = alive(s).filter((x) => s.actors[x].life === 'downed' && x !== id);
      partner ||= targets[0] || '';
      chooser = `<label class="choice-label">救援目标<select id="partner">${targets.map((x) => `<option value="${x}" ${partner === x ? 'selected' : ''}>${NAMES[x]} · 剩${s.actors[x].deadline - s.turn}回合</option>`).join('') || '<option value="">当前无人濒死</option>'}</select></label>`;
    } else if (a.min === 2) {
      const partners = active(s).filter((x) => x !== id);
      partner ||= partners[0] || '';
      chooser = `<label class="choice-label">合作伙伴<select id="partner">${partners.map((x) => `<option value="${x}" ${partner === x ? 'selected' : ''}>${NAMES[x]}</option>`).join('') || '<option value="">没有可行动伙伴</option>'}</select></label>`;
    }
    if (a.zone === 'pick') {
      const zones = a.begging ? BEG_ZONES : a.bins ? BINS_ZONES : OUT_ZONES.filter((z) => UI.data.shops.some((sh) => sh.district === z));
      chooser += `<label class="choice-label">去哪个街区<select id="zonePick">${zones.map((z) => `<option value="${z}" ${zone === z ? 'selected' : ''}>${zoneName(z)}</option>`).join('')}</select></label>`;
      if (a.begging && zone) {
        const curStyle = selectedStyle || planned?.style || 'ask';
        chooser += `<label class="choice-label">怎么讨<select id="begStyle"><option value="ask" ${curStyle === 'ask' ? 'selected' : ''}>开口求助（读人对话：选开场白再开口，被拒精神-1/上限2）</option><option value="sign" ${curStyle === 'sign' ? 'selected' : ''}>举纸板（被拒不伤精神，给得少1块）</option>${id === 'fan' ? `<option value="perform" ${curStyle === 'perform' ? 'selected' : ''}>速写换零钱（消耗1格纸笔，少被拒、多给4块）</option>` : ''}</select></label>`;
        const list2 = passersby(s, zone, slot);
        chooser += `<div class="choice-label">选最多3位路人（不选=自动挑没问过的）</div><div class="pick-list">${list2.map((n) => `<label><input type="checkbox" data-npc="${n.id}" ${UI.sel.targets.includes(n.id) ? 'checked' : ''} ${n.asked ? 'disabled' : ''}>${esc(n.name)}${n.regular ? '（熟人' + (n.trust ? '·信任' + n.trust : '') + '）' : n.job ? '·' + esc(n.job) : ''} · ${esc(n.mood.label)}${n.asked ? ' · 今天问过' : ''}</label>`).join('')}</div>`;
      }
      if (a.bins && zone) chooser += `<div class="choice-label">这里的桶</div><div class="pick-list">${binsAvailable(s, zone).map((b) => `<label>${esc(b.name)} ${b.used ? '· 今天翻过' : '· 可翻'}</label>`).join('')}</div>`;
      if (a.shopping && zone) chooser += `<div class="choice-label">采购清单</div><div class="pick-list">${UI.sel.cart.length ? UI.sel.cart.map((l) => `<label>${esc(UI.data.items.find((i) => i.id === l.itemId)?.name)} ×${l.qty}（${esc(shopDef(l.shopId).name)}）</label>`).join('') : '<label class="muted">到店再买也行，或点店铺先列清单</label>'}</div><button data-openshop="${zone}" style="margin-top:6px;width:100%">列采购单 / 看店</button>`;
    }
    const options = { zone, cart: UI.sel.cart, targets: UI.sel.targets, destination: UI.sel.destination, duration };
    if (a.rescue) { options.target = partner; options.participants = [id, partner]; }
    else if (a.min === 2) options.participants = [id, partner];
    else if (a.min === 3) options.participants = [...IDS];
    if (a.begging) options.style = selectedStyle || planned?.style || 'ask';
    const estimate = actionEstimate(s, id, a.id, duration, options);
    const signed = (value) => `${value >= 0 ? '+' : ''}${value}`;
    const estimateValues = (value) => `精神 ${signed(value.mind)}${value.pendingMind ? `（待结算 ${signed(value.pendingMind)}）` : ''}·体力 ${signed(value.energy)}·现金 ${signed(value.cash)}`;
    const estimateLine = estimate.error && estimate.completedHours === undefined
      ? `<span class="bad">无法完整预估：${esc(estimate.error)}</span>`
      : estimate.complete
        ? `<span>预计变化：${estimateValues(estimate)}</span>`
        : `<span class="bad">仅完成${estimate.completedHours}/${duration}小时：${estimateValues(estimate)}<br>后续未执行：${esc(estimate.error || '结算中断。')}</span>`;
    const budget = `<label class="choice-label">持续时间<select id="durationPick">${durations.map(h => `<option value="${h}" ${duration === h ? 'selected' : ''}>${h}小时</option>`).join('')}</select></label><div class="budget"><span>时间：<b>${period}</b> · 连续${duration}小时</span><span>执行地点：<b>${zone ? zoneName(zone) : '待选'}</b>${a.indoor ? '（室内）' : ''}</span>${estimateLine}<span>每小时基础耗材：<b>${cost}</b></span><span>基础体力 ${p.energy} + 咖啡额度 ${p.coffeeCredit || 0}，饭钱保护 <b>${reserve(s)}</b></span><span class="muted small">随机事件与后续排程会改变实际结果。</span>${limit ? `<span>${limit}</span>` : ''}</div>`;
    const careOpts = s.phase === 'tail' ? [] : careOptions(s, id, hour);
    const careT = s.plan[id][index]?.care;
    const careBlock = p.diseases.length && s.phase !== 'tail' ? `<div class="choice-label">本小时护理（附在行动上）</div><select id="carePick"><option value="">不护理</option>${careOpts.map((o, i) => `<option value="${i}" ${careT && careT.itemUid === o.itemUid && careT.diseaseUid === o.diseaseUid ? 'selected' : ''}>${esc(diseaseLabel(p.diseases.find((d) => d.uid === o.diseaseUid)))} ← ${esc(UI.data.items.find((x) => x.id === o.itemId).name)}（${o.container === 'camp' ? '营地箱' : NAMES[o.container] + '的包'}）${o.support ? '·支持' : o.relief ? '·缓解' : ''}</option>`).join('')}</select>${careOpts.length ? '' : '<p class="muted small">手边没有够得着的匹配用品：用品要在他自己包里、营地箱或同小时同街区同伴包里。</p>'}` : '';
    const gear = a.fishing ? fishingGear(s, id) : null;
    const gearHelp = gear && (!gear.rod || !gear.bait) ? `<p class="energy-hint">${!gear.rod ? '鱼竿' : ''}${!gear.rod && !gear.bait ? '和' : ''}${!gear.bait ? '鱼饵' : ''}需放在钓鱼者包里；可去店铺查看补齐。</p>` : '';
    detail = `<div class="action-detail"><strong>${esc(a.name)}</strong><p>${esc(a.note)}</p>${budget}${gearHelp}${a.risky ? '<div class="risk-note">有死亡可能：事故之外还需考虑饥饿、寒冷和救援期限。</div>' : ''}${chooser}${careBlock}</div>`;
  }
  const energyHelp = p.life === 'active' && p.energy + (p.coffeeCredit || 0) < 20 ? `<div class="energy-help" role="note">行动额度不足20：睡1小时恢复20；便利店速溶4杯或咖啡店现制2杯补20（混饮累计）。<div class="energy-actions"><button type="button" data-sleep-hour="${hour}">安排睡1小时</button><button type="button" data-view-coffee>查看咖啡</button></div></div>` : '';
  root.innerHTML = `<section class="panel"><div class="section-tag">ARRANGE</div><div class="ctx">正在安排：<b style="color:${COLORS[id]}">${NAMES[id]}</b>的下一件事${UI.sel.zone ? ' · <b>' + zoneName(UI.sel.zone) + '</b> <button class="linkbtn" id="clearZone">全部街区</button>' : ' · 全部街区'}</div>${energyHelp}<div class="action-options">${list || '<p class="muted">这个街区没有该角色可做的事。</p>'}</div>${detail}<button id="assignBtn" class="primary assign" ${!a ? 'disabled' : ''}>设为下一件事</button></section>`;
}

export function renderSchedule(s) {
  const index = s.phase === 'tail' ? s.hour - 22 : s.phase === 'planning' ? planIndex(s.hour) : null;
  $('schedule').innerHTML = IDS.map((id) => {
    const p = s.actors[id];
    if (p.life === 'unrecruited') return '<div class="next-task empty"><b>尚未相遇</b><small>这里还空着一个位置</small></div>';
    const t = index === null ? null : currentTask(s, id);
    const a = t && ACTIONS[t.id];
    let duration = 1;
    if (t && index !== null) while (s.plan[id][index + duration]?.id === t.id && s.plan[id][index + duration]?.zone === t.zone) duration++;
    const title = p.life === 'dead' ? '已死亡' : a ? a.name + (t.zone && a.zone === 'pick' ? ' · ' + zoneName(t.zone) : '') : '等待安排';
    const note = p.life === 'dead' ? '遗物与回顾' : t?.group ? '与同伴一起行动' : t?.cart?.length ? '带采购清单' : p.life === 'downed' ? '需要救援' : '可点击更换';
    const income = a ? `连续${duration}小时 · 至${String(s.hour + duration).padStart(2, '0')}:00 · 基础精神${(a.mind || 0) >= 0 ? '+' : ''}${(a.mind || 0) * duration}` : '自由活动';
    const err = UI.errAt?.actorId === id && UI.errAt.hour === s.hour;
    return `<button class="next-task ${UI.sel.actor === id ? 'selected' : ''} ${err ? 'err' : ''}" style="--who:${COLORS[id]}" data-hour="${s.hour}" data-actor="${id}" ${p.life === 'dead' || !['planning', 'tail'].includes(s.phase) ? 'disabled' : ''}><b>${NAMES[id]}</b><span>${esc(title)}</span><small>基础体力${p.energy} + 咖啡额度${p.coffeeCredit || 0} · ${esc(note)}</small><small>${income}</small></button>`;
  }).join('');
  $('planFocus').textContent = (dayNode(s.day)?.focus ? Object.entries(dayNode(s.day).focus).filter(([k]) => s.actors[k].life === 'active').map(([k, v]) => NAMES[k] + '：' + v).join('　') : '给每个人选好下一件事，然后开始行动。');
  $('btnAdvance').textContent = ['planning', 'tail'].includes(s.phase) ? '开始行动' : s.phase === 'meeting' ? '先与马哥见面' : s.phase === 'gameover' ? '本局已结束' : '看结局';
  $('btnAdvance').disabled = Boolean(UI.night) || !['planning', 'tail', 'meeting', 'ending', 'gameover'].includes(s.phase);
  const downed = alive(s).filter((x) => s.actors[x].life === 'downed');
  const chilly = active(s).filter((x) => s.actors[x].warmth <= 30).map((x) => NAMES[x]);
  const hungry = active(s).filter((x) => s.actors[x].food <= 25).map((x) => NAMES[x]);
  const filthy = active(s).filter((x) => s.actors[x].hygiene <= 15).map((x) => NAMES[x]);
  const sick = active(s).filter((x) => s.actors[x].diseases.some((d) => d.severity >= 60)).map((x) => NAMES[x]);
  const warn = (filthy.length ? `<strong>${filthy.join('、')}卫生极低</strong>，留意疾病风险。 ` : '') + (sick.length ? `<strong>${sick.join('、')}病情重度</strong>，先考虑护理。 ` : '') + (chilly.length ? `<strong>${chilly.join('、')}保暖偏低</strong>，留意过夜地点。 ` : '') + (hungry.length ? `<strong>${hungry.join('、')}饿了</strong>，先备够食物。 ` : '');
  let inc = 0, cost = 0;
  const seen = new Set();
  for (const id of index === null ? [] : alive(s)) {
    const t = s.plan[id][index]; if (!t) continue;
    const key = t.group || id; if (seen.has(key)) continue; seen.add(key);
    const a = ACTIONS[t.id]; inc += t.pay ?? a.cash ?? 0;
    cost += (t.costOverride ?? a.cost?.cash ?? 0) + (t.cart || []).reduce((x, l) => x + (UI.data.items.find((i) => i.id === l.itemId)?.price || 0) * l.qty, 0);
  }
  const budget = s.phase === 'planning' ? `本次预计：收入约 <b>+${inc}</b>，支出 <b>-${cost}</b>，行动后现金约 <b>${s.cash - cost + inc}</b>${s.cash - cost < reserve(s) ? '<span class="bad">，低于饭钱保护' + reserve(s) + '</span>' : ''}。 ` : '';
  $('planStatus').innerHTML = budget + warn + (downed.length ? `<strong>${downed.map((x) => NAMES[x]).join('、')}濒死</strong>，尽快安排救援。` : '') + ` 饥饿与病情在固定时点结算；今日付费博彩 ${s.daily.bets}/2。`;
}

function renderJournal(s) {
  $('journal').textContent = s.log[0] || '';
}
