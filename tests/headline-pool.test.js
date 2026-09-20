import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh, morningChoice, eventChoice, assign } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { nodeFor } from '../public/game/headlines.js';
import { POOL, TIMED_PACKS, TIMED_TEMPLATES } from '../public/game/headline-pool.js';
import { relation } from '../public/game/npcs.js';
import { makeItem } from '../public/game/items.js';

before(loadData);

// 构造某一天清晨的状态：只动日期、回合、现金与马哥在队情况，其余保持 fresh。
function at(day, { seed = 900, cash = 300, ma = true } = {}) {
  const s = fresh(seed);
  s.day = day; s.turn = (day - 1) * 4; s.hour = 6; s.slot = 0;
  if (ma) { s.actors.ma.life = 'active'; s.metMa = true; }
  s.cash = cash; s.ledger = { start: cash, income: 0, expense: 0 };
  s.pendingMorning = null;
  return s;
}
const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');
const minds = (s) => Object.fromEntries(alive(s).map((id) => [id, s.actors[id].mind]));
const idle = (s) => { for (const id of Object.keys(s.plan)) s.plan[id] = Array(16).fill(null); return s; };
const step = (s) => { const r = settle(s); assert.equal(r.error, undefined, r.error); return r.state; };
const until = (s, hour) => { while (s.hour < hour) s = step(s); return s; };
const pick = (s, id, choiceId) => { s.pendingMorning = nodeFor(s, id); const r = morningChoice(s, choiceId); assert.equal(r.error, undefined, r.error); return r.state; };
const spot = (s, tpl) => s.events.find((e) => e.templateId === tpl);
const entry = (id) => POOL.find((h) => h.id === id);
const trust = (s, npc) => relation(s, npc).trust;

const NEW_IDS = ['ma_two_bosses', 'station_cigs', 'xuan_two_repairs', 'xuan_shoes', 'fan_camera_lend', 'fan_wall_erased', 'lu_flood', 'storm_camp', 'chen_coworker', 'liu_restock', 'newcomer', 'wang_host'];

test('十二件新事都能生成节点；每个热点都有效果包、模板与合法窗口', () => {
  const s = at(30);
  for (const id of NEW_IDS) {
    const h = entry(id);
    assert.ok(h, id);
    assert.ok(h.minDay >= 5 && h.title.length >= 4 && h.title.length <= 9, id + ' 标题与起始日');
    const node = nodeFor(s, id);
    assert.ok(node.title && typeof node.text === 'string' && node.text.length && node.choices.length >= 2, id);
    for (const c of node.choices) assert.ok(typeof c.label === 'string' && c.label.length, id + ':' + c.id);
    for (const c of h.choices) {
      if (!c.spawn) continue;
      for (const sp of [].concat(c.spawn(s))) {
        const pack = TIMED_PACKS[sp.templateId];
        const tpl = TIMED_TEMPLATES.find((t) => t.id === sp.templateId);
        assert.ok(pack?.timed && tpl, id + ' 缺效果包或模板 ' + sp.templateId);
        assert.ok(tpl.districtIds.includes(sp.district), sp.templateId + ' 街区与模板不符');
        assert.ok(sp.window.from >= 6 && sp.window.to <= 22 && sp.window.from < sp.window.to, sp.templateId + ' 窗口');
        for (const pc of pack.choices) assert.ok(['present', 'book', 'instant'].includes(pc.kind) && typeof pc.label === 'string', sp.templateId + ':' + pc.id);
      }
    }
  }
});

