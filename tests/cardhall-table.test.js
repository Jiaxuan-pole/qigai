import test from 'node:test';
import assert from 'node:assert/strict';
import { newBlackjackSession, startBlackjackHand, blackjackAct, blackjackLegalActions } from '../public/game/blackjack.js';
import { tableProjection, actionChoices, showVenueTable } from '../public/ui/card-table-view.js';

test('blackjack projection hides and then reveals dealer hole', () => {
  let session = newBlackjackSession({ seed: 4, sessionId: 'table-view', players: ['xuan', 'hall_lan', 'hall_qiao'], controller: 'xuan', dealerId: 'hall_dealer', chips: { xuan: 20, hall_lan: 20, hall_qiao: 20 }, bank: 100 });
  session = startBlackjackHand(session).state;
  const initial = tableProjection(session, 'xuan');
  assert.equal(initial.seats.length, 4);
  assert.equal(initial.seats.find((seat) => seat.id === 'hall_dealer').cards[1], null);
  assert.equal(initial.seats.find((seat) => seat.id === 'hall_lan').cards[0], null);
  assert.equal(initial.seats.find((seat) => seat.id === 'xuan').cards.length, 2);
  while (!session.cur.over) session = blackjackAct(session, blackjackLegalActions(session)[0].id).state;
  const final = tableProjection(session, 'xuan');
  assert.equal(final.seats.find((seat) => seat.id === 'hall_dealer').cards[1], session.cur.dealerCards[1]);
  assert.equal(final.seats.find((seat) => seat.id === 'hall_lan').cards[0], session.cur.hands.hall_lan[0]);
  assert.equal(JSON.stringify(initial).includes('deck'), false);
});

test('four seats and legal amount/target controls belong only to controller turn', () => {
  const session = { game: 'texas', players: ['xuan', 'hall_lan', 'hall_qiao'], controller: 'xuan', chips: { xuan: 10, hall_lan: 10, hall_qiao: 10 }, cur: { turn: 'xuan', over: false, hole: { xuan: [0, 1], hall_lan: [2, 3], hall_qiao: [4, 5] }, board: [], revealed: {}, folded: {}, pot: 3, stage: 'preflop' } };
  const choices = actionChoices(session, 'xuan', [{ id: 'raise', min: 2, max: 8 }, { id: 'compare', targets: ['hall_lan', 'hall_qiao'], cost: 2 }]);
  assert.deepEqual(choices.filter((choice) => choice.id === 'raise').map((choice) => choice.amount), [2, 8]);
  assert.deepEqual(choices.filter((choice) => choice.id === 'compare').map((choice) => choice.target), ['hall_lan', 'hall_qiao']);
  session.cur.turn = 'hall_lan';
  assert.deepEqual(actionChoices(session, 'xuan', choices), []);
  assert.deepEqual(tableProjection(session, 'xuan').seats.find((seat) => seat.id === 'hall_lan').cards, [null, null]);
});

test('table lifecycle cancels updates and escapes lines after teardown', async () => {
  const priorDocument = globalThis.document;
  const priorWindow = globalThis.window;
  const priorMatchMedia = globalThis.matchMedia;
  const priorRaf = globalThis.requestAnimationFrame;
  const priorCancelRaf = globalThis.cancelAnimationFrame;
  const classes = () => { const set = new Set(); return { add: (x) => set.add(x), remove: (x) => set.delete(x), toggle: (x, on) => on ? set.add(x) : set.delete(x), contains: (x) => set.has(x) }; };
  const element = () => ({ classList: classes(), style: {}, dataset: {}, children: [], append(child) { this.children.push(child); }, replaceChildren() { this.children = []; }, querySelector: () => null, focus() {} });
  const nodes = Object.fromEntries(['toast', 'modalContent', 'modal', 'modalOverlay', 'modalClose', 'cardCanvas', 'cardTalk', 'casinoNpcSource', 'casinoInfo', 'cardActions'].map((id) => [id, element()]));
  const labels = [];
  const cards = [];
  const context = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }), fillText(value, x, y) { labels.push({ value, x, y, align: this.textAlign }); }, fillRect(x, y, width, height) { if (this.fillStyle === '#0d151b' && width === 480) cards.length = 0; if ((this.fillStyle === '#f2eee4' || this.fillStyle === '#2f4a6b') && width === 24 && height === 34) cards.push({ x, y }); } }, { get(target, key) { return target[key] || (() => {}); } });
  nodes.cardCanvas.getContext = () => context;
  globalThis.document = { getElementById: (id) => nodes[id], createElement: () => element(), activeElement: element(), body: { style: {} } };
  globalThis.window = {};
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.requestAnimationFrame = () => { throw new Error('reduced motion requested a frame'); };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const session = newBlackjackSession({ seed: 5, sessionId: 'lifecycle', players: ['hall_lan', 'hall_qiao', 'hall_guest'], controller: 'hall_lan', dealerId: 'hall_dealer', chips: { hall_lan: 20, hall_qiao: 20, hall_guest: 20 }, bank: 100 });
    const hand = startBlackjackHand(session).state;
    const table = showVenueTable({ session: hand, line: '<bad>', source: 'local', onAction() {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(nodes.cardTalk.innerHTML, '&lt;bad&gt;');
    assert.equal(nodes.casinoNpcSource.textContent, '本地');
    assert.ok(nodes.cardActions.children.length > 0 || hand.cur.turn !== 'hall_lan');
    const dealerName = labels.find((entry) => entry.value === '发牌员');
    const dealerMoney = labels.find((entry) => entry.value === '100 庄');
    assert.equal(dealerName.align, 'center');
    assert.equal(dealerMoney.x, dealerName.x);
    assert.ok(dealerMoney.y > dealerName.y);
    const settled = structuredClone(hand);
    settled.cur.over = true;
    settled.cur.turn = null;
    settled.cur.results = { hall_lan: 'lose', hall_qiao: 'natural' };
    for (const id of settled.players) settled.cur.hands[id] = Array.from({ length: 11 }, (_, i) => i);
    settled.cur.dealerCards = Array.from({ length: 11 }, (_, i) => i);
    await table.update({ session: settled });
    assert.ok(labels.some((entry) => entry.value.includes('输')));
    assert.ok(labels.some((entry) => entry.value.includes('黑杰克')));
    assert.equal(labels.some((entry) => /\blose\b|\bnatural\b/.test(entry.value)), false);
    assert.match(nodes.casinoInfo.textContent, /阿岚 18.*阿乔 18.*发牌员/);
    assert.equal(cards.length, 44);
    assert.deepEqual([...new Set(cards.map(({ y }) => y))].sort((a, b) => a - b), [82, 118, 156]);
    const side = cards.filter(({ y }) => y === 118);
    assert.equal(side.length, 22);
    assert.ok(side.filter(({ x }) => x < 240).every(({ x }) => x >= 76 && x + 24 <= 208));
    assert.ok(side.filter(({ x }) => x > 240).every(({ x }) => x >= 272 && x + 24 <= 404));
    assert.ok(cards.filter(({ y }) => y === 82 || y === 156).every(({ x }) => x >= 176 && x + 24 <= 304));
    table.destroy();
    assert.equal(table.update({ session: settled, line: 'later' }), undefined);
    assert.equal(nodes.cardTalk.innerHTML, '&lt;bad&gt;');
  } finally { globalThis.document = priorDocument; globalThis.window = priorWindow; globalThis.matchMedia = priorMatchMedia; globalThis.requestAnimationFrame = priorRaf; globalThis.cancelAnimationFrame = priorCancelRaf; }
});
