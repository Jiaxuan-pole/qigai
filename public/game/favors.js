// 熟人委托链：每位熟人三步，按顺序解锁；有截止日，失约扣信任并冷却；奖励是解锁与优惠，不是现金。
import { clamp } from './rules.js';
import { relation, REGULARS } from './npcs.js';

// kind: count=完成某些行动 n 次；deliver=把某件物品交到该熟人手上。
export const FAVORS = {
  reg_liu: { name: '刘姐', steps: [
    { id: 'liu1', title: '帮早餐摊顶两个早班', text: '“早上忙不过来，来帮两天。”', kind: 'count', actions: ['kitchen'], need: 2, days: 4, trustMin: 0, reward: { trust: 1, flag: 'liuBonusMeal', text: '刘姐以后每次帮厨多给一份饭。' } },
    { id: 'liu2', title: '早市进货搬两趟', text: '“进货的车只到市场口，你们腿脚快。”', kind: 'count', actions: ['carry'], zone: 'market', need: 2, days: 4, trustMin: 1, reward: { trust: 1, flag: 'liuCredit', text: '刘姐允许赊账：现金不够时每天可赊一份正餐（次日自动扣）。' } },
    { id: 'liu3', title: '给王叔送一份热汤', text: '“服务站那老王胃不好，替我带一份。”', kind: 'deliver', item: 'hot_soup', to: 'reg_wang', days: 3, trustMin: 2, reward: { trust: 1, flag: 'liuSecondShift', text: '刘姐介绍了第二个帮厨位：早餐帮厨每天可安排两人。' } },
  ] },
  reg_chen: { name: '老陈', steps: [
    { id: 'chen1', title: '站口跑三趟腿', text: '“先看看你稳不稳。”', kind: 'count', actions: ['run'], need: 3, days: 4, trustMin: 0, reward: { trust: 1, flag: 'chenCart', text: '老陈的推车可以借了（搬运收入+6）。' } },
    { id: 'chen2', title: '接一单工友的搬箱活', text: '“有人找我要人，我先推你。”', kind: 'count', actions: ['oddjob', 'carry'], need: 1, days: 3, trustMin: 1, reward: { trust: 1, flag: 'chenFixedRun', text: '站口固定跑腿位：跑腿每单+3。' } },
    { id: 'chen3', title: '请老陈喝一罐', text: '“不图你的，图个交情。”', kind: 'deliver', item: 'beer', to: 'reg_chen', days: 3, trustMin: 2, reward: { trust: 1, flag: 'chenNightWatch', text: '老陈介绍了看仓夜班：马哥晚间在站前街可接“临时短工”热点时收入+10。' } },
  ] },
  reg_lu: { name: '鲁叔', steps: [
    { id: 'lu1', title: '回收巷做三次分类', text: '“先把手练熟。”', kind: 'count', actions: ['scavenge'], need: 3, days: 4, trustMin: 0, reward: { trust: 1, flag: 'luToolkit', text: '鲁叔的工具箱可以借了（每天一次维修不耗零件）。' } },
    { id: 'lu2', title: '修好一件旧电器给他看', text: '“别光说会修。”', kind: 'count', actions: ['repair_item'], need: 1, days: 6, trustMin: 1, reward: { trust: 1, flag: 'luBetterPrice', text: '老周收旧物给价+20%。' } },
    { id: 'lu3', title: '帮仓库清一次危棚', text: '“危险，但我只信你们。”', kind: 'count', actions: ['danger'], need: 1, days: 5, trustMin: 2, reward: { trust: 1, flag: 'luStorage', text: '鲁叔给了仓库钥匙：暴雨和寒潮期间营地箱物品自动寄存不受潮。' } },
  ] },
  reg_xu: { name: '许姐', steps: [
    { id: 'xu1', title: '交两张街头速写', text: '“画得像不像不重要，像街就行。”', kind: 'count', actions: ['sketch', 'graffiti'], need: 2, days: 4, trustMin: 0, reward: { trust: 1, flag: 'xuStudio', text: '许姐的工作位可以借了（剪辑不占唯一电脑）。' } },
    { id: 'xu2', title: '剪出一段能放的东西', text: '“素材再多不剪也是素材。”', kind: 'count', actions: ['edit'], need: 2, days: 6, trustMin: 1, reward: { trust: 1, flag: 'xuVenue', text: '许姐的工作间可以放片了（放映事件更常出现）。' } },
    { id: 'xu3', title: '拍一单商户宣传给她看成品', text: '“有人问我要会拍的人。”', kind: 'count', actions: ['shoot'], need: 1, days: 5, trustMin: 2, reward: { trust: 1, flag: 'xuContract', text: '许姐介绍了商拍合同：商户宣传拍摄每单+8。' } },
  ] },
  reg_wang: { name: '王叔', steps: [
    { id: 'wang1', title: '把自己收拾干净三次', text: '“先照顾好自己，再说别的。”', kind: 'count', actions: ['wash', 'warm', 'bath'], need: 3, days: 5, trustMin: 0, reward: { trust: 1, flag: 'wangShelter', text: '服务站临时过夜区对你们随时开放。' } },
    { id: 'wang2', title: '给候车室的人送一份饭', text: '“有个人三天没吃东西。”', kind: 'deliver', item: 'meal', to: 'reg_wang', days: 3, trustMin: 1, reward: { trust: 1, flag: 'wangSoup', text: '服务站免费餐每天可领三份。' } },
    { id: 'wang3', title: '陪一次送援或去诊所建计划', text: '“懂得求助不丢人。”', kind: 'count', actions: ['rescue', 'clinic', 'aid'], need: 1, days: 8, trustMin: 2, reward: { trust: 1, flag: 'wangHalfClinic', text: '诊所评估半价（9）。' } },
  ] },
};

