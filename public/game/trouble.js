// 街头冲突：小混混拦路与城管清理。数值全在顶部常量；函数只改传入的 state，和事件效果函数同一约定。
import { getData } from './data.js';
import { rng } from './rng.js';
import { clamp, makeDowned } from './rules.js';
import { relation } from './npcs.js';
import { itemsIn, removeItem } from './items.js';
import { currentTask } from './clock.js';

export const C = {
  // 战力 = 体力×0.6 + 健康×0.4（0–1），累了病了都打不动。
  power: { energy: 0.6, health: 0.4 },
  // 马哥命硬又混过江湖；同街区同时段每多一个队友混混就怯一分。
  maBonus: 0.3, allyBonus: 0.35,
  // 两个混混的战力区间；城管硬顶几乎赢不了，赢了也没收益。
  thugPower: [0.9, 1.3], chengguanPower: [1.6, 2.1],
  // 三档伤：轻伤只掉健康；中伤留伤口要护理；重伤再扣体力，可能当场濒死。
  injury: { light: [4, 8], medium: [10, 16], heavy: [20, 30] }, heavyEnergy: 20,
  // 输赢差距决定伤情：差不多就是皮外伤，被碾压才是重伤。
  margin: { medium: 0.3, heavy: 0.75 },
  winScratch: 0.3, maDamageScale: 0.75,
  winMind: 4, loseMind: 6, talkFailMind: 3,
  // 输了被搜身：最多 15 块；没钱就拿走一件随身物。
  robCap: 15, payRange: [5, 10],
  runEnergy: 8, runHygiene: 3, runDropChance: 0.2,
  // 打赢后混混 10 天不敢来；给钱会被记住，再来的概率按次数涨。
  respectDays: 10, thugTaxStep: 0.15,
  // 说话：轩哥靠精神讲道理，凡哥靠相机说在拍纪录片，马哥靠老陈的名头。
  talk: { xuanBase: 0.35, xuanMind: 0.5, fanCamera: 0.7, fanNoCamera: 0.3, maBase: 0.4, maTrust: 0.12 },
  // 城管：罚款 20–40；讲理基础五成，王叔信任≥3 加 0.25，有队友加 0.15；收拾走人默认没收瓶罐纸板，没有就丢半格钱。
  fineRange: [20, 40], reasonBase: 0.5, reasonWang: 0.25, reasonAlly: 0.15, reasonCap: 0.9, leaveCash: 8,
  // 营地清场：D10 起每天 12% 抽一次，隔 7 天；搬走丢纸板和 1 单位木料，不搬一半概率坏设施否则罚 20。
  clearingDay: 10, clearingChance: 0.12, clearingCooldownDays: 7, clearingFine: 20,
};

const NAMES = (state, id) => state.names[id];

export function fightPower(state, actorId, allies = []) {
  const p = state.actors[actorId];
  let power = (p.energy / 100) * C.power.energy + (p.health / 100) * C.power.health;
  if (actorId === 'ma') power += C.maBonus;
  power += allies.filter((id) => state.actors[id]?.life === 'active').length * C.allyBonus;
  return power;
}

// 同街区同时段的队友：按当前格的排程看谁也在那条街。
export function alliesAt(state, actorId, district) {
  return Object.keys(state.actors).filter((id) => id !== actorId && state.actors[id].life === 'active' && currentTask(state, id)?.zone === district);
}

function roll(state, key, i) { return rng(state.seed, `trouble:${key}:${i}`); }
function between(r, [lo, hi]) { return lo + Math.floor(r * (hi - lo + 1)); }

// 受伤落到人身上；健康归零就按救援规则濒死，结算里的濒死检查会因为 life 已变而跳过。
export function applyInjury(state, actorId, severity, key, events) {
  const p = state.actors[actorId];
  if (severity === 'none') return { severity, health: 0, wound: false };
  let health = between(roll(state, key, 'dmg'), C.injury[severity]);
  if (actorId === 'ma') health = Math.ceil(health * C.maDamageScale);
  p.health = clamp(p.health - health);
  const wound = severity !== 'light';
  if (wound) p.exposure.wound = true;
  if (severity === 'heavy') p.energy = clamp(p.energy - C.heavyEnergy);
  if (p.health <= 0 && p.life === 'active') {
    const r = makeDowned(actorId, state.turn, p.gritUsed, getData().rules);
    p.life = 'downed'; p.downedAt = state.turn; p.deadline = r.deadline; p.deathCause = '打架重伤'; p.gritUsed = r.gritUsed;
    events.push(`${NAMES(state, actorId)}被打倒了，濒死：须在回合${p.deadline}结束前获救。`);
  }
  return { severity, health, wound };
}