test('两头都在找马哥：同一窗口两个热点只认马哥，去了老陈那边鲁叔就记仇，反过来老陈记仇', () => {
  let s = idle(at(10));
  relation(s, 'reg_lu').trust = 2; relation(s, 'reg_chen').trust = 2;
  s = pick(s, 'ma_two_bosses', 'both');
  const spots = s.events.filter((e) => e.window && e.day === 10);
  assert.deepEqual(spots.map((e) => e.district).sort(), ['recycle', 'station']);
  for (const e of spots) { assert.deepEqual(e.window, { from: 14, to: 17 }); assert.deepEqual(e.cast, ['ma']); }
  s = until(s, 14);
  const truck = spot(s, 'chen_truck_spot');
  assert.match(eventChoice(s, truck.uid, 'take', 'xuan').error, /马哥/);
  const booked = eventChoice(s, truck.uid, 'take', 'ma');
  assert.equal(booked.booked, true);
  let after = step(booked.state);
  assert.equal(after.cash, s.cash + 24, '卸车现结24');
  after = until(after, 17);
  assert.equal(spot(after, 'lu_stack_spot').status, 'expired');
  assert.equal(trust(after, 'reg_lu'), 1, '鲁叔白等一下午');
  assert.equal(trust(after, 'reg_chen'), 2);

  const lu = assign(s, 'ma', 14, 'shop', { zone: 'recycle' }).state;
  const r = eventChoice(lu, spot(lu, 'lu_stack_spot').uid, 'stack', 'ma');
  assert.equal(r.error, undefined);
  const twin = step(lu);
  let done = step(r.state);
  assert.equal(done.wood, twin.wood + 3);
  assert.equal(done.cloth, twin.cloth + 2);
  assert.equal(trust(done, 'reg_lu'), 3);
  done = until(done, 17);
  assert.equal(spot(done, 'chen_truck_spot').status, 'expired');
  assert.equal(trust(done, 'reg_chen'), 1, '老陈自己卸了车');

  const skipped = pick(idle(at(10)), 'ma_two_bosses', 'skip');
  assert.equal(trust(skipped, 'reg_lu'), 0);
  assert.equal(skipped.events.filter((e) => e.window).length, 0);
});

test('站前有人卸烟：听老陈的涨信任；拿一条转手要先付30，六成赚二十，四成血本无归还得罪老陈', () => {
  const safe = pick(at(9), 'station_cigs', 'listen');
  assert.equal(trust(safe, 'reg_chen'), 1);
  const poor = at(9, { cash: 20 });
  poor.pendingMorning = nodeFor(poor, 'station_cigs');
  assert.match(morningChoice(poor, 'buy').error, /现金不足/);
  const outcomes = new Set();
  for (let seed = 900; seed < 930; seed++) {
    const s = at(9, { seed });
    relation(s, 'reg_chen').trust = 2;
    const mind = s.actors.ma.mind;
    const r = pick(s, 'station_cigs', 'buy');
    assert.equal(r.ledger.expense, 30);
    if (r.cash === 320) { outcomes.add('win'); assert.equal(r.actors.ma.mind, Math.min(100, mind + 4)); assert.equal(trust(r, 'reg_chen'), 2); }
    else { outcomes.add('lose'); assert.equal(r.cash, 270); assert.equal(r.actors.ma.mind, mind - 6); assert.equal(trust(r, 'reg_chen'), 1); }
  }
  assert.deepEqual([...outcomes].sort(), ['lose', 'win']);
});

