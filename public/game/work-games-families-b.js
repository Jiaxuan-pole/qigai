import { rng } from './rng.js';

export const acceptedVariantsB = {
  shoot: { jobId: 'shoot', family: 'camera', title: '商户宣传拍摄', instructions: '移动取景框，将招牌放在焦点内，再拍摄。' },
  edit: { jobId: 'edit', family: 'sequence', title: '剪辑小委托', instructions: '按故事先后选出镜头。' },
  deliverProject: { sourceId: 'deliverProject', family: 'sequence', title: '成片审片', instructions: '按放映顺序核对成片镜头。' },
  run: { jobId: 'run', family: 'route', title: '街头跑腿', instructions: '沿街格逐步行进，绕开封路到达送件点。' },
  oddjob: { jobId: 'oddjob', family: 'route', title: '临时短工', instructions: '带工具穿过工地通道到指定摊位。' },
  carry: { jobId: 'carry', family: 'balance', title: '搬运短工', instructions: '按货物偏重调整重心，再选通道前进。' },
  danger: { jobId: 'danger', family: 'balance', title: '危棚翻找', instructions: '避开破损地板，稳住重心再穿过每段棚道。' },
  coop: { jobId: 'coop', family: 'relay', title: '轩凡联合商户单', instructions: '按各站亮起的信号传递设备。' },
  trio: { jobId: 'trio', family: 'relay', title: '三人布场委托', instructions: '三站依次响应灯号，交接布景材料。' },
  shellgame: { jobId: 'shellgame', family: 'cups', title: '站口猜球', instructions: '逐次看清两杯交换，最后选球所在的杯。' },
};

const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const sample = (seed, key, count) => Math.floor(rng(seed, key) * count);
const error = (progress, reason) => ({ progress, error: reason });
const acceptedInput = (input, fields) => input && typeof input === 'object' && !Array.isArray(input)
  && Object.keys(input).every((key) => fields.includes(key));

export function createB(seed, gameId, variant) {
  const meta = Object.hasOwn(acceptedVariantsB, variant) ? acceptedVariantsB[variant] : null;
  if (!meta || !Number.isInteger(seed) || typeof gameId !== 'string' || !gameId) throw new TypeError('invalid work game');
  const key = `${gameId}:${variant}`;
  const common = { variant, family: meta.family, title: meta.title, instructions: meta.instructions };
  if (meta.family === 'camera') {
    return { ...common, subject: '早市招牌', width: 5, height: 4,
      target: { x: 2 + sample(seed, key + ':x', 2), y: 1 + sample(seed, key + ':y', 2) },
      focusRadius: 0, maxMoves: 9 };
  }
  if (meta.family === 'sequence') {
    const cards = variant === 'edit'
      ? [{ id: 'arrival', label: '进店开场' }, { id: 'detail', label: '商品特写' }, { id: 'closing', label: '店主挥手' }]
      : [{ id: 'slate', label: '片头板' }, { id: 'proof', label: '样片检查' }, { id: 'approval', label: '交付签收' }];
    const offset = sample(seed, key + ':order', cards.length);
    return { ...common, cards: cards.map((_, i) => cards[(i + offset) % cards.length]),
      correctOrder: cards.map((card) => card.id), scene: variant === 'edit' ? '剪辑台' : '影院审片间' };
  }
  if (meta.family === 'route') {
    const upper = sample(seed, key + ':lane', 2) === 0;
    const solution = upper ? ['right', 'right', 'right', 'right', 'down'] : ['down', 'right', 'right', 'right', 'right'];
    const blocked = upper ? [{ x: 1, y: 1 }, { x: 3, y: 1 }] : [{ x: 1, y: 0 }, { x: 3, y: 0 }];
    return { ...common, width: 5, height: 2, start: { x: 0, y: 0 }, goal: { x: 4, y: 1 },
      blocked, solution, maxMoves: 7, cargo: variant === 'run' ? '封好的信件' : '借来的扳手',
      destination: variant === 'run' ? '站口收件台' : '工地摊位' };
  }
  if (meta.family === 'balance') {
    const count = variant === 'danger' ? 4 : 3;
    const stages = Array.from({ length: count }, (_, i) => {
      const balance = sample(seed, `${key}:balance:${i}`, 2) ? 'right' : 'left';
      const safeLane = sample(seed, `${key}:lane:${i}`, 2);
      return { balance, safeLane, obstacle: variant === 'danger' ? (safeLane ? '左侧破洞' : '右侧碎木') : (safeLane ? '左侧堆箱' : '右侧手推车') };
    });
    return { ...common, stages, cargo: variant === 'danger' ? '危棚材料' : '成箱货物', maxStrikes: 2 };
  }
  if (meta.family === 'relay') {
    const names = variant === 'coop' ? ['轩哥组装', '凡哥取景'] : ['轩哥布线', '凡哥打光', '马哥运景'];
    const cues = ['red', 'green', 'blue'];
    return { ...common, stations: names.map((label, i) => ({ id: `station-${i}`, label,
      cue: cues[sample(seed, `${key}:cue:${i}`, cues.length)] })), maxMistakes: 2 };
  }
  const startCup = sample(seed, key + ':ball', 3);
  const swaps = Array.from({ length: 4 }, (_, i) => {
    const a = sample(seed, `${key}:swap:${i}`, 3);
    return [a, (a + 1 + sample(seed, `${key}:offset:${i}`, 2)) % 3];
  });
  return { ...common, startCup, swaps, cups: ['左杯', '中杯', '右杯'] };
}

