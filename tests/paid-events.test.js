import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { morningNode, applyMorningChoice, PAID_EVENT_COST as P } from '../public/game/story.js';
import { relation } from '../public/game/npcs.js';

before(loadData);

// 四件固定日付费事件：付钱干净解决，不付有后果。构造状态时只动日期、现金与在队情况。
const CASH = 600;
function at(day, { seed = 700, cash = CASH, ma = true } = {}) {
  const s = fresh(seed);
  s.day = day;
  s.actors.ma.life = ma ? 'active' : 'unrecruited';
  s.cash = cash;
  s.ledger = { start: cash, income: 0, expense: 0 };
  return s;
}

const option = (node, id) => node.choices.find((c) => c.id === id);
const alive = (s) => Object.keys(s.actors).filter((id) => s.actors[id].life === 'active');
const minds = (s) => Object.fromEntries(alive(s).map((id) => [id, s.actors[id].mind]));

test('D9 占地费：付30解决，不付掉防雨与精神', () => {
  const s = at(9);
  const node = morningNode(s);
  assert.ok(node, 'D9 应该有晨间节点');
  const pay = option(node, 'pay');
  assert.ok(pay, 'D9 应该有付钱选项');
  assert.equal(pay.requires(s), null, '现金够时付钱选项可用');

  const poor = at(9, { cash: P.land - 1 });
  const reason = option(morningNode(poor), 'pay').requires(poor);
  assert.match(String(reason), /现金不足/, '现金不足时要给出禁用原因');

  const before = { rain: s.camp.rain, mind: minds(s) };
  const paid = [];
  applyMorningChoice(s, 'pay', paid);
  assert.equal(s.cash, CASH - P.land);
  assert.equal(s.ledger.expense, P.land);
  assert.equal(s.camp.rain, before.rain, '付钱后防雨不变');
  for (const id of alive(s)) assert.equal(s.actors[id].mind, before.mind[id], '付钱后精神不变');
  assert.ok(paid.length, '付钱要有结果说明');

  const r = at(9);
  const rMind = minds(r);
  const refused = [];
  applyMorningChoice(r, 'refuse', refused);
  assert.equal(r.cash, CASH, '不付不扣钱');
  assert.equal(r.ledger.expense, 0);
  assert.equal(r.camp.rain, before.rain - 1, '不付防雨-1');
  for (const id of alive(r)) assert.equal(r.actors[id].mind, rMind[id] - 4, '不付全员精神-4');
  assert.ok(refused.length, '不付要有后果说明');

  const floor = at(9);
  floor.camp.rain = 0;
  applyMorningChoice(floor, 'refuse', []);
  assert.equal(floor.camp.rain, 0, '防雨最低0');
});

test('D22 相机进水：付45修好，不付扣凡哥精神并清空素材', () => {
  const s = at(22);
  s.footage = 5;
  const pay = option(morningNode(s), 'pay');
  assert.ok(pay, 'D22 应该有付钱选项');
  assert.equal(pay.requires(s), null);

  const poor = at(22, { cash: P.camera - 1 });
  assert.match(String(option(morningNode(poor), 'pay').requires(poor)), /现金不足/);

  const mind = s.actors.fan.mind;
  applyMorningChoice(s, 'pay', []);
  assert.equal(s.cash, CASH - P.camera);
  assert.equal(s.ledger.expense, P.camera);
  assert.equal(s.footage, 5, '付钱后素材保住');
  assert.equal(s.actors.fan.mind, mind, '付钱后凡哥精神不变');
  assert.ok(!s.flags.cameraSoaked);

  const r = at(22);
  r.footage = 5;
  const refused = [];
  applyMorningChoice(r, 'refuse', refused);
  assert.equal(r.cash, CASH);
  assert.equal(r.footage, 0, '不付素材清零');
  assert.equal(r.actors.fan.mind, mind - 10, '不付凡哥精神-10');
  assert.equal(r.flags.cameraSoaked, true);
  assert.ok(refused.length);
});

test('D22 凡哥不在时没有这个节点', () => {
  const s = at(22);
  s.actors.fan.life = 'dead';
  assert.equal(morningNode(s), null);
});