test('两家都等轩哥修：刘姐给钱、许姐给人情，各要一块零件，只能去一家，另一家信任-1', () => {
  let s = idle(at(10));
  s.parts = 2; relation(s, 'reg_liu').trust = 2; relation(s, 'reg_xu').trust = 1;
  s = pick(s, 'xuan_two_repairs', 'both');
  const spots = s.events.filter((e) => e.window && e.day === 10);
  assert.deepEqual(spots.map((e) => e.district).sort(), ['cinema', 'market']);
  for (const e of spots) { assert.deepEqual(e.window, { from: 10, to: 13 }); assert.deepEqual(e.cast, ['xuan']); }
  s = until(s, 10);
  const griddle = spot(s, 'liu_griddle_spot');
  assert.match(eventChoice(s, griddle.uid, 'fix', 'fan').error, /轩哥/);
  const broke = JSON.parse(JSON.stringify(s)); broke.parts = 0;
  assert.match(eventChoice(broke, griddle.uid, 'fix', 'xuan').error, /零件/);
  const booked = eventChoice(s, griddle.uid, 'fix', 'xuan');
  assert.equal(booked.booked, true);
  let paid = step(booked.state);
  assert.equal(paid.cash, s.cash + 22);
  assert.equal(paid.parts, 1);
  paid = until(paid, 13);
  assert.equal(spot(paid, 'xu_projector_spot').status, 'expired');
  assert.equal(trust(paid, 'reg_xu'), 0, '许姐等到一点');
  assert.equal(trust(paid, 'reg_liu'), 2);

  const favor = assign(s, 'xuan', 10, 'shop', { zone: 'cinema' }).state;
  const r = eventChoice(favor, spot(favor, 'xu_projector_spot').uid, 'fix', 'xuan');
  assert.equal(r.error, undefined);
  const twin = step(favor);
  let done = step(r.state);
  assert.equal(done.parts, twin.parts - 1);
  assert.equal(done.cash, twin.cash, '许姐不给钱');
  assert.equal(trust(done, 'reg_xu'), 3);
  assert.equal(done.actors.xuan.mind, twin.actors.xuan.mind + 3);
  done = until(done, 13);
  assert.equal(spot(done, 'liu_griddle_spot').status, 'expired');
  assert.equal(trust(done, 'reg_liu'), 1, '刘姐找了修电器的');

  const skipped = pick(idle(at(10)), 'xuan_two_repairs', 'skip');
  assert.equal(trust(skipped, 'reg_xu'), 0);
});

test('轩哥的皮鞋开胶了：有胶带用一格，没胶带就花35或者趿拉一天', () => {
  const s = at(8);
  s.pendingMorning = nodeFor(s, 'xuan_shoes');
  assert.match(morningChoice(s, 'tape').error, /胶带/);
  makeItem(s, 'tape', 'camp');
  const mind = s.actors.xuan.mind;
  const taped = pick(s, 'xuan_shoes', 'tape');
  assert.equal(taped.items.find((x) => x.itemId === 'tape').uses, 4);
  assert.equal(taped.actors.xuan.mind, mind - 1);
  const bought = pick(at(8), 'xuan_shoes', 'shop');
  assert.equal(bought.cash, 300 - 35);
  assert.equal(bought.ledger.expense, 35);
  const poor = at(8, { cash: 30 });
  poor.pendingMorning = nodeFor(poor, 'xuan_shoes');
  assert.match(morningChoice(poor, 'shop').error, /现金不足/);
  const base = at(8);
  const health = base.actors.xuan.health;
  const endured = pick(base, 'xuan_shoes', 'endure');
  assert.equal(endured.actors.xuan.mind, mind - 5);
  assert.equal(endured.actors.xuan.health, health - 4);
});

test('小赵想借相机：借出去当天拍不了，晚上去旧影院取回来电量-1；没去取相机回到营地箱但电用光了', () => {
  let s = idle(at(9));
  relation(s, 'reg_zhao').trust = 2;
  const isCam = (x) => ['camera', 'old_camera'].includes(x.itemId);
  assert.ok(s.items.some(isCam));
  s = pick(s, 'fan_camera_lend', 'lend');
  assert.ok(!s.items.some(isCam), '相机不在队里');
  assert.equal(s.flags.lentCamera, 'old_camera');
  assert.equal(trust(s, 'reg_zhao'), 3);
  const back = spot(s, 'camera_back_spot');
  assert.equal(back.district, 'cinema');
  assert.deepEqual(back.window, { from: 18, to: 21 });
  assert.deepEqual(back.cast, ['fan']);
  const shoot = assign(s, 'fan', 6, 'shoot');
  assert.match((shoot.error ? shoot : settle(shoot.state)).error, /相机/);

  let evening = until(s, 18);
  const battery = evening.battery;
  evening = assign(evening, 'fan', 18, 'shop', { zone: 'cinema' }).state;
  const r = eventChoice(evening, back.uid, 'take', 'fan');
  assert.equal(r.error, undefined);
  const twin = step(evening);
  const got = step(r.state);
  assert.equal(got.items.find(isCam)?.container, 'fan');
  assert.equal(got.battery, battery - 1);
  assert.equal(got.flags.lentCamera, null);
  assert.equal(got.actors.fan.mind, Math.min(100, twin.actors.fan.mind + 6));
  assert.equal(trust(got, 'reg_zhao'), 4);

  const missed = until(s, 21);
  assert.equal(spot(missed, 'camera_back_spot').status, 'expired');
  assert.equal(missed.items.find(isCam)?.container, 'camp');
  assert.equal(missed.battery, 0);
  assert.equal(missed.flags.lentCamera, null);
  assert.equal(trust(missed, 'reg_zhao'), 2);

  const refused = pick(idle(at(9)), 'fan_camera_lend', 'refuse');
  assert.ok(refused.items.some(isCam));
  assert.equal(refused.actors.fan.mind, at(9).actors.fan.mind - 2);
  const bare = at(9); bare.items = bare.items.filter((x) => !isCam(x));
  assert.equal(entry('fan_camera_lend').cond(bare), false);
});

