import test from 'node:test';
import assert from 'node:assert/strict';
import { actionChoices } from '../public/ui/card-table-view.js';

test('hall table preserves canonical amount and target in clickable choices', () => {
  const session = { game: 'texas', controller: 'xuan', players: ['xuan', 'hall_lan', 'hall_qiao'], chips: { xuan: 10, hall_lan: 10, hall_qiao: 10 }, hand: 1, maxHands: 5,
    cur: { over: false, turn: 'xuan', hole: { xuan: [0, 1], hall_lan: [2, 3], hall_qiao: [4, 5] }, board: [], pot: 3 } };
  const choices = actionChoices(session, 'xuan', [{ id: 'raise', amount: 5 }, { id: 'compare', target: 'hall_lan' }, { id: 'fold' }]);
  assert.deepEqual(choices.map(({ id, amount, target }) => ({ id, amount, target })), [
    { id: 'raise', amount: 5, target: undefined },
    { id: 'compare', amount: undefined, target: 'hall_lan' },
    { id: 'fold', amount: undefined, target: undefined },
  ]);
});
