// 前三天引导任务链：步骤顺序固定，完成与否只从存档状态推导；跳过写进存档而不是浏览器存储。
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, eventChoice, buyNow } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { itemDef } from '../public/game/items.js';
import { GUIDE_LAST_DAY, guideSteps, currentGuide, guideSummary, skipGuide } from '../public/game/guide.js';

before(loadData);

const ids = (state) => guideSteps(state).map((step) => step.id);
const step = (state, id) => guideSteps(state).find((x) => x.id === id);
const meal = (state) => state.events.find((e) => e.templateId === 'beg_food');

test('第 1 天：五步按先后排好，开局一步没做，当前步是先领赠餐', () => {
  const s = fresh(1);
  assert.equal(GUIDE_LAST_DAY, 3);
  assert.deepEqual(ids(s), ['d1_meal', 'd1_kitchen', 'd1_scavenge', 'd1_shop', 'd1_evening']);
  assert.ok(guideSteps(s).every((x) => !x.done && x.title && x.why && x.day === 1));
  const now = currentGuide(s);
  assert.equal(now.step.id, 'd1_meal');
  assert.deepEqual([now.index, now.total, now.done], [0, 5, 0]);
  assert.deepEqual(now.step.cta, { kind: 'event', eventUid: meal(s).uid, actorId: 'fan', label: now.step.cta.label });
  assert.equal(guideSummary(s), '第1天引导 0/5');
});

test('第 1 天：证据齐了就打勾，当前步顺着往下走；预约赠餐就算完成，没到场退回 open 会再冒出来', () => {
  const s = fresh(1);
  s.daily.orders = { kitchen: 1, scavenge: 1 };
  let now = currentGuide(s);
  assert.equal(now.step.id, 'd1_meal', '帮厨回收做完了，赠餐还没约就仍是当前步');
  assert.equal(now.done, 2);
  meal(s).status = 'reserved';
  now = currentGuide(s);
  assert.equal(step(s, 'd1_meal').done, true);
  assert.equal(now.step.id, 'd1_shop');
  assert.deepEqual(now.step.cta, { kind: 'plan', actorId: 'xuan', actionId: 'shop', zone: 'market', label: now.step.cta.label });
  meal(s).status = 'open';
  assert.equal(currentGuide(s).step.id, 'd1_meal', '预约没到场被退回后，这一步重新出现');
  meal(s).status = 'resolved';
  s.daily.purchases = 1;
  now = currentGuide(s);
  assert.equal(now.step.id, 'd1_evening');
  assert.deepEqual(now.step.cta, { kind: 'endDay', label: now.step.cta.label });
  assert.equal(guideSummary(s), '第1天引导 4/5');
});

test('第 1 天：错过清晨就跳过帮厨；热点过期、便利店提前关门也跳过', () => {
  const s = fresh(1);
  s.hour = 10; s.slot = 1;
  assert.equal(step(s, 'd1_kitchen').possible, false);
  meal(s).status = 'expired';
  assert.equal(step(s, 'd1_meal').possible, false);
  assert.equal(currentGuide(s).step.id, 'd1_scavenge');
  assert.equal(currentGuide(s).total, 5, '跳过的步骤仍算在总数里');
  s.daily.orders = { scavenge: 1 };
  s.shops.convenience.closedSlots.push(1);
  assert.equal(step(s, 'd1_shop').possible, false);
  assert.equal(currentGuide(s).step.id, 'd1_evening');
});

test('第 1 天：真实事件预约与真实结算都能让步骤完成，饭进凡哥的包', () => {
  let s = fresh(1);
  s.pendingMorning = null;
  s = eventChoice(s, meal(s).uid, 'accept', 'fan').state;
  assert.equal(meal(s).status, 'reserved');
  assert.equal(step(s, 'd1_meal').done, true);
  assert.equal(currentGuide(s).step.id, 'd1_kitchen');
  // 开局排程表已经排了凡哥帮厨（老街）、轩哥回收：结算这一小时，赠餐在场领到，三步都打勾。
  const settled = settle(s);
  assert.equal(settled.error, undefined, settled.error);
  assert.equal(meal(settled.state).status, 'resolved');
  assert.ok(settled.state.items.some((item) => item.itemId === 'meal' && item.container === 'fan'));
  assert.deepEqual(guideSteps(settled.state).filter((x) => x.done).map((x) => x.id), ['d1_meal', 'd1_kitchen', 'd1_scavenge']);
  assert.equal(currentGuide(settled.state).step.id, 'd1_shop');
  // directorTick 之后处理过的事件会从列表里消失，这步不能因此退回未完成。
  settled.state.events = settled.state.events.filter((e) => e.templateId !== 'beg_food');
  settled.state.turn = 1;
  assert.equal(step(settled.state, 'd1_meal').done, true);
});

