// 回合结算：预检（整格失败不扣费）→ 执行 → 吃饭与环境 → 愿望/精神/疾病 → 濒死与死亡 → 夜间 → 新一日。
import { getData, indexById } from './data.js';
import { rng } from './rng.js';
import { clamp, makeDowned, cardOutcome } from './rules.js';
import { ACTIONS } from './actions.js';
import { IDS, NAMES, SLOTS, copy, alive, active, reserve, energyCost, foodEquivalent, task, cancelAt, freshDaily } from './engine.js';
import { makeItem, itemsIn, consumeUse, eatOne, discardExpired, hasDevice, FOOD_VALUE, findItem } from './items.js';
import { restockMorning, validateCart, executeCart, shopClosedReason, shopDef } from './shop.js';
import { generateMorningWishes, tickWishes, fulfillWish } from './wishes.js';
import { fulfillItemWish, fulfillReachedItemWishes } from './item-wishes.js';
import { addDisease, progressDiseases, mentalTick, nightExposure } from './health.js';
import { begAt, digBins, collectBottles, passersby, relation } from './npcs.js';
import { beginSession, autoResolve as begAuto } from './beg.js';
import { noteAction, tickFavors } from './favors.js';
import { generateBoard, revealCell, forfeit, boardSummary } from './bins.js';
import { canRepair, repair } from './salvage.js';
import { tickLoans } from './loans.js';
import { install, canInstall, hasFacility, nightWarmthBonus, fuelCount } from './camp.js';
import { hasRadio, bulletin } from './radio.js';
import { recordFilm, filmName, nightScreening } from './screening.js';
import { binsAvailable } from './npcs.js';
import { forecast } from './story.js';
import { directorTick, settleReserved, misfortuneLine } from './events.js';
import { weatherOf, morningNode, nightScripted, computeEnding } from './story.js';
import { generateFace } from './tickets.js';
import { fish, fishingGear, autoResolveFishingQte } from './fishing.js';
import { planIndex, slotOfHour } from './clock.js';
import { killActor } from './death.js';
import { validateCooking, cookFood } from './cooking.js';
import { inviteCasino } from './casino-contract.js';
import { startWorkGame } from './work-games.js';
import { beginDayReport, recordAutomaticWork, finishDayReport } from './day-report.js';
import { sleepSurfaceFor } from './furniture.js';
import { awardTableMeal } from './furniture-effects.js';

const R = () => getData().rules;

export function units(s) {
  const result = [], seen = new Set();
  for (const id of alive(s)) {
    const t = s.busy?.[id] ? null : s.plan[id][planIndex(s.hour)];
    if (!t) { result.push({ actor: id, task: null }); continue; }
    const key = t.group || id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ actor: id, task: t, action: ACTIONS[t.id] });
  }
  return result;
}

import { itemDef } from './items.js';
function itemName(id) { return itemDef(id)?.name || id; }
// 修旧物目标：轩哥包里或（本格在营地时）营地箱里的坏物件，优先能修的电视。
function repairTarget(s, actorId, zone) {
  const cands = s.items.filter((x) => x.itemId.startsWith('broken_') && (x.container === actorId || (zone === 'camp' && x.container === 'camp')));
  const ok = cands.filter((x) => canRepair(s, x.uid, actorId).ok);
  const pick = ok.find((x) => x.itemId === 'broken_tv') || ok[0];
  return pick ? { uid: pick.uid, name: itemName(pick.itemId) } : null;
}

function needsItem(s, actorId, itemId, zone) {
  return s.items.some((x) => x.itemId === itemId && x.uses > 0 && !x.wet && (x.container === actorId || (zone === 'camp' && x.container === 'camp')));
}

