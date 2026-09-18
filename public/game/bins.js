// 翻桶内容在开板时锁定，避免玩家靠翻格顺序重掷收益。
import { rng } from './rng.js';
import { clamp } from './rules.js';
import { makeItem } from './items.js';

const DROPS = [
  ['bread', 15], ['bottles', 15], ['butts', 10], ['cloth', 8], ['parts', 8], ['cash', 8], ['soap', 3],
  ['broken_phone', 2], ['broken_radio', 2], ['broken_headphones', 2], ['fishing_rod_simple', 1], ['cardboard', 8], ['dirt', 20],
];
const RESOURCE_IDS = new Set(['bottles', 'cloth', 'parts', 'cardboard']);
const TOTAL_WEIGHT = DROPS.reduce((total, [, weight]) => total + weight, 0);
const SUMMARY_NAMES = { bread: '面包', bottles: '瓶罐', butts: '烟头', cloth: '布料', parts: '零件', cash: '块零钱', soap: '肥皂', broken_phone: '坏手机', broken_radio: '坏收音机', broken_headphones: '坏耳机', fishing_rod_simple: '简易鱼竿', cardboard: '纸板' };

function pickDrop(random) {
  let cursor = random * TOTAL_WEIGHT;
  for (const [id, weight] of DROPS) {
    cursor -= weight;
    if (cursor < 0) return id;
  }
  return 'empty';
}

function quantity(state, key, id) {
  const random = rng(state.seed, key + ':qty');
  if (id === 'bottles') return 2 + Math.floor(random * 4);
  if (id === 'cash') return 1 + Math.floor(random * 4);
  if (id === 'cardboard') return 1 + Math.floor(random * 2);
  return 1;
}

function hasGloves(state, actorId) {
  return Boolean(state.items?.some((item) => item.itemId === 'gloves' && item.container === actorId));
}

function knowsDirt(state, actorId) {
  return hasGloves(state, actorId) || (state.flags?.binSkill?.[actorId] || 0) >= 6;
}

function makeCell(state, binId, index, warnDirt) {
  const key = `bin:${state.day}:${binId}:${index}`;
  const id = pickDrop(rng(state.seed, key));
  if (id === 'dirt') return { kind: 'dirt', warned: warnDirt, revealed: false };
  if (id === 'empty') return { kind: 'empty', warned: false, revealed: false };
  const type = id === 'cash' ? 'cash' : RESOURCE_IDS.has(id) ? 'resource' : 'item';
  return { kind: 'loot', loot: { type, id, qty: quantity(state, key, id) }, warned: false, revealed: false };
}

export function generateBoard(state, actorId, binId) {
  const warned = knowsDirt(state, actorId);
  const digsLeft = 6 + (hasGloves(state, actorId) ? 2 : 0) + ((state.flags?.binSkill?.[actorId] || 0) >= 6 ? 1 : 0);
  return {
    binId,
    actorId,
    size: 4,
    cells: Array.from({ length: 16 }, (_, index) => makeCell(state, binId, index, warned)),
    digsLeft,
    dirtHits: 0,
    done: false,
  };
}

function addResource(state, id, qty) {
  state[id] = (Number(state[id]) || 0) + qty;
}

function addCash(state, qty) {
  state.cash = (Number(state.cash) || 0) + qty;
  state.ledger ||= {};
  state.ledger.income = (Number(state.ledger.income) || 0) + qty;
}

function settleLoot(state, board, loot) {
  if (loot.type === 'cash') return addCash(state, loot.qty);
  if (loot.type === 'resource') return addResource(state, loot.id, loot.qty);
  state.items ||= [];
  const item = makeItem(state, loot.id, board.actorId);
  if (loot.id === 'bread') item.dirty = true;
  if (loot.id === 'soap') item.uses = 1;
}

function settleDirt(state, board) {
  const actor = state.actors?.[board.actorId];
  board.dirtHits += 1;
  if (!actor) return;
  actor.hygiene = clamp((Number(actor.hygiene) || 0) - 6);
  actor.clothes ||= {};
  actor.clothes.dirty = true;
}

export function revealCell(state, board, index) {
  if (board.done) return { board, error: '翻桶已经结束。' };
  if (!Number.isInteger(index) || index < 0 || index >= board.cells.length) return { board, error: '格子编号无效。' };
  const cell = board.cells[index];
  if (cell.revealed) return { board, error: '这格已经翻过。' };
  cell.revealed = true;
  if (cell.kind === 'loot') settleLoot(state, board, cell.loot);
  if (cell.kind === 'dirt') settleDirt(state, board);
  board.digsLeft = Math.max(0, board.digsLeft - 1);
  if (board.digsLeft === 0 || board.cells.every((candidate) => candidate.revealed)) board.done = true;
  const gained = cell.kind === 'dirt' ? '翻到脏物，卫生-6' : cell.kind === 'empty' ? '什么也没有' : `得到${lootText(cell.loot)}`;
  return { board, cell, gained, done: board.done };
}

export function forfeit(board) {
  board.done = true;
  return board;
}

function lootText(loot) {
  const name = SUMMARY_NAMES[loot.id] || loot.id;
  return loot.type === 'cash' ? `${loot.qty}${name}` : `${loot.qty}个${name}`;
}

export function boardSummary(board) {
  const loot = board.cells.filter((cell) => cell.revealed && cell.kind === 'loot').map((cell) => lootText(cell.loot));
  return `翻了${board.cells.filter((cell) => cell.revealed).length}格得到${loot.join('、') || '没有东西'}，脏物${board.dirtHits}次。`;
}