test('墙被刷白了：放弃就少一件作品；答应重画要凡哥下午带颜料到旧影院，没去也少一件', () => {
  const gone = at(10); gone.art = 2;
  const mind = gone.actors.fan.mind;
  const let_go = pick(gone, 'fan_wall_erased', 'let_go');
  assert.equal(let_go.art, 1);
  assert.equal(let_go.actors.fan.mind, mind - 6);

  let s = idle(at(10)); s.art = 2; relation(s, 'reg_zhao').trust = 1;
  s = pick(s, 'fan_wall_erased', 'repaint');
  const wall = spot(s, 'repaint_spot');
  assert.deepEqual([wall.district, wall.window, wall.cast], ['cinema', { from: 14, to: 17 }, ['fan']]);
  s = until(s, 14);
  s = assign(s, 'fan', 14, 'shop', { zone: 'cinema' }).state;
  assert.match(eventChoice(s, wall.uid, 'paint', 'fan').error, /颜料/);
  makeItem(s, 'paint', 'fan');
  const r = eventChoice(s, wall.uid, 'paint', 'fan');
  assert.equal(r.error, undefined);
  const twin = step(s);
  const painted = step(r.state);
  assert.equal(painted.items.find((x) => x.itemId === 'paint').uses, 3);
  assert.equal(painted.art, 2);
  assert.equal(painted.actors.fan.mind, Math.min(100, twin.actors.fan.mind + 8));
  assert.equal(trust(painted, 'reg_zhao'), 2);

  const missed = until(s, 17);
  assert.equal(spot(missed, 'repaint_spot').status, 'expired');
  assert.equal(missed.art, 1);
  assert.ok(missed.log.some((line) => line.includes('作品-1')));
  assert.equal(entry('fan_wall_erased').cond({ ...at(10), art: 0 }), false);
});

test('鲁叔的仓库进水了：只在雨天出现，热点撞早餐时段，去了得料与信任，没去信任-1', () => {
  const h = entry('lu_flood');
  assert.equal(h.cond({ weatherKind: 'rain' }), true);
  assert.equal(h.cond({ weatherKind: 'storm' }), true);
  assert.equal(h.cond({ weatherKind: 'clear' }), false);
  let s = idle(at(8)); s.weatherKind = 'rain'; relation(s, 'reg_lu').trust = 1;
  s = pick(s, 'lu_flood', 'go');
  const flood = spot(s, 'lu_flood_spot');
  assert.equal(flood.district, 'recycle');
  assert.deepEqual(flood.window, { from: 6, to: 10 });
  const going = assign(s, 'ma', 6, 'shop', { zone: 'recycle' }).state;
  const r = eventChoice(going, flood.uid, 'haul', 'ma');
  assert.equal(r.error, undefined);
  const twin = step(going);
  const hauled = step(r.state);
  assert.equal(hauled.wood, twin.wood + 3);
  assert.equal(hauled.cloth, twin.cloth + 2);
  assert.equal(hauled.actors.ma.hygiene, twin.actors.ma.hygiene - 8);
  assert.equal(trust(hauled, 'reg_lu'), 2);

  const missed = until(s, 10);
  assert.equal(spot(missed, 'lu_flood_spot').status, 'expired');
  assert.equal(trust(missed, 'reg_lu'), 0);
  assert.equal(pick(idle(at(8)), 'lu_flood', 'skip').events.filter((e) => e.window).length, 0);
});