export function preflight(s) {
  if (s.phase === 'tail') return preflightTail(s);
  if (s.phase !== 'planning') return { error: '请先处理当前剧情或结算画面。' };
  if (s.pendingMorning) return { error: '先处理今天的晨间节点。' };
  if (s.pending?.beg?.length || s.pending?.bins?.length) return { error: '还有没处理完的路人对话或垃圾桶，先把它们做完。' };
  if (s.pending?.fishingQte?.length) return { error: '还有待处理的收竿，先完成后再推进。' };
  if (s.pending?.workGames?.length) return { error: '还有待完成的工作挑战，先处理后再推进。' };
  if (s.pending?.riverFight) return { error: '还有待处理的河边事件，先完成后再推进。' };
  if (s.pending?.casino && s.pending.casino.phase !== 'settled') return { error: '棋牌馆牌局尚未完成，先处理后再推进。' };
  const jobs = units(s), costs = {}, equip = new Set(), counts = { ...s.daily.orders };
  let bets = s.daily.bets, vouchers = s.vouchers, campAdds = 0;
  const funding = [], cookingItems = new Set();
  let casinoVisits = 0;
  for (const j of jobs) {
    const { actor: id, task: t, action: a } = j;
    const where = { actorId: id, hour: s.hour };
    if (!t) continue;
    if ((t.hours ?? a?.hours ?? 1) > 22 - s.hour) return { error: '任务时长超过今天剩余小时。', ...where };
    if (!a) return { error: '行动不存在。', ...where };
    if (a.allowed && !a.allowed.includes(s.slot)) return { error: a.name + '不在当前时段开放。', ...where };
    if (a.risky && s.turn < 3) return { error: '教学阶段不开放危险作业。', ...where };
    if (a.fixed && a.fixed.slice().sort().join() !== t.participants.slice().sort().join()) return { error: '职业合作参与者不正确。', ...where };
    if (a.min && t.participants.length !== a.min) return { error: a.name + '需要' + a.min + '人。', ...where };
    if (!a.min && !a.fixed && (t.participants.length !== 1 || t.participants[0] !== id)) return { error: '单人行动的参与者错误。', ...where };
    if (a.rescue && (!t.target || !t.participants.includes(t.target) || s.actors[t.target].life !== 'downed')) return { error: '救援目标已变化，请重排。', ...where };
    if (a.eventOnly) { const ev = s.events.find((e) => e.uid === t.eventUid); if (!ev || ev.status !== 'reserved' || s.turn >= ev.expiresTurn) return { error: '「' + a.name + '」对应的机会已经过期，请重排这一格。', ...where }; }
    if (a.casinoVisit) {
      if (t.zone !== 'cardhall') return { error: '去棋牌馆必须在棋牌馆街区。', ...where };
      if (s.hour > a.latestStartHour) return { error: '棋牌馆最晚20点入馆，避免跨夜移位。', ...where };
      if (++casinoVisits > 1) return { error: '同一小时棋牌馆只接待一位入馆者。', ...where };
    }
    if (a.shop) { const closed = shopClosedReason(s, a.shop, s.slot); if (closed) return { error: shopDef(a.shop).name + '：' + closed, ...where }; }
    if (a.shopping && t.cart && t.cart.length) { const v = validateCart(s, id, t.zone, s.slot, t.cart); if (v.error) return { error: v.error, ...where }; }
    const lotteryCart = a.shopping && t.cart?.some((line) => itemDef(line.itemId)?.category === 'lottery');
    if (a.fishing) {
      if (t.zone !== 'river') return { error: '钓鱼必须在河岸。', ...where };
      const gear = fishingGear(s, id);
      if (!gear.rod) return { error: NAMES[id] + '包里没有可用鱼竿。', ...where };
      if (!gear.bait) return { error: NAMES[id] + '包里没有鱼饵。', ...where };
    }
    if (a.cooking) {
      if (t.zone !== 'camp') return { error: '加工食物要到营地篝火旁。', ...where };
      const uid = t.targets?.[0], reason = validateCooking(s, id, uid);
      if (reason) return { error: reason, ...where };
      if (cookingItems.has(uid)) return { error: '同一份原料不能在同一小时重复加工。', ...where };
      cookingItems.add(uid);
    }
    if (a.needs && !needsItem(s, id, a.needs, t.zone)) return { error: NAMES[id] + '手边没有可用的' + indexById(getData().items)[a.needs].name + '（要在自己包里，或人在营地时在营地箱）。', ...where };
    if (a.repairing) { const target = repairTarget(s, id, t.zone); if (!target) return { error: '手边没有可修的旧电器：坏物件要在轩哥包里，或人在营地时在营地箱；坏电视还要修理桌和2个零件。', ...where }; }
    if (a.building) { if (!t.facility) return { error: '先在营地面板选要装的设施。', ...where }; const c = canInstall(s, t.facility.slot, t.facility.kind); if (!c.ok) return { error: c.reason, ...where }; }
    for (const m of t.participants) {
      const p = s.actors[m], mt = s.plan[m][planIndex(s.hour)];
      if (s.busy?.[m]) return { error: NAMES[m] + '正在执行任务，不能叠加合作。', actorId: m, hour: s.hour };
      if (!mt || JSON.stringify(mt) !== JSON.stringify(t)) return { error: '合作绑定不完整，请重新选择参与者。', actorId: m, hour: s.hour };
      if (a.rescue && m === t.target) continue;
      if (p.life !== (a.downedOnly ? 'downed' : 'active')) return { error: NAMES[m] + '的生命状态不允许当前行动。', actorId: m, hour: s.hour };
      if (a.who !== 'any' && a.who !== m) return { error: '角色不能做这项专属工作。', actorId: m, hour: s.hour };
      if (p.life === 'active') {
        if (a.complex && p.mind < 20) return { error: NAMES[m] + '精神不足20，请改基础工作、免费爱好或休整。', actorId: m, hour: s.hour };
        if ((a.risky || a.complex) && p.intox >= 2) return { error: NAMES[m] + '醉意较高，不能危险作业或复杂专注工作。', actorId: m, hour: s.hour };
        if ((a.gamble || lotteryCart) && p.intox > 0) return { error: NAMES[m] + '有醉意，本回合不能付费博彩。', actorId: m, hour: s.hour };
        if (a.casinoVisit && p.intox > 0) return { error: NAMES[m] + '有醉意，不能进入棋牌馆。', actorId: m, hour: s.hour };
        if (p.energy + (p.coffeeCredit || 0) < energyCost(s, m, a)) return { error: NAMES[m] + '体力不足（需' + energyCost(s, m, a) + '），请休整或选择轻活。', actorId: m, hour: s.hour };
        if (p.diseases.some((d) => d.severity >= 85) && (a.work || a.risky)) return { error: NAMES[m] + '病情危重，不能照常干活。', actorId: m, hour: s.hour };
      }
    }
    for (const e of a.equip || []) {
      // 借来的工作位：剪辑不占唯一电脑。
      if (e === 'computer' && t.id === 'edit' && s.items.some((x) => x.itemId === 'studio_pass' && x.container === id)) continue;
      if (equip.has(e)) return { error: '唯一' + (e === 'computer' ? '电脑' : '相机') + '同槽被重复占用，请调整时段。', ...where };
      if (!hasDevice(s, e)) return { error: '没有可用的' + (e === 'computer' ? '电脑' : '相机') + '。', ...where };
      equip.add(e);
    }
    counts[t.id] = (counts[t.id] || 0) + 1;
    const limit = t.id === 'kitchen' && s.flags.liuSecondShift ? 2 : t.id === 'soup' && s.flags.wangSoup ? 3 : a.limit;
    if (limit && counts[t.id] > limit) return { error: a.name + '的本日岗位/次数已用完。', ...where };
    if (a.cooldownDays && s.flags.cooldown && s.flags.cooldown[t.id] > s.day) return { error: a.name + '要到第' + s.flags.cooldown[t.id] + '天才能再摆。', ...where };
    if ((a.gamble || lotteryCart) && ++bets > R().gambling.paidActionsTeamDailyCap) return { error: '全队今日付费博彩已达2次（购票与牌局共用），可选无赌注纸牌。', ...where };
    campAdds += a.camp || 0;
    let cost = { ...(a.cost || {}) };
    // 鲁叔的工具箱：每天一次维修不耗零件。
    if (t.id === 'repair' && cost.parts && !s.daily.toolkitUsed && s.items.some((x) => x.itemId === 'toolkit' && x.container === id)) delete cost.parts;
    if (t.costOverride !== null && t.costOverride !== undefined) cost.cash = t.costOverride;
    for (const [k, v] of Object.entries(t.extraCost || {})) cost[k] = (cost[k] || 0) + v;
    if (t.cart && t.cart.length) { const v = validateCart(s, id, t.zone, s.slot, t.cart); cost.cash = (cost.cash || 0) + v.total; }
    let useVoucher = false;
    if (a.aid) { if (vouchers > 0) { vouchers--; useVoucher = true; } else cost.cash = R().rescue.serviceCost; }
    for (const [k, v] of Object.entries(cost)) costs[k] = (costs[k] || 0) + v;
    funding.push({ ...j, cost, useVoucher });
  }
  if (s.camp.rain + campAdds > 3) return { error: '防雨等级上限3。' };
  const labels = { cash: '现金', parts: '零件', battery: '电量', wood: '木料', cloth: '布料' };
  for (const [k, v] of Object.entries(costs)) if (s[k] < v) { const culprit = funding.find((j) => (j.cost[k] || 0) > 0); return { error: labels[k] + '不足：本回合需' + v + '，现有' + s[k] + '。整回合未执行、未扣费。', actorId: culprit?.actor, hour: s.hour }; }
  if (cookingItems.size && cookingItems.size > fuelCount(s)) return { error: '篝火燃料不足：还需为同小时的其他料理留料。整小时未扣费。', actorId: funding.find((j) => j.action.cooking).actor, hour: s.hour };
  const leisureCash = funding.filter((j) => j.action.leisure || j.action.gamble || (j.task.cart && j.task.cart.some((l) => itemDef(l.itemId)?.category === 'lottery'))).reduce((a, j) => a + (j.cost.cash || 0), 0);
  if (leisureCash > 0 && s.cash - (costs.cash || 0) < reserve(s)) { const culprit = funding.find((j) => j.action.leisure || j.action.gamble || (j.task.cart && j.task.cart.some((l) => itemDef(l.itemId)?.category === 'lottery'))); return { error: '这会动用预留的饭钱' + reserve(s) + '。先补食物或安排劳动。', actorId: culprit?.actor, hour: s.hour }; }
  return { jobs: funding, costs, counts, bets };
}

function preflightTail(s) {
  const jobs = [], seen = new Set();
  let vouchers = s.vouchers, cash = 0;
  for (const id of alive(s)) {
    const t = s.plan[id][s.hour - 22];
    if (!t) continue;
    if (!['aid', 'rescue', 'wait', 'rest'].includes(t.id)) return { error: '尾声回合只处理救援：' + NAMES[id] + '请改为救援、联系救助或休息。', actorId: id, hour: s.hour };
    if (t.group && seen.has(t.group)) continue;
    if (t.group) seen.add(t.group);
    const a = ACTIONS[t.id];
    if (a.rescue && (!t.target || s.actors[t.target].life !== 'downed' || t.participants.some((m) => JSON.stringify(s.plan[m][s.hour - 22]) !== JSON.stringify(t)))) return { error: '救援绑定不完整。', actorId: id, hour: s.hour };
    const useVoucher = Boolean(a.aid && vouchers > 0);
    if (useVoucher) vouchers--;
    const cost = a.aid ? (useVoucher ? 0 : R().rescue.serviceCost) : (a.cost?.cash || 0);
    cash += cost;
    jobs.push({ actor: id, task: t, action: a, cost: { cash: cost }, useVoucher });
  }
  if (cash > s.cash) return { error: '现金不足：救援需' + cash + '，现有' + s.cash + '。整小时未执行、未扣费。', hour: s.hour };
  return { jobs, costs: { cash }, counts: {}, bets: 0 };
}

