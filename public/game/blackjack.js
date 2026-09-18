import { rng } from './rng.js';

export const BLACKJACK_BET = 2;
export const BLACKJACK_MAX_HANDS = 5;

export function blackjackValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const rank = card % 13;
    if (rank === 12) { total += 1; aces++; }
    else total += Math.min(rank + 2, 10);
  }
  const soft = aces > 0 && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft, natural: cards.length === 2 && total === 21 };
}

function shuffle(seed, key) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng(seed, `${key}:${i}`) * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function newBlackjackSession({ seed, sessionId, players, controller, dealerId, chips, bank, maxHands = BLACKJACK_MAX_HANDS, bet, tableKey }) {
  if (!Number.isInteger(seed) || !sessionId || !Array.isArray(players) || players.length < 1 || new Set(players).size !== players.length || !dealerId || players.includes(dealerId) || !players.includes(controller) || !Number.isSafeInteger(bank) || bank < 0 || !Number.isInteger(maxHands) || maxHands < 1 || maxHands > BLACKJACK_MAX_HANDS || players.some((id) => !Number.isSafeInteger(chips?.[id]) || chips[id] < 0) || bet !== undefined && (!Number.isSafeInteger(bet) || bet < 1)) throw new TypeError('invalid blackjack session');
  return { game: 'blackjack', seed, sessionId, players: [...players], controller, dealerId, chips: Object.fromEntries(players.map((id) => [id, chips[id]])), bank, handSeq: 0, maxHands, cur: null, done: false,
    ...(bet === undefined ? {} : { bet }), ...(tableKey === undefined ? {} : { tableKey }) };
}

export function startBlackjackHand(session) {
  if (session.done || session.handSeq >= session.maxHands || (session.cur && !session.cur.over)) return { error: 'hand unavailable' };
  const bet = session.bet ?? BLACKJACK_BET;
  const requiredBank = (session.bet === undefined ? 4 : 4 * bet) * session.players.length;
  if (session.players.some((id) => session.chips[id] < bet) || session.bank < requiredBank) return { error: 'insufficient bankroll' };
  const s = structuredClone(session);
  s.handSeq++;
  const deck = shuffle(s.seed, `${s.tableKey || s.sessionId}:${s.handSeq}`);
  const cur = { deck, di: 0, hands: {}, dealerCards: [], bets: {}, status: {}, turn: null, over: false, results: {} };
  for (const id of s.players) { cur.hands[id] = []; cur.bets[id] = bet; s.chips[id] -= bet; }
  for (let round = 0; round < 2; round++) {
    for (const id of s.players) cur.hands[id].push(deck[cur.di++]);
    cur.dealerCards.push(deck[cur.di++]);
  }
  for (const id of s.players) cur.status[id] = blackjackValue(cur.hands[id]).natural ? 'natural' : 'playing';
  cur.turn = s.players.find((id) => cur.status[id] === 'playing') || s.dealerId;
  s.cur = cur;
  if (blackjackValue(cur.dealerCards).natural) settle(s);
  return { state: s, events: [{ action: 'deal', handSeq: s.handSeq }] };
}

export function blackjackLegalActions(session) {
  const c = session.cur;
  if (!c || c.over || !c.turn) return [];
  if (c.turn === session.dealerId) {
    const v = blackjackValue(c.dealerCards);
    return [{ id: v.total < 17 ? 'hit' : 'stand', cost: 0 }];
  }
  const id = c.turn;
  const actions = [{ id: 'hit', cost: 0 }, { id: 'stand', cost: 0 }];
  if (c.hands[id].length === 2 && session.chips[id] >= c.bets[id]) actions.push({ id: 'double', cost: c.bets[id] });
  return actions;
}

function nextTurn(s) {
  const c = s.cur;
  c.turn = s.players.find((id) => c.status[id] === 'playing') || s.dealerId;
  if (c.turn === s.dealerId && s.players.every((id) => c.status[id] === 'bust')) settle(s);
}

function settle(s) {
  const c = s.cur;
  const dealer = blackjackValue(c.dealerCards);
  for (const id of s.players) {
    const player = blackjackValue(c.hands[id]);
    let result;
    if (player.total > 21) result = 'bust';
    else if (player.natural && dealer.natural) result = 'push';
    else if (player.natural) result = 'natural';
    else if (dealer.natural) result = 'lose';
    else if (dealer.total > 21 || player.total > dealer.total) result = 'win';
    else if (player.total === dealer.total) result = 'push';
    else result = 'lose';
    const wager = c.bets[id];
    const payout = result === 'natural' ? Math.floor(wager * 5 / 2) : result === 'win' ? wager * 2 : result === 'push' ? wager : 0;
    s.chips[id] += payout;
    s.bank += wager - payout;
    c.results[id] = result;
  }
  c.over = true;
  c.turn = null;
  if (s.handSeq >= s.maxHands) s.done = true;
}

export function blackjackAct(session, action) {
  if (!blackjackLegalActions(session).some((choice) => choice.id === action)) return { error: 'illegal action' };
  const s = structuredClone(session);
  const c = s.cur;
  const id = c.turn;
  if (id === s.dealerId) {
    if (action === 'hit') c.dealerCards.push(c.deck[c.di++]);
    else settle(s);
  } else if (action === 'hit') {
    c.hands[id].push(c.deck[c.di++]);
    if (blackjackValue(c.hands[id]).total > 21) { c.status[id] = 'bust'; nextTurn(s); }
  } else if (action === 'stand') { c.status[id] = 'stand'; nextTurn(s); }
  else {
    s.chips[id] -= c.bets[id];
    c.bets[id] *= 2;
    c.hands[id].push(c.deck[c.di++]);
    c.status[id] = blackjackValue(c.hands[id]).total > 21 ? 'bust' : 'double';
    nextTurn(s);
  }
  return { state: s, events: [{ action, id, handSeq: s.handSeq }] };
}

export function blackjackLocalDecision(session, npcId) {
  if (session.cur?.turn !== npcId) return null;
  const legal = blackjackLegalActions(session);
  if (npcId === session.dealerId) return legal[0]?.id || null;
  const value = blackjackValue(session.cur.hands[npcId]);
  return legal.find((a) => a.id === (value.total < 17 ? 'hit' : 'stand'))?.id || null;
}

export function blackjackView(session, viewer) {
  const c = session.cur;
  if (!c) return { handSeq: session.handSeq, turn: null, over: true, chips: { ...session.chips }, bank: session.bank };
  return {
    handSeq: session.handSeq, turn: c.turn, over: c.over, dealerId: session.dealerId,
    dealerUpcard: c.dealerCards[0], dealerCards: c.over ? [...c.dealerCards] : [c.dealerCards[0], null],
    hands: Object.fromEntries(session.players.filter((id) => c.over || id === viewer).map((id) => [id, [...c.hands[id]]])),
    counts: Object.fromEntries(session.players.map((id) => [id, c.hands[id].length])),
    bets: { ...c.bets }, chips: { ...session.chips }, bank: session.bank,
    legalActions: c.turn === viewer ? blackjackLegalActions(session) : [], results: c.over ? { ...c.results } : {},
  };
}
