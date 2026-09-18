import { rng } from './rng.js';

export const acceptedVariantsA = Object.freeze({
  scavenge: { family: 'sorting', title: '回收铺分拣', instructions: '逐件把零件、木料和废铁放进对应筐。', jobId: 'scavenge' },
  bottles: { family: 'sorting', title: '沿街捡瓶罐', instructions: '把塑料瓶、玻璃瓶和铝罐分筐。', jobId: 'bottles' },
  sellBottles: { family: 'sorting', title: '回收铺打包', instructions: '按材质把待售瓶罐装进对应包。', sourceId: 'sellBottles' },
  kitchen: { family: 'memory', title: '早餐帮厨', instructions: '先记住点单，准备好后依原顺序出餐。', jobId: 'kitchen' },
  repair: { family: 'circuit', title: '维修台接线', instructions: '旋转线路板，接通电源与设备。', jobId: 'repair' },
  phonestall: { family: 'circuit', title: '手机摊接线', instructions: '旋转手机排线，接通电源与屏幕。', jobId: 'phonestall' },
  table: { family: 'audit', title: '商户对账', instructions: '核对数量乘单价，指出金额错误的一行。', jobId: 'table' },
  sellFish: { family: 'audit', title: '鱼获估价', instructions: '按店内鱼种基价，指出不合规则的价签。', sourceId: 'sellFish' },
  salvageSell: { family: 'audit', title: '旧物估价', instructions: '按修好物件的店内基价，指出不合规则的价签。', sourceId: 'salvageSell' },
});

const MATERIALS = {
  scavenge: [['parts', '旧零件', '零件筐'], ['wood', '干木料', '木料筐'], ['metal', '废铁片', '金属筐']],
  bottles: [['plastic', '塑料饮料瓶', '塑料袋'], ['glass', '玻璃饮料瓶', '玻璃箱'], ['aluminum', '易拉罐', '铝罐袋']],
  sellBottles: [['plastic', '压扁的塑料瓶', '塑料包'], ['glass', '洗净的玻璃瓶', '玻璃箱'], ['aluminum', '压扁的铝罐', '铝罐包']],
};
const DISHES = [['porridge', '热粥'], ['bun', '菜包'], ['egg', '煮蛋'], ['noodles', '汤面']];
const FISH = [['small', '普通小鱼', 6], ['rare', '少见鱼', 14], ['small2', '另一条普通小鱼', 6]];
const SALVAGE = [['phone', '修好的旧手机', 24], ['radio', '修好的旧收音机', 20], ['headphones', '修好的旧耳机', 26], ['tv', '修好的旧电视', 60]];

function pickIndex(seed, key, length) { return Math.floor(rng(seed, key) * length); }
function invalid(progress, error = '无效操作') { return { progress, error }; }
function exact(input, type, keys) {
  return input && typeof input === 'object' && !Array.isArray(input) && input.type === type
    && Object.keys(input).length === keys.length && keys.every(key => Object.hasOwn(input, key));
}

export function createA(seed, gameId, variant) {
  const meta = typeof variant === 'string' && Object.hasOwn(acceptedVariantsA, variant) ? acceptedVariantsA[variant] : null;
  if (!meta || !Number.isSafeInteger(seed) || typeof gameId !== 'string' || !gameId || gameId.length > 120) {
    throw new TypeError('无效的A族挑战参数');
  }
  const common = { gameId, variant, ...meta };
  if (meta.family === 'sorting') {
    const materials = MATERIALS[variant];
    const pieces = Array.from({ length: 5 }, (_, i) => {
      const material = materials[pickIndex(seed, `${gameId}:piece:${i}`, materials.length)];
      return { id: `piece-${i}`, label: material[1], material: material[0] };
    });
    return { ...common, pieces, bins: materials.map(m => ({ id: m[0], label: m[2] })), maxMoves: pieces.length };
  }
  if (meta.family === 'memory') {
    const order = Array.from({ length: 4 }, (_, i) => DISHES[pickIndex(seed, `${gameId}:dish:${i}`, DISHES.length)][0]);
    return { ...common, dishes: DISHES.map(d => ({ id: d[0], label: d[1] })), order, maxMoves: order.length };
  }
  if (meta.family === 'circuit') {
    const path = [3, 4, 5];
    const tiles = Array.from({ length: 9 }, (_, i) => ({
      id: `tile-${i}`, mask: path.includes(i) ? 10 : (i % 2 ? 3 : 5),
      rotation: pickIndex(seed, `${gameId}:rotation:${i}`, 4),
    }));
    if (path.every(i => tiles[i].rotation % 2 === 0)) tiles[4] = { ...tiles[4], rotation: 1 };
    return { ...common, width: 3, height: 3, tiles, path, start: 3, end: 5, maxMoves: 12 };
  }
  const bad = pickIndex(seed, `${gameId}:wrong-row`, 3);
  let rows;
  if (variant === 'table') {
    const labels = ['早餐摊原料', '回收铺耗材', '维修台工具'];
    rows = labels.map((item, i) => {
      const quantity = 2 + pickIndex(seed, `${gameId}:quantity:${i}`, 4);
      const unitPrice = 3 + pickIndex(seed, `${gameId}:price:${i}`, 6);
      return { id: `row-${i}`, item, quantity, unitPrice, total: quantity * unitPrice + (i === bad ? 2 : 0) };
    });
  } else {
    const tags = variant === 'sellFish' ? FISH : SALVAGE;
    const offset = pickIndex(seed, `${gameId}:tags`, tags.length);
    rows = Array.from({ length: 3 }, (_, i) => {
      const item = tags[(offset + i) % tags.length];
      return { id: `row-${i}`, item: item[1], description: `店内基价${item[2]}元`, basePrice: item[2],
        tagPrice: item[2] + (i === bad ? 3 : 0) };
    });
  }
  return { ...common, rows, answerId: `row-${bad}`, maxMoves: 1 };
}