function setDowned(s, id, turn, cause, events) {
  const p = s.actors[id];
  if (p.life !== 'active' || p.health > 0) return;
  if (turn <= 3) { p.health = 1; events.push(NAMES[id] + '受到前三回合教学保护。'); return; }
  const r = makeDowned(id, turn, p.gritUsed, R());
  p.life = 'downed'; p.downedAt = turn; p.deadline = r.deadline; p.deathCause = cause; p.gritUsed = r.gritUsed;
  events.push(NAMES[id] + '濒死：' + cause + '。须在回合' + p.deadline + '结束前获救。' + (r.extra ? '命硬：整局唯一的额外1回合已启用。' : ''));
}

function kill(s, id, turn, events) {
  killActor(s, id, turn, events);
}

function recover(s, id, events) {
  const p = s.actors[id];
  p.life = 'active'; p.health = R().rescue.restoredHealth; p.energy = Math.max(p.energy, 20); p.warmth = Math.max(35, p.warmth);
  p.mind = Math.max(p.mind, R().rescue.restoredMindMinimum); p.downedAt = null; p.deadline = null; p.deathCause = null; p.careProtect = true; p.crisis = false; p.zeroTurns = 0; p.location = 'service';
  events.push(NAMES[id] + '已获救：健康25、精神至少20。本格受安全照护保护，请继续安排休整。');
}

function cleanupFuture(s, start) {
  for (const id of IDS) {
    if (!['downed', 'dead'].includes(s.actors[id].life)) continue;
    for (let k = start; k < 16; k++) { cancelAt(s, id, k + 6); if (s.actors[id].life === 'downed') s.plan[id][k] = task('wait', [id]); }
  }
}

const NON_REPEAT = new Set(['shop', 'beg', 'bins', 'cards', 'observe', 'oddjob', 'rescue', 'aid', 'wait', 'clinic', 'bath', 'graffiti', 'laundry', 'campclean', 'roof', 'bed', 'helper', 'trio', 'coop', 'danger', 'talk', 'casino']);
export function nextPlan(s) {
  const fallback = { xuan: ['scavenge', 'repair', 'joke', 'rest'], fan: ['kitchen', 'sketch', 'sketch', 'rest'], ma: ['run', 'run', 'rest', 'freecards'] };
  const result = {};
  for (const id of IDS) {
    const p = s.actors[id];
    result[id] = Array.from({ length: 16 }, (_, h) => {
      const k = Math.floor(h / 4);
      if (p.life === 'downed') return task('wait', [id]);
      if (p.life !== 'active') return null;
      const prev = s.plan[id][h];
      if (prev && !prev.group && !NON_REPEAT.has(prev.id) && ACTIONS[prev.id].zone !== 'pick') return task(prev.id, [id]);
      return h % 4 === 0 ? task(fallback[id][k], [id]) : null;
    });
  }
  return result;
}

function chargeCosts(s, costs) {
  let expense = 0;
  for (const [k, v] of Object.entries(costs)) { s[k] -= v; if (k === 'cash') expense += v; }
  return expense;
}

