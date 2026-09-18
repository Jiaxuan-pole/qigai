import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadData } from '../public/game/data.js';
import { generateFace, verifyFace, STYLES } from '../public/game/tickets.js';

const PAYOUTS = [0, 5, 10, 25, 100];
const EXPECTED_STYLES = ['street', 'bells', 'goodday'];
const TICKET_IDS_PER_PAYOUT = 200;
const SEED = 481516;

before(async () => {
  await loadData();
});

function ticket(style, payout, index) {
  return { ticketId: style + '-' + payout + '-' + index, payout };
}

function assertNonWinsStayNonWinning(style, face) {
  if (style === 'street') {
    assert.equal(face.cells.length, 6);
    for (const cell of face.cells) {
      if (cell.hit) assert.equal(cell.n, face.winning, 'street 命中位必须等于奖号');
      else assert.notEqual(cell.n, face.winning, 'street 非命中位不能等于奖号');
    }
    return;
  }
  if (style === 'bells') {
    assert.equal(face.rows.length, 4);
    for (const row of face.rows) {
      const matches = row.syms[0] === row.syms[1] && row.syms[1] === row.syms[2];
      assert.equal(matches, row.hit, 'bells 三同判定必须与命中标记一致');
    }
    return;
  }
  assert.equal(face.cells.length, 12);
  for (const cell of face.cells) {
    if (cell.hit) assert.ok(cell.prize > 0, 'goodday 命中格必须显示奖金');
    else assert.equal(cell.prize, 0, 'goodday 非命中格不能显示奖金');
  }
}

test('票面风格固定为 street、bells、goodday', () => {
  assert.deepEqual(Object.keys(STYLES).sort(), EXPECTED_STYLES.slice().sort());
});

for (const style of EXPECTED_STYLES) {
  test(style + ' 票面矩阵锁定返还、结构合法且由 ticketId 决定', () => {
    for (const payout of PAYOUTS) {
      for (let index = 0; index < TICKET_IDS_PER_PAYOUT; index += 1) {
        const input = ticket(style, payout, index);
        const first = generateFace(SEED, input, style);
        const second = generateFace(SEED, input, style);

        assert.equal(first.style, style);
        assert.equal(first.total, payout);
        assert.equal(verifyFace(first), payout, style + '/' + payout + '/' + index + ' 票面验奖必须等于锁定返还');
        assert.deepEqual(second, first, style + '/' + payout + '/' + index + ' 同一 ticketId 必须生成相同票面');
        assertNonWinsStayNonWinning(style, first);
      }
    }
  });
}