export function initialB(challenge) {
  switch (challenge.family) {
    case 'camera': return { x: 0, y: 0, moves: 0, shot: false, done: false };
    case 'sequence': return { selected: [], mistakes: 0, done: false };
    case 'route': return { ...challenge.start, moves: 0, hits: 0, done: false };
    case 'balance': return { stage: 0, lean: null, strikes: 0, done: false };
    case 'relay': return { station: 0, mistakes: 0, done: false };
    case 'cups': return { swapIndex: 0, trackedCup: challenge.startCup, choice: null, done: false };
    default: throw new TypeError('unknown family');
  }
}

export function reduceB(challenge, progress, input) {
  if (!Object.hasOwn(acceptedVariantsB, challenge?.variant) || challenge.family !== acceptedVariantsB[challenge.variant].family)
    return error(progress, 'unknown challenge');
  if (!progress || progress.done) return error(progress, 'finished');
  if (!acceptedInput(input, ['type', 'direction', 'cardId', 'lane', 'station', 'cue', 'swapIndex', 'cup', 'score', 'cash']))
    return error(progress, 'invalid input');
  if ('score' in input || 'cash' in input) return error(progress, 'forbidden field');
  switch (challenge.family) {
    case 'camera': {
      if (input.type === 'shoot' && Object.keys(input).length === 1)
        return { progress: { ...progress, shot: true, done: true } };
      if (input.type !== 'move' || typeof input.direction !== 'string' || !Object.hasOwn(directions, input.direction) || Object.keys(input).length !== 2)
        return error(progress, 'invalid camera action');
      const [dx, dy] = directions[input.direction];
      const x = progress.x + dx, y = progress.y + dy;
      if (x < 0 || x >= challenge.width || y < 0 || y >= challenge.height || progress.moves >= challenge.maxMoves)
        return error(progress, 'outside viewfinder');
      return { progress: { ...progress, x, y, moves: progress.moves + 1 } };
    }
    case 'sequence': {
      if (input.type !== 'select' || Object.keys(input).length !== 2 ||
        !challenge.cards.some((card) => card.id === input.cardId) || progress.selected.includes(input.cardId))
        return error(progress, 'invalid clip');
      const selected = [...progress.selected, input.cardId];
      const mistakes = progress.mistakes + Number(input.cardId !== challenge.correctOrder[progress.selected.length]);
      return { progress: { selected, mistakes, done: selected.length === challenge.cards.length } };
    }
    case 'route': {
      if (input.type !== 'move' || typeof input.direction !== 'string' || !Object.hasOwn(directions, input.direction) || Object.keys(input).length !== 2)
        return error(progress, 'invalid direction');
      const [dx, dy] = directions[input.direction];
      const x = progress.x + dx, y = progress.y + dy;
      if (x < 0 || x >= challenge.width || y < 0 || y >= challenge.height ||
        challenge.blocked.some((cell) => cell.x === x && cell.y === y) || progress.moves >= challenge.maxMoves)
        return error(progress, 'blocked road');
      return { progress: { ...progress, x, y, moves: progress.moves + 1,
        done: x === challenge.goal.x && y === challenge.goal.y || progress.moves + 1 >= challenge.maxMoves } };
    }
    case 'balance': {
      const stage = challenge.stages[progress.stage];
      if (input.type === 'shift' && Object.keys(input).length === 2 && ['left', 'right'].includes(input.direction))
        return { progress: { ...progress, lean: input.direction } };
      if (input.type !== 'advance' || Object.keys(input).length !== 2 || ![0, 1].includes(input.lane) || !progress.lean)
        return error(progress, 'invalid advance');
      const strikes = progress.strikes + Number(progress.lean !== stage.balance) + Number(input.lane !== stage.safeLane);
      const nextStage = progress.stage + 1;
      return { progress: { stage: nextStage, lean: null, strikes,
        done: nextStage === challenge.stages.length || strikes >= challenge.maxStrikes } };
    }
    case 'relay': {
      const station = challenge.stations[progress.station];
      if (input.type !== 'pass' || Object.keys(input).length !== 3 || input.station !== station.id ||
        !['red', 'green', 'blue'].includes(input.cue)) return error(progress, 'invalid handoff');
      const mistakes = progress.mistakes + Number(input.cue !== station.cue);
      const nextStation = progress.station + 1;
      return { progress: { station: nextStation, mistakes,
        done: nextStation === challenge.stations.length || mistakes >= challenge.maxMistakes } };
    }
    case 'cups': {
      if (input.type === 'watch' && Object.keys(input).length === 2 && input.swapIndex === progress.swapIndex) {
        if (progress.swapIndex >= challenge.swaps.length) return error(progress, 'swaps ended');
        const [a, b] = challenge.swaps[progress.swapIndex];
        const trackedCup = progress.trackedCup === a ? b : progress.trackedCup === b ? a : progress.trackedCup;
        return { progress: { ...progress, trackedCup, swapIndex: progress.swapIndex + 1 } };
      }
      if (input.type === 'choose' && Object.keys(input).length === 2 && progress.swapIndex === challenge.swaps.length &&
        Number.isInteger(input.cup) && input.cup >= 0 && input.cup < 3)
        return { progress: { ...progress, choice: input.cup, done: true } };
      return error(progress, 'invalid cup step');
    }
    default: return error(progress, 'unknown family');
  }
}

export function scoreB(challenge, progress) {
  if (!progress?.done || !Object.hasOwn(acceptedVariantsB, challenge?.variant)) return 0;
  switch (challenge.family) {
    case 'camera': return progress.shot && Math.abs(progress.x - challenge.target.x) + Math.abs(progress.y - challenge.target.y) <= challenge.focusRadius ? 100 : 0;
    case 'sequence': return Math.max(0, Math.round(100 * (challenge.cards.length - progress.mistakes) / challenge.cards.length));
    case 'route': return progress.x === challenge.goal.x && progress.y === challenge.goal.y
      ? Math.max(0, 100 - Math.max(0, progress.moves - challenge.solution.length) * 15) : 0;
    case 'balance': return progress.stage === challenge.stages.length ? Math.max(0, 100 - progress.strikes * 35) : 0;
    case 'relay': return progress.station === challenge.stations.length ? Math.max(0, 100 - progress.mistakes * 40) : 0;
    case 'cups': return progress.choice === progress.trackedCup ? 100 : 0;
    default: return 0;
  }
}
