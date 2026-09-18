export const CASINO_NPCS = Object.freeze({
  hall_lan: { name: '阿岚', bankroll: 30 },
  hall_qiao: { name: '阿乔', bankroll: 30 },
  hall_dealer: { name: '发牌员', bankroll: 100 },
});

const PLAYERS = ['xuan', 'fan', 'ma', 'hall_lan', 'hall_qiao'];
const ESCROW_ACCOUNTS = [...PLAYERS, 'hall_dealer'];
const PHASES = ['invited', 'playing', 'settled'];
export const MAX_CASINO_MONEY = 1_000_000_000;
const money = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_CASINO_MONEY;
const integer = (n) => Number.isSafeInteger(n) && n >= 0;
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const copy = (value) => structuredClone(value);

export function freshCasinoVenue() {
  return {
    casinoSeq: 0,
    bankrolls: Object.fromEntries(Object.entries(CASINO_NPCS).map(([id, npc]) => [id, npc.bankroll])),
  };
}

export function inviteCasino(input, actorId) {
  if (!PLAYERS.slice(0, 3).includes(actorId) || input.actors?.[actorId]?.life !== 'active') throw new Error('无效的入馆角色');
  if (!integer(input.seed) || !integer(input.day) || !integer(input.hourTick) || !integer(input.stateRevision)) throw new Error('无效的会话身份');
  if (input.pending?.casino && input.pending.casino.phase !== 'settled') throw new Error('已有未完成牌局');
  const state = copy(input);
  state.casinoVenue ??= freshCasinoVenue();
  validateVenue(state.casinoVenue);
  if (state.casinoVenue.casinoSeq === Number.MAX_SAFE_INTEGER) throw new Error('牌局序号已满');
  state.casinoVenue.casinoSeq += 1;
  const casinoSeq = state.casinoVenue.casinoSeq;
  const sessionId = `${state.seed}:${state.day}:${state.hourTick}:${actorId}:${casinoSeq}`;
  state.pending ??= {};
  state.pending.casino = {
    phase: 'invited', sessionId, seed: state.seed, day: state.day, hourTick: state.hourTick,
    actorId, casinoSeq, handSeq: 0, actionSeq: 0, appliedActionIds: [],
    game: null, session: null, escrow: Object.fromEntries(ESCROW_ACCOUNTS.map((id) => [id, 0])),
    allowedActions: [],
  };
  state.stateRevision += 1;
  return { state, events: [{ type: 'casinoInvited', sessionId, actorId }] };
}

function validateVenue(venue) {
  if (!plain(venue) || !integer(venue.casinoSeq) || !plain(venue.bankrolls)) throw new Error('无效的棋牌馆资金');
  for (const id of Object.keys(CASINO_NPCS)) if (!money(venue.bankrolls[id])) throw new Error('无效的 NPC 资金');
  if (Object.keys(venue.bankrolls).some((id) => !(id in CASINO_NPCS))) throw new Error('未知的 NPC 资金');
}

export function validateCasinoState(state) {
  if (!plain(state) || !money(state.cash) || !plain(state.ledger) || !integer(state.stateRevision)) throw new Error('无效的玩家现金');
  if (!Number.isSafeInteger(state.ledger.start) || !integer(state.ledger.income) || !integer(state.ledger.expense) || state.ledger.start + state.ledger.income - state.ledger.expense !== state.cash) throw new Error('现金账本不平');
  validateVenue(state.casinoVenue);
  const c = state.pending?.casino;
  if (!c) return true;
  if (!PHASES.includes(c.phase) || !PLAYERS.slice(0, 3).includes(c.actorId) || !integer(c.seed) || !integer(c.day) || !integer(c.hourTick) || !integer(c.casinoSeq) || !integer(c.handSeq) || !integer(c.actionSeq) || !Array.isArray(c.appliedActionIds) || !plain(c.escrow)) throw new Error('无效的牌局状态');
  if (c.sessionId !== `${c.seed}:${c.day}:${c.hourTick}:${c.actorId}:${c.casinoSeq}` || c.casinoSeq > state.casinoVenue.casinoSeq) throw new Error('会话身份不匹配');
  if (c.appliedActionIds.length > c.actionSeq || new Set(c.appliedActionIds).size !== c.appliedActionIds.length || c.appliedActionIds.some((id) => typeof id !== 'string' || !id)) throw new Error('重复或无效交易 ID');
  for (const id of ESCROW_ACCOUNTS) if (!money(c.escrow[id])) throw new Error('无效的托管资金');
  if (Object.keys(c.escrow).some((id) => !ESCROW_ACCOUNTS.includes(id))) throw new Error('未知托管账户');
  if (c.phase === 'invited' && (c.game !== null || c.session !== null || Object.values(c.escrow).some(Boolean))) throw new Error('邀请状态不能持有筹码');
  if (c.phase === 'settled' && Object.values(c.escrow).some(Boolean)) throw new Error('已结算牌局仍有托管');
  return true;
}

