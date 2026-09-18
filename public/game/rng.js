// 可复现随机：同一 seed 与 key 永远得到同一个数，存档刷新不换结果。
// 彩票在购买时用 ticketId 作 key 锁定，刮开只是演出。

export function rng(seed, key) {
  let h = (seed ^ 2166136261) >>> 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 按整数权重抽下标；weights 之和不要求是 100。
export function weightedIndex(r, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function pick(r, list) {
  if (!list.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

export function intBetween(r, lo, hi) {
  return lo + Math.floor(r * (hi - lo + 1));
}
