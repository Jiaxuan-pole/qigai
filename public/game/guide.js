// 前三天新手引导任务链：每天几件按顺序做的小事，完成与否全部从存档状态推导，不另记进度，
// 玩家自己做了也算数。跳过写进 flags，跨设备继续时不会再弹。
import { copy, active, reserve, NAMES } from './engine.js';
import { getData } from './data.js';
import { itemDef } from './items.js';
import { shopClosedReason, shopDef } from './shop.js';

export const GUIDE_LAST_DAY = 3;

const name = (s, id) => s.names?.[id] || NAMES[id];
const isActive = (s, id) => s.actors?.[id]?.life === 'active';
// 首选某人，不在或不能动就换任何能行动的人。
const pick = (s, preferred) => (isActive(s, preferred) ? preferred : active(s)[0] || null);
const ordered = (s, actionId) => (s.daily?.orders?.[actionId] || 0) > 0;
const plan = (actorId, actionId, zone, label) => (actorId ? { kind: 'plan', actorId, actionId, zone, label } : null);
const mealEvent = (s) => s.events?.find((e) => e.templateId === 'beg_food');
const anyone = (s) => active(s).length > 0;
const liuRecord = (s) => s.favors?.reg_liu;
const shopOpen = (s, shopId) => !shopClosedReason(s, shopId, s.slot);
const bought = (s) => (s.daily?.purchases || 0) > 0;
// 人已经站在店所在街区就直接开店；否则安排「到店采买」走过去，到了会自动开店。
const shopCta = (s, shopId, preferred, walkLabel, shopLabel) => {
  const district = shopDef(shopId).district;
  const there = active(s).find((id) => s.actors[id].location === district);
  return there ? { kind: 'shop', shopId, actorId: there, label: shopLabel } : plan(pick(s, preferred), 'shop', district, walkLabel);
};