const INJURY_TEXT = {
  light: (n) => `${n}挨了两下，皮外伤`,
  medium: (n) => `${n}的手划破了，流了不少血。今晚不护理，伤口会感染`,
  heavy: (n) => `${n}被按在地上打，站起来的时候直晃。伤口要马上护理`,
};

function fight(state, opts, events) {
  const { kind, actorId, allies, key } = opts;
  const mine = fightPower(state, actorId, allies);
  const theirs = between(roll(state, key, 'them') , [0, 100]) / 100 * ((kind === 'chengguan' ? C.chengguanPower : C.thugPower)[1] - (kind === 'chengguan' ? C.chengguanPower : C.thugPower)[0]) + (kind === 'chengguan' ? C.chengguanPower : C.thugPower)[0];
  const win = roll(state, key, 'win') < mine / (mine + theirs);
  return applyFightOutcome(state, { ...opts, mine, theirs, win }, events);
}

export function applyFightOutcome(state, opts, events = []) {
  const { kind, actorId, allies = [], key, mine, theirs, win } = opts;
  const margin = theirs - mine;
  const p = state.actors[actorId];
  const n = NAMES(state, actorId);
  const result = { outcome: win ? 'win' : 'lose', injuries: {}, cash: 0, items: [], mind: 0, text: '' };
  if (win) {
    const scratch = opts.scratch ?? roll(state, key, 'scratch') < C.winScratch;
    result.injuries[actorId] = applyInjury(state, actorId, scratch ? 'light' : 'none', key, events);
    p.mind = clamp(p.mind + C.winMind); result.mind = C.winMind;
    if (kind === 'thugs') { state.flags.thugRespect = state.day + C.respectDays; result.text = `${n}${allies.length ? '和' + allies.map((id) => NAMES(state, id)).join('、') : ''}把两个混混打跑了${scratch ? '，' + INJURY_TEXT.light(n) : ''}。这片十天内他们不会再来。精神+${C.winMind}。`; }
    else result.text = `${n}挣开了，人没被带走${scratch ? '，' + INJURY_TEXT.light(n) : ''}。什么也没捞着，摊也没了。`;
    return result;
  }
  const severity = opts.severity || (margin >= C.margin.heavy ? 'heavy' : margin >= C.margin.medium ? 'medium' : 'light');
  result.injuries[actorId] = applyInjury(state, actorId, severity, key, events);
  p.mind = clamp(p.mind - C.loseMind); result.mind = -C.loseMind;
  const hurt = INJURY_TEXT[severity](n) + `：健康-${result.injuries[actorId].health}`;
  if (kind === 'thugs') {
    const take = Math.min(C.robCap, state.cash);
    if (take > 0) { state.cash -= take; state.ledger.expense += take; result.cash = -take; result.text = `${n}打输了。${hurt}，兜里的${take}块被翻走。精神-${C.loseMind}。`; }
    else {
      const bag = itemsIn(state, actorId);
      if (bag.length) { const it = bag[Math.floor(roll(state, key, 'rob') * bag.length)]; removeItem(state, it.uid); result.items.push(it.itemId); result.text = `${n}打输了。${hurt}，兜里没钱，${itemName(it.itemId)}被拿走了。精神-${C.loseMind}。`; }
      else result.text = `${n}打输了。${hurt}，身上什么都没有，对方骂骂咧咧走了。精神-${C.loseMind}。`;
    }
  } else {
    const fine = Math.min(state.cash, between(roll(state, key, 'fine'), C.fineRange));
    state.cash -= fine; state.ledger.expense += fine; result.cash = -fine;
    banStalls(state);
    result.text = `${n}跟城管动了手，被按住了。${hurt}，罚了${fine}块，今天这条街不能再摆摊。精神-${C.loseMind}。`;
  }
  return result;
}

function itemName(itemId) { return getData().items.find((x) => x.id === itemId)?.name || itemId; }

