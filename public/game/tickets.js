// 刮刮乐票面：购买时按锁定的总返还生成合法票面，展示奖金之和必须等于锁定结果。
// 三款票面共用 5 元奖表：street（对号码）、bells（三个铃铛）、goodday（好日子直揭金额）。
import { rng, pick, intBetween } from './rng.js';

export const STYLES = {
  street: { name: '街角即开彩', rule: '我的号码与中奖号码相同，即得该号码下方奖金', color: '#c0392b' },
  bells: { name: '三个铃铛', rule: '同一行三个图案相同，即得该行右侧奖金', color: '#8e6b2e' },
  goodday: { name: '好日子', rule: '刮出金额即可获得，所有中奖格相加', color: '#2f6f8f' },
};
const SYMBOLS = ['铃铛', '杯子', '面包', '雨伞', '钥匙', '袜子'];
const AMOUNTS = [5, 10, 25, 100];

// 把总返还拆成 1—3 个合法奖金位（每位取自奖表金额）。
function splitPayout(r, payout) {
  if (payout === 0) return [];
  if (payout === 5 || payout === 100) return [payout];
  if (payout === 10) return r < 0.5 ? [10] : [5, 5];
  if (payout === 25) return r < 0.4 ? [25] : r < 0.7 ? [10, 10, 5] : [5, 10, 10];
  return [payout];
}

function styleFor(seed, ticketId) {
  const keys = Object.keys(STYLES);
  return keys[Math.floor(rng(seed, 'style:' + ticketId) * keys.length)];
}

export function generateFace(seed, ticket, forcedStyle = null) {
  const style = forcedStyle || ticket.style || styleFor(seed, ticket.ticketId);
  const key = 'face:' + ticket.ticketId;
  const scale = (ticket.price ?? 5) / 5;
  const wins = splitPayout(rng(seed, key + ':split'), ticket.payout / scale).map((n) => n * scale);
  let face;
  if (style === 'street') face = streetFace(seed, key, wins, scale);
  else if (style === 'bells') face = bellsFace(seed, key, wins, scale);
  else face = goodDayFace(seed, key, wins, scale);
  face.style = style;
  face.total = ticket.payout;
  face.price = ticket.price ?? 5;
  if (verifyFace(face) !== ticket.payout) throw new Error('票面奖金与锁定结果不一致 ' + ticket.ticketId);
  return face;
}

// 街角即开彩：1 个奖号，6 个号码位；命中位的号码等于奖号。
function streetFace(seed, key, wins, scale) {
  const winning = intBetween(rng(seed, key + ':win'), 10, 39);
  const cells = [];
  const used = new Set([winning]);
  for (let i = 0; i < 6; i++) {
    if (i < wins.length) { cells.push({ n: winning, prize: wins[i], hit: true }); continue; }
    let n;
    let attempt = 0;
    do { n = intBetween(rng(seed, key + ':n' + i + ':' + attempt), 10, 39); attempt += 1; } while (used.has(n));
    used.add(n);
    cells.push({ n, prize: pick(rng(seed, key + ':p' + i), AMOUNTS) * scale, hit: false });
  }
  // 打乱顺序，命中位不总在前面。
  const order = cells.map((c, i) => ({ c, k: rng(seed, key + ':o' + i) })).sort((a, b) => a.k - b.k).map((x) => x.c);
  return { winning, cells: order };
}

// 三个铃铛：4 行，每行 3 个图案 + 1 个奖金；命中行三个相同。
function bellsFace(seed, key, wins, scale) {
  const rows = [];
  for (let i = 0; i < 4; i++) {
    if (i < wins.length) {
      const sym = pick(rng(seed, key + ':sym' + i), SYMBOLS);
      rows.push({ syms: [sym, sym, sym], prize: wins[i], hit: true });
      continue;
    }
    // 非命中行保证不是三同。
    const a = pick(rng(seed, key + ':a' + i), SYMBOLS);
    let b = pick(rng(seed, key + ':b' + i), SYMBOLS);
    let c = pick(rng(seed, key + ':c' + i), SYMBOLS);
    if (a === b && b === c) c = SYMBOLS[(SYMBOLS.indexOf(c) + 1) % SYMBOLS.length];
    rows.push({ syms: [a, b, c], prize: pick(rng(seed, key + ':p' + i), AMOUNTS) * scale, hit: false });
  }
  const order = rows.map((r, i) => ({ r, k: rng(seed, key + ':o' + i) })).sort((x, y) => x.k - y.k).map((x) => x.r);
  return { rows: order };
}

// 好日子：3×4 方格，命中格直接是金额，其余是生活图案。
function goodDayFace(seed, key, wins, scale) {
  const cells = [];
  for (let i = 0; i < 12; i++) {
    if (i < wins.length) cells.push({ prize: wins[i], hit: true, icon: null });
    else cells.push({ prize: 0, hit: false, icon: pick(rng(seed, key + ':i' + i), SYMBOLS) });
  }
  const order = cells.map((c, i) => ({ c, k: rng(seed, key + ':o' + i) })).sort((a, b) => a.k - b.k).map((x) => x.c);
  return { cells: order };
}

// 由票面重新验算总奖金：判定规则与展示规则一致。
export function verifyFace(face) {
  if (face.style === 'street') return face.cells.reduce((a, c) => a + (c.n === face.winning ? c.prize : 0), 0);
  if (face.style === 'bells') return face.rows.reduce((a, r) => a + (r.syms[0] === r.syms[1] && r.syms[1] === r.syms[2] ? r.prize : 0), 0);
  return face.cells.reduce((a, c) => a + (c.hit ? c.prize : 0), 0);
}

export function faceCellCount(face) {
  if (face.style === 'street') return face.cells.length + 1;
  if (face.style === 'bells') return face.rows.length;
  return face.cells.length;
}
