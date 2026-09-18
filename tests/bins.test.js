import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../public/game/data.js';
import { fresh } from '../public/game/engine.js';
import { boardSummary, forfeit, generateBoard, revealCell } from '../public/game/bins.js';

before(async () => {
  await loadData();
});

function state(seed = 260916) {
  const result = fresh(seed);
  result.pendingMorning = null;
  return result;
}

function category(cell) {
  if (cell.kind !== 'loot') return cell.kind;
  return cell.loot.id;
}

function boardWith(seed, predicate, setup = null) {
  for (let index = 0; index < 500; index += 1) {
    const input = state(seed);
    if (setup) setup(input);
    const candidate = generateBoard(input, 'xuan', 'market:' + index);
    const cellIndex = candidate.cells.findIndex(predicate);
    if (cellIndex >= 0) return { board: candidate, cellIndex };
  }
  throw new Error('测试种子未生成目标格');
}

function itemCounts(input) {
  return input.items.reduce((counts, item) => {
    counts[item.itemId] = (counts[item.itemId] || 0) + 1;
    return counts;
  }, {});
}

test('翻桶棋盘固定为十六格，翻格次数受手套和熟练度影响', () => {
  const plain = state();
  const regular = generateBoard(plain, 'xuan', 'market:0');
  assert.deepEqual(
    {
      binId: regular.binId,
      actorId: regular.actorId,
      size: regular.size,
      cellCount: regular.cells.length,
      digsLeft: regular.digsLeft,
      dirtHits: regular.dirtHits,
      done: regular.done,
    },
    { binId: 'market:0', actorId: 'xuan', size: 4, cellCount: 16, digsLeft: 6, dirtHits: 0, done: false },
  );
  assert.ok(regular.cells.every((cell) => ['loot', 'dirt', 'empty'].includes(cell.kind) && cell.revealed === false));

  const gloved = state();
  gloved.items.push({ uid: 'glove-test', itemId: 'gloves', container: 'xuan', uses: 1, dirty: false, wet: false });
  assert.equal(generateBoard(gloved, 'xuan', 'market:0').digsLeft, 8);

  const skilled = boardWith(260916, (cell) => cell.kind === 'dirt', (input) => { input.flags.binSkill.xuan = 6; }).board;
  assert.equal(skilled.digsLeft, 7);
  assert.ok(skilled.cells.filter((cell) => cell.kind === 'dirt').every((cell) => cell.warned));

  const campGloves = state();
  campGloves.items.push({ uid: 'camp-gloves', itemId: 'gloves', container: 'camp', uses: 1, dirty: false, wet: false });
  assert.equal(generateBoard(campGloves, 'xuan', 'market:0').digsLeft, 6);
  const otherGloves = state();
  otherGloves.items.push({ uid: 'other-gloves', itemId: 'gloves', container: 'fan', uses: 1, dirty: false, wet: false });
  assert.equal(generateBoard(otherGloves, 'xuan', 'market:0').digsLeft, 6);
});

test('棋盘按种子、日期、桶和格子锁定，翻开顺序不改变结果', () => {
  const left = state(711);
  const right = state(711);
  left.day = 7;
  right.day = 7;
  const first = generateBoard(left, 'xuan', 'station:1');
  const second = generateBoard(right, 'xuan', 'station:1');
  assert.deepEqual(first.cells, second.cells);

  for (const index of [0, 1, 2, 3, 4, 5]) revealCell(left, first, index);
  for (const index of [5, 4, 3, 2, 1, 0]) revealCell(right, second, index);
  assert.deepEqual(first.cells, second.cells);
  assert.equal(left.cash, right.cash);
  assert.equal(left.ledger.income, right.ledger.income);
  assert.equal(left.bottles || 0, right.bottles || 0);
  assert.equal(left.cloth, right.cloth);
  assert.equal(left.parts, right.parts);
  assert.equal(left.cardboard || 0, right.cardboard || 0);
  assert.deepEqual(itemCounts(left), itemCounts(right));
});

test('五百张棋盘的八千格落在约定权重的三个百分点内', () => {
  const expected = { bread: 15, bottles: 15, butts: 10, cloth: 8, parts: 8, cash: 8, soap: 3, broken_phone: 2, broken_radio: 2, broken_headphones: 2, fishing_rod_simple: 1, cardboard: 8, dirt: 20 };
  const totalWeight = Object.values(expected).reduce((total, weight) => total + weight, 0);
  const actual = Object.fromEntries(Object.keys(expected).map((key) => [key, 0]));
  for (let index = 0; index < 500; index += 1) {
    const board = generateBoard(state(9001), 'xuan', 'recycle:' + index);
    for (const cell of board.cells) {
      const kind = category(cell);
      assert.ok(Object.hasOwn(actual, kind), kind + ' 不在权重表中');
      actual[kind] += 1;
      if (cell.kind === 'loot' && kind === 'bottles') assert.ok(cell.loot.qty >= 2 && cell.loot.qty <= 5);
      if (cell.kind === 'loot' && kind === 'cash') assert.ok(cell.loot.qty >= 1 && cell.loot.qty <= 4);
      if (cell.kind === 'loot' && kind === 'cardboard') assert.ok(cell.loot.qty >= 1 && cell.loot.qty <= 2);
      if (cell.kind === 'loot' && !['bottles', 'cash', 'cardboard'].includes(kind)) assert.equal(cell.loot.qty, 1);
    }
  }
  for (const [kind, weight] of Object.entries(expected)) {
    assert.ok(Math.abs(actual[kind] / 80 - weight / totalWeight * 100) <= 3, kind + ' 偏差超过三个百分点');
  }
});