const total = (state) => state.cash + Object.values(state.casinoVenue.bankrolls).reduce((a, b) => a + b, 0)
  + Object.values(state.pending?.casino?.escrow ?? {}).reduce((a, b) => a + b, 0);

export function assertConservation(before, after) {
  validateCasinoState(before);
  validateCasinoState(after);
  const a = total(before), b = total(after);
  if (a !== b) throw new Error(`棋牌馆资金不守恒: ${a} -> ${b}`);
  return { before: a, after: b };
}

// 现金账本只记录与托管间的真实转移，内部筹码转手不记收入。
export function applyCasinoTransaction(input, { actionId, from, to, amount }) {
  validateCasinoState(input);
  const c = input.pending?.casino;
  if (!c || c.phase === 'settled') throw new Error('没有进行中的牌局');
  if (typeof actionId !== 'string' || !actionId || !money(amount) || amount === 0) throw new Error('无效的交易');
  if (c.appliedActionIds.includes(actionId)) return { state: input, events: [] };
  const account = (state, key) => {
    if (key === 'cash') return [state, 'cash'];
    if (key === 'dealerBank') return [state.casinoVenue.bankrolls, 'hall_dealer'];
    if (key.startsWith('npc:') && key.slice(4) in CASINO_NPCS) return [state.casinoVenue.bankrolls, key.slice(4)];
    if (key.startsWith('escrow:') && ESCROW_ACCOUNTS.includes(key.slice(7))) return [state.pending.casino.escrow, key.slice(7)];
    throw new Error('无效的交易账户');
  };
  if (from === to || (from === 'dealerBank' && to === 'npc:hall_dealer') || (to === 'dealerBank' && from === 'npc:hall_dealer')) throw new Error('交易账户相同');
  const state = copy(input);
  const [source, sourceKey] = account(state, from);
  const [target, targetKey] = account(state, to);
  if (!money(source[sourceKey]) || !money(target[targetKey]) || source[sourceKey] < amount || !money(target[targetKey] + amount)) throw new Error('交易资金不足或越界');
  source[sourceKey] -= amount;
  target[targetKey] += amount;
  if (from === 'cash') state.ledger.expense += amount;
  if (to === 'cash') state.ledger.income += amount;
  state.pending.casino.actionSeq += 1;
  state.pending.casino.appliedActionIds.push(actionId);
  state.stateRevision += 1;
  assertConservation(input, state);
  return { state, events: [{ type: 'casinoTransaction', actionId, from, to, amount }] };
}

const cards = (value) => Array.isArray(value) ? value.filter((n) => Number.isInteger(n) && n >= 0 && n < 52) : [];
const actions = (value) => Array.isArray(value) ? value.map((a) => {
  if (!plain(a) || typeof a.id !== 'string' || !a.id || (a.amount !== undefined && !integer(a.amount)) || (a.target !== undefined && typeof a.target !== 'string')) throw new Error('无效的合法动作');
  return { id: a.id, ...(a.amount === undefined ? {} : { amount: a.amount }), ...(a.target === undefined ? {} : { target: a.target }) };
}) : [];

export function casinoObservation(state, npcId) {
  validateCasinoState(state);
  const c = state.pending?.casino;
  if (!c || c.phase !== 'playing' || !(npcId in CASINO_NPCS)) throw new Error('NPC 无进行中的牌局');
  const s = c.session;
  if (!plain(s) || !plain(s.cur)) throw new Error('无效的游戏会话');
  const cur = s.cur;
  const game = c.game;
  if (!['zjh', 'texas', 'blackjack'].includes(game)) throw new Error('无效的牌类');
  const ownCards = game === 'zjh' ? (cur.seen?.[npcId] ? cards(cur.hands?.[npcId]) : [])
    : game === 'texas' ? cards(cur.hole?.[npcId])
      : npcId === 'hall_dealer' ? [] : cards(cur.hands?.[npcId]);
  const board = game === 'texas' ? cards(cur.board) : [];
  const dealerUpcard = game === 'blackjack' ? cards(cur.dealerCards)[0] ?? null : null;
  const publicChips = {};
  for (const id of PLAYERS) if (money(s.chips?.[id])) publicChips[id] = s.chips[id];
  const publicActions = Array.isArray(s.events) ? s.events.map((e) => {
    if (!plain(e) || !integer(e.seq) || (e.id !== null && typeof e.id !== 'string') || typeof e.action !== 'string') throw new Error('无效的公开行动');
    return { seq: e.seq, id: e.id, action: e.action, ...(integer(e.amount) ? { amount: e.amount } : {}), ...(typeof e.target === 'string' ? { target: e.target } : {}) };
  }) : [];
  return {
    requestId: `${c.sessionId}:${c.handSeq}:${c.actionSeq}:${state.stateRevision}:${npcId}`,
    sessionId: c.sessionId, handSeq: c.handSeq, actionSeq: c.actionSeq,
    stateRevision: state.stateRevision, npcId, game, ownCards, board, dealerUpcard,
    publicChips, publicActions, allowedActions: actions(c.allowedActions),
  };
}
