// 今日事：每天一件只属于今天的事。清晨节点给出选择；选了的事有的当场生效，有的在街上开一个有时限的热点，
// 窗口关了还没处理就执行错过后果。抽哪件只由种子和日期决定，生成节点不改状态；冷却写在 flags 里跨存档有效。
import { rng } from './rng.js';
import { POOL } from './headline-pool.js';
import { spawnTimedEvent, PACKS } from './events.js';

// 前三天走新手引导，不抽今日事。
export const HEADLINE_MIN_DAY = 4;

const entry = (id) => POOL.find((h) => h.id === id);
const text = (v, s) => (typeof v === 'function' ? v(s) : v);

export function pickHeadline(state) {
  const day = state.day;
  // 到日子必来的事（占地费）优先于随机池。
  const forced = POOL.find((h) => h.force && h.cond?.(state));
  if (forced) return forced;
  if (day < HEADLINE_MIN_DAY) return null;
  const cooldown = state.flags.headlineCooldown || {};
  const cands = POOL.filter((h) => !h.force && (h.minDay || HEADLINE_MIN_DAY) <= day && (cooldown[h.id] || 0) <= day && (!h.cond || h.cond(state)));
  if (!cands.length) return null;
  const total = cands.reduce((a, h) => a + (h.weight || 1), 0);
  let x = rng(state.seed, 'headline:' + day) * total;
  for (const h of cands) { x -= h.weight || 1; if (x < 0) return h; }
  return cands[cands.length - 1];
}

// 节点只带 id 与文案；requires 函数存档往返会丢，所以校验一律回到池子里查（headlineRequires）。
export function nodeFor(state, id) {
  const h = entry(id);
  if (!h) return null;
  return { headlineId: h.id, title: h.title, text: text(h.text, state), choices: h.choices.map((c) => ({ id: c.id, label: text(c.label, state), requires: c.requires })) };
}

export function headlineNode(state) {
  const h = pickHeadline(state);
  return h ? nodeFor(state, h.id) : null;
}

export function headlineRequires(headlineId, choiceId, state) {
  const c = entry(headlineId)?.choices.find((x) => x.id === choiceId);
  return c?.requires ? c.requires(state) : null;
}

export function applyHeadline(state, headlineId, choiceId, events) {
  const h = entry(headlineId);
  const c = h?.choices.find((x) => x.id === choiceId);
  if (!h || !c) return false;
  state.flags.headlineCooldown = state.flags.headlineCooldown || {};
  state.flags.headlineCooldown[h.id] = state.day + (h.cooldownDays ?? 6);
  state.flags.headline = { day: state.day, id: h.id, title: h.title, choiceId };
  if (c.effect) c.effect(state, events);
  const spots = c.spawn ? [].concat(c.spawn(state) || []) : [];
  for (const spot of spots) spawnTimedEvent(state, spot.templateId, spot.district, spot.window, events, { headlineId: h.id, cast: spot.cast, target: spot.target });
  return true;
}

// 每小时结算末尾调用：hourAfter 是这一小时结算完之后的钟点。窗口关了还开着的定时热点过期并执行 miss，一次为限。
export function expireTimedEvents(state, day, hourAfter, events) {
  for (const ev of state.events) {
    if (!ev.window || ev.day !== day || !['open', 'reserved'].includes(ev.status) || hourAfter < ev.window.to) continue;
    ev.status = 'expired'; ev.reserved = null; ev.missed = true;
    events.push(`「${ev.title}」过了时间。`);
    PACKS[ev.templateId]?.miss?.(state, ev, events);
  }
}

export function windowLabel(ev, state) {
  if (!ev.window) return `还剩${ev.expiresTurn - state.turn}回合`;
  if (state.hour < ev.window.from) return `${ev.window.from}点开始`;
  return `还剩${Math.max(0, ev.window.to - state.hour)}小时`;
}
