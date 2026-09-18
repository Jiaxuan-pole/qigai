import { drawItemArt } from './item-art.js';

const DARK = '#141a1f';
const PAPER = '#d7cbb1';
const BROWN = '#7f5339';
const TAN = '#b5794c';
const SHADOW = '#4a2f2b';
const GREEN = '#637c5a';
const BLUE = '#5b91a4';
const GRAY = '#819098';
const GOLD = '#e3bb72';

const rect = (c, color, x, y, width, height) => { c.fillStyle = color; c.fillRect(x, y, width, height); };

function resourceKind(id) {
  return ['bottles', 'parts', 'cloth', 'cardboard'].includes(id) ? id : 'unknown';
}

export function artForBinCell(cell) {
  if (!cell?.revealed) return { kind: cell?.warned ? 'warning' : 'closed' };
  if (cell.kind === 'dirt') return { kind: 'dirt' };
  if (cell.kind === 'empty') return { kind: 'empty' };
  if (cell.kind !== 'loot' || !cell.loot) return { kind: 'unknown' };
  if (cell.loot.type === 'cash') return { kind: 'cash' };
  if (cell.loot.type === 'resource') return { kind: resourceKind(cell.loot.id) };
  if (cell.loot.type === 'item' && cell.loot.id) return { kind: 'item', id: cell.loot.id };
  return { kind: 'unknown' };
}

function escapeAttr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function binCellArtMarkup(cell) {
  const art = artForBinCell(cell);
  const item = art.kind === 'item' ? ` data-bin-item="${escapeAttr(art.id)}"` : '';
  return `<canvas class="bin-art bin-art--${art.kind}" width="32" height="32" data-bin-art="${art.kind}"${item} aria-hidden="true"></canvas>`;
}

export function drawBinArt(canvas, art) {
  const c = canvas?.getContext?.('2d');
  if (!c) return false;
  if (canvas.width !== 32) canvas.width = 32;
  if (canvas.height !== 32) canvas.height = 32;
  if (art?.kind === 'item') return drawItemArt(canvas, art.id);
  c.clearRect?.(0, 0, 32, 32);
  const kind = art?.kind || 'unknown';
  if (kind === 'closed' || kind === 'warning') {
    rect(c, DARK, 7, 8, 18, 18); rect(c, '#425158', 9, 10, 14, 14); rect(c, GRAY, 10, 7, 12, 3);
    rect(c, '#2c383e', 11, 14, 4, 4); rect(c, '#2c383e', 18, 18, 3, 3);
    if (kind === 'warning') { rect(c, GOLD, 21, 5, 7, 8); rect(c, DARK, 24, 7, 1, 3); rect(c, DARK, 24, 11, 1, 1); }
  } else if (kind === 'dirt') {
    rect(c, SHADOW, 6, 20, 20, 6); rect(c, BROWN, 8, 16, 16, 8); rect(c, TAN, 11, 12, 9, 11); rect(c, '#c18a5b', 14, 14, 4, 4);
    rect(c, GREEN, 8, 9, 2, 4); rect(c, GREEN, 20, 7, 2, 5); rect(c, '#a4bb75', 21, 5, 2, 2);
  } else if (kind === 'empty') {
    rect(c, DARK, 6, 9, 20, 15); rect(c, '#35434a', 8, 11, 16, 11); rect(c, GRAY, 9, 7, 14, 3); rect(c, '#58676c', 11, 17, 4, 2); rect(c, '#58676c', 19, 14, 2, 2);
  } else if (kind === 'cash') {
    rect(c, DARK, 6, 11, 20, 13); rect(c, '#5d7d5a', 8, 13, 16, 9); rect(c, PAPER, 10, 15, 12, 2); rect(c, GOLD, 18, 7, 7, 7); rect(c, '#b98c42', 20, 9, 3, 3);
  } else if (kind === 'bottles') {
    rect(c, DARK, 7, 8, 7, 18); rect(c, BLUE, 9, 10, 3, 13); rect(c, PAPER, 9, 7, 3, 4); rect(c, DARK, 17, 5, 7, 21); rect(c, GREEN, 19, 9, 3, 14); rect(c, PAPER, 19, 5, 3, 5);
  } else if (kind === 'parts') {
    rect(c, DARK, 8, 10, 16, 12); rect(c, GRAY, 11, 12, 10, 8); rect(c, GOLD, 14, 7, 4, 18); rect(c, GOLD, 7, 14, 18, 4); rect(c, DARK, 14, 14, 4, 4);
  } else if (kind === 'cloth') {
    rect(c, DARK, 6, 10, 20, 14); rect(c, '#a55d58', 8, 12, 16, 10); rect(c, PAPER, 10, 13, 4, 2); rect(c, '#6f3e4d', 17, 18, 5, 2); rect(c, '#c98c74', 20, 10, 2, 12);
  } else if (kind === 'cardboard') {
    rect(c, DARK, 6, 9, 20, 16); rect(c, BROWN, 8, 11, 16, 12); rect(c, TAN, 10, 9, 12, 4); rect(c, PAPER, 10, 16, 12, 1); rect(c, '#9a6d45', 14, 13, 2, 10);
  } else {
    rect(c, DARK, 7, 8, 18, 18); rect(c, GRAY, 9, 10, 14, 14); rect(c, PAPER, 15, 12, 3, 7); rect(c, DARK, 15, 20, 3, 2);
  }
  return true;
}

export function mountBinArt(root) {
  root?.querySelectorAll?.('canvas[data-bin-art]').forEach((canvas) => {
    if (!canvas.dataset.binArtMounted) {
      drawBinArt(canvas, { kind: canvas.dataset.binArt, id: canvas.dataset.binItem });
      canvas.dataset.binArtMounted = 'true';
    }
  });
}