// 今天不能再摆摊：借用结算里已有的冷却检查。ponytail: 不分街区，够用；要按街区禁再加 zone 字段。
function banStalls(state) {
  state.flags.cooldown = state.flags.cooldown || {};
  for (const id of ['phonestall', 'shellgame']) state.flags.cooldown[id] = Math.max(state.flags.cooldown[id] || 0, state.day + 1);
}

function talkChance(state, actorId) {
  const p = state.actors[actorId];
  if (actorId === 'xuan') return C.talk.xuanBase + (p.mind / 100) * C.talk.xuanMind;
  if (actorId === 'fan') return itemsIn(state, 'fan').some((x) => ['old_camera', 'camera'].includes(x.itemId)) ? C.talk.fanCamera : C.talk.fanNoCamera;
  return C.talk.maBase + relation(state, 'reg_chen').trust * C.talk.maTrust;
}

const TALK_LINE = { xuan: '“哥，我这电脑包比你俩加起来都轻，真没油水。”', fan: '“别动，这是纪录片，镜头开着呢。”', ma: '“老陈的人，站口装卸的那个。你俩认识吧？”' };

// 混混：给烟 / 给钱 / 说话 / 跑 / 硬顶。
function thugs(state, opts, events) {
  const { actorId, choice, key } = opts;
  const p = state.actors[actorId];
  const n = NAMES(state, actorId);
  const result = { outcome: choice, injuries: {}, cash: 0, items: [], mind: 0, text: '' };
  if (choice === 'smoke') {
    const c = itemsIn(state, actorId, 'cigarette').find((x) => x.uses > 0);
    if (!c) return { error: '包里没烟' };
    c.uses -= 1; if (c.uses <= 0) removeItem(state, c.uid);
    result.items.push('cigarette'); result.text = `${n}递了根烟，对方点上，抬抬下巴让开了。`;
    return result;
  }
  if (choice === 'pay') {
    const amount = between(roll(state, key, 'pay'), C.payRange);
    if (state.cash < amount) return { error: `现金不够${amount}` };
    state.cash -= amount; state.ledger.expense += amount; result.cash = -amount;
    state.flags.thugTax = (state.flags.thugTax || 0) + 1;
    result.text = `${n}掏了${amount}块。对方数了数，记住了这张脸。`;
    return result;
  }
  if (choice === 'talk') {
    const ok = roll(state, key, 'talk') < talkChance(state, actorId);
    if (ok) { p.mind = clamp(p.mind + 2); result.mind = 2; result.text = `${n}：${TALK_LINE[actorId]}对方愣了一下，走了。精神+2。`; return result; }
    result.injuries[actorId] = applyInjury(state, actorId, 'light', key, events);
    p.mind = clamp(p.mind - C.talkFailMind); result.mind = -C.talkFailMind;
    result.text = `${n}：${TALK_LINE[actorId]}对方没听完就推了一把，${INJURY_TEXT.light(n)}：健康-${result.injuries[actorId].health}。精神-${C.talkFailMind}。`;
    return result;
  }
  if (choice === 'run') {
    p.energy = clamp(p.energy - C.runEnergy); p.hygiene = clamp(p.hygiene - C.runHygiene);
    const bag = itemsIn(state, actorId);
    if (bag.length && roll(state, key, 'drop') < C.runDropChance) { const it = bag[Math.floor(roll(state, key, 'dropwhich') * bag.length)]; removeItem(state, it.uid); result.items.push(it.itemId); result.text = `${n}绕了两条街才甩掉他们，体力-${C.runEnergy}、卫生-${C.runHygiene}，${itemName(it.itemId)}跑丢了。`; }
    else result.text = `${n}绕了两条街才甩掉他们，体力-${C.runEnergy}、卫生-${C.runHygiene}。混混没追。`;
    return result;
  }
  if (choice === 'fight') return fight(state, { ...opts, kind: 'thugs' }, events);
  return { error: '没有这个选项' };
}