test('棚子撑不住了：雨天防雨不满才来；补要木布各2，求王叔要信任，不管就掉防雨和保暖', () => {
  const h = entry('storm_camp');
  assert.equal(h.cond({ weatherKind: 'rain', camp: { rain: 1 } }), true);
  assert.equal(h.cond({ weatherKind: 'rain', camp: { rain: 3 } }), false);
  assert.equal(h.cond({ weatherKind: 'clear', camp: { rain: 1 } }), false);
  const s = at(8); s.weatherKind = 'rain'; s.camp.rain = 1; s.wood = 2; s.cloth = 4;
  const energy = Object.fromEntries(alive(s).map((id) => [id, s.actors[id].energy]));
  const patched = pick(s, 'storm_camp', 'patch');
  assert.equal(patched.wood, 0);
  assert.equal(patched.cloth, 2);
  assert.equal(patched.camp.rain, 2);
  for (const id of alive(s)) assert.equal(patched.actors[id].energy, Math.max(0, energy[id] - 12));
  const short = at(8); short.wood = 1;
  short.pendingMorning = nodeFor(short, 'storm_camp');
  assert.match(morningChoice(short, 'patch').error, /木料/);
  const noWang = at(8);
  noWang.pendingMorning = nodeFor(noWang, 'storm_camp');
  assert.match(morningChoice(noWang, 'wang').error, /王叔/);
  relation(noWang, 'reg_wang').trust = 1;
  assert.equal(pick(noWang, 'storm_camp', 'wang').flags.shelterDay, 8);
  const leak = at(8); leak.camp.rain = 2;
  const warmth = Object.fromEntries(alive(leak).map((id) => [id, leak.actors[id].warmth]));
  const before = minds(leak);
  const leaked = pick(leak, 'storm_camp', 'ignore');
  assert.equal(leaked.camp.rain, 1);
  for (const id of alive(leak)) { assert.equal(leaked.actors[id].warmth, warmth[id] - 10); assert.equal(leaked.actors[id].mind, before[id] - 2); }
});

test('老陈的工友摔了：放20信任+2全员精神+2，放5信任+1，一分不放信任-1全员精神-2', () => {
  const s = at(9); const before = minds(s);
  const big = pick(s, 'chen_coworker', 'give20');
  assert.equal(big.cash, 280);
  assert.equal(big.ledger.expense, 20);
  assert.equal(trust(big, 'reg_chen'), 2);
  for (const id of alive(s)) assert.equal(big.actors[id].mind, Math.min(100, before[id] + 2));
  const small = pick(at(9), 'chen_coworker', 'give5');
  assert.equal(small.cash, 295);
  assert.equal(trust(small, 'reg_chen'), 1);
  const stingy = at(9); relation(stingy, 'reg_chen').trust = 2;
  const none = pick(stingy, 'chen_coworker', 'none');
  assert.equal(none.cash, 300);
  assert.equal(trust(none, 'reg_chen'), 1);
  for (const id of alive(s)) assert.equal(none.actors[id].mind, before[id] - 2);
  const poor = at(9, { cash: 10 });
  poor.pendingMorning = nodeFor(poor, 'chen_coworker');
  assert.match(morningChoice(poor, 'give20').error, /现金不足/);
});