const DAYS = {
  1: [
    // 「接过来」是需在场的预约：约了算完成，下一步帮厨把凡哥送到老街，同一小时就领到饭；人没到场事件会退回 open，这一步自然再冒出来。
    { id: 'd1_meal', title: '先去老街领那份赠餐', why: '街上的热点只停留几回合。让凡哥接过来，下一步帮厨他正好在老街。',
      // directorTick 会把处理过的事件从列表里剪掉：第 1 天不在列表里就只可能是已经处理或过期，都算这步过去了。
      done: (s) => ['resolved', 'reserved'].includes(mealEvent(s)?.status) || (!mealEvent(s) && s.turn > 0), possible: (s) => mealEvent(s)?.status === 'open', cta: (s) => ({ kind: 'event', eventUid: mealEvent(s).uid, actorId: pick(s, 'fan'), label: '看这个热点' }) },
    { id: 'd1_kitchen', title: '让凡哥去早餐摊帮厨', why: '收入6还多得一份饭，全队每天一个岗位，只在清晨。',
      done: (s) => ordered(s, 'kitchen'), possible: (s) => s.slot === 0 && isActive(s, 'fan'), cta: () => plan('fan', 'kitchen', 'market', '凡哥去帮厨') },
    { id: 'd1_scavenge', title: '让轩哥去回收巷分类回收', why: '稳定的5块收入，还能攒零件和木料；卫生会掉，晚点去洗。',
      done: (s) => ordered(s, 'scavenge'), possible: (s) => isActive(s, 'xuan'), cta: () => plan('xuan', 'scavenge', 'recycle', '轩哥去回收') },
    { id: 'd1_shop', title: '到老街便利店买一样东西', why: '站在店旁边随时能买，买吃的不设限；饭钱保护只拦博彩和消遣，别把现金花光。',
      done: bought, possible: (s) => anyone(s) && shopOpen(s, 'convenience'), cta: (s) => shopCta(s, 'convenience', 'xuan', '去便利店', '进便利店看看') },
    { id: 'd1_evening', title: '把今天过完', why: '剩下的小时自己排，或按「结束今天」自动排满；傍晚桥下会有新面孔。',
      done: () => false, possible: () => true, cta: () => ({ kind: 'endDay', label: '结束今天' }) },
  ],
  2: [
    { id: 'd2_ticket', title: (s) => `让${name(s, pick(s, 'ma'))}去站前彩票亭买一张`, why: '马哥彩票运好；彩票亭 10 点开门，付费博彩全队每天两次，动到饭钱就买不了。',
      done: (s) => (s.ticketSeq || 0) > 0, possible: (s) => anyone(s) && shopOpen(s, 'lottery_kiosk') && (s.daily?.bets || 0) < getData().rules.gambling.paidActionsTeamDailyCap && s.cash - itemDef('ticket').price >= reserve(s), cta: (s) => shopCta(s, 'lottery_kiosk', 'ma', '去彩票亭', '看看彩票') },
    { id: 'd2_beg', title: '找路人求助一次', why: '每次最多问三位，同一个人全队一天只问一次；被拒也不亏。',
      done: (s) => ordered(s, 'beg') || Object.keys(s.daily?.begged || {}).length > 0, possible: anyone, cta: (s) => plan(pick(s, 'xuan'), 'beg', 'market', '去老街求助') },
    { id: 'd2_bottles', title: '沿街捡瓶罐或翻垃圾桶', why: '不占岗位的零钱来源：瓶罐一元一个，垃圾桶可能翻到吃的和材料。',
      done: (s) => ordered(s, 'bottles') || ordered(s, 'bins') || Object.keys(s.daily?.bins || {}).length > 0, possible: anyone, cta: (s) => plan(pick(s, 'xuan'), 'bottles', 'market', '去捡瓶罐') },
    { id: 'd2_wash', title: '去服务站洗漱一次', why: '卫生低了会生病；水点免费，带肥皂更管用。',
      done: (s) => ordered(s, 'wash') || ordered(s, 'warm'), possible: anyone, cta: (s) => plan(pick(s, 'xuan'), 'wash', 'service', '去洗漱') },
    { id: 'd2_end', title: '试试让队友自己动', why: '「AI安排队友全天」让其他人自己过一天，或按「结束今天」直接跳到夜里。',
      done: () => false, possible: () => true, cta: () => ({ kind: 'endDay', label: '结束今天' }) },
  ],
  3: [
    { id: 'd3_bed', title: (s) => (isActive(s, 'ma') ? `去家具城给${name(s, 'ma')}买张床` : '去家具城买张床'), why: (s) => `基础床${bedPrice()}块，家具城日间与午后开门，买了送到营地包裹；有床的人夜里睡得干燥暖和，不用再挤地铺。现金${s.cash}。`,
      done: (s) => (s.camp?.parcels?.length || 0) > 0 || (s.camp?.beds || 0) > 0, possible: (s) => anyone(s) && s.cash >= bedPrice() && shopOpen(s, 'furniture_store'), cta: (s) => shopCta(s, 'furniture_store', 'xuan', '去家具城', '进家具城看看') },
    { id: 'd3_unpack', title: '回营拆包，把床摆好', why: '包裹不拆不算数；摆好后今晚就能睡上干燥的床。',
      done: (s) => (s.camp?.placements?.length || 0) > 0 || Boolean(s.camp?.parcels?.some((p) => p.status === 'opened')), possible: (s) => Boolean(s.camp?.parcels?.some((p) => p.status === 'sealed')), cta: () => ({ kind: 'camp', label: '打开营地' }) },
    { id: 'd3_wish', title: '回应一个愿望', why: '愿望积压会扣精神；想要东西的给样小物件就解开，想做点什么的要留时间陪着做。',
      done: (s) => Boolean(s.wishes?.some((w) => w.status === 'fulfilled')), possible: (s) => Boolean(activeWish(s)), cta: (s) => { const w = activeWish(s); return w.targetItem ? { kind: 'inventory', actorId: w.actor, label: `看${name(s, w.actor)}的背包` } : { kind: 'wishes', label: '看看愿望板' }; } },
    { id: 'd3_favor', title: '到老街找刘姐接委托', why: '帮她顶两个早班，以后每次帮厨多得一份饭，这是最稳的饭源。',
      done: (s) => Boolean(liuRecord(s)?.active) || (liuRecord(s)?.done?.length || 0) > 0, possible: anyone,
      cta: (s) => { const there = active(s).find((id) => s.actors[id].location === 'market'); return there ? { kind: 'accept', npcId: 'reg_liu', actorId: there, label: '接下刘姐的委托' } : plan(pick(s, 'xuan'), 'bottles', 'market', '去老街找刘姐'); } },
  ],
};

const bedPrice = () => itemDef('bed_basic').price;
// 先挑想要具体物件的愿望：那种能靠背包里的东西当场解开，最适合教学。
const activeWish = (s) => { const list = (s.wishes || []).filter((w) => w.status === 'active' && isActive(s, w.actor)); return list.find((w) => w.targetItem) || list[0]; };

export function guideSteps(state) {
  if (!state || state.flags?.guideOff || !(state.day >= 1 && state.day <= GUIDE_LAST_DAY)) return [];
  return (DAYS[state.day] || []).map((step) => {
    const done = Boolean(step.done(state));
    const possible = done || Boolean(step.possible(state));
    return { id: step.id, day: state.day, title: typeof step.title === 'function' ? step.title(state) : step.title, why: typeof step.why === 'function' ? step.why(state) : step.why, done, possible, cta: !done && possible ? step.cta(state) : null };
  });
}

export function currentGuide(state) {
  const steps = guideSteps(state);
  const step = steps.find((x) => !x.done && x.possible);
  if (!step) return null;
  return { step, index: steps.indexOf(step), total: steps.length, done: steps.filter((x) => x.done).length };
}

export function guideSummary(state) {
  const steps = guideSteps(state);
  return steps.length ? `第${state.day}天引导 ${steps.filter((x) => x.done).length}/${steps.length}` : null;
}

export function skipGuide(input) {
  if (input.flags?.guideOff) return { state: input, events: [] };
  const s = copy(input);
  s.flags.guideOff = true;
  s.stateRevision += 1;
  return { state: s, events: [] };
}
