const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, required, optional = []) => object(x) && required.every((key) => Object.hasOwn(x, key))
  && Object.keys(x).every((key) => required.includes(key) || optional.includes(key));
const text = (x, max) => typeof x === 'string' && x.length > 0 && x.length <= max && !/[<>\u0000-\u001f\u007f]/u.test(x);
const integer = (x, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x >= 0 && x <= max;
const card = (x) => integer(x, 51);
const cardList = (x, max) => Array.isArray(x) && x.length <= max && x.every(card) && new Set(x).size === x.length;
const money = (x) => integer(x, 1_000_000_000);
const ids = ['requestId', 'sessionId', 'handSeq', 'actionSeq', 'stateRevision', 'npcId'];
const games = ['zjh', 'texas', 'blackjack'];
const npcs = ['hall_lan', 'hall_qiao', 'hall_dealer'];
const actionNames = ['see', 'call', 'raise', 'compare', 'fold', 'check', 'bet', 'allin', 'hit', 'stand', 'double'];

function validAction(action) {
  return exact(action, ['id'], ['amount', 'target']) && actionNames.includes(action.id)
    && (action.amount === undefined || money(action.amount))
    && (action.target === undefined || text(action.target, 32));
}

export function checkCardNpcContext(ctx) {
  if (!exact(ctx, [...ids, 'game', 'ownCards', 'board', 'dealerUpcard', 'publicChips', 'publicActions', 'allowedActions'])) return '请求字段无效';
  if (!text(ctx.requestId, 200) || !text(ctx.sessionId, 120) || !integer(ctx.handSeq) || !integer(ctx.actionSeq)
    || !integer(ctx.stateRevision) || !npcs.includes(ctx.npcId) || !games.includes(ctx.game)) return '请求身份无效';
  if (ctx.requestId !== `${ctx.sessionId}:${ctx.handSeq}:${ctx.actionSeq}:${ctx.stateRevision}:${ctx.npcId}`) return '请求身份不匹配';
  if (!cardList(ctx.ownCards, ctx.game === 'zjh' ? 3 : ctx.game === 'texas' ? 2 : 12)
    || !cardList(ctx.board, ctx.game === 'texas' ? 5 : 0)
    || !(ctx.dealerUpcard === null || card(ctx.dealerUpcard))
    || (ctx.game !== 'blackjack' && ctx.dealerUpcard !== null)) return '牌面无效';
  if (!object(ctx.publicChips) || Object.keys(ctx.publicChips).length > 6
    || Object.entries(ctx.publicChips).some(([id, value]) => !['xuan', 'fan', 'ma', 'hall_lan', 'hall_qiao'].includes(id) || !money(value))) return '公开筹码无效';
  if (!Array.isArray(ctx.publicActions) || ctx.publicActions.length > 100 || ctx.publicActions.some((a) =>
    !exact(a, ['seq', 'id', 'action'], ['amount', 'target']) || !integer(a.seq)
    || !(a.id === null || ['xuan', 'fan', 'ma', ...npcs].includes(a.id)) || !/^[a-z][a-zA-Z]{0,19}$/u.test(a.action)
    || (a.amount !== undefined && !money(a.amount)) || (a.target !== undefined && !text(a.target, 32)))) return '公开行动无效';
  if (!Array.isArray(ctx.allowedActions) || ctx.allowedActions.length < 1 || ctx.allowedActions.length > 20
    || ctx.allowedActions.some((a) => !validAction(a))
    || new Set(ctx.allowedActions.map((a) => JSON.stringify(a))).size !== ctx.allowedActions.length) return '合法动作无效';
  return null;
}

export function validateCardNpcPayload(payload, context) {
  if (!exact(payload, [...ids, 'action', 'line']) || ids.some((key) => payload[key] !== context[key])) return false;
  if (!validAction(payload.action) || !context.allowedActions.some((candidate) =>
    Object.keys(candidate).length === Object.keys(payload.action).length
      && Object.keys(candidate).every((key) => candidate[key] === payload.action[key]))) return false;
  const line = payload.line;
  return text(line, 60) && [...line].length <= 60 && line.trim() === line;
}

export const CARD_NPC_SYSTEM = '你是虚构棋牌馆内当前行动的NPC。只按JSON返回 requestId、sessionId、handSeq、actionSeq、stateRevision、npcId、action、line。身份字段原样抄回。action只能从allowedActions中原样选一个，不增减字段或金额；line为1到60字纯文本台词，不含HTML。不能推断隐藏牌、牌堆或改动资金。发牌员必须选择唯一合法动作。';

export async function cardNpcReply(body, model, extract) {
  const err = checkCardNpcContext(body);
  if (err) return { status: 400, body: { ok: false, reason: err } };
  try {
    const { text, ms } = await model(CARD_NPC_SYSTEM, JSON.stringify(body), { timeoutMs: 20000 });
    const payload = extract(text);
    if (!validateCardNpcPayload(payload, body)) return { status: 200, body: { ok: false, reason: 'NPC 输出无效', ms } };
    return { status: 200, body: { ok: true, payload, ms } };
  } catch {
    return { status: 503, body: { ok: false, reason: 'NPC 模型暂不可用' } };
  }
}
