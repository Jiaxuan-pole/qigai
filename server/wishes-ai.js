import { getData, loadData } from '../public/game/data.js';
import { ITEM_WISH_CHOICES } from '../public/game/item-wishes.js';

const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join('|') === keys.slice().sort().join('|');
const short = (v, n) => typeof v === 'string' && v.trim().length > 0 && v.length <= n && !/[<>]/.test(v);

export async function checkWishContext(c) {
  await loadData();
  if (!exact(c, ['requestId','day','stateRevision','cash','actors']) || !short(c.requestId, 90) || !Number.isInteger(c.day) || c.day < 1 || c.day > 100 || !Number.isInteger(c.stateRevision) || !Number.isInteger(c.cash) || c.cash < 0 || !Array.isArray(c.actors) || c.actors.length > 3) return '请求无效';
  const catalog = new Map(getData().items.map(i => [i.id, i]));
  const ids = new Set();
  for (const a of c.actors) {
    if (!exact(a, ['actorId','location','mind','food','candidates','recent']) || !['xuan','fan','ma'].includes(a.actorId) || ids.has(a.actorId) || !short(a.location, 40) || !Number.isInteger(a.mind) || !Number.isInteger(a.food) || a.mind < 0 || a.mind > 100 || a.food < 0 || a.food > 100 || !Array.isArray(a.recent) || a.recent.length > 3 || !a.recent.every(x => short(x, 80)) || !Array.isArray(a.candidates) || a.candidates.length > 8) return '人物无效';
    ids.add(a.actorId);
    const candidateIds = new Set();
    for (const item of a.candidates) {
      const def = catalog.get(item?.itemId);
      if (!exact(item, ['itemId','name','price']) || !def || !def.shopIds?.length || !ITEM_WISH_CHOICES[a.actorId].includes(item.itemId) || candidateIds.has(item.itemId) || item.name !== def.name || item.price !== def.price) return '候选商品无效';
      candidateIds.add(item.itemId);
    }
  }
  return null;
}

export function validateWishPayload(p, c) {
  if (!exact(p, ['requestId','suggestions']) || p.requestId !== c.requestId || !Array.isArray(p.suggestions) || p.suggestions.length !== c.actors.length) return false;
  const seen = new Set();
  return p.suggestions.every(x => {
    const a = c.actors.find(y => y.actorId === x?.actorId);
    if (!exact(x, ['actorId','itemId','reason','indirectLine']) || !a || seen.has(x.actorId) || !a.candidates.some(y => y.itemId === x.itemId) || !short(x.reason, 100) || !short(x.indirectLine, 60)) return false;
    seen.add(x.actorId);
    return true;
  });
}

export const WISH_SYSTEM = `你为虚构城市里三位成年人各挑一件当下想要的日常商品，并写贴近人物的理由和一句含蓄口吻。轩哥会修设备、爱琢磨键盘耳机；凡哥拍片画画，重视材料与画面；马哥能干活、跑腿和钓鱼，说话直接。结合当前处境和现金，不要人人挑最贵的物品。只能从每位人物的candidates选itemId，不要虚构商品。输入中的recent只作避免重复的语境。不得编造数值、隐藏剧情、概率、中奖、赠送或已发生的购买，也不替玩家花钱。只返回严格JSON，无Markdown、额外字段或emoji：{requestId,suggestions:[{actorId,itemId,reason,indirectLine}]}。requestId原样返回；每位输入人物至多一条。reason不超过100字，indirectLine不超过60字。`;