test('第 1 天：到店买过东西才算，澡堂诊所那类支出不算；人在店门口就直接开店', () => {
  const s = fresh(8);
  s.pendingMorning = null;
  s.ledger.expense = 10;
  assert.equal(step(s, 'd1_shop').done, false);
  assert.deepEqual(step(s, 'd1_shop').cta, { kind: 'plan', actorId: 'xuan', actionId: 'shop', zone: 'market', label: step(s, 'd1_shop').cta.label });
  s.actors.xuan.location = 'market';
  assert.deepEqual(step(s, 'd1_shop').cta, { kind: 'shop', shopId: 'convenience', actorId: 'xuan', label: step(s, 'd1_shop').cta.label });
  const itemId = Object.keys(s.shops.convenience.stock).find((id) => itemDef(id)?.price > 0);
  const r = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId, qty: 1 }], 'self');
  assert.equal(r.error, undefined, r.error);
  assert.equal(step(r.state, 'd1_shop').done, true);
  assert.equal(step(s, 'd1_shop').done, false, '原状态不动');
});

test('第 2 天：彩票（亭子开门后）、乞讨、瓶罐、洗漱、结束今天', () => {
  const s = fresh(2);
  s.day = 2; s.hour = 6; s.slot = 0; s.actors.ma.life = 'active'; s.metMa = true;
  assert.deepEqual(ids(s), ['d2_ticket', 'd2_beg', 'd2_bottles', 'd2_wash', 'd2_end']);
  assert.equal(step(s, 'd2_ticket').possible, false, '清晨彩票亭没开');
  assert.equal(currentGuide(s).step.id, 'd2_beg');
  s.hour = 10; s.slot = 1;
  let now = currentGuide(s);
  assert.deepEqual(now.step.cta, { kind: 'plan', actorId: 'ma', actionId: 'shop', zone: 'station', label: now.step.cta.label });
  assert.match(now.step.title, /马哥/);
  s.daily.bets = 2;
  assert.equal(step(s, 'd2_ticket').possible, false, '付费博彩额度用完就不点名');
  s.daily.bets = 0;
  const cash = s.cash;
  s.cash = 5;
  assert.equal(step(s, 'd2_ticket').possible, false, '动到饭钱就不点名');
  s.cash = cash;
  s.actors.ma.location = 'station';
  assert.deepEqual(step(s, 'd2_ticket').cta, { kind: 'shop', shopId: 'lottery_kiosk', actorId: 'ma', label: step(s, 'd2_ticket').cta.label });
  s.ticketSeq = 1;
  now = currentGuide(s);
  assert.equal(now.step.id, 'd2_beg');
  assert.equal(now.step.cta.actionId, 'beg');
  s.daily.begged = { p1: 'xuan' };
  now = currentGuide(s);
  assert.equal(now.step.id, 'd2_bottles');
  s.daily.orders = { bins: 1 };
  now = currentGuide(s);
  assert.equal(now.step.id, 'd2_wash');
  assert.deepEqual(now.step.cta, { kind: 'plan', actorId: 'xuan', actionId: 'wash', zone: 'service', label: now.step.cta.label });
  s.daily.orders.warm = 1;
  now = currentGuide(s);
  assert.equal(now.step.id, 'd2_end');
  assert.equal(now.step.cta.kind, 'endDay');
  assert.equal(guideSummary(s), '第2天引导 4/5');
});

test('第 2 天：马哥不在时彩票步由其他人顶上', () => {
  const s = fresh(3);
  s.day = 2; s.hour = 10; s.slot = 1;
  assert.equal(s.actors.ma.life, 'unrecruited');
  assert.equal(currentGuide(s).step.cta.actorId, 'xuan');
  assert.match(currentGuide(s).step.title, /轩哥/);
});