export function settle(input, { controlledActorId = null } = {}) {
  if (input.phase === 'tail') return settleTail(input);
  const check = preflight(input);
  if (check.error) return { state: input, error: check.error, at: check.actorId ? { actorId: check.actorId, hour: check.hour } : null };
  const s = copy(input), events = [], hour = s.hour, boundary = (hour - 5) % 4 === 0;
  beginDayReport(s, { partial: s.daily.report?.day !== s.day });
  const T = s.turn + (boundary ? 1 : 0), slot = s.slot, day = s.day, startAlive = alive(input);
  const completing = [];
  const busySeen = new Set();
  for (const id of IDS) {
    const job = s.busy[id];
    if (!job || busySeen.has(job.jobId)) continue;
    busySeen.add(job.jobId);
    if (job.remainingHours === 1) completing.push({ actor: id, task: job.task, action: ACTIONS[job.task.id] });
  }
  for (const j of check.jobs) {
    const t = j.task, hours = t.hours ?? j.action.hours ?? 1;
    for (const id of t.participants) {
      if (j.action.rescue && id === t.target) continue;
      const p = s.actors[id], cost = p.life === 'active' ? energyCost(input, id, j.action) : 0;
      const paid = Math.min(p.energy, cost);
      p.energy -= paid;
      p.coffeeCredit = Math.max(0, (p.coffeeCredit || 0) - (cost - paid));
    }
    if (hours > 1) {
      const jobId = `${s.day}:${hour}:${j.actor}:${t.id}`;
      for (const id of t.participants) s.busy[id] = { jobId, startedHour: hour, remainingHours: hours, task: copy(t) };
    } else completing.push(j);
  }
  const completedIds = new Set(completing.flatMap((j) => j.task.participants));
  for (const id of IDS) if (s.busy[id]) {
    s.busy[id].remainingHours--;
    if (s.busy[id].remainingHours === 0) s.busy[id] = null;
  }
  s.actionCount += completedIds.size;
  const completedJobs = completing;
  const daytimeSleepers = completedJobs.filter((job) => job.task.id === 'sleep' && job.task.zone === 'camp')
    .flatMap((job) => job.task.participants).filter((id) => s.actors[id]?.life === 'active');
  if (day === 45) {
    const prior = s.lastCompletedHours || {};
    const repairNow = completing.some((j) => j.task.id === 'repair' && j.task.participants.includes('xuan'));
    if (repairNow && prior.xuan?.id === 'repair' && prior.xuan.hour === hour - 1 && !s.flags.trialPassed) {
      s.flags.trialPassed = true;
      events.push('轩哥连续两小时试工通过：老周给了固定维修位，之后每单维修多4。');
    }
    const interviewNow = completing.some((j) => j.task.id === 'interview' && j.task.participants.includes('fan'));
    if (interviewNow && s.actors.ma.life === 'active' && (s.actors.ma.location === 'cinema' || completing.some((j) => j.task.participants.includes('ma') && j.task.zone === 'cinema')) && !s.flags.interviewDone) {
      s.flags.interviewDone = true; s.footage += 1;
      fulfillWish(s, 'fan', 'fan_seen', 'partial', events);
      relation(s, 'reg_xu').trust = clamp(relation(s, 'reg_xu').trust + 1, 0, 5);
      events.push('凡哥的采访有马哥看设备，顺利完成：素材+1，许姐更信任你们。');
    }
  }
  s.lastCompletedHours = s.lastCompletedHours || {};
  for (const j of completing) for (const id of j.task.participants) s.lastCompletedHours[id] = { id: j.task.id, hour };

  const wx = weatherOf(s.seed, day);
  const zones = {}, cared = {}, rested = {}, indoor = {}, mindGain = {}, dirtyWork = {};
  const moves = [], arrivals = [];
  let income = 0, autoIncome = 0, expense = chargeCosts(s, check.costs);
  const jobOutcomes = [];
  for (const { actor: id, task: t, action: a, useVoucher } of completedJobs) {
    let taskIncome = 0;
    if (useVoucher) s.vouchers--;
    for (const m of t.participants) { zones[m] = t.zone; rested[m] = Boolean(a.rest); indoor[m] = Boolean(a.indoor); mindGain[m] = (mindGain[m] || 0) + (a.mind || 0); dirtyWork[m] = Boolean(a.dirty); }
    if (a.aid) {
      recover(s, id, events);
      recordAutomaticWork(s, { actorId: id, participants: t.participants, controlledActorId,
        source: 'job', sourceUid: `h${input.hourTick}:${id}:${t.id}`, label: a.name, hour, income: 0 });
      continue;
    }
    if (a.rescue) recover(s, t.target, events);
    let pay = t.pay ?? a.cash ?? 0;
    // D45 试工通过后，回收巷的老周给轩哥固定维修位：每单多 4。
    if (t.id === 'repair' && s.flags.trialPassed) pay += 4;
    // 熟人委托解锁的加成。
    if (t.id === 'run' && s.flags.chenFixedRun) pay += 3;
    if (t.id === 'shoot' && s.flags.xuContract) pay += 8;
    if (t.id === 'oddjob' && id === 'ma' && t.zone === 'station' && s.flags.chenNightWatch) pay += 10;
    if (t.id === 'carry' && s.items.some((x) => x.itemId === 'cart' && x.container === id)) pay += 6;
    if (pay) { s.cash += pay; income += pay; taskIncome += pay; }
    for (const [k, v] of Object.entries(a.gain || {})) s[k] += v;
    if (a.foodGain) { const n = a.foodGain + (t.id === 'kitchen' && s.flags.liuBonusMeal ? 1 : 0); for (let i = 0; i < n; i++) makeItem(s, 'meal', 'camp'); }
    s.camp.rain += a.camp || 0; s.art += a.art || 0;
    if (a.footage) { s.footage += a.footage; s.clips = s.clips || []; s.clips.push({ day, source: t.id === 'interview' ? '旧影院的采访' : '街头', turn: T }); }
    if (t.id === 'shoot') { s.clips = s.clips || []; s.clips.push({ day, source: '商户宣传的花絮', turn: T }); s.footage += 1; }
    // 三人接力项目：拍摄→剪辑→交付。
    const pj = s.flags.project;
    if (pj && pj.stage === 1 && ['shoot', 'interview'].includes(t.id)) { pj.stage = 2; events.push('宣传片素材拍完了，下一步安排「剪辑小委托」出成品（可用许姐的工作位）。'); }
    else if (pj && pj.stage === 2 && t.id === 'edit') { pj.stage = 3; makeItem(s, 'promo_video', id); events.push(`宣传片剪好了，在${NAMES[id]}包里；第${pj.deadline}天前有人带到老街交付。`); }
    // 剪辑：手里有 3 段素材就剪成一部短片，作品有了来历。
    if (t.id === 'edit' && (s.clips || []).length >= 3) { const used = s.clips.splice(0, 3); s.flags.films = (s.flags.films || 0) + 1; s.footage = Math.max(0, s.footage - 3); const film = recordFilm(s, day, used); events.push(`凡哥把${film.sources.join('、')}剪成了一部短片${filmName(film)}。留在营地的电视晚上能放。`); fulfillWish(s, 'fan', 'fan_seen', 'partial', events); }
    if (a.battery) s.battery = Math.min(5, s.battery + a.battery);
    if (a.begging) {
      const targets = t.targets && t.targets.length ? t.targets : passersby(s, t.zone, slot).filter((n) => !n.asked).map((n) => n.id).slice(0, 3);
      if ((t.style || 'ask') === 'ask') { const meta = Object.fromEntries(passersby(s, t.zone, slot).map((n) => [n.id, { name: n.name, job: n.job }])); const session = beginSession(s, id, t.zone, targets, 'ask', meta); if (session.npcs.length) { if (id === controlledActorId) { arrivals.push({ actorId: id, zone: t.zone, slot, kind: 'beg' }); events.push(`${NAMES[id]}在${t.zone === 'market' ? '老街' : t.zone === 'station' ? '站前街' : t.zone === 'cinema' ? '旧影院' : '服务站'}拦下了${session.npcs.length}位路人，等你开口。`); } else { const before = s.cash; const result = begAuto(s, session); const gained = s.cash - before; autoIncome += gained; taskIncome += gained; if (result.summary) events.push(result.summary); } } else events.push(`${NAMES[id]}想求助，但这里今天已经没有没问过的人。`); }
      else { const r = begAt(s, id, t.zone, targets, events, t.style); income += r.cash; taskIncome += r.cash; }
    }
    if (a.busking) {
      s.flags.cooldown = s.flags.cooldown || {};
      s.flags.cooldown[t.id] = s.day + a.cooldownDays;
      const r = rng(s.seed, `busk:${T}:${id}`);
      if (a.busking === 'phone') { const cash = 8 + Math.floor(r * 8); s.cash += cash; income += cash; taskIncome += cash; events.push(`轩哥的修手机小摊今天来了${2 + Math.floor(r * 4)}个人，收入${cash}。`); }
      else if (r < 0.2) { const p = s.actors[id]; p.mind = clamp(p.mind - 3); events.push('马哥的杯子刚摆好就被城管赶了，白忙一场，精神-3。'); }
      else { const cash = 6 + Math.floor(r * 15); s.cash += cash; income += cash; taskIncome += cash; s.flags.gambles = (s.flags.gambles || 0); events.push(`马哥的猜球小摊收了${cash}块，有个大爷连猜三次都没中。`); }
    }
    if (a.bins) {
      const avail = binsAvailable(s, t.zone).filter((b) => !b.used).slice(0, 2);
      if (!avail.length) events.push(`${NAMES[id]}想翻桶，但这里今天的桶都翻过了。`);
      for (const b of avail) { s.daily.bins[b.id] = id; const board = generateBoard(s, id, b.id); board.name = b.name; if (id === controlledActorId) s.pending.bins.push(board); else { const before = s.cash; const order = board.cells.map((_, i) => i).sort((a, b) => Number(board.cells[a].warned) - Number(board.cells[b].warned)); for (const i of order) { if (board.done) break; revealCell(s, board, i); } if (!board.done) forfeit(board); const gained = s.cash - before; autoIncome += gained; taskIncome += gained; events.push(boardSummary(board)); } }
      if (avail.length) { s.flags.binSkill = s.flags.binSkill || {}; s.flags.binSkill[id] = (s.flags.binSkill[id] || 0) + 1; if (id === controlledActorId) { arrivals.push({ actorId: id, zone: t.zone, slot, kind: 'bins' }); events.push(`${NAMES[id]}蹲到了${avail.map((b) => b.name).join('和')}前，等你一格一格翻。`); } }
    }
    if (a.repairing) { const target = repairTarget(s, id, t.zone); if (target) { const r = repair(s, target.uid, id); if (!r.error) { events.push(`轩哥把${target.name}修好了：现在是${indexById(getData().items)[r.item.itemId]?.name || itemName(r.item.itemId)}。去库存里决定卖、留还是送。`); s.flags.repairs = (s.flags.repairs || 0) + 1; } else events.push('修理没成：' + r.error); } }
    if (a.building && t.facility) { const r = install(s, t.facility.slot, t.facility.kind); events.push(r.error ? '施工没成：' + r.error : r.text); }
    if (t.id === 'repair' && s.items.some((x) => x.itemId === 'toolkit' && x.container === id) && !s.daily.toolkitUsed) s.daily.toolkitUsed = true;
    if (a.bottles) collectBottles(s, id, t.zone, events);
    if (a.fishing) { const bite = fish(s, id, events); if (bite && id !== controlledActorId) { const before = s.cash; const waiting = s.pending.fishingQte.slice(0, -1); s.pending.fishingQte = [bite]; const result = autoResolveFishingQte(s); result.state.pending.fishingQte.unshift(...waiting); Object.assign(s, result.state); taskIncome += s.cash - before; events.push(...result.events); } if (s.pending.riverFight?.actorId !== controlledActorId) s.pending.riverFight = null; }
    if (a.cooking) cookFood(s, id, t.targets[0], events);
    if (a.freeMeal) { makeItem(s, 'meal', id); events.push(`${NAMES[id]}在服务站领到一份免费餐。`); }
    if (a.shopping) {
      if (t.cart && t.cart.length) {
        const v = validateCart(s, id, t.zone, slot, t.cart);
        const made = executeCart(s, id, t.cart, t.destination);
        const tickets = made.filter((x) => x.ticket);
        if (tickets.length) { s.daily.bets -= tickets.length - 1; for (const it of tickets) { it.ticket.face = generateFace(s.seed, it.ticket); it.ticket.revealed = []; } fulfillWish(s, id, 'ma_lottery', 'exact', events); s.flags.gambles = (s.flags.gambles || 0) + 1; }
        for (const it of made) { if (['keyboard', 'headphones'].includes(it.itemId) && id === 'xuan') fulfillWish(s, 'xuan', it.itemId === 'keyboard' ? 'xuan_keyboard' : 'xuan_headphones', 'exact', events); if (it.itemId === 'shoes' && id === 'ma') fulfillWish(s, 'ma', 'ma_shoes', 'exact', events); if (it.container === id || (it.container === 'camp' && s.actors[id].location === 'camp')) fulfillItemWish(s, id, it.itemId, 'obtain', events); }
        const parcelId = made.some((it) => itemDef(it.itemId)?.category === 'furniture') ? s.camp.parcels.at(-1).id : null;
        events.push(`${NAMES[id]}到店买了${t.cart.map((l) => indexById(getData().items)[l.itemId].name + '×' + l.qty).join('、')}，花${v.total}${parcelId ? '，家具送到营地包裹' + parcelId : ''}。`);
      } else arrivals.push({ actorId: id, zone: t.zone, slot });
    }
    if (a.wash) { const p = s.actors[id]; let gain = a.hygiene; const soap = itemsIn(s, id, 'soap')[0]; if (soap) { consumeUse(s, soap.uid); gain = 25; } if (itemsIn(s, id, 'towel')[0]) gain += 5; p.hygiene = clamp(p.hygiene + gain); events.push(`${NAMES[id]}在水点洗漱，卫生+${gain}${soap ? '（用了肥皂）' : ''}。`); }
    if (a.laundry) { const p = s.actors[id]; if (a.needs) { const det = s.items.find((x) => x.itemId === 'detergent' && (x.container === id || x.container === 'camp')); if (det) consumeUse(s, det.uid); } p.clothes = { dirty: false, wet: true, dirtyDays: 0 }; fulfillWish(s, id, 'clean_clothes_wish', 'partial', events); if (a.hygiene >= 55) { p.hygiene = clamp(p.hygiene + a.hygiene); events.push(`${NAMES[id]}洗了澡也洗了衣服：卫生+${a.hygiene}，衣服今晚是湿的。`); } else events.push(`${NAMES[id]}洗了衣服，晾着，今晚是湿的。`); }
    if (a.campClean) { let n = a.campClean; const bag = s.items.find((x) => x.itemId === 'trash_bag' && x.container === 'camp'); if (bag) { consumeUse(s, bag.uid); n += 20; } s.camp.dirt = clamp(s.camp.dirt - n); events.push(`营地整理：脏污-${n}，现在${s.camp.dirt}。`); }
    if (a.clinic) { const p = s.actors[id]; if (s.flags.wangHalfClinic && (a.cost?.cash || 0) > 0 && t.costOverride === null && s.flags.freePlanDay !== s.day) { s.cash += 9; expense -= 9; events.push('王叔打过招呼：诊所评估半价。'); } if (s.flags.freePlanDay === s.day && (a.cost?.cash || 0) > 0 && t.costOverride === null) { s.cash += a.cost.cash; expense -= a.cost.cash; events.push('第57天复查日：诊所评估免费。'); } const d = p.diseases.find((x) => !x.known) || p.diseases.find((x) => !x.plan); if (d) { d.known = true; d.plan = true; events.push(`诊所评估：${NAMES[id]}确诊${d.kind === 'gut' ? '肠胃不适' : d.kind === 'skin' ? '皮肤感染' : d.kind === 'wound' ? '伤口感染' : '受寒虚弱'}，已建立治疗计划，计划用品可生效。`); } else events.push(`诊所评估：${NAMES[id]}没有需要建立计划的病情。`); }
    if (a.needs === 'paint') { const paint = s.items.find((x) => x.itemId === 'paint' && x.container === id); if (paint) consumeUse(s, paint.uid); s.flags.wallPermit = false; }
    if (a.wishExact) for (const m of t.participants) fulfillWish(s, m, a.wishExact, 'exact', events);
    if (a.wishPartial) for (const m of t.participants) fulfillWish(s, m, a.wishPartial, 'partial', events);
    if (a.talk) { for (const m of t.participants) { fulfillWish(s, m, 'xuan_understood', 'exact', events); fulfillWish(s, m, 'fan_seen', 'partial', events); fulfillWish(s, m, 'adult_connection', 'partial', events); } s.daily.talked = true; }
    if (a.equip?.includes('camera')) fulfillWish(s, id, 'fan_camera', 'exact', events);
    if (a.gamble) {
      s.daily.bets++;
      const win = cardOutcome(id, rng(s.seed, `cards:${T}:${id}`), R());
      s.cash += win; income += win; s.flags.gambles = (s.flags.gambles || 0) + 1;
      taskIncome += win;
      events.push(`${NAMES[id]}「${a.name}」返还${win}（含本金），本次净${win - 10}。`);
    }
    for (const m of t.participants) {
      if (a.rescue && m === t.target) continue;
      const p = s.actors[m];
      if (input.actors[m].life !== 'active') continue;
      noteAction(s, m, t.id, t.zone);
      const sleepSurface = t.id === 'sleep' ? sleepSurfaceFor(s, m, t.zone, { presentIds: daytimeSleepers }) : null;
      p.energy = clamp(p.energy + (a.energyGain || 0) + (sleepSurface?.kind === 'bed' ? 10 : 0));
      p.warmth = clamp(p.warmth + (a.warm || 0));
      if (a.hygiene && !a.wash) p.hygiene = clamp(p.hygiene + a.hygiene);
      p.health = clamp(p.health + (a.heal || 0));
      if (a.intox) p.intox = Math.min(2, p.intox + a.intox);
      if (a.work && !a.eventOnly) { if (t.id === 'run') s.flags.runs = (s.flags.runs || 0) + 1; if (t.id === 'repair') s.flags.repairs = (s.flags.repairs || 0) + 1; if (['table', 'edit', 'coop', 'trio', 'shoot'].includes(t.id)) s.flags.fixedJobs = (s.flags.fixedJobs || 0) + 1; }
      if (t.id === 'oddjob' && m === 'ma') s.flags.runs = (s.flags.runs || 0) + 1;
      if (t.id === 'run' && (s.flags.runs || 0) % 3 === 0) relation(s, 'reg_chen').trust = clamp(relation(s, 'reg_chen').trust + 1, 0, 5);
      if (t.id === 'kitchen') relation(s, 'reg_liu').trust = clamp(relation(s, 'reg_liu').trust + 1, 0, 5);
      if (['scavenge', 'repair'].includes(t.id) && (s.daily.orders[t.id] || 0) === 0) relation(s, 'reg_lu').trust = clamp(relation(s, 'reg_lu').trust + (rng(s.seed, 'lu:' + T) < 0.4 ? 1 : 0), 0, 5);
      if (['graffiti', 'interview'].includes(t.id)) relation(s, 'reg_xu').trust = clamp(relation(s, 'reg_xu').trust + 1, 0, 5);
      if (['warm', 'wash'].includes(t.id) && rng(s.seed, 'wang:' + T + m) < 0.35) relation(s, 'reg_wang').trust = clamp(relation(s, 'reg_wang').trust + 1, 0, 5);
      if (a.injury) { let hit = a.injury[0] + Math.floor(rng(s.seed, `injury:${day}:${hour}:${m}`) * (a.injury[1] - a.injury[0] + 1)); if (m === 'ma') hit = Math.ceil(hit * 0.75); p.health = clamp(p.health - hit); p.exposure.wound = true; events.push(NAMES[m] + '危险劳动事故伤害' + hit + '，留下伤口。'); setDowned(s, m, s.turn, '危险劳动', events); }
      if (a.work && !['camp', 'service'].includes(t.zone) && !s.daily.misfortune.includes(m) && T > 3) {
        s.daily.misfortune.push(m);
        if (rng(s.seed, `misfortune:${day}:${m}`) < (m === 'ma' ? 0.25 : 0.12)) { p.energy = clamp(p.energy - 4); p.hygiene = clamp(p.hygiene - 3); events.push(NAMES[m] + '遇到小倒霉：' + misfortuneLine(s, `mis:${day}:${m}`) + '，多花体力4、卫生3。'); }
      }
      if (t.care && m === id) {
        const it = findItem(s, t.care.itemUid);
        const d = p.diseases.find((x) => x.uid === t.care.diseaseUid);
        if (it && d && consumeUse(s, it.uid)) {
          if (t.care.support) d.supportUntil = T + 1; else if (t.care.relief) d.reliefUntil = T + 1; else { cared[m] = cared[m] || new Set(); cared[m].add(d.uid); }
          p.exposure.cared = true; if (d.kind === 'wound') p.exposure.woundCovered = true;
          events.push(`${NAMES[m]}完成了一次护理（${indexById(getData().items)[it.itemId].name}）。`);
        }
      }
    }
    const sourceUid = `h${input.hourTick}:${id}:${t.id}`;
    recordAutomaticWork(s, { actorId: id, participants: t.participants, controlledActorId,
      source: 'job', sourceUid, label: a.name, hour, income: taskIncome });
    if (['scavenge', 'bottles', 'kitchen', 'repair', 'table', 'shoot', 'edit', 'run', 'carry', 'coop', 'trio', 'danger', 'oddjob', 'phonestall', 'shellgame'].includes(t.id)) {
      jobOutcomes.push({ actorId: id, participants: t.participants, sourceUid, basePay: t.id === 'bottles' ? 0 : taskIncome, variant: t.id });
    }
  }
  for (const id of startAlive) {
    const before = input.actors[id].location;
    const to = zones[id] || (s.actors[id].life === 'downed' ? before : before);
    if (s.actors[id].life === 'active' || s.actors[id].life === 'downed') s.actors[id].location = zones[id] === 'pick' ? before : (zones[id] || before);
    if (s.actors[id].life === 'active') fulfillReachedItemWishes(s, id, events);
    if (before !== s.actors[id].location) moves.push({ actorId: id, from: before, to: s.actors[id].location });
  }
  settleReserved(s, zones, events);
  s.daily.orders = check.counts;
  s.hourTick += 1;
  const casinoVisit = completedJobs.find((job) => job.action.casinoVisit);
  if (casinoVisit) {
    const invited = inviteCasino(s, casinoVisit.actor).state;
    s.casinoVenue = invited.casinoVenue;
    s.pending ??= {};
    s.pending.casino = invited.pending.casino;
    events.push(`${NAMES[casinoVisit.actor]}进入棋牌馆，先看看牌局再决定是否买入。`);
  }
  const facts = s.periodFacts || (s.periodFacts = { zones: {}, cared: {}, rested: {}, indoor: {}, mindGain: {}, dirtyWork: {} });
  for (const id of IDS) {
    if (zones[id]) facts.zones[id] = zones[id];
    if (cared[id]) facts.cared[id] = [...new Set([...(facts.cared[id] || []), ...cared[id]])];
    if (rested[id]) facts.rested[id] = true;
    if (indoor[id]) facts.indoor[id] = true;
    facts.mindGain[id] = (facts.mindGain[id] || 0) + (mindGain[id] || 0);
    if (dirtyWork[id]) facts.dirtyWork[id] = true;
  }
  if (boundary) {
    s.turn = T;
    for (const id of IDS) { zones[id] = facts.zones[id] || s.actors[id].location; cared[id] = new Set(facts.cared[id] || []); rested[id] = facts.rested[id]; indoor[id] = facts.indoor[id]; mindGain[id] = facts.mindGain[id]; dirtyWork[id] = facts.dirtyWork[id]; }
    delete s.periodFacts;

  // 吃饭与环境
  // 每回合饱食 -10：两餐 60 减一天 50 留 10 的余量，一次缺餐才追得回来。
  for (const id of startAlive) s.actors[id].food = clamp(s.actors[id].food - 10);
  if (slot === 1 || slot === 3) {
    for (const id of [...startAlive].sort((a, b) => s.actors[a].food - s.actors[b].food)) {
      const got = eatOne(s, id);
      if (got) { s.actors[id].food = clamp(s.actors[id].food + FOOD_VALUE[got.itemId]); if (got.dirty) s.actors[id].exposure.dirtyFood = true; if (got.itemId === 'hot_soup') fulfillWish(s, id, 'good_meal', 'exact', events); awardTableMeal(s, id, zones[id], events); }
      else events.push(NAMES[id] + '缺一份饭。');
    }
  }
  for (const id of startAlive) {
    const p = s.actors[id];
    if (p.life !== 'active') continue;
    const zone = zones[id];
    const sheltered = indoor[id] || (zone === 'camp' && s.camp.rain >= 2);
    if (!sheltered) p.warmth = clamp(p.warmth - wx.out - (p.clothes.wet ? 6 : 0));
    const hunger = p.food <= 15 ? 6 : 0, cold = p.warmth <= 20 ? 6 : 0;
    const { pressure, breakdown } = tickWishes(s, id);
    // 饿着、冻着、衣服湿着都磨精神；这些不受愿望封顶，但每格合计不超过 3。
    const bodilyLoss = Math.min(1, (p.food <= 20 ? 1 : 0) + (p.warmth <= 20 ? 1 : 0) + (p.clothes.wet ? 1 : 0) + (p.diseases.some((d) => d.severity >= 30) ? 1 : 0));
    const crisisDamage = mentalTick(s, id, pressure, (mindGain[id] || 0) - bodilyLoss, events);
    if (breakdown.length) events.push(`${NAMES[id]}愿望压力：${breakdown.map((b) => { const w = s.wishes.find(x => x.uid === b.uid); return (w?.targetItem ? `想要${indexById(getData().items)[w.targetItem]?.name}` : getData().wishTemplates.find(t => t.id === b.templateId)?.name) + '-' + b.loss; }).join('、')}（本格合计-${pressure}）。`);
    const dDamage = progressDiseases(s, id, { dirty: p.hygiene < 25 || dirtyWork[id], rested: rested[id], warmPlace: sheltered, cared: cared[id] }, events);
    const reasons = [];
    if (hunger) reasons.push('饥饿');
    if (cold) reasons.push('失温');
    if (crisisDamage) reasons.push('精神崩溃');
    if (dDamage) reasons.push('病情');
    // 极端污秽保底：卫生 ≤10 连续 8 个行动回合必得轻度皮肤感染（第 4 回合起 UI 有倒计时）。
    if (p.hygiene <= R().hygiene.criticalDirtyThreshold) p.dirtyStreak += 1; else p.dirtyStreak = 0;
    if (p.dirtyStreak >= R().hygiene.criticalDirtyConsecutiveTurns) { p.dirtyStreak = 0; if (!p.diseases.some((d) => d.kind === 'skin') && !(p.immune.skin > s.day)) addDisease(s, id, 'skin', 20, '极端污秽持续8回合', events); }
    const protect = p.careProtect;
    p.careProtect = false;
    if (!protect) p.health = clamp(p.health - hunger - cold);
    if (reasons.length && (hunger || cold)) events.push(`${NAMES[id]}受到${reasons.join('+')}伤害。`);
    setDowned(s, id, T, reasons.join('+') || '重伤', events);
  }
  for (const id of startAlive) { const p = s.actors[id]; if (p.life === 'downed' && p.deadline <= T) kill(s, id, T, events); }
  tickFavors(s, events, false);
  }
  s.ledger.income += income; s.ledger.expense += expense;
  const actions = completedJobs.map((j) => j.task.participants.map((id) => NAMES[id]).join('+') + '「' + j.action.name + '」').join('；');
  s.log.unshift(`第${day}天${SLOTS[slot]}（回合${T}）：${actions}。收入${income + autoIncome}，支出${expense}。`);
  let night = null;
  if (hour === 21) night = settleNight(s, day, wx, events);
  for (const job of jobOutcomes) {
    if (!job.participants.includes(controlledActorId) || s.actors[controlledActorId]?.life !== 'active' || s.actors[job.actorId]?.life !== 'active') continue;
    const opened = startWorkGame(s, { actorId: job.actorId, controllerId: controlledActorId,
      participants: job.participants, source: 'job', sourceUid: job.sourceUid,
      basePay: job.basePay, variant: job.variant });
    if (opened.gameId) { Object.assign(s, opened.state); events.push(`${NAMES[controlledActorId]}有一局工作挑战待完成。`); }
  }
  if (hour === 21) finishDayReport(s);
  if (s.metMa && alive(s).length === 0) s.phase = 'gameover';
  else if (hour === 17 && day === 1 && !s.metMa) s.phase = 'meeting';
  else if (day === 100 && hour === 21) s.phase = alive(s).some((id) => s.actors[id].life === 'downed') ? 'tail' : 'ending';
  if (['gameover', 'ending'].includes(s.phase)) { cleanupFuture(s, planIndex(hour) + 1); s.ending = computeEnding(s); }
  else if (s.phase === 'tail') { s.tailTurns = 0; for (const id of IDS) s.plan[id] = Array.from({ length: 16 }, () => (s.actors[id].life === 'downed' ? task('wait', [id]) : s.actors[id].life === 'active' ? task('rest', [id]) : null)); s.hour = 22; s.slot = 3; events.push('第100天末夜有人濒死：进入救援尾声，最多两个回合，只处理救援。'); }
  else if (hour === 21) startNewDay(s, events);
  else { s.hour++; s.slot = slotOfHour(s.hour); cleanupFuture(s, planIndex(s.hour)); }
  if (boundary && s.phase === 'planning') directorTick(s, events);
  for (const m of events) s.log.unshift(m);
  s.log = s.log.slice(0, 120);
  s.stateRevision += 1;
  s.lastTx = `${s.seed}:${day}:${hour}`;
  s.effectiveFood = foodEquivalent(s);
  s.weatherKind = weatherOf(s.seed, s.day).kind;
  return { state: s, events, night, moves, arrivals, txId: s.lastTx };
}

