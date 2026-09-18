import test from 'node:test';
import assert from 'node:assert/strict';
import { newBlackjackSession, startBlackjackHand, blackjackLegalActions, blackjackAct, blackjackValue, blackjackView } from '../public/game/blackjack.js';

const make = (extra = {}) => newBlackjackSession({ seed: 1, sessionId: 'fixed', players: ['hero', 'lan'], controller: 'hero', dealerId: 'dealer', chips: { hero: 10, lan: 10 }, bank: 30, ...extra });
const total = (s) => Object.values(s.chips).reduce((a, b) => a + b, 0) + s.bank + (s.cur?.over ? 0 : Object.values(s.cur?.bets || {}).reduce((a, b) => a + b, 0));

test('ace is soft until needed and natural is two cards', () => {
  assert.deepEqual(blackjackValue([12, 8]), { total: 21, soft: true, natural: true });
  assert.deepEqual(blackjackValue([12, 8, 3]), { total: 16, soft: false, natural: false });
});

test('fixed seed completes blackjack hand', () => {
  let s = startBlackjackHand(make()).state;
  const initial = total(s);
  const seen = new Set(s.cur.deck);
  assert.equal(seen.size, 52);
  assert.equal(s.cur.di, 6);
  while (!s.cur.over) {
    const action = blackjackLegalActions(s)[0]?.id;
    assert.ok(action);
    const next = blackjackAct(s, action);
    assert.equal(next.error, undefined);
    s = next.state;
  }
  assert.equal(total(s), initial);
  assert.deepEqual(s.cur.results, { hero: 'bust', lan: 'bust' });
  assert.deepEqual(s.chips, { hero: 8, lan: 8 });
  assert.equal(s.bank, 34);
  assert.equal(s.cur.dealerCards.length >= 2, true);
});

test('double is illegal after hit', () => {
  let s = startBlackjackHand(make()).state;
  while (s.cur.turn !== 'hero' && !s.cur.over) s = blackjackAct(s, blackjackLegalActions(s)[0].id).state;
  if (s.cur.over) return;
  s = blackjackAct(s, 'hit').state;
  const before = structuredClone(s);
  assert.equal(blackjackAct(s, 'double').error, 'illegal action');
  assert.deepEqual(s, before);
});

test('JSON restore preserves next card and hidden dealer hole', () => {
  const s = startBlackjackHand(make()).state;
  assert.deepEqual(startBlackjackHand(make()).state.cur.deck, s.cur.deck);
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(blackjackAct(restored, blackjackLegalActions(restored)[0].id), blackjackAct(s, blackjackLegalActions(s)[0].id));
  if (!s.cur.over) {
    const view = blackjackView(s, 'hero');
    assert.equal(view.dealerCards[1], null);
    assert.equal(view.hands.lan, undefined);
    assert.equal(view.deck, undefined);
  }
});

test('natural pays three to two, push refunds, and bust forfeits', () => {
  const base = startBlackjackHand(make()).state;
  const cases = [
    { hero: [12, 8], dealer: [7, 8], result: 'natural', heroChips: 13, bank: 29 },
    { hero: [7, 8], dealer: [20, 21], result: 'push', heroChips: 10, bank: 32 },
    { hero: [7, 8, 9], dealer: [20, 21], result: 'bust', heroChips: 8, bank: 34 },
  ];
  for (const item of cases) {
    const s = structuredClone(base);
    s.cur.hands.hero = item.hero;
    s.cur.hands.lan = [7, 8, 9];
    s.cur.dealerCards = item.dealer;
    s.cur.status = { hero: item.result === 'natural' ? 'natural' : 'stand', lan: 'bust' };
    s.cur.turn = 'dealer';
    const finished = blackjackAct(s, 'stand').state;
    assert.equal(finished.cur.results.hero, item.result);
    assert.equal(finished.chips.hero, item.heroChips);
    assert.equal(finished.bank, item.bank);
    assert.equal(total(finished), 50);
  }
});

test('double draws once, dealer stands on soft seventeen, and funds stay bounded', () => {
  let s = startBlackjackHand(make()).state;
  s.cur.hands.hero = [0, 1];
  s.cur.hands.lan = [7, 8, 9];
  s.cur.status.lan = 'bust';
  s.cur.turn = 'hero';
  s.cur.dealerCards = [12, 4];
  const before = s.cur.di;
  s = blackjackAct(s, 'double').state;
  assert.equal(s.cur.di, before + 1);
  assert.equal(s.cur.bets.hero, 4);
  assert.equal(s.cur.turn, 'dealer');
  assert.deepEqual(blackjackLegalActions(s), [{ id: 'stand', cost: 0 }]);
  s = blackjackAct(s, 'stand').state;
  assert.equal(total(s), 50);
  assert.ok(s.bank >= 0);
});

test('bank reserve and five-hand cap reject new hand without mutation', () => {
  const poor = make({ bank: 5 });
  assert.equal(startBlackjackHand(poor).error, 'insufficient bankroll');
  assert.equal(poor.handSeq, 0);
  let s = make({ maxHands: 1 });
  s = startBlackjackHand(s).state;
  while (!s.cur.over) s = blackjackAct(s, blackjackLegalActions(s)[0].id).state;
  assert.equal(startBlackjackHand(s).error, 'hand unavailable');
});

test('dealer bank covers two simultaneous double wins', () => {
  const insufficient = make({ bank: 6 });
  assert.equal(startBlackjackHand(insufficient).error, 'insufficient bankroll');
  assert.equal(insufficient.handSeq, 0);
  assert.equal(startBlackjackHand(make({ bank: 10 })).error, undefined);
  let s = startBlackjackHand(make({ bank: 8 })).state;
  const front = [0, 2, 4, 1, 3, 5, 9, 10, 8];
  s.cur.deck = [...front, ...Array.from({ length: 52 }, (_, n) => n).filter((n) => !front.includes(n))];
  s.cur.hands = { hero: [0, 1], lan: [2, 3] };
  s.cur.dealerCards = [4, 5];
  s.cur.status = { hero: 'playing', lan: 'playing' };
  s.cur.turn = 'hero';
  s = blackjackAct(s, 'double').state;
  s = blackjackAct(s, 'double').state;
  s = blackjackAct(s, 'hit').state;
  s = blackjackAct(s, 'stand').state;
  assert.deepEqual(s.cur.results, { hero: 'win', lan: 'win' });
  assert.equal(s.bank, 0);
  assert.equal(total(s), 28);
});

test('odd custom blackjack bet settles natural in whole cash units', () => {
  let s = startBlackjackHand(make({ bet: 3, bank: 36, tableKey: 'fixed:10:3' })).state;
  s.cur.hands.hero = [12, 8];
  s.cur.hands.lan = [7, 8, 9];
  s.cur.dealerCards = [7, 8];
  s.cur.status = { hero: 'natural', lan: 'bust' };
  s.cur.turn = 'dealer';
  s = blackjackAct(s, 'stand').state;
  assert.deepEqual(s.cur.results, { hero: 'natural', lan: 'bust' });
  assert.equal(s.chips.hero, 14);
  assert.equal(s.bank, 35);
  assert.equal(total(s), 56);
  assert.equal(Number.isInteger(s.bank), true);
});
