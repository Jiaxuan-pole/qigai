import { acceptedVariantsA, createA, initialA, reduceA, scoreA } from './work-games-families-a.js';
import { acceptedVariantsB, createB, initialB, reduceB, scoreB } from './work-games-families-b.js';
import { accountWorkGameBonus } from './day-report.js';

export const rewardPolicy = Object.freeze({ bonusRate: 0.25, maxScore: 100 });
const registries = [
  { variants: acceptedVariantsA, create: createA, initial: initialA, reduce: reduceA, score: scoreA },
  { variants: acceptedVariantsB, create: createB, initial: initialB, reduce: reduceB, score: scoreB },
];
const actorIds = ['xuan', 'fan', 'ma'];
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(value);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const fail = (state, error) => ({ state, error });

export function workGameRegistry(variant, source) {
  if (typeof variant !== 'string' || !['job', 'sale'].includes(source)) return null;
  const entry = registries.find(item => Object.hasOwn(item.variants, variant));
  const meta = entry?.variants[variant];
  return meta && meta[source === 'job' ? 'jobId' : 'sourceId'] === variant ? entry : null;
}

export function workGameId(state, { actorId, controllerId, source, sourceUid, variant }) {
  return `work:${state.seed}:${state.day}:${state.hourTick}:${state.actionCount}:${state.stateRevision}:${source}:${sourceUid.length}-${sourceUid}:${actorId}:${controllerId}:${variant}`;
}

export function startWorkGame(state, request) {
  const { actorId, controllerId, participants, source, sourceUid, basePay, variant, family } = request ?? {};
  const registry = workGameRegistry(variant, source);
  if (!registry || (family !== undefined && family !== registry.variants[variant].family) ||
    Object.keys(request ?? {}).some(key => !['actorId', 'controllerId', 'participants', 'source', 'sourceUid', 'basePay', 'variant', 'family'].includes(key)) ||
    !actorIds.includes(actorId) || (controllerId !== null && !actorIds.includes(controllerId)) || !safeId(sourceUid) ||
    !integer(basePay, 10_000) || !integer(state?.seed, 0xffff_ffff) || !integer(state?.day, 100) ||
    !integer(state?.hourTick, 1600) || !integer(state?.actionCount, 4800) ||
    !integer(state?.stateRevision, Number.MAX_SAFE_INTEGER) ||
    (participants !== undefined && (!Array.isArray(participants) || participants.length < 1 || participants.length > 3 ||
      new Set(participants).size !== participants.length || participants.some(id => !actorIds.includes(id)) || !participants.includes(actorId)))) {
    return fail(state, '挑战参数无效');
  }
  const selected = participants === undefined ? controllerId === actorId : participants.includes(controllerId);
  if (controllerId === null || !selected || state.actors?.[controllerId]?.life !== 'active' || state.actors?.[actorId]?.life !== 'active') {
    return { state, gameId: null };
  }
  const gameId = workGameId(state, { actorId, controllerId, source, sourceUid, variant });
  if (gameId.length > 120) return fail(state, '挑战参数无效');
  const queue = state.pending?.workGames ?? [];
  const completed = state.workGameCompleted ?? [];
  if (!Array.isArray(queue) || !Array.isArray(completed) || queue.some(game => game.id === gameId ||
    game.sourceUid === sourceUid && game.source === source) || completed.includes(gameId) ||
    completed.some(id => id.includes(`:${source}:${sourceUid.length}-${sourceUid}:`))) return fail(state, '挑战已创建');
  const challenge = registry.create(state.seed, gameId, variant);
  const session = { id: gameId, seed: state.seed, day: state.day, hourTick: state.hourTick,
    actionCount: state.actionCount, stateRevision: state.stateRevision, jobActorId: actorId, actorId: controllerId,
    controllerId, source, sourceUid, variant, basePay, challenge, progress: registry.initial(challenge), inputs: [] };
  return { state: { ...state, pending: { ...state.pending, workGames: [...queue, session] },
    workGameCompleted: completed, stateRevision: state.stateRevision + 1 }, gameId };
}

export function acceptedWorkGameAction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype ||
    Object.keys(input).length < 1 || Object.keys(input).length > 3 ||
    Object.keys(input).some(key => ['score', 'cash', 'answer', 'bonus', 'basePay'].includes(key))) return false;
  return Object.entries(input).every(([key, value]) => typeof key === 'string' && key.length <= 24 &&
    (typeof value === 'string' && value.length <= 120 || Number.isSafeInteger(value) && value >= 0 && value <= 100));
}

export function stepWorkGame(state, gameId, input) {
  const queue = state?.pending?.workGames;
  if (!Array.isArray(queue) || queue[0]?.id !== gameId) return fail(state, '不是当前挑战');
  const session = queue[0];
  if (state.actors?.[session.controllerId]?.life !== 'active' || state.actors?.[session.jobActorId]?.life !== 'active')
    return fail(state, '参与者无法继续挑战');
  if (!acceptedWorkGameAction(input) || session.inputs.length >= 32) return fail(state, '挑战输入无效');
  const registry = workGameRegistry(session.variant, session.source);
  if (!registry) return fail(state, '挑战类型无效');
  const result = registry.reduce(session.challenge, session.progress, input);
  if (result.error) return fail(state, result.error);
  const next = { ...session, progress: result.progress, inputs: [...session.inputs, { ...input }] };
  return { state: { ...state, pending: { ...state.pending, workGames: [next, ...queue.slice(1)] },
    stateRevision: state.stateRevision + 1 }, session: next };
}

export function finishWorkGame(state, gameId, options = {}) {
  const { forfeit = false } = options ?? {};
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'forfeit'))
    return fail(state, '结束参数无效');
  const queue = state?.pending?.workGames;
  if (!Array.isArray(queue) || queue[0]?.id !== gameId) return fail(state, '不是当前挑战');
  if (typeof forfeit !== 'boolean') return fail(state, '结束参数无效');
  const session = queue[0];
  const inactive = state.actors?.[session.controllerId]?.life !== 'active' || state.actors?.[session.jobActorId]?.life !== 'active';
  if (!forfeit && !inactive && !session.progress.done) return fail(state, '挑战尚未完成');
  const registry = workGameRegistry(session.variant, session.source);
  if (!registry) return fail(state, '挑战类型无效');
  const score = forfeit || inactive ? 0 : registry.score(session.challenge, session.progress);
  if (!integer(score, rewardPolicy.maxScore) || !integer(state.cash, 10_000_000) ||
    !integer(state.ledger?.income, Number.MAX_SAFE_INTEGER)) return fail(state, '奖励状态无效');
  const bonus = Math.floor(session.basePay * score / rewardPolicy.maxScore * rewardPolicy.bonusRate);
  const completed = state.workGameCompleted ?? [];
  if (completed.includes(gameId) || state.cash + bonus > 10_000_000 ||
    !Number.isSafeInteger(state.ledger.income + bonus)) return fail(state, '挑战已结算');
  const paid = { ...state, cash: state.cash + bonus, ledger: { ...state.ledger, income: state.ledger.income + bonus },
    pending: { ...state.pending, workGames: queue.slice(1) }, workGameCompleted: [...completed, gameId],
    stateRevision: state.stateRevision + 1 };
  return { state: accountWorkGameBonus(paid, session.day, bonus), score, bonus };
}
