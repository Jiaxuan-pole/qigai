import { acceptedWorkGameAction, workGameId, workGameRegistry } from './work-games.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safe = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const same = (left, right) => {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((item, index) => same(item, right[index]));
  if (!object(left) || !object(right)) return false;
  const a = Object.keys(left).sort(), b = Object.keys(right).sort();
  return a.length === b.length && a.every((key, index) => key === b[index] && same(left[key], right[key]));
};
const fields = ['id', 'seed', 'day', 'hourTick', 'actionCount', 'stateRevision', 'actorId',
  'controllerId', 'jobActorId', 'source', 'sourceUid', 'variant', 'basePay', 'challenge', 'progress', 'inputs'];

function completedWorkGame(value) {
  if (typeof value !== 'string') return null;
  const head = /^work:(\d+):(\d+):(\d+):(\d+):(\d+):(job|sale):(\d+)-/.exec(value);
  if (!head) return null;
  const [seed, day, hourTick, actionCount, stateRevision] = head.slice(1, 6).map(Number);
  const source = head[6], sourceUidLength = Number(head[7]);
  const sourceUidStart = head[0].length;
  if (!safe(seed, 0xffff_ffff) || !safe(day, 100) || day < 1 || !safe(hourTick, 1600) ||
    hourTick < (day - 1) * 16 || hourTick > day * 16 || !safe(actionCount, 4800) ||
    !safe(stateRevision, Number.MAX_SAFE_INTEGER) || !safe(sourceUidLength, 120) || sourceUidLength < 1 ||
    sourceUidStart + sourceUidLength >= value.length) return null;
  const sourceUid = value.slice(sourceUidStart, sourceUidStart + sourceUidLength);
  const tail = /^:(xuan|fan|ma):(xuan|fan|ma):([A-Za-z0-9_-]+)$/.exec(value.slice(sourceUidStart + sourceUidLength));
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(sourceUid) || !tail || !workGameRegistry(tail[3], source)) return null;
  const generatedSource = source === 'job' && /^h(\d+):(xuan|fan|ma):([A-Za-z0-9_-]+)$/.exec(sourceUid);
  if (generatedSource) {
    const sourceTick = Number(generatedSource[1]);
    if (!safe(sourceTick, 1599) || sourceTick !== hourTick - 1 || Math.floor(sourceTick / 16) + 1 !== day ||
      generatedSource[2] !== tail[1] || generatedSource[3] !== tail[3]) return null;
  }
  return { id: value, seed, day, hourTick, actionCount, stateRevision, source, sourceUid };
}

export function normalizeWorkGames(state) {
  const pending = state?.pending ?? {};
  return { ...state, pending: { ...pending, workGames: pending.workGames === undefined ? [] : pending.workGames },
    workGameCompleted: state.workGameCompleted === undefined ? [] : state.workGameCompleted };
}

export function validateWorkGames(state) {
  const queue = state?.pending?.workGames;
  const completed = state?.workGameCompleted;
  if (queue === undefined && completed === undefined) return { ok: true };
  if (!Array.isArray(queue) || !Array.isArray(completed) || queue.length > 16 || completed.length > 5000 ||
    new Set(completed).size !== completed.length) return { ok: false, reason: '工作挑战列表无效' };
  const completedGames = completed.map(completedWorkGame);
  if (completedGames.some(game => !game) || completedGames.some((game) => game.seed !== state.seed ||
    game.day > state.day || game.hourTick > state.hourTick || game.actionCount > state.actionCount ||
    game.stateRevision >= state.stateRevision)) return { ok: false, reason: '已完成工作挑战无效' };
  const seen = new Set(completed);
  const sources = new Set();
  for (const game of completedGames) {
    const sourceKey = `${game.source}:${game.sourceUid}`;
    if (sources.has(sourceKey)) return { ok: false, reason: '已完成工作挑战无效' };
    sources.add(sourceKey);
  }
  for (const session of queue) {
    if (!object(session) || Object.keys(session).length !== fields.length ||
      fields.some(key => !Object.hasOwn(session, key)) || !safe(session.seed, 0xffff_ffff) ||
      !safe(session.day, 100) || !safe(session.hourTick, 1600) || !safe(session.actionCount, 4800) ||
      !safe(session.stateRevision, Number.MAX_SAFE_INTEGER) || !safe(session.basePay, 10_000) ||
      session.seed !== state.seed || session.day > state.day || session.hourTick > state.hourTick ||
      session.actionCount > state.actionCount || session.stateRevision > state.stateRevision ||
      !['xuan', 'fan', 'ma'].includes(session.controllerId) || session.actorId !== session.controllerId ||
      !['xuan', 'fan', 'ma'].includes(session.actorId) || !['xuan', 'fan', 'ma'].includes(session.jobActorId) ||
      typeof session.sourceUid !== 'string' || !/^[A-Za-z0-9:_-]{1,120}$/.test(session.sourceUid) ||
      !object(session.challenge) || !object(session.progress) || !Array.isArray(session.inputs) || session.inputs.length > 32) {
      return { ok: false, reason: '工作挑战会话无效' };
    }
    const registry = workGameRegistry(session.variant, session.source);
    const id = workGameId(session, { ...session, actorId: session.jobActorId });
    const sourceKey = `${session.source}:${session.sourceUid}`;
    if (!registry || session.id !== id || seen.has(id) || sources.has(sourceKey))
      return { ok: false, reason: '工作挑战身份无效' };
    seen.add(id);
    sources.add(sourceKey);
    let challenge, progress;
    try {
      challenge = registry.create(session.seed, id, session.variant);
      progress = registry.initial(challenge);
      if (!same(challenge, session.challenge)) return { ok: false, reason: '工作挑战题目无效' };
      for (const input of session.inputs) {
        if (!acceptedWorkGameAction(input)) return { ok: false, reason: '工作挑战输入无效' };
        const result = registry.reduce(challenge, progress, input);
        if (result.error) return { ok: false, reason: '工作挑战轨迹无效' };
        progress = result.progress;
      }
    } catch {
      return { ok: false, reason: '工作挑战重放失败' };
    }
    if (!same(progress, session.progress)) return { ok: false, reason: '工作挑战进度无效' };
  }
  return { ok: true };
}
