// 牌桌 AI：三个人各有性格参数，决策只看自己的牌、公共牌、底池与桌面行为，不读别人的底牌和牌堆。
import { rng } from './rng.js';
import { evalZjh, bestOfSeven, legalActions, preflopStrength, rankOf, suitOf, ZJH } from './cards.js';

// aggr 加注意愿；bluff 诈唬概率；foldBase 弃牌门槛；blindRounds 愿意闷几轮；compareAt 主动比牌的信心线；allin 全押冲动。
export const PERSONALITY = {
  ma: { aggr: 0.75, bluff: 0.28, foldBase: 0.2, blindRounds: 2, compareAt: 0.55, allin: 0.1 },
  xuan: { aggr: 0.45, bluff: 0.06, foldBase: 0.34, blindRounds: 0, compareAt: 0.62, allin: 0.01 },
  fan: { aggr: 0.35, bluff: 0.12, foldBase: 0.4, blindRounds: 1, compareAt: 0.66, allin: 0.02 },
};

// 三张牌的强度：按 22100 手里比它弱的比例粗估，类内用最大张微调。
export function zjhStrength(ev) {
  const top = ev.key[0] / 12;
  if (ev.special) return 0.5;
  if (ev.cat === 1) return 0.74 * ((ev.key[0] * 169 + ev.key[1] * 13 + ev.key[2]) / (12 * 169 + 11 * 13 + 10));
  if (ev.cat === 2) return 0.744 + 0.169 * top;
  if (ev.cat === 3) return 0.913 + 0.032 * top;
  if (ev.cat === 4) return 0.945 + 0.05 * top;
  if (ev.cat === 5) return 0.995 + 0.003 * top;
  return 0.998 + 0.002 * top;
}

// 德州：翻前查表，翻后用成牌类别加听牌。
export function texasStrength(hole, board) {
  if (!board.length) return preflopStrength(hole);
  const cards = [...hole, ...board];
  const best = bestOfSeven(cards);
  const base = { 1: 0.12, 2: 0.36, 3: 0.58, 4: 0.7, 5: 0.8, 6: 0.86, 7: 0.92, 8: 0.97, 9: 0.99 }[best.cat];
  let s = base + (best.key[0] / 12) * 0.08;
  if (best.cat === 2 && !hole.map(rankOf).includes(best.key[0])) s -= 0.12;
  if (board.length < 5) {
    const suits = [0, 0, 0, 0];
    for (const c of cards) suits[suitOf(c)] += 1;
    if (Math.max(...suits) === 4 && best.cat < 6) s += 0.12;
    const ranks = [...new Set(cards.map(rankOf))].sort((a, b) => a - b);
    let run = 1, bestRun = 1;
    for (let i = 1; i < ranks.length; i++) { run = ranks[i] === ranks[i - 1] + 1 ? run + 1 : 1; bestRun = Math.max(bestRun, run); }
    if (bestRun === 4 && best.cat < 5) s += 0.08;
  }
  return Math.min(0.995, s);
}

function roll(session, id, tag) {
  return rng(session.seed, `ai:${session.day}:${session.hand}:${session.seq}:${id}:${tag}`);
}

export function aiDecide(session, id) {
  const cur = session.cur;
  const p = PERSONALITY[id] || PERSONALITY.fan;
  const legal = legalActions(session);
  const has = (k) => legal.find((a) => a.id === k);
  if (session.game === 'zjh') {
    const others = cur.order.filter((x) => x !== id && !cur.folded[x]);
    if (!cur.seen[id]) {
      const keepBlind = cur.round <= p.blindRounds && roll(session, id, 'blind') < 0.8 && has('call');
      if (!keepBlind) return { action: 'see' };
      return { action: 'call' };
    }
    const ev = evalZjh(cur.hands[id]);
    let s = zjhStrength(ev);
    if (roll(session, id, 'bluff') < p.bluff) s = Math.max(s, 0.82);
    const cmp = has('compare');
    // 比谁：挑加注次数最少的那位，看起来最虚。
    const target = others.slice().sort((a, b) => (cur.raises[a] || 0) - (cur.raises[b] || 0))[0];
    if (cur.round > ZJH.maxRounds) return cmp && s >= 0.45 ? { action: 'compare', target } : { action: 'fold' };
    const call = has('call');
    const cost = call ? call.cost : 0;
    const potOdds = cost / (cur.pot + cost || 1);
    if (call && s < p.foldBase + potOdds * 0.8) return { action: 'fold' };
    if (cmp && (others.length === 1 ? s >= p.compareAt : s >= p.compareAt + 0.2) && roll(session, id, 'cmp') < 0.7) return { action: 'compare', target };
    const raise = has('raise');
    if (raise && s >= 0.7 + (1 - p.aggr) * 0.2 && roll(session, id, 'raise') < p.aggr) return { action: 'raise' };
    if (call) return { action: 'call' };
    if (cmp) return { action: 'compare', target };
    return { action: 'fold' };
  }
  const s0 = texasStrength(cur.hole[id], cur.board);
  let s = s0;
  const bluffing = roll(session, id, 'bluff') < p.bluff;
  if (bluffing) s = Math.max(s, 0.78);
  // 凡哥一晚只在河牌诈唬一次，之后老老实实。
  if (id === 'fan' && !session.fanBluffed && cur.stage === 'river' && roll(session, id, 'big') < 0.15) { session.fanBluffed = true; s = 0.9; }
  const call = has('call'), check = has('check'), bet = has('bet'), raise = has('raise'), allin = has('allin');
  const chips = session.chips[id];
  if (call) {
    const potOdds = call.cost / (cur.pot + call.cost);
    // 德州只按底池赔率外加一点性格余量弃牌，否则两位配角会被马哥的加注打跑太多。
    if (s < potOdds * 0.9 + p.foldBase * 0.25) return { action: 'fold' };
    if (allin && (s >= 0.9 || (bluffing && roll(session, id, 'allin') < p.allin))) return { action: 'allin' };
    if (raise && s >= 0.72 && roll(session, id, 'raise') < p.aggr) return { action: 'raise', amount: Math.min(raise.max, Math.max(raise.min, Math.round(cur.pot * 0.6))) };
    return { action: 'call' };
  }
  if (allin && s >= 0.93 && roll(session, id, 'allin2') < p.allin * 3) return { action: 'allin' };
  if (bet && s >= 0.6 && roll(session, id, 'bet') < p.aggr) return { action: 'bet', amount: Math.min(bet.max, Math.max(bet.min, Math.round(cur.pot * 0.5))) };
  if (raise && s >= 0.8 && roll(session, id, 'raise2') < p.aggr) return { action: 'raise', amount: Math.min(raise.max, Math.max(raise.min, Math.round(cur.pot * 0.6))) };
  if (check) return { action: 'check' };
  return { action: chips > 0 && call ? 'call' : 'fold' };
}