test('刘姐要人看摊：十点到一点看摊给20；答应了没人去，信任-1且明天不能帮厨', () => {
  assert.equal(entry('liu_restock').cond({ flags: { liuClosedDay: 8 }, day: 8 }), false);
  assert.equal(entry('liu_restock').cond({ flags: {}, day: 8 }), true);
  let s = idle(at(8)); relation(s, 'reg_liu').trust = 2;
  s = pick(s, 'liu_restock', 'go');
  const stall = spot(s, 'liu_watch_spot');
  assert.equal(stall.district, 'market');
  assert.deepEqual(stall.window, { from: 10, to: 13 });
  assert.match(eventChoice(s, stall.uid, 'watch', 'fan').error, /10点/);
  s = until(s, 10);
  const booked = eventChoice(s, stall.uid, 'watch', 'fan');
  assert.equal(booked.booked, true);
  const paid = step(booked.state);
  assert.equal(paid.cash, s.cash + 20);
  assert.equal(spot(paid, 'liu_watch_spot').status, 'resolved');
  assert.equal(trust(paid, 'reg_liu'), 2);

  const missed = until(s, 13);
  assert.equal(spot(missed, 'liu_watch_spot').status, 'expired');
  assert.equal(trust(missed, 'reg_liu'), 1);
  assert.equal(missed.flags.liuClosedDay, 9);
  const declined = pick(idle(at(8)), 'liu_restock', 'decline');
  assert.equal(trust(declined, 'reg_liu'), 0);
});

test('桥下多了个人：给饭少一份吃的、脏污+10、全员精神+3、可能留下瓶罐；赶走全员精神-3', () => {
  const s = at(8); const before = minds(s);
  const meals = s.items.filter((x) => x.itemId === 'meal').length;
  const dirt = s.camp.dirt;
  const fed = pick(s, 'newcomer', 'feed');
  assert.equal(fed.items.filter((x) => x.itemId === 'meal').length, meals - 1);
  assert.equal(fed.camp.dirt, dirt + 10);
  for (const id of alive(s)) assert.equal(fed.actors[id].mind, Math.min(100, before[id] + 3));
  assert.ok([0, 6].includes(fed.bottles || 0));
  const bottles = new Set();
  for (let seed = 900; seed < 930; seed++) bottles.add(pick(at(8, { seed }), 'newcomer', 'feed').bottles || 0);
  assert.deepEqual([...bottles].sort(), [0, 6]);
  const empty = at(8); empty.items = empty.items.filter((x) => !['meal', 'bread', 'hot_soup'].includes(x.itemId));
  empty.pendingMorning = nodeFor(empty, 'newcomer');
  assert.match(morningChoice(empty, 'feed').error, /吃的/);
  const chased = pick(at(8), 'newcomer', 'chase');
  for (const id of alive(s)) assert.equal(chased.actors[id].mind, before[id] - 3);
});

test('王叔想让轩哥上台：晚上到服务站，卫生不到40进不了门；讲完全员精神涨、王叔信任+2；没去信任-1', () => {
  const declined = pick(at(12), 'wang_host', 'decline');
  assert.equal(declined.actors.xuan.mind, at(12).actors.xuan.mind - 2);
  let s = idle(at(12)); relation(s, 'reg_wang').trust = 1;
  s = pick(s, 'wang_host', 'go');
  const stage = spot(s, 'wang_host_spot');
  assert.deepEqual([stage.district, stage.window, stage.cast], ['service', { from: 18, to: 21 }, ['xuan']]);
  const evening = until(s, 18);
  s = assign(evening, 'xuan', 18, 'warm').state;
  s.actors.xuan.hygiene = 30;
  assert.match(eventChoice(s, stage.uid, 'host', 'xuan').error, /卫生/);
  assert.match(eventChoice(s, stage.uid, 'host', 'fan').error, /轩哥/);
  s.actors.xuan.hygiene = 50;
  const r = eventChoice(s, stage.uid, 'host', 'xuan');
  assert.equal(r.error, undefined);
  const twin = step(s);
  const hosted = step(r.state);
  assert.equal(trust(hosted, 'reg_wang'), Math.min(5, trust(twin, 'reg_wang') + 2), '休整本身也可能让王叔加一，所以对照同一小时的孪生结算');
  assert.equal(hosted.actors.xuan.mind, Math.min(100, twin.actors.xuan.mind + 10), '自己+8 再加全员+2');
  assert.equal(hosted.actors.fan.mind, Math.min(100, twin.actors.fan.mind + 2));

  const missed = until(evening, 21);
  assert.equal(spot(missed, 'wang_host_spot').status, 'expired');
  assert.equal(trust(missed, 'reg_wang'), 0, '没人去服务站，王叔从1掉到0');
  assert.ok(missed.log.some((line) => line.includes('王叔信任-1')));
});