function settleNight(s, day, wx, events) {
  const need = alive(s);
  const spot = s.flags.nightSpot === 'station' ? 'station' : (s.flags.shelterDay === day || s.flags.nightSpot === 'shelter') ? 'shelter' : 'camp';
  const shelter = spot === 'shelter';
  const sleepSurfaces = Object.fromEntries(need.map((id) => [id, sleepSurfaceFor(s, id, spot, { sleepingIds: need })]));
  if (spot === 'station') events.push('今晚全员在候车室过夜。');
  nightScripted(s, events);
  // 刘姐赊账：没饭又没钱时先给一份，次日有钱再还。
  if (s.flags.liuCredit && foodEquivalent(s) === 0 && s.cash < 8) { makeItem(s, 'meal', 'camp'); s.flags.liuDebt = (s.flags.liuDebt || 0) + 8; events.push('刘姐赊了一份饭，明天记得还8块。'); }
  // 毯子是个人寝具：自己包里的先归自己，营地箱里的按床位顺序一人一条，不重复给三人加成。
  const spareBlankets = s.items.filter((x) => x.itemId === 'blanket' && !x.wet && x.container === 'camp');
  const blanketOf = {};
  for (const id of s.camp.bedPriority.filter((x) => need.includes(x))) {
    const own = s.items.find((x) => x.itemId === 'blanket' && !x.wet && x.container === id);
    blanketOf[id] = own || spareBlankets.shift() || null;
  }
  for (const id of need) {
    const p = s.actors[id];
    p.food = clamp(p.food - 10);
    // 睡前还饿且有余粮：再吃一份，把白天欠的补回来。
    if (p.food <= 30) { const got = eatOne(s, id); if (got) { p.food = clamp(p.food + FOOD_VALUE[got.itemId]); if (got.dirty) p.exposure.dirtyFood = true; awardTableMeal(s, id, spot, events); events.push(NAMES[id] + '睡前又吃了一份。'); } }
    if (p.life === 'active') {
      const dryBed = sleepSurfaces[id]?.kind === 'bed' || sleepSurfaces[id]?.kind === 'shelter';
      const blanket = blanketOf[id];
      if (p.intox >= 2) p.hangoverDay = day + 1;
      p.energy = p.hangoverDay === day + 1 ? 80 : 100;
      p.mind = clamp(p.mind + (dryBed ? 3 : 1) - (shelter ? 1 : 0));
      if (shelter) p.warmth = clamp(p.warmth + 10);
      else if (spot === 'station') { p.warmth = clamp(p.warmth - Math.ceil(wx.night / 2) + (blanket ? 6 : 0)); p.mind = clamp(p.mind - 2); p.hygiene = clamp(p.hygiene - 2); if (rng(s.seed, `evict:${day}:${id}`) < 0.3) { p.mind = clamp(p.mind - 3); p.energy = clamp(p.energy - 5); events.push(NAMES[id] + '半夜被保安赶出候车室，精神-3、体力-5。'); } }
      else if (dryBed && s.camp.rain >= 2) p.warmth = clamp(p.warmth + 8 + (blanket ? 6 : 0));
      else p.warmth = clamp(p.warmth - wx.night - (p.clothes.wet ? 6 : 0) + (blanket ? 6 : 0));
      if (!dryBed && spot === 'camp') events.push(NAMES[id] + '没有干燥床位，夜间更易失温。');
      if (p.food > 15 && p.warmth > 20) p.health = clamp(p.health + 2);
      const hunger = p.food <= 15 ? 6 : 0, cold = p.warmth <= 20 ? 6 : 0;
      if (!p.careProtect) p.health = clamp(p.health - hunger - cold);
      p.careProtect = false;
      if (cold && !dryBed && !p.diseases.some((d) => d.kind === 'chill') && rng(s.seed, `chill:${day}:${id}`) < 0.4) addDisease(s, id, 'chill', 15, '夜里冻着了', events);
      for (const d of p.diseases) if (dryBed && d.severity < 30) d.severity = Math.max(1, d.severity - R().disease.safeSleepMildSeverityReduction);
      p.hygiene = clamp(p.hygiene - 4 - (s.camp.dirt >= 60 ? 2 : 0) - (p.clothes.dirty ? 2 : 0));
      p.clothes.dirtyDays += 1;
      if (p.clothes.dirtyDays >= 3) p.clothes.dirty = true;
      if (p.clothes.wet && (dryBed || shelter) && !['rain', 'storm'].includes(wx.kind)) p.clothes.wet = false;
      nightExposure(s, id, events);
      setDowned(s, id, s.turn, '夜间饥寒', events);
      p.location = shelter ? 'service' : spot === 'station' ? 'station' : 'camp';
      if (p.life === 'active') fulfillReachedItemWishes(s, id, events);
    }
    p.intox = 0; p.smokes = 0; p.jokeUsed = false; p.coffeeNight = false; p.grief = Math.max(0, p.grief - 1);
  }
  // 篝火：营地过夜时烧燃料取暖（纸板优先）；晾晒架让湿东西一晚必干。
  let fire = false;
  if (spot === 'camp' && need.length) {
    const before = fuelCount(s);
    const bonus = nightWarmthBonus(s, wx.kind);
    const burned = before - fuelCount(s);
    fire = burned > 0;
    for (const id of need) if (s.actors[id].life === 'active') s.actors[id].warmth = clamp(s.actors[id].warmth + bonus);
    if (burned > 0) events.push(`篝火烧了${burned}单位燃料，每人保暖+${bonus}${bonus < 10 ? '（燃料不够，火小）' : ''}。`);
    else events.push('没有燃料生火，夜里只能硬扛。');
  }
  // 放映：营地过夜、没人濒死、电视在营地箱里、有短片、有燃料。篝火先烧，放映另烧一单位。
  const screening = spot === 'camp' && !need.some((id) => s.actors[id].life === 'downed') ? nightScreening(s, day, wx, need.filter((id) => s.actors[id].life === 'active'), events) : null;
  const dryingRack = hasFacility(s, 'drying_rack');
  for (const id of need) { const p = s.actors[id]; if (p.clothes.wet && dryingRack) p.clothes.wet = false; }
  if (s.items.some((x) => x.itemId === 'thermos')) { for (const id of need) if (s.actors[id].life === 'active') s.actors[id].food = clamp(s.actors[id].food + 5); events.push('刘姐的保温桶里还有热的：每人饱食+5。'); }
  if (hasFacility(s, 'display_rack') && s.art > 0 && s.actors.fan.life === 'active') { s.actors.fan.mind = clamp(s.actors.fan.mind + 1); }
  if (hasRadio(s)) { const lines = bulletin(s, { forecast: forecast(s.seed, s.day), closedTomorrow: [] }); s.radioLast = lines; for (const l of lines) events.push('收音机：' + l.text); }
  for (const it of s.items) if (it.wet && it.container === 'camp' && (dryingRack || !['rain', 'storm'].includes(wx.kind))) it.wet = false;
  s.camp.dirt = clamp(s.camp.dirt + 3 + (spot === 'camp' ? need.length : 0));
  delete s.flags.nightSpot;
  return { day, ...s.ledger, end: s.cash, food: foodEquivalent(s), survivors: need.length, beds: s.camp.beds, shelter, spot, sleepSurfaces, fire, screening };
}