// 城管：收拾走人 / 交罚款 / 讲理 / 硬顶。
function chengguan(state, opts, events) {
  const { actorId, choice, key, allies } = opts;
  const p = state.actors[actorId];
  const n = NAMES(state, actorId);
  const result = { outcome: choice, injuries: {}, cash: 0, items: [], mind: 0, text: '' };
  const leave = () => {
    if ((state.bottles || 0) > 0 || (state.cardboard || 0) > 0) { result.items.push('bottles', 'cardboard'); state.bottles = 0; state.cardboard = 0; return '瓶罐和纸板被没收了'; }
    const lost = Math.min(state.cash, C.leaveCash); state.cash -= lost; state.ledger.expense += lost; result.cash -= lost; return `半格的摊钱${lost}块没了`;
  };
  if (choice === 'leave') { result.text = `${n}收拾东西走人，${leave()}。人没事。`; return result; }
  if (choice === 'fine') {
    const fine = between(roll(state, key, 'fine'), C.fineRange);
    if (state.cash < fine) return { error: `罚款要${fine}，现金不够` };
    state.cash -= fine; state.ledger.expense += fine; result.cash = -fine;
    result.text = `${n}交了${fine}块罚款，东西保住了。`;
    return result;
  }
  if (choice === 'reason') {
    let chance = C.reasonBase + (relation(state, 'reg_wang').trust >= 3 ? C.reasonWang : 0) + (allies.length ? C.reasonAlly : 0);
    chance = Math.min(C.reasonCap, chance);
    if (roll(state, key, 'reason') < chance) { p.mind = clamp(p.mind + 2); result.mind = 2; result.text = `${n}说得在理，对方摆摆手：“今天算了，下回别在这儿。”精神+2。`; return result; }
    const fine = Math.min(state.cash, C.fineRange[0]);
    state.cash -= fine; state.ledger.expense += fine; result.cash = -fine;
    result.text = `${n}讲了半天，对方不听。罚了${fine}块，${leave()}。`;
    return result;
  }
  if (choice === 'fight') return fight(state, { ...opts, kind: 'chengguan' }, events);
  return { error: '没有这个选项' };
}

// 统一入口。opts: { kind:'thugs'|'chengguan', actorId, choice, key, allies? }
export function resolveConfrontation(state, opts, events = []) {
  const allies = opts.allies || [];
  const full = { ...opts, allies, key: opts.key || `${opts.kind}:${state.day}:${state.slot}` };
  const r = opts.kind === 'chengguan' ? chengguan(state, full, events) : thugs(state, full, events);
  if (!r.error && r.text) events.push(r.text);
  return r;
}

// 营地清场：晨间节点。是不是清场日只由种子和日期决定，生成节点不改状态。
export function isClearingDay(state) {
  const d = state.day;
  if (d < C.clearingDay || (state.flags.clearingCooldown || 0) > d) return false;
  if (getData().chapters.some((x) => x.startDay === d)) return false;
  return rng(state.seed, 'clearing:' + d) < C.clearingChance;
}

export function campClearingNode(state) {
  if (!isClearingDay(state)) return null;
  const fuel = (state.wood || 0) + (state.cardboard || 0);
  return { title: '桥下来人了', text: `两个穿制服的站在桥柱边拍照：“这儿不能住，今天之内搬。”燃料还有${fuel}单位，功能位${(state.camp.facilities || []).filter(Boolean).length}个。`, choices: [
    { id: 'move', label: '搬去桥另一头（纸板全丢，木料-1）' },
    { id: 'stay', label: '不搬，等他们走（一半概率设施被拆，否则罚20）' },
  ] };
}

export function campClearing(state, choiceId, events) {
  state.flags.clearingCooldown = state.day + C.clearingCooldownDays;
  if (choiceId === 'move') {
    const lost = state.cardboard || 0;
    state.cardboard = 0; state.wood = Math.max(0, (state.wood || 0) - 1);
    events.push(`营地挪到了桥另一头：纸板${lost ? '丢了' + lost + '张' : '本来就没有'}，木料-1。`);
    return;
  }
  const broke = (state.camp.facilities || []).findIndex(Boolean);
  if (broke >= 0 && rng(state.seed, 'clearing-stay:' + state.day) < 0.5) {
    const name = getData().items.find((x) => x.id === state.camp.facilities[broke])?.name || state.camp.facilities[broke];
    state.camp.facilities[broke] = null;
    events.push(`他们走的时候把${name}踹散了。`);
    return;
  }
  const fine = Math.min(state.cash, C.clearingFine);
  state.cash -= fine; state.ledger.expense += fine;
  events.push(`没搬。对方开了张单子：罚${fine}块。`);
}
