import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadData } from '../public/game/data.js';
import { fresh, buyNow, useItem, reserve, transferItem, assign } from '../public/game/engine.js';
import { preflight, settle } from '../public/game/settle.js';
import { claimTicket, revealTicketCells } from '../public/game/shop.js';
import { itemDef, makeItem } from '../public/game/items.js';
import { normalizeSave } from '../public/game/save.js';
import { verifyFace, faceCellCount, generateFace } from '../public/game/tickets.js';
import { missingItemArtIds } from '../public/ui/item-art.js';

before(loadData);
const atShop = (cash = 200) => { const s = fresh(842); s.cash = cash; s.ledger.income += cash - 72; s.actors.xuan.location = 'market'; s.actors.fan.location = 'market'; s.actors.xuan.mind = 30; return s; };
const buy = (s, id, actor = 'xuan') => buyNow(s, actor, [{ shopId: 'convenience', itemId: id, qty: 1 }]);
const IDS = ['cigarette_regular', 'cigarette_premium', 'beer_bottle', 'baijiu', 'vodka', 'ticket_10', 'ticket_20'];

test('新档次均有商品、实际库存和像素图登记', () => {
  const s = atShop();
  assert.deepEqual(missingItemArtIds(IDS), []);
  for (const id of IDS) { assert.ok(itemDef(id)); assert.ok(s.shops.convenience.stock[id] > 0); }
});

test('多档烟酒扣款、扣库存、用量与状态，沿用每日限制', () => {
  for (const [id, price, uses, mind, intox] of [
    ['cigarette_regular', 20, 8, 5, 0], ['cigarette_premium', 32, 10, 6, 0],
    ['beer_bottle', 10, 2, 5, 1], ['baijiu', 18, 3, 6, 2], ['vodka', 28, 3, 6, 2],
  ]) {
    let s = atShop(); const stock = s.shops.convenience.stock[id];
    const r = buy(s, id); assert.equal(r.error, undefined, id);
    assert.equal(r.total, price); assert.equal(r.state.cash, 200 - price);
    assert.equal(r.state.shops.convenience.stock[id], stock - 1);
    assert.equal(r.made[0].uses, uses);
    s = r.state;
    if (id.startsWith('cigarette')) makeItem(s, 'lighter', 'xuan');
    const u = useItem(s, 'xuan', r.made[0].uid); assert.equal(u.error, undefined, id);
    assert.equal(u.state.actors.xuan.mind, 30 + mind);
    assert.equal(u.state.actors.xuan.intox, intox);
    assert.equal(u.state.items.find((x) => x.uid === r.made[0].uid)?.uses, uses - 1);
    if (intox === 2) assert.match(useItem(u.state, 'xuan', r.made[0].uid).error, /饮酒上限/);
  }
});

test('异价票同笔只占一次额度，跨类型混买累计且饭钱保护生效', () => {
  let s = atShop();
  let r = buyNow(s, 'xuan', [{ shopId: 'convenience', itemId: 'ticket_10', qty: 1 }, { shopId: 'convenience', itemId: 'ticket_20', qty: 1 }]);
  assert.equal(r.error, undefined); assert.equal(r.state.daily.bets, 1); assert.equal(r.total, 30);
  s = r.state; s.daily.errands = {};
  r = buy(s, 'ticket'); assert.equal(r.error, undefined); assert.equal(r.state.daily.bets, 2);
  s = r.state; s.daily.errands = {};
  assert.match(buy(s, 'ticket_20').error, /付费博彩已达/);
  s = atShop(25); s.items = s.items.filter((x) => x.itemId !== 'meal'); assert.ok(reserve(s) > 0);
  assert.match(buy(s, 'ticket_20').error, /预留的饭钱/);
});

test('不同票价锁定购票人、票价与面额；交接刷新不重抽且只核销一次', () => {
  for (const [id, price, style] of [['ticket', 5, 'street'], ['ticket_10', 10, 'bells'], ['ticket_20', 20, 'goodday']]) {
    let s = atShop(); const r = buy(s, id); assert.equal(r.error, undefined, id);
    s = r.state; const inst = r.made[0], ticket = inst.ticket;
    assert.equal(ticket.buyer, 'xuan'); assert.equal(ticket.price, price);
    assert.equal(ticket.style, style); assert.equal(verifyFace(ticket.face), ticket.payout);
    assert.equal(ticket.payout % (price / 5), 0);
    const snapshot = JSON.stringify(ticket);
    const moved = transferItem(s, 'xuan', inst.uid, 'fan'); assert.equal(moved.error, undefined);
    s = structuredClone(moved.state); assert.equal(JSON.stringify(s.items.find((x) => x.uid === inst.uid).ticket), snapshot);
    const cells = faceCellCount(ticket.face);
    assert.equal(revealTicketCells(s, inst.uid, Array.from({length: cells}, (_, i) => i), cells).scratched, true);
    const before = s.cash, payout = ticket.payout;
    assert.equal(claimTicket(s, 'fan', inst.uid).payout, payout);
    assert.equal(s.cash, before + payout);
    assert.match(claimTicket(s, 'fan', inst.uid).error, /没有这张票/);
  }
});