test('手套或熟练会标记脏物格，普通翻桶不泄露警告', () => {
  const plain = boardWith(801, (cell) => cell.kind === 'dirt').board;
  assert.equal(plain.cells.filter((cell) => cell.kind === 'dirt').some((cell) => cell.warned), false);

  const equipped = state(801);
  equipped.items.push({ uid: 'glove-test', itemId: 'gloves', container: 'xuan', uses: 1, dirty: false, wet: false });
  const warned = generateBoard(equipped, 'xuan', plain.binId);
  assert.ok(warned.cells.filter((cell) => cell.kind === 'dirt').every((cell) => cell.warned));
});

test('翻格立即结算，脏物扣卫生，面包和肥皂保留约定实例属性', () => {
  const bread = boardWith(802, (cell) => cell.loot?.id === 'bread');
  const breadState = state(802);
  const breadBoard = generateBoard(breadState, 'xuan', bread.board.binId);
  const breadReveal = revealCell(breadState, breadBoard, bread.cellIndex);
  assert.equal(breadState.items.at(-1).itemId, 'bread');
  assert.equal(breadState.items.at(-1).dirty, true);
  assert.equal(breadReveal.gained, '得到1个面包');

  const soap = boardWith(803, (cell) => cell.loot?.id === 'soap');
  const soapState = state(803);
  const soapBoard = generateBoard(soapState, 'xuan', soap.board.binId);
  revealCell(soapState, soapBoard, soap.cellIndex);
  assert.equal(soapState.items.at(-1).itemId, 'soap');
  assert.equal(soapState.items.at(-1).uses, 1);

  const dirt = boardWith(804, (cell) => cell.kind === 'dirt');
  const dirtState = state(804);
  const dirtBoard = generateBoard(dirtState, 'xuan', dirt.board.binId);
  dirtState.actors.xuan.hygiene = 4;
  const dirtReveal = revealCell(dirtState, dirtBoard, dirt.cellIndex);
  assert.equal(dirtState.actors.xuan.hygiene, 0);
  assert.equal(dirtState.actors.xuan.clothes.dirty, true);
  assert.equal(dirtBoard.dirtHits, 1);
  assert.equal(dirtReveal.gained, '翻到脏物，卫生-6');
});

test('翻到三种坏电器时通过真实 makeItem 放入翻桶者背包', () => {
  for (const [itemId, seed] of [['broken_phone', 809], ['broken_radio', 810], ['broken_headphones', 811]]) {
    const found = boardWith(seed, (cell) => cell.loot?.id === itemId);
    const input = state(seed);
    const board = generateBoard(input, 'xuan', found.board.binId);
    revealCell(input, board, found.cellIndex);
    assert.equal(input.items.at(-1).itemId, itemId);
    assert.equal(input.items.at(-1).container, 'xuan');
  }
});

test('非法或重复翻格不改变收益，次数耗尽或弃桶后结束', () => {
  const found = boardWith(805, (cell) => cell.loot?.type === 'cash');
  const input = state(805);
  const board = generateBoard(input, 'xuan', found.board.binId);
  const before = JSON.stringify({ state: input, board });
  assert.match(revealCell(input, board, -1).error, /格子/);
  assert.equal(JSON.stringify({ state: input, board }), before);

  revealCell(input, board, found.cellIndex);
  const afterFirst = JSON.stringify({ cash: input.cash, income: input.ledger.income, board });
  assert.match(revealCell(input, board, found.cellIndex).error, /已经翻过/);
  assert.equal(JSON.stringify({ cash: input.cash, income: input.ledger.income, board }), afterFirst);

  const complete = generateBoard(state(806), 'xuan', 'market:complete');
  const completeState = state(806);
  let terminal;
  for (let index = 0; index < 6; index += 1) terminal = revealCell(completeState, complete, index);
  assert.equal(complete.done, true);
  assert.equal(complete.digsLeft, 0);
  assert.equal(terminal.done, true);
  assert.match(revealCell(completeState, complete, 6).error, /结束/);
  assert.equal(forfeit(generateBoard(state(807), 'xuan', 'market:forfeit')).done, true);
});

test('资源字段缺失时初始化，结算摘要只报告已翻格、收获和脏物次数', () => {
  const input = state(808);
  delete input.cardboard;
  const board = {
    binId: 'test', actorId: 'xuan', size: 4, cells: [{ kind: 'loot', loot: { type: 'resource', id: 'cardboard', qty: 2 }, warned: false, revealed: false }],
    digsLeft: 1, dirtHits: 0, done: false,
  };
  revealCell(input, board, 0);
  assert.equal(input.cardboard, 2);
  assert.equal(boardSummary(board), '翻了1格得到2个纸板，脏物0次。');

  const empty = { binId: 'empty', actorId: 'xuan', size: 4, cells: [{ kind: 'empty', warned: false, revealed: false }], digsLeft: 1, dirtHits: 0, done: false };
  assert.equal(revealCell(state(809), empty, 0).gained, '什么也没有');
});
