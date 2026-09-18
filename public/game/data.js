// 设计数据只有一份：根目录 03 JSON。浏览器经 /data/design.json 取，node 直接读文件。
// 这里不做任何数值改写；平衡改动进 balance.js 的覆盖表，方便对照策划原稿。

let cache = null;

export async function loadData() {
  if (cache) return cache;
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const res = await fetch('/data/design.json');
    if (!res.ok) throw new Error('设计数据加载失败 ' + res.status);
    cache = await res.json();
    return cache;
  }
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const path = fileURLToPath(new URL('../../03_开发数据_商店物品愿望事件100日.json', import.meta.url));
  cache = JSON.parse(await readFile(path, 'utf8'));
  return cache;
}

export function setData(data) {
  cache = data;
}

export function getData() {
  if (!cache) throw new Error('设计数据尚未加载，先 await loadData()');
  return cache;
}

export function indexById(list) {
  const out = Object.create(null);
  for (const x of list) out[x.id] = x;
  return out;
}