export function initialA(challenge) {
  switch (challenge.family) {
    case 'sorting': return { done: false, placed: [] };
    case 'memory': return { done: false, phase: 'preview', picks: [] };
    case 'circuit': return { done: false, rotations: challenge.tiles.map(t => t.rotation), moves: 0 };
    case 'audit': return { done: false, selectedId: null };
    default: throw new TypeError('未知的A族机制');
  }
}

function reduceSorting(c, p, input) {
  if (!exact(input, 'place', ['type', 'pieceId', 'binId'])) return invalid(p);
  const piece = c.pieces.find(x => x.id === input.pieceId);
  if (!piece || !c.bins.some(x => x.id === input.binId) || p.placed.some(x => x.pieceId === piece.id)
    || p.placed.length >= c.maxMoves) return invalid(p);
  const placed = [...p.placed, { pieceId: piece.id, binId: input.binId }];
  return { progress: { done: placed.length === c.pieces.length, placed } };
}

function reduceMemory(c, p, input) {
  if (p.phase === 'preview') {
    if (!exact(input, 'ready', ['type'])) return invalid(p);
    return { progress: { ...p, phase: 'recall' } };
  }
  if (!exact(input, 'pick', ['type', 'dishId']) || !c.dishes.some(x => x.id === input.dishId)
    || p.picks.length >= c.maxMoves) return invalid(p);
  const picks = [...p.picks, input.dishId];
  return { progress: { done: picks.length === c.order.length, phase: 'recall', picks } };
}

function rotate(mask, turns) {
  let out = mask;
  for (let i = 0; i < turns; i++) out = ((out << 1) & 15) | (out >>> 3);
  return out;
}

function connected(c, rotations) {
  const masks = c.tiles.map((tile, i) => rotate(tile.mask, rotations[i]));
  if (!(masks[c.start] & 8) || !(masks[c.end] & 2)) return false;
  const directions = [
    [1, 4, -c.width, i => i >= c.width], [2, 8, 1, i => i % c.width < c.width - 1],
    [4, 1, c.width, i => i < c.tiles.length - c.width], [8, 2, -1, i => i % c.width > 0],
  ];
  const seen = new Set([c.start]);
  const queue = [c.start];
  for (const current of queue) {
    if (current === c.end) return true;
    for (const [bit, opposite, delta, allowed] of directions) {
      const next = current + delta;
      if (allowed(current) && (masks[current] & bit) && (masks[next] & opposite) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

function reduceCircuit(c, p, input) {
  if (exact(input, 'submit', ['type'])) return { progress: { ...p, done: true } };
  if (!exact(input, 'rotate', ['type', 'index']) || !Number.isInteger(input.index)
    || input.index < 0 || input.index >= c.tiles.length || p.moves >= c.maxMoves) return invalid(p);
  const rotations = [...p.rotations];
  rotations[input.index] = (rotations[input.index] + 1) % 4;
  return { progress: { done: false, rotations, moves: p.moves + 1 } };
}

function reduceAudit(c, p, input) {
  if (!exact(input, 'flag', ['type', 'rowId']) || !c.rows.some(x => x.id === input.rowId)) return invalid(p);
  return { progress: { done: true, selectedId: input.rowId } };
}

export function reduceA(challenge, progress, input) {
  if (progress.done) return invalid(progress, '挑战已结束');
  switch (challenge.family) {
    case 'sorting': return reduceSorting(challenge, progress, input);
    case 'memory': return reduceMemory(challenge, progress, input);
    case 'circuit': return reduceCircuit(challenge, progress, input);
    case 'audit': return reduceAudit(challenge, progress, input);
    default: return invalid(progress);
  }
}

export function scoreA(challenge, progress) {
  if (!progress.done) return 0;
  switch (challenge.family) {
    case 'sorting': return Math.round(100 * progress.placed.filter(x =>
      challenge.pieces.find(piece => piece.id === x.pieceId)?.material === x.binId).length / challenge.pieces.length);
    case 'memory': return Math.round(100 * progress.picks.filter((dishId, i) => dishId === challenge.order[i]).length / challenge.order.length);
    case 'circuit': return connected(challenge, progress.rotations) ? 100 : 0;
    case 'audit': return progress.selectedId === challenge.answerId ? 100 : 0;
    default: return 0;
  }
}