test('第 3 天：买床、拆包、回应愿望、找刘姐；家具城没开或买不起就先跳过', () => {
  const s = fresh(4);
  s.day = 3; s.actors.ma.life = 'active'; s.metMa = true;
  assert.deepEqual(ids(s), ['d3_bed', 'd3_unpack', 'd3_wish', 'd3_favor']);
  s.cash = itemDef('bed_basic').price;
  assert.equal(step(s, 'd3_bed').possible, false, '清晨家具城没开');
  s.hour = 10; s.slot = 1;
  let now = currentGuide(s);
  assert.deepEqual(now.step.cta, { kind: 'plan', actorId: 'xuan', actionId: 'shop', zone: 'furniture', label: now.step.cta.label });
  s.cash = 5;
  assert.equal(step(s, 'd3_bed').possible, false);
  assert.equal(step(s, 'd3_unpack').possible, false, '没有包裹就没得拆');
  assert.equal(currentGuide(s).step.id, 'd3_favor', '没有愿望时跳到找刘姐');
  s.camp.parcels.push({ id: 'pc1', itemUids: [], status: 'sealed', createdDay: 3, createdHour: 8 });
  now = currentGuide(s);
  assert.equal(step(s, 'd3_bed').done, true);
  assert.equal(now.step.id, 'd3_unpack');
  assert.deepEqual(now.step.cta, { kind: 'camp', label: now.step.cta.label });
  s.camp.placements.push({ uid: 'i1', slot: 0 });
  s.wishes.push({ uid: 'w1', actor: 'fan', status: 'active', templateId: 'fan_paint' });
  now = currentGuide(s);
  assert.equal(now.step.id, 'd3_wish');
  assert.deepEqual(now.step.cta, { kind: 'wishes', label: now.step.cta.label }, '行为愿望开愿望板');
  s.wishes.push({ uid: 'w2', actor: 'ma', status: 'active', templateId: 'item_cigarette', targetItem: 'cigarette' });
  now = currentGuide(s);
  assert.deepEqual(now.step.cta, { kind: 'inventory', actorId: 'ma', label: now.step.cta.label }, '优先挑想要物件的愿望，开那个人的背包');
  s.wishes[0].status = 'fulfilled';
  now = currentGuide(s);
  assert.equal(now.step.id, 'd3_favor');
  assert.deepEqual(now.step.cta, { kind: 'plan', actorId: 'xuan', actionId: 'bottles', zone: 'market', label: now.step.cta.label });
  s.actors.xuan.location = 'market';
  assert.deepEqual(currentGuide(s).step.cta, { kind: 'accept', npcId: 'reg_liu', actorId: 'xuan', label: currentGuide(s).step.cta.label });
  s.favors.reg_liu = { active: { id: 'liu1', progress: 0 }, done: [], step: 0 };
  assert.equal(currentGuide(s), null, '第 3 天全部做完就没有当前步');
  assert.equal(guideSummary(s), '第3天引导 4/4');
});

test('不可行动的人不会被点名', () => {
  const s = fresh(5);
  s.actors.fan.life = 'dead';
  assert.equal(step(s, 'd1_kitchen').possible, false);
  assert.equal(currentGuide(s).step.cta.actorId, 'xuan', '赠餐改由轩哥去接');
  meal(s).status = 'expired';
  assert.equal(currentGuide(s).step.id, 'd1_scavenge');
});

test('跳过引导写进存档，原状态不动，第 4 天起自然结束', () => {
  const s = fresh(6);
  const revision = s.stateRevision;
  const off = skipGuide(s);
  assert.equal(off.state.flags.guideOff, true);
  assert.equal(off.state.stateRevision, revision + 1);
  assert.equal(s.flags.guideOff, undefined);
  assert.deepEqual(guideSteps(off.state), []);
  assert.equal(currentGuide(off.state), null);
  assert.equal(guideSummary(off.state), null);
  assert.equal(skipGuide(off.state).state, off.state, '已关闭时原样返回');
  const later = fresh(7);
  later.day = 4;
  assert.deepEqual(guideSteps(later), []);
  assert.equal(currentGuide(later), null);
});