function startNewDay(s, events) {
  s.day++; s.hour = 6; s.slot = 0; s.busy = { xuan: null, fan: null, ma: null }; s.daily = freshDaily(); s.ledger = { start: s.cash, income: 0, expense: 0 };
  beginDayReport(s);
  for (const id of IDS) s.actors[id].coffeeCredit = 0;
  tickFavors(s, events, true);
  tickLoans(s, events);
  if (s.flags.project && s.day > s.flags.project.deadline) { relation(s, 'reg_liu').trust = clamp(relation(s, 'reg_liu').trust - 1, 0, 5); events.push('宣传片过了交付日，商户找了别人：刘姐信任-1。'); s.items = s.items.filter((x) => x.itemId !== 'promo_video'); s.flags.project = null; s.flags.projectFailed = (s.flags.projectFailed || 0) + 1; }
  if (s.flags.liuDebt > 0 && s.cash >= s.flags.liuDebt) { s.cash -= s.flags.liuDebt; s.ledger.expense += s.flags.liuDebt; events.push(`还了刘姐赊的饭钱${s.flags.liuDebt}。`); s.flags.liuDebt = 0; }
  const dropped = discardExpired(s);
  if (dropped) events.push(`${dropped}份食物过期丢弃。`);
  restockMorning(s);
  generateMorningWishes(s, events);
  s.plan = nextPlan(s);
  s.pendingMorning = morningNode(s);
  cleanupFuture(s, 0);
  const wx = weatherOf(s.seed, s.day);
  events.push(`第${s.day}天：${wx.label}，${wx.temp}°C。`);
}