function rec(state, npcId) {
  state.favors = state.favors || {};
  if (!state.favors[npcId]) state.favors[npcId] = { step: 0, active: null, done: [], cooldownUntil: 0 };
  return state.favors[npcId];
}

export function favorStatus(state, npcId) {
  const chain = FAVORS[npcId];
  if (!chain) return null;
  const r = rec(state, npcId);
  const step = chain.steps[r.step] || null;
  return { chain, rec: r, step, finished: !step, active: r.active };
}

// 接受委托：人在该熟人街区、信任达标、没有进行中的、不在冷却。
export function acceptFavor(state, npcId, actorId) {
  const st = favorStatus(state, npcId);
  if (!st || !st.step) return { error: '这位熟人没有新的委托了' };
  if (st.active) return { error: '上一件还没做完' };
  if (st.rec.cooldownUntil > state.day) return { error: '上次失约了，第' + st.rec.cooldownUntil + '天以后再来' };
  const reg = REGULARS.find((x) => x.id === npcId);
  if (state.actors[actorId].location !== reg.district) return { error: '人要在' + reg.name + '的街区才能接' };
  if (relation(state, npcId).trust < st.step.trustMin) return { error: '信任还不够（需' + st.step.trustMin + '）' };
  st.rec.active = { id: st.step.id, progress: 0, deadline: state.day + st.step.days, acceptedDay: state.day };
  return { ok: true, step: st.step };
}

// 结算里每完成一格行动调用一次。
export function noteAction(state, actorId, actionId, zone) {
  for (const [npcId, r] of Object.entries(state.favors || {})) {
    if (!r.active) continue;
    const step = FAVORS[npcId].steps.find((x) => x.id === r.active.id);
    if (!step || step.kind !== 'count' || !step.actions.includes(actionId)) continue;
    if (step.zone && step.zone !== zone) continue;
    r.active.progress += 1;
  }
}

// 交付类委托：人在目标熟人街区，包里有那件东西。
export function deliverFavor(state, npcId, actorId) {
  const r = (state.favors || {})[npcId];
  if (!r || !r.active) return { error: '没有进行中的委托' };
  const step = FAVORS[npcId].steps.find((x) => x.id === r.active.id);
  if (step.kind !== 'deliver') return { error: '这件委托不是交东西' };
  const to = REGULARS.find((x) => x.id === step.to);
  if (state.actors[actorId].location !== to.district) return { error: '要把东西送到' + to.name + '所在的街区' };
  const item = state.items.find((x) => x.itemId === step.item && x.container === actorId);
  if (!item) return { error: '包里没有' + step.item };
  state.items = state.items.filter((x) => x.uid !== item.uid);
  r.active.progress = 1;
  return { ok: true };
}

// 每回合末与每日初：完成→发奖；过期→失约。
export function tickFavors(state, events, newDay = false) {
  for (const [npcId, r] of Object.entries(state.favors || {})) {
    if (!r.active) continue;
    const chain = FAVORS[npcId];
    const step = chain.steps.find((x) => x.id === r.active.id);
    const need = step.kind === 'count' ? step.need : 1;
    if (r.active.progress >= need) {
      const rel = relation(state, npcId);
      rel.trust = clamp(rel.trust + (step.reward.trust || 0), 0, 5);
      if (step.reward.flag) state.flags[step.reward.flag] = true;
      r.done.push(step.id); r.step += 1; r.active = null;
      events.push(`${chain.name}的委托「${step.title}」完成：${step.reward.text}`);
    } else if (newDay && state.day > r.active.deadline) {
      const rel = relation(state, npcId);
      rel.trust = clamp(rel.trust - 1, 0, 5);
      r.active = null; r.cooldownUntil = state.day + 3;
      events.push(`${chain.name}的委托「${step.title}」过期了：信任-1，三天内别再去开口。`);
    }
  }
}

export function activeFavors(state) {
  return Object.entries(state.favors || {}).filter(([, r]) => r.active).map(([npcId, r]) => ({ npcId, chain: FAVORS[npcId], step: FAVORS[npcId].steps.find((x) => x.id === r.active.id), active: r.active }));
}