test('D38 登记卡：按在世人头15元，不付掉王叔信任与卫生', () => {
  const s = at(38);
  assert.equal(alive(s).length, 3);
  const pay = option(morningNode(s), 'pay');
  assert.ok(pay, 'D38 应该有付钱选项');
  assert.equal(pay.requires(s), null);
  assert.match(pay.label, new RegExp(String(3 * P.cardPerPerson)), '三个人时按三份标价');

  const poor = at(38, { cash: 3 * P.cardPerPerson - 1 });
  assert.match(String(option(morningNode(poor), 'pay').requires(poor)), /现金不足/);

  const two = at(38, { ma: false, cash: 2 * P.cardPerPerson });
  assert.equal(alive(two).length, 2);
  assert.equal(option(morningNode(two), 'pay').requires(two), null, '两个人时两份就够');
  applyMorningChoice(two, 'pay', []);
  assert.equal(two.cash, 0);
  assert.equal(two.ledger.expense, 2 * P.cardPerPerson);

  relation(s, 'reg_wang').trust = 3;
  const hygiene = Object.fromEntries(alive(s).map((id) => [id, s.actors[id].hygiene]));
  applyMorningChoice(s, 'pay', []);
  assert.equal(s.cash, CASH - 3 * P.cardPerPerson);
  assert.equal(s.ledger.expense, 3 * P.cardPerPerson);
  assert.equal(relation(s, 'reg_wang').trust, 3, '付钱后信任不变');
  for (const id of alive(s)) assert.equal(s.actors[id].hygiene, hygiene[id], '付钱后卫生不变');

  const r = at(38);
  relation(r, 'reg_wang').trust = 3;
  const rHygiene = Object.fromEntries(alive(r).map((id) => [id, r.actors[id].hygiene]));
  const refused = [];
  applyMorningChoice(r, 'refuse', refused);
  assert.equal(r.cash, CASH);
  assert.equal(relation(r, 'reg_wang').trust, 2, '不付王叔信任-1');
  for (const id of alive(r)) assert.equal(r.actors[id].hygiene, rHygiene[id] - 10, '不付全员卫生-10');
  assert.ok(refused.length);

  const floor = at(38);
  relation(floor, 'reg_wang').trust = 0;
  applyMorningChoice(floor, 'refuse', []);
  assert.equal(relation(floor, 'reg_wang').trust, 0, '信任最低0');
});

test('D63 换季体检：付40全员健康+5', () => {
  const s = at(63);
  const pay = option(morningNode(s), 'pay');
  assert.ok(pay, 'D63 应该有付钱选项');
  assert.equal(pay.requires(s), null);

  const poor = at(63, { cash: P.checkup - 1 });
  assert.match(String(option(morningNode(poor), 'pay').requires(poor)), /现金不足/);

  const health = Object.fromEntries(alive(s).map((id) => [id, s.actors[id].health]));
  applyMorningChoice(s, 'pay', []);
  assert.equal(s.cash, CASH - P.checkup);
  assert.equal(s.ledger.expense, P.checkup);
  for (const id of alive(s)) {
    assert.equal(s.actors[id].health, health[id] + 5, '付钱后全员健康+5');
    assert.equal(s.actors[id].diseases.length, 0, '付钱后不染病');
  }
});

// 种子 10 三人的 checkup 判定都 < 0.3，种子 2 三人都 >= 0.3。
test('D63 不付：命中的种子每人受寒', () => {
  const s = at(63, { seed: 10 });
  const events = [];
  applyMorningChoice(s, 'refuse', events);
  assert.equal(s.cash, CASH);
  for (const id of alive(s)) assert.ok(s.actors[id].diseases.some((d) => d.kind === 'chill'), `${id} 应该受寒`);
  assert.ok(events.length);
});

test('D63 不付：不命中的种子没人染病', () => {
  const s = at(63, { seed: 2 });
  applyMorningChoice(s, 'refuse', []);
  assert.equal(s.cash, CASH);
  for (const id of alive(s)) assert.equal(s.actors[id].diseases.length, 0, `${id} 不该染病`);
});
