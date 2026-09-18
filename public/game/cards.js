// 夜间牌局：炸金花与德州扑克的规则与会话推进。纯函数、无 DOM；发牌与 AI 掷骰全部走 rng(seed, key)。
// 牌用 0..51 的整数：点数 n % 13（0 是 2，12 是 A），花色 Math.floor(n / 13)（黑桃 红桃 方块 梅花）。
import { rng } from './rng.js';
import { aiDecide } from './cards-ai.js';

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
export const rankOf = (n) => n % 13;
export const suitOf = (n) => Math.floor(n / 13);
export const parse = (txt) => RANKS.indexOf(txt[0]) + SUITS.indexOf(txt[1]) * 13;
export const label = (n) => RANKS[rankOf(n)].replace('T', '10') + '♠♥♦♣'[suitOf(n)];

export const ZJH = { ante: 1, stake: 2, cap: 8, maxRounds: 5, compareFromRound: 2, special235: true };
export const TEXAS = { smallBlind: 1, bigBlind: 2 };
export const BUY_IN = 10;
export const MAX_HANDS = 5;
// 马哥牌运：发牌时按此概率多发一手、留好的那手。无论谁操控马哥都生效。
export const MA_LUCK = { chance: 0.4 };

const ZJH_NAMES = { 6: '豹子', 5: '顺金', 4: '金花', 3: '顺子', 2: '对子', 1: '单张' };
const TEXAS_NAMES = { 9: '同花顺', 8: '四条', 7: '葫芦', 6: '同花', 5: '顺子', 4: '三条', 3: '两对', 2: '一对', 1: '高牌' };

export function evalZjh(cards) {
  const r = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const trio = r[0] === r[1] && r[1] === r[2];
  let straightHigh = -1;
  if (r[0] - 1 === r[1] && r[1] - 1 === r[2]) straightHigh = r[0];
  else if (r[0] === 12 && r[1] === 1 && r[2] === 0) straightHigh = 1;
  let cat, key;
  if (trio) { cat = 6; key = [r[0]]; }
  else if (straightHigh >= 0 && flush) { cat = 5; key = [straightHigh]; }
  else if (flush) { cat = 4; key = r; }
  else if (straightHigh >= 0) { cat = 3; key = [straightHigh]; }
  else if (r[0] === r[1]) { cat = 2; key = [r[0], r[2]]; }
  else if (r[1] === r[2]) { cat = 2; key = [r[1], r[0]]; }
  else { cat = 1; key = r; }
  const special = cat === 1 && r[0] === 3 && r[1] === 1 && r[2] === 0;
  const score = cat * 10000 + key[0] * 169 + (key[1] ?? 0) * 13 + (key[2] ?? 0);
  return { cat, key, special, name: ZJH_NAMES[cat], score };
}

export function compareZjh(a, b, opts = ZJH) {
  if (opts.special235 !== false) {
    if (a.special && b.cat === 6) return 1;
    if (b.special && a.cat === 6) return -1;
  }
  return a.score > b.score ? 1 : a.score < b.score ? -1 : 0;
}

function evaluate5(cards) {
  const counts = new Map();
  for (const c of cards) counts.set(rankOf(c), (counts.get(rankOf(c)) || 0) + 1);
  const groups = [...counts.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0]);
  const ranks = groups.map((g) => g[0]);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  let straightHigh = -1;
  if (groups.length === 5) {
    const sorted = [...ranks].sort((x, y) => y - x);
    if (sorted[0] - sorted[4] === 4) straightHigh = sorted[0];
    else if (sorted[0] === 12 && sorted[1] === 3 && sorted[4] === 0) straightHigh = 3;
  }
  let cat, key;
  if (straightHigh >= 0 && flush) { cat = 9; key = [straightHigh]; }
  else if (groups[0][1] === 4) { cat = 8; key = [ranks[0], ranks[1]]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 7; key = [ranks[0], ranks[1]]; }
  else if (flush) { cat = 6; key = ranks; }
  else if (straightHigh >= 0) { cat = 5; key = [straightHigh]; }
  else if (groups[0][1] === 3) { cat = 4; key = ranks; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 3; key = ranks; }
  else if (groups[0][1] === 2) { cat = 2; key = ranks; }
  else { cat = 1; key = ranks; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 13 + (key[i] ?? 0);
  const name = cat === 9 && straightHigh === 12 ? '皇家同花顺' : TEXAS_NAMES[cat];
  return { cat, key, name, score };
}