// 尾声：T401—402 只处理救援，不发工资、不吃饭、不生成事件。
function settleTail(input) {
  const check = preflight(input);
  if (check.error) return { state: input, error: check.error };
  const s = copy(input), events = [], T = s.turn + 1;
  let expense = 0;
  for (const j of check.jobs) {
    const { actor: id, task: t, action: a } = j;
    if (a.aid) { if (j.useVoucher) s.vouchers--; else { if (s.cash < R().rescue.serviceCost) { events.push(NAMES[id] + '联系救助失败：现金不足20。'); continue; } s.cash -= R().rescue.serviceCost; expense += R().rescue.serviceCost; } recover(s, id, events); }
    else if (a.rescue) { if (s.cash < 12) { events.push('陪同送援失败：现金不足12。'); continue; } s.cash -= 12; expense += 12; recover(s, t.target, events); }
  }
  for (const id of alive(s)) { const p = s.actors[id]; if (p.life === 'downed' && p.deadline <= T) kill(s, id, T, events); }
  s.turn = T; s.hour = 22 + (T - 400); s.tailTurns += 1; s.ledger.expense += expense;
  if (!alive(s).some((id) => s.actors[id].life === 'downed') || T >= R().rescue.tailMaxGlobalTurn) { s.phase = alive(s).length ? 'ending' : 'gameover'; s.ending = computeEnding(s); }
  else { for (const id of IDS) s.plan[id] = Array.from({ length: 16 }, () => (s.actors[id].life === 'downed' ? task('wait', [id]) : s.actors[id].life === 'active' ? task('rest', [id]) : null)); }
  s.log.unshift(`救援尾声回合${T}：${events.join('') || '没有变化。'}`);
  for (const m of events) s.log.unshift(m);
  s.stateRevision += 1;
  s.lastTx = `${s.seed}:100:${s.hour - 1}`;
  return { state: s, events, night: null, moves: [], arrivals: [], txId: s.lastTx };
}
