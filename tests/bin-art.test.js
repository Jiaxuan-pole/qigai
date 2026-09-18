import assert from 'node:assert/strict';
import test from 'node:test';
import { artForBinCell, binCellArtMarkup, drawBinArt } from '../public/ui/bin-art.js';

function trace(art) {
  const calls = [];
  const canvas = { width: 32, height: 32, getContext: () => ({
    fillStyle: '',
    fillRect(x, y, width, height) { calls.push([this.fillStyle, x, y, width, height]); },
  }) };
  assert.equal(drawBinArt(canvas, art), true);
  return calls;
}

test('dumpster rewards each have a non-empty, distinct static pixel drawing', () => {
  const arts = [
    { kind: 'dirt' }, { kind: 'empty' }, { kind: 'cash' }, { kind: 'bottles' }, { kind: 'parts' },
    { kind: 'cloth' }, { kind: 'cardboard' }, { kind: 'item', id: 'bread' }, { kind: 'unknown' }, { kind: 'closed' }, { kind: 'warning' },
  ];
  const signatures = arts.map((art) => JSON.stringify(trace(art)));
  assert.equal(new Set(signatures).size, arts.length);
  const dirtColors = trace({ kind: 'dirt' }).map(([color]) => color);
  assert.ok(dirtColors.includes('#7f5339'));
  assert.ok(dirtColors.includes('#637c5a'));
});

test('revealed item loot delegates to its actual food, tool, and fishing-rod art', () => {
  const ids = ['bread', 'broken_phone', 'fishing_rod_simple'];
  const signatures = ids.map((id) => JSON.stringify(trace(artForBinCell({ kind: 'loot', loot: { type: 'item', id, qty: 1 }, revealed: true }))));
  assert.equal(new Set(signatures).size, ids.length);
});

test('unrevealed cells draw only generic closed or warning art and do not leak their reward', () => {
  const hiddenLoot = { kind: 'loot', loot: { type: 'item', id: 'bread', qty: 1 }, warned: false, revealed: false };
  const hiddenDirt = { kind: 'dirt', warned: true, revealed: false };
  assert.deepEqual(artForBinCell(hiddenLoot), { kind: 'closed' });
  assert.deepEqual(artForBinCell(hiddenDirt), { kind: 'warning' });
  assert.doesNotMatch(binCellArtMarkup(hiddenLoot), /bread|item/);
  assert.doesNotMatch(binCellArtMarkup(hiddenDirt), /dirt/);
});

test('unknown loot falls back to a drawable artifact', () => {
  const art = artForBinCell({ kind: 'loot', loot: { type: 'mystery', id: 'lost' }, revealed: true });
  assert.deepEqual(art, { kind: 'unknown' });
  assert.ok(trace(art).length > 0);
});

test('bin board mounts static art and keeps revealed quantity in a DOM label', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/ui/modals.js', import.meta.url), 'utf8');
  assert.match(source, /binCellArtMarkup\(c\)/);
  assert.match(source, /mountBinArt\(\$\('modalContent'\)\)/);
  assert.match(source, /未翻开的格子\$\{i \+ 1\}/);
  assert.match(source, /bin-cell-label/);
});