// 5–7 张里选最好的五张。
export function bestOfSeven(cards) {
  if (cards.length === 5) return evaluate5(cards);
  let best = null;
  const n = cards.length;
  const pick = (start, chosen) => {
    if (chosen.length === 5) { const e = evaluate5(chosen); if (!best || e.score > best.score) best = e; return; }
    for (let i = start; i <= n - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return best;
}

function shuffle(seed, key) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng(seed, `${key}:${i}`) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

export function newSession(state, opts = {}) {
  const players = opts.players || ['xuan', 'fan', 'ma'];
  const buyIn = opts.buyIn ?? BUY_IN;
  return {
    game: opts.game === 'texas' ? 'texas' : 'zjh', stakes: opts.stakes === 'cash' ? 'cash' : 'free', controller: opts.controller === undefined ? 'xuan' : opts.controller,
    players, chips: Object.fromEntries(players.map((id) => [id, buyIn])), buyIn, hand: 0, maxHands: MAX_HANDS,
    dealer: opts.dealer ?? Math.max(0, players.indexOf('ma')), cur: null, events: [], seq: 0, done: false, results: [],
    day: state.day, seed: state.seed, sessionId: opts.sessionId, handSeq: Number.isSafeInteger(opts.handSeq) && opts.handSeq >= 0 ? opts.handSeq : 0, fanBluffed: false,
    ...(opts.baseBet === undefined ? {} : { baseBet: opts.baseBet }), ...(opts.tableKey === undefined ? {} : { tableKey: opts.tableKey }),
  };
}

function pushEvent(session, ev) { session.seq += 1; session.events.push({ seq: session.seq, hand: session.hand, ...ev }); if (session.events.length > 60) session.events.splice(0, session.events.length - 60); }

const active = (cur) => cur.order.filter((id) => !cur.folded[id]);

export function startHand(state, session) {
  session.hand += 1;
  session.handSeq = Number.isSafeInteger(session.handSeq) && session.handSeq >= 0 ? session.handSeq + 1 : session.hand;
  const key = session.sessionId === undefined || session.sessionId === null ? `cards:${session.day}:${session.hand}` : `cards:${session.tableKey || session.sessionId}:${session.handSeq}`;
  const deck = shuffle(session.seed, key);
  const n = session.players.length;
  session.dealer = (session.dealer + (session.hand === 1 ? 0 : 1)) % n;
  const order = session.players.map((_, i) => session.players[(session.dealer + 1 + i) % n]);
  const cur = { hand: session.hand, over: false, winners: [], order, dealerId: session.players[session.dealer], folded: {}, pot: 0, revealed: {}, deck, di: 0 };
  for (const id of session.players) if (session.chips[id] <= 0) cur.folded[id] = true;
  const draw = (k) => { const out = deck.slice(cur.di, cur.di + k); cur.di += k; return out; };
  const luck = rng(session.seed, key + ':luck') < MA_LUCK.chance;
  const maSeated = session.players.includes('ma');
  if (session.game === 'zjh') {
    cur.hands = {}; cur.seen = {}; cur.stake = session.baseBet ?? ZJH.stake; cur.round = 1; cur.pos = 0; cur.raises = {}; cur.compares = [];
    for (const id of order) cur.hands[id] = draw(3);
    if (luck && maSeated) { const alt = draw(3); if (evalZjh(alt).score > evalZjh(cur.hands.ma).score) cur.hands.ma = alt; }
    for (const id of order) { const pay = Math.min(Math.ceil(cur.stake / 2), session.chips[id]); session.chips[id] -= pay; cur.pot += pay; }
    cur.turn = active(cur)[0];
  } else {
    cur.hole = {}; cur.board = []; cur.streetBets = {}; cur.committed = {}; cur.allin = {}; cur.acted = {}; cur.stage = 'preflop';
    for (const id of order) { cur.hole[id] = draw(2); cur.streetBets[id] = 0; cur.committed[id] = 0; }
    if (luck && maSeated) { const alt = draw(2); if (preflopStrength(alt) > preflopStrength(cur.hole.ma)) cur.hole.ma = alt; }
    const live = active(cur);
    const sb = live.length === 2 ? cur.dealerId : live[0];
    const bb = live[(live.indexOf(sb) + 1) % live.length];
    const bigBlind = session.baseBet ?? TEXAS.bigBlind;
    postBlind(session, cur, sb, Math.max(1, Math.floor(bigBlind / 2))); postBlind(session, cur, bb, bigBlind);
    cur.lastRaise = bigBlind;
    cur.turn = live.length === 2 ? sb : cur.dealerId;
    if (cur.folded[cur.turn]) cur.turn = nextActor(cur, cur.turn);
  }
  session.cur = cur;
  pushEvent(session, { id: null, action: 'deal', game: session.game });
  return cur;
}

function postBlind(session, cur, id, amount) {
  const pay = Math.min(amount, session.chips[id]);
  session.chips[id] -= pay; cur.streetBets[id] += pay; cur.committed[id] += pay; cur.pot += pay;
  if (session.chips[id] === 0) cur.allin[id] = true;
}

function nextActor(cur, from) {
  const i = cur.order.indexOf(from);
  for (let k = 1; k <= cur.order.length; k++) {
    const id = cur.order[(i + k) % cur.order.length];
    if (!cur.folded[id] && !(cur.allin && cur.allin[id])) return id;
  }
  return null;
}

export function legalActions(session) {
  const cur = session.cur;
  if (!cur || cur.over || !cur.turn) return [];
  return session.game === 'zjh' ? legalZjh(session, cur) : legalTexas(session, cur);
}

function legalZjh(session, cur) {
  const id = cur.turn, chips = session.chips[id], seen = Boolean(cur.seen[id]);
  const out = [];
  if (!seen) out.push({ id: 'see', cost: 0 });
  const unit = seen ? cur.stake : Math.ceil(cur.stake / 2);
  const others = active(cur).filter((x) => x !== id);
  const capped = cur.round > ZJH.maxRounds;
  const canCompare = cur.round >= ZJH.compareFromRound || others.length === 1;
  if (!capped && chips >= unit) out.push({ id: 'call', cost: unit });
  if (!capped && cur.stake + 2 <= (session.baseBet ?? ZJH.stake) * 4) { const to = cur.stake + 2; const cost = seen ? to : Math.ceil(to / 2); if (chips >= cost) out.push({ id: 'raise', cost, to }); }
  if (canCompare && chips >= unit * 2) out.push({ id: 'compare', cost: unit * 2, targets: others });
  out.push({ id: 'fold', cost: 0 });
  return out;
}

function legalTexas(session, cur) {
  const id = cur.turn, chips = session.chips[id];
  const maxBet = Math.max(...Object.values(cur.streetBets));
  const toCall = maxBet - cur.streetBets[id];
  const out = [];
  if (toCall === 0) out.push({ id: 'check', cost: 0 });
  else out.push({ id: 'call', cost: Math.min(toCall, chips) });
  const stackTo = cur.streetBets[id] + chips;
  if (maxBet === 0 && chips > 0) out.push({ id: 'bet', min: Math.min(session.baseBet ?? TEXAS.bigBlind, stackTo), max: stackTo });
  else if (chips > toCall) { const min = maxBet + cur.lastRaise; out.push({ id: 'raise', min: Math.min(min, stackTo), max: stackTo }); }
  if (chips > 0) out.push({ id: 'allin', to: stackTo });
  out.push({ id: 'fold', cost: 0 });
  return out;
}

// 当前行动者执行一个动作。返回 { error? }；会话原地修改，引擎负责拷贝。
export function act(state, session, action, amount = 0, target = null) {
  const cur = session.cur;
  if (!cur || cur.over) return { error: '这一手已经结束' };
  const legal = legalActions(session).find((a) => a.id === action);
  if (!legal) return { error: '现在不能这样做' };
  const id = cur.turn;
  const r = session.game === 'zjh' ? actZjh(session, cur, id, legal, target) : actTexas(session, cur, id, legal, amount);
  if (r && r.error) return r;
  return {};
}

function actZjh(session, cur, id, legal, target) {
  if (legal.id === 'see') { cur.seen[id] = true; pushEvent(session, { id, action: 'see' }); return {}; }
  if (legal.id === 'fold') { cur.folded[id] = true; pushEvent(session, { id, action: 'fold' }); }
  else if (legal.id === 'call' || legal.id === 'raise') {
    session.chips[id] -= legal.cost; cur.pot += legal.cost;
    if (legal.id === 'raise') { cur.stake = legal.to; cur.raises[id] = (cur.raises[id] || 0) + 1; }
    pushEvent(session, { id, action: legal.id, cost: legal.cost, blind: !cur.seen[id], to: legal.to });
  } else if (legal.id === 'compare') {
    if (!legal.targets.includes(target)) return { error: '要选一个还在牌桌上的人比' };
    session.chips[id] -= legal.cost; cur.pot += legal.cost;
    const r = compareZjh(evalZjh(cur.hands[id]), evalZjh(cur.hands[target]));
    const loser = r > 0 ? target : id;
    cur.folded[loser] = true;
    cur.revealed[id] = true; cur.revealed[target] = true;
    cur.compares.push({ a: id, b: target, loser });
    pushEvent(session, { id, action: 'compare', cost: legal.cost, target, loser });
  }
  const live = active(cur);
  if (live.length <= 1) { finishZjh(session, cur, live); return {}; }
  advanceZjh(cur, id);
  return {};
}

function advanceZjh(cur, from) {
  const i = cur.order.indexOf(from);
  for (let k = 1; k <= cur.order.length; k++) {
    const idx = (i + k) % cur.order.length;
    const id = cur.order[idx];
    if (cur.folded[id]) continue;
    if (idx <= i) cur.round += 1;
    cur.turn = id;
    return;
  }
}

function finishZjh(session, cur, live) {
  cur.over = true;
  cur.turn = null;
  const winner = live[0] || cur.order[0];
  cur.winners = [winner]; cur.winner = winner;
  session.chips[winner] += cur.pot;
  for (const id of cur.order) if (!cur.folded[id] || cur.revealed[id]) cur.revealed[id] = true;
  cur.summary = { winner, pot: cur.pot, hands: Object.fromEntries(cur.order.map((id) => [id, evalZjh(cur.hands[id]).name])) };
  pushEvent(session, { id: winner, action: 'win', pot: cur.pot });
  closeHand(session, cur);
}

function actTexas(session, cur, id, legal, amount) {
  const maxBet = Math.max(...Object.values(cur.streetBets));
  const pay = (n) => { const p = Math.min(n, session.chips[id]); session.chips[id] -= p; cur.streetBets[id] += p; cur.committed[id] += p; cur.pot += p; if (session.chips[id] === 0) cur.allin[id] = true; return p; };
  if (legal.id === 'fold') { cur.folded[id] = true; pushEvent(session, { id, action: 'fold' }); }
  else if (legal.id === 'check') { cur.acted[id] = true; pushEvent(session, { id, action: 'check' }); }
  else if (legal.id === 'call') { const p = pay(maxBet - cur.streetBets[id]); cur.acted[id] = true; pushEvent(session, { id, action: 'call', cost: p }); }
  else {
    const to = legal.id === 'allin' ? legal.to : Number(amount);
    if (!Number.isFinite(to) || to > legal.max) return { error: '筹码不够' };
    if (to < legal.min && to !== cur.streetBets[id] + session.chips[id]) return { error: `至少要到 ${legal.min}` };
    const raiseBy = to - maxBet;
    pay(to - cur.streetBets[id]);
    if (raiseBy >= cur.lastRaise) cur.lastRaise = raiseBy;
    cur.acted = { [id]: true };
    pushEvent(session, { id, action: legal.id === 'allin' ? 'allin' : maxBet === 0 ? 'bet' : 'raise', to });
  }
  const live = active(cur);
  if (live.length === 1) { finishTexas(session, cur, false); return {}; }
  const canAct = live.filter((x) => !cur.allin[x]);
  const max2 = Math.max(...Object.values(cur.streetBets));
  const settled = canAct.every((x) => cur.acted[x] && cur.streetBets[x] === max2);
  if (canAct.length <= 1 && (canAct.length === 0 || cur.streetBets[canAct[0]] === max2)) { while (cur.stage !== 'river') dealStreet(cur); finishTexas(session, cur, true); return {}; }
  if (settled) {
    if (cur.stage === 'river') { finishTexas(session, cur, true); return {}; }
    dealStreet(cur);
    for (const x of cur.order) cur.streetBets[x] = 0;
    cur.acted = {}; cur.lastRaise = session.baseBet ?? TEXAS.bigBlind;
    cur.turn = nextActor(cur, cur.dealerId);
    return {};
  }
  cur.turn = nextActor(cur, id);
  return {};
}

function dealStreet(cur) {
  const take = (k) => { const out = cur.deck.slice(cur.di, cur.di + k); cur.di += k; return out; };
  if (cur.stage === 'preflop') { cur.board.push(...take(3)); cur.stage = 'flop'; }
  else if (cur.stage === 'flop') { cur.board.push(...take(1)); cur.stage = 'turn'; }
  else if (cur.stage === 'turn') { cur.board.push(...take(1)); cur.stage = 'river'; }
}

// 摊牌：按各人投入额分层建池，每层只在投够的人里比牌。
function finishTexas(session, cur, showdown) {
  cur.over = true; cur.turn = null;
  const live = active(cur);
  const ranks = {};
  if (showdown) for (const id of live) { ranks[id] = bestOfSeven([...cur.hole[id], ...cur.board]); cur.revealed[id] = true; }
  const won = Object.fromEntries(cur.order.map((id) => [id, 0]));
  if (!showdown) { won[live[0]] = cur.pot; }
  else {
    const levels = [...new Set(live.map((id) => cur.committed[id]))].sort((a, b) => a - b);
    let prev = 0;
    for (const L of levels) {
      let pot = 0;
      for (const id of cur.order) pot += Math.max(0, Math.min(cur.committed[id], L) - prev);
      const eligible = live.filter((id) => cur.committed[id] >= L);
      const top = Math.max(...eligible.map((id) => ranks[id].score));
      const winners = eligible.filter((id) => ranks[id].score === top);
      const share = Math.floor(pot / winners.length);
      let rest = pot - share * winners.length;
      for (const id of winners) { won[id] += share + (rest > 0 ? 1 : 0); if (rest > 0) rest -= 1; }
      prev = L;
    }
  }
  for (const id of cur.order) session.chips[id] += won[id];
  cur.winners = cur.order.filter((id) => won[id] > 0);
  cur.won = won;
  cur.summary = { winners: cur.winners, pot: cur.pot, hands: showdown ? Object.fromEntries(live.map((id) => [id, ranks[id].name])) : {} };
  pushEvent(session, { id: cur.winners[0], action: 'win', pot: cur.pot, winners: cur.winners });
  closeHand(session, cur);
}

function closeHand(session, cur) {
  session.results.push({ hand: cur.hand, winners: cur.winners, pot: cur.pot, chips: { ...session.chips } });
  if (session.hand >= session.maxHands || session.players.some((id) => session.chips[id] <= 0)) session.done = true;
}

// 让 AI 一直走到轮到玩家或本手结束；controller 为 null 时整手都是 AI。
export function runAI(state, session) {
  const cur = session.cur;
  let guard = 0;
  while (cur && !cur.over && cur.turn && cur.turn !== session.controller && guard++ < 200) {
    const d = aiDecide(session, cur.turn);
    const r = act(state, session, d.action, d.amount, d.target);
    if (r.error) { const fallback = legalActions(session).find((a) => a.id === 'check') || legalActions(session).find((a) => a.id === 'call') || { id: 'fold' }; if (act(state, session, fallback.id, fallback.min || 0, null).error) break; }
  }
  return cur;
}

// 翻前手牌估值：对子最强，高牌越大越好，同花和相连各加一点。
export function preflopStrength(hole) {
  const [a, b] = hole.map(rankOf).sort((x, y) => y - x);
  if (a === b) return 0.55 + (a / 12) * 0.4;
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  return 0.18 + ((a + b) / 24) * 0.42 + (suited ? 0.06 : 0) + (a - b <= 2 ? 0.05 : 0);
}