test('旧存档补新库存但保留旧0；旧票缺price按5元', () => {
  const s = atShop(); s.shops.convenience.stock.ticket = 0;
  for (const id of IDS) delete s.shops.convenience.stock[id];
  const old = makeItem(s, 'ticket', 'xuan', { ticket: { ticketId: 'legacy', buyer: 'xuan', payout: 5, scratched: true, claimed: false } });
  const n = normalizeSave(s);
  assert.equal(n.shops.convenience.stock.ticket, 0);
  for (const id of IDS) assert.ok(n.shops.convenience.stock[id] > 0);
  assert.equal(n.items.find((x) => x.uid === old.uid).ticket.price ?? 5, 5);
});


test('旧存档马哥自带牌只补一次，已有牌转移不复制', () => {
  const s = atShop(); s.metMa = true; s.actors.ma.life = 'active';
  const fixed = normalizeSave(s);
  assert.equal(fixed.items.filter((x) => x.itemId === 'cards').length, 1);
  assert.equal(fixed.items.find((x) => x.itemId === 'cards').container, 'ma');
  assert.equal(fixed.flags.maCardsGranted, true);
  assert.equal(normalizeSave(fixed).items.filter((x) => x.itemId === 'cards').length, 1);
  fixed.items.find((x) => x.itemId === 'cards').container = 'camp';
  assert.equal(normalizeSave(fixed).items.filter((x) => x.itemId === 'cards').length, 1);
  const oldWithCampCards = structuredClone(s);
  makeItem(oldWithCampCards, 'cards', 'camp');
  assert.equal(normalizeSave(oldWithCampCards).items.filter((x) => x.itemId === 'cards').length, 1);
  fixed.items = fixed.items.filter((x) => x.itemId !== 'cards');
  assert.equal(normalizeSave(fixed).items.filter((x) => x.itemId === 'cards').length, 0);
});


test('10元和20元三款票面对全部奖级守恒', () => {
  for (const price of [10, 20]) {
    for (const style of ['street', 'bells', 'goodday']) {
      for (const base of [0, 5, 10, 25, 100]) {
        const payout = base * price / 5;
        const ticket = { ticketId: `${price}:${style}:${base}`, price, style, payout };
        const face = generateFace(91354, ticket);
        assert.equal(face.price, price);
        assert.equal(verifyFace(face), payout);
        assert.deepEqual(generateFace(91354, ticket), face);
      }
    }
  }
});


function scheduledTicket(id, cash = 100) {
  let s = fresh(5831); s.pendingMorning = null; s.turn = 5; s.slot = 1; s.day = 2; s.hour = 10; s.hourTick = 20;
  s.cash = cash; s.ledger.income += cash - 72;
  const r = assign(s, 'xuan', 10, 'shop', { zone: 'market', cart: [{shopId:'convenience', itemId:id, qty:1}] });
  assert.equal(r.error, undefined);
  return r.state;
}

test('排程异价票在预检中守住饭钱、醉意与团队额度且失败零扣款', () => {
  for (const id of ['ticket', 'ticket_10', 'ticket_20']) {
    let s = scheduledTicket(id); s.items = s.items.filter((x) => x.itemId !== 'meal');
    s.cash = reserve(s) + itemDef(id).price - 1; s.ledger.income = s.cash - s.ledger.start;
    assert.match(preflight(s).error, /预留的饭钱/, id);
    const before = structuredClone(s); const r = settle(s); assert.match(r.error, /预留的饭钱/); assert.deepEqual(s, before); assert.deepEqual(r.state, before);
    s = scheduledTicket(id); s.actors.xuan.intox = 1; assert.match(preflight(s).error, /醉意/, id);
    s = scheduledTicket(id); s.daily.bets = 2; assert.match(preflight(s).error, /付费博彩已达/, id);
  }
});

test('排程混购多票算一次，与先前牌局和另一人购票共用上限', () => {
  let s = scheduledTicket('ticket_10', 200);
  s.plan.xuan[4].cart.push({shopId:'convenience', itemId:'ticket_20', qty:1});
  s.daily.bets = 1; // 当日牌局已占一次。
  assert.equal(preflight(s).error, undefined);
  const r = settle(s); assert.equal(r.error, undefined);
  assert.equal(r.state.daily.bets, 2);
  assert.equal(r.state.items.filter((x) => x.ticket).length, 2);
  s = scheduledTicket('ticket_10', 200);
  const other = assign(s, 'fan', 10, 'shop', {zone:'market', cart:[{shopId:'convenience',itemId:'ticket_20',qty:1}]});
  assert.equal(other.error, undefined);
  s = other.state; s.daily.bets = 1;
  assert.match(preflight(s).error, /付费博彩已达/);
});
