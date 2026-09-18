import { px } from './pixel.js';

const OUT = '#141a1f', SKIN = '#d9a577', SKIN_D = '#b98358', SKIN_L = '#ecc19a';
const PAPER = '#d7cbb1', METAL = '#a7b1b3', GOLD = '#e3bb72';
const PROFILES = {
  chengguan: { top: '#6d8b9b', light: '#a7b1b3', dark: '#3e5668', pants: '#26333b', hair: '#26333b', width: 24, hat: 'uniform' },
  thug: { top: '#3e4c53', light: '#6b7375', dark: '#26333b', pants: '#456784', hair: '#1e1a1c', width: 26, hat: 'crop' },
  thug_hood: { top: '#805e70', light: '#a28290', dark: '#534051', pants: '#30383c', hair: '#1e1a1c', width: 23, hat: 'hood' },
  barista: { top: '#d7cbb1', light: '#ece4d3', dark: '#a7b1b3', pants: '#30383c', hair: '#342e2c', width: 20, hat: 'bun' },
  clerk: { top: '#6d8b81', light: '#96afa1', dark: '#48695e', pants: '#30383c', hair: '#342e2c', width: 22, hat: 'visor' },
  rider: { top: '#c69a32', light: '#e0bb57', dark: '#987028', pants: '#304c67', hair: '#342e2c', width: 21, hat: 'helmet' },
  cleaner: { top: '#6d8b81', light: '#96afa1', dark: '#48695e', pants: '#465056', hair: '#737d83', width: 23, hat: 'scarf' },
  elder: { top: '#8a758b', light: '#a99daa', dark: '#625768', pants: '#465056', hair: '#a7b1b3', width: 21, hat: 'bald' },
  commuter: { top: '#587d9a', light: '#8ca5ba', dark: '#304c67', pants: '#26333b', hair: '#342e2c', width: 20, hat: 'part' },
  vendor: { top: '#b48459', light: '#d1a77b', dark: '#805b48', pants: '#465056', hair: '#342e2c', width: 25, hat: 'headband' },
  student: { top: '#a28290', light: '#c6a6b4', dark: '#805e70', pants: '#304c67', hair: '#1e1a1c', width: 18, hat: 'bob' },
  worker: { top: '#587d9a', light: '#8ca5ba', dark: '#304c67', pants: '#465056', hair: '#342e2c', width: 27, hat: 'cap' },
  volunteer: { top: '#9f615b', light: '#c18b80', dark: '#754b4d', pants: '#465056', hair: '#737d83', width: 23, hat: 'part' },
};

function hash(value) { let h = 0; for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

function identity(npc) {
  if (PROFILES[npc.kind]) return npc.kind;
  const job = `${npc.job || ''}${npc.name || ''}`;
  if (/城管|巡查|保安/.test(job)) return 'chengguan';
  if (/连帽|thug_hood/.test(job)) return 'thug_hood';
  if (/混混|thugs/.test(job)) return 'thug';
  if (/咖啡|barista/.test(job)) return 'barista';
  if (/外卖|快递|骑手|代驾/.test(job)) return 'rider';
  if (/保洁|清扫|环卫/.test(job)) return 'cleaner';
  if (/退休|大爷|老人/.test(job)) return 'elder';
  if (/摊主|摆摊|小贩|面馆|早餐/.test(job)) return 'vendor';
  if (/上班|通勤/.test(job)) return 'commuter';
  if (/学生|游客/.test(job)) return 'student';
  if (/装卸|送货|仓库|司机|工人/.test(job)) return 'worker';
  if (/志愿|服务站/.test(job)) return 'volunteer';
  if (/店|店员|老板/.test(job)) return 'clerk';
  return ['commuter', 'student', 'vendor', 'elder'][hash(npc.id || job) % 4];
}

function boots(c, x, y, color = '#26333b') {
  px(c, x - 1, y, 10, 5, OUT); px(c, x, y + 1, 8, 3, color);
  px(c, x + 1, y + 1, 3, 1, METAL); px(c, x, y + 4, 9, 1, '#737d83');
}

function legs(c, k, pose, frame) {
  const walking = ['walk', 'flee'].includes(pose);
  const step = walking ? [-3, 0, 3, 1][frame] : pose === 'attack' ? 4 : pose === 'hit' ? -2 : 0;
  const bend = pose === 'defend' ? 3 : 0;
  const lift = walking ? [0, 3, 0, 2][frame] : 0;
  for (const [x, offset, raised] of [[7, -step, 0], [19, step, lift]]) {
    px(c, x + offset, 35 + bend, 7, 13 - bend - raised, OUT);
    px(c, x + offset + 1, 36 + bend, 5, 11 - bend - raised, k.pants);
    px(c, x + offset + 1, 38 + bend, 1, 8 - bend - raised, '#26333b');
    px(c, x + offset + 3, 41 + bend - raised, 3, 1, METAL);
    boots(c, x + offset - 1, 47 - raised, k.hat === 'crop' || k.hat === 'bob' ? PAPER : '#26333b');
  }
}

function head(c, k, kind, dx, dy, pose) {
  px(c, 9 + dx, 1 + dy, 17, 18, OUT);
  px(c, 10 + dx, 4 + dy, 15, 13, SKIN); px(c, 10 + dx, 14 + dy, 15, 3, SKIN_D);
  px(c, 10 + dx, 6 + dy, 4, 2, SKIN_L); px(c, 25 + dx, 9 + dy, 2, 4, SKIN_D);
  px(c, 10 + dx, 1 + dy, 15, 5, k.hair); px(c, 9 + dx, 4 + dy, 3, 6, k.hair);
  if (k.hat === 'bald') { px(c, 13 + dx, 1 + dy, 10, 4, SKIN_L); px(c, 9 + dx, 5 + dy, 3, 5, METAL); }
  if (k.hat === 'part') { px(c, 13 + dx, 2 + dy, 8, 1, '#737d83'); px(c, 20 + dx, 4 + dy, 4, 3, k.hair); }
  if (k.hat === 'crop') {
    px(c, 10 + dx, dy - 1, 6, 3, k.hair); px(c, 17 + dx, dy - 2, 7, 4, k.hair);
    px(c, 10 + dx, 4 + dy, 4, 4, '#737d83'); px(c, 23 + dx, 13 + dy, 2, 1, '#805b48');
  }
  if (k.hat === 'hood') {
    px(c, 6 + dx, 2 + dy, 4, 18, k.dark); px(c, 8 + dx, dy - 2, 18, 5, k.dark);
    px(c, 25 + dx, 2 + dy, 4, 18, k.dark); px(c, 9 + dx, dy, 15, 2, k.light);
  }
  if (k.hat === 'bob') { px(c, 7 + dx, 3 + dy, 4, 17, k.hair); px(c, 24 + dx, 3 + dy, 4, 17, k.hair); }
  if (k.hat === 'bun') { px(c, 5 + dx, 2 + dy, 6, 7, k.hair); px(c, 6 + dx, 4 + dy, 3, 1, '#805b48'); }
  if (k.hat === 'helmet') {
    px(c, 7 + dx, dy - 2, 22, 8, OUT); px(c, 8 + dx, dy - 2, 20, 6, GOLD);
    px(c, 12 + dx, dy - 3, 13, 2, '#e0bb57'); px(c, 9 + dx, dy, 5, 1, PAPER);
    px(c, 27 + dx, 5 + dy, 2, 6, METAL); px(c, 24 + dx, 14 + dy, 3, 2, OUT);
  }
  if (['uniform', 'cap', 'visor'].includes(k.hat)) {
    px(c, 8 + dx, dy - 3, 19, 6, OUT); px(c, 9 + dx, dy - 2, 17, 4, k.hat === 'uniform' ? '#3e5668' : k.top);
    px(c, 9 + dx, 2 + dy, 22, 2, OUT); px(c, 10 + dx, 2 + dy, 17, 1, METAL);
    if (k.hat === 'uniform') { px(c, 18 + dx, dy - 2, 4, 3, GOLD); px(c, 19 + dx, dy - 1, 2, 1, PAPER); }
  }
  if (k.hat === 'scarf') {
    px(c, 7 + dx, dy, 20, 5, GOLD); px(c, 6 + dx, 5 + dy, 4, 12, GOLD);
    px(c, 7 + dx, 16 + dy, 5, 4, '#987028'); px(c, 10 + dx, 1 + dy, 3, 1, PAPER);
  }
  if (k.hat === 'headband') { px(c, 8 + dx, 3 + dy, 19, 3, PAPER); px(c, 6 + dx, 4 + dy, 3, 7, PAPER); }
  px(c, 15 + dx, 8 + dy, 3, 1, OUT); px(c, 22 + dx, 8 + dy, 3, 1, OUT);
  const eyeHeight = pose === 'hit' ? 1 : 2;
  px(c, 16 + dx, 10 + dy, 2, eyeHeight, OUT); px(c, 23 + dx, 10 + dy, 2, eyeHeight, OUT);
  px(c, 20 + dx, 11 + dy, 2, 3, SKIN_D); px(c, 19 + dx, 15 + dy, 4, 1, '#805b48');
  if (kind === 'elder' || kind === 'commuter') {
    px(c, 13 + dx, 9 + dy, 6, 1, METAL); px(c, 21 + dx, 9 + dy, 6, 1, METAL);
    px(c, 13 + dx, 10 + dy, 1, 3, METAL); px(c, 21 + dx, 10 + dy, 1, 3, METAL); px(c, 19 + dx, 10 + dy, 2, 1, METAL);
  }
}

function jacket(c, k, kind, dx, y) {
  const left = Math.floor((32 - k.width) / 2);
  px(c, left + dx - 1, y, k.width + 2, 19, OUT); px(c, left + dx, y + 1, k.width, 17, k.top);
  px(c, left + dx, y + 1, 5, 14, k.light); px(c, left + dx + k.width - 4, y + 1, 4, 17, k.dark);
  px(c, left + dx + 2, y + 16, k.width - 4, 1, k.dark);
  px(c, 12 + dx, y + 1, 4, 3, PAPER); px(c, 20 + dx, y + 1, 4, 3, PAPER);
  px(c, 17 + dx, y + 3, 2, 13, k.dark);
  for (const by of [7, 11]) px(c, 18 + dx, y + by, 1, 1, METAL);
  if (kind === 'chengguan') {
    px(c, 4 + dx, y + 1, 6, 2, '#3e5668'); px(c, 24 + dx, y + 1, 5, 2, '#3e5668');
    px(c, 5 + dx, y + 1, 4, 1, METAL); px(c, 24 + dx, y + 1, 4, 1, METAL);
    px(c, 7 + dx, y + 7, 7, 5, k.dark); px(c, 8 + dx, y + 7, 5, 1, METAL);
    px(c, 21 + dx, y + 6, 4, 3, GOLD); px(c, 20 + dx, y + 11, 6, 1, METAL);
    px(c, 4 + dx, y + 16, 25, 3, OUT); px(c, 16 + dx, y + 16, 5, 3, METAL); px(c, 17 + dx, y + 17, 3, 1, OUT);
    px(c, 7 + dx, y + 11, 5, 10, OUT); px(c, 8 + dx, y + 13, 3, 2, '#6d8b81'); px(c, 8 + dx, y + 7, 1, 5, OUT);
  } else if (['barista', 'clerk', 'vendor'].includes(kind)) {
    const apron = kind === 'barista' ? '#48695e' : kind === 'clerk' ? '#304c67' : PAPER;
    px(c, 11 + dx, y + 3, 13, 20, apron); px(c, 12 + dx, y, 2, 5, apron); px(c, 22 + dx, y, 2, 5, apron);
    px(c, 9 + dx, y + 11, 17, 2, k.dark); px(c, 13 + dx, y + 13, 9, 6, k.dark);
    px(c, 14 + dx, y + 14, 7, 1, METAL); px(c, 14 + dx, y + 5, 6, 3, PAPER);
  } else if (kind === 'cleaner' || kind === 'rider') {
    px(c, 9 + dx, y + 1, 2, 16, GOLD); px(c, 24 + dx, y + 1, 2, 16, GOLD);
    px(c, 5 + dx, y + 11, 23, 2, PAPER); px(c, 14 + dx, y + 4, 7, 3, k.dark);
  } else if (kind === 'thug') {
    px(c, 11 + dx, y + 2, 12, 12, '#30383c'); px(c, 13 + dx, y + 3, 8, 3, SKIN_D);
    px(c, 15 + dx, y + 6, 4, 1, GOLD); px(c, 18 + dx, y + 7, 2, 3, GOLD);
    px(c, 5 + dx, y + 8, 4, 2, METAL); px(c, 24 + dx, y + 11, 4, 1, METAL);
  } else if (kind === 'thug_hood') {
    px(c, 13 + dx, y + 1, 1, 9, PAPER); px(c, 23 + dx, y + 1, 1, 7, PAPER);
    px(c, 11 + dx, y + 12, 14, 4, k.dark); px(c, 16 + dx, y + 6, 5, 3, k.light);
  } else if (kind === 'commuter') {
    px(c, 16 + dx, y + 2, 4, 10, PAPER); px(c, 17 + dx, y + 3, 2, 8, '#9f615b');
    px(c, 23 + dx, y + 6, 4, 2, PAPER);
  } else if (kind === 'worker') {
    px(c, 9 + dx, y + 2, 3, 16, k.dark); px(c, 23 + dx, y + 2, 3, 16, k.dark);
    px(c, 12 + dx, y + 8, 12, 9, k.dark); px(c, 14 + dx, y + 9, 7, 1, METAL);
  } else if (kind === 'volunteer') {
    px(c, 13 + dx, y + 4, 10, 6, PAPER); px(c, 16 + dx, y + 6, 4, 2, k.top);
  }
}

function arm(c, x, y, w, h, color, horizontal = false) {
  px(c, x - 1, y - 1, w + 2, h + 2, OUT); px(c, x, y, w, h, color);
  if (horizontal) { px(c, x + w - 3, y, 2, h, METAL); px(c, x + w, y, 5, h, SKIN); px(c, x + w + 2, y + h - 1, 3, 1, SKIN_D); }
  else { px(c, x, y + h - 2, w, 2, METAL); px(c, x, y + h, w, 4, SKIN); px(c, x, y + h + 3, w, 1, SKIN_D); }
}

function arms(c, k, dx, y, pose, frame) {
  const swing = ['walk', 'flee'].includes(pose) ? [-3, 1, 3, -1][frame] : 0;
  if (pose === 'attack') {
    arm(c, 3 + dx, y + 4, 5, 9, k.light);
    const reach = [7, 17, 11, 4][frame];
    arm(c, 26 + dx, y + 3, reach, 5, k.dark, true);
    px(c, 27 + dx + reach, y + 3, 3, 1, SKIN_L);
  } else if (pose === 'defend') {
    arm(c, 4 + dx, y + 1, 5, 10, k.light); arm(c, 23 + dx, y - 5, 5, 12, k.dark);
    px(c, 21 + dx, y - 8, 7, 6, SKIN); px(c, 20 + dx, y - 7, 2, 3, SKIN_D);
    arm(c, 7 + dx, y + 8, 15, 4, k.light, true);
  } else if (pose === 'hit') {
    arm(c, dx - 2, y + 2, 8, 5, k.light, true); arm(c, 25 + dx, y + 8, 5, 7, k.dark);
  } else {
    arm(c, 3 + dx, y + 2 + swing, 5, 11, k.light); arm(c, 25 + dx, y + 2 - swing, 5, 11, k.dark);
  }
}

function equipment(c, kind, dx, y, frame) {
  if (kind === 'rider' || kind === 'student') {
    const color = kind === 'rider' ? GOLD : '#9f615b';
    px(c, -5 + dx, y - 3, 10, 21, OUT); px(c, -4 + dx, y - 2, 8, 19, color);
    px(c, -3 + dx, y, 6, 2, PAPER); px(c, -3 + dx, y + 11, 6, 4, '#805b48'); px(c, 5 + dx, y + 1, 2, 14, color);
  } else if (kind === 'cleaner') {
    const sway = frame % 2;
    px(c, 31 + sway, y + 3, 2, 29, '#a8926c'); px(c, 26 + sway, y + 29, 13, 4, '#987028');
    for (let i = 0; i < 5; i++) px(c, 26 + sway + i * 3, y + 32, 1, 3, '#a8926c');
    px(c, 28, y + 16, 6, 3, SKIN);
  } else if (kind === 'elder') {
    px(c, 30, y + 15, 6, 2, '#805b48'); px(c, 34, y + 16, 2, 21, '#805b48');
    px(c, 33, y + 35, 4, 2, OUT); px(c, 29, y + 13, 5, 3, SKIN);
  } else if (kind === 'commuter' || kind === 'worker') {
    px(c, 1 + dx, y + 15, 7, 3, OUT); px(c, -3 + dx, y + 18, 14, 10, OUT);
    px(c, -2 + dx, y + 19, 12, 8, kind === 'commuter' ? '#805b48' : '#587d9a');
    px(c, -1 + dx, y + 21, 10, 1, METAL); px(c, 3 + dx, y + 20, 3, 3, GOLD);
  } else if (kind === 'barista') {
    px(c, 27 + dx, y + 10, 8, 9, OUT); px(c, 28 + dx, y + 11, 6, 7, PAPER);
    px(c, 28 + dx, y + 10, 6, 2, '#805b48'); px(c, 34 + dx, y + 12, 3, 4, PAPER);
    px(c, 30 + dx + frame % 2, y + 5, 1, 3, METAL);
  } else if (kind === 'clerk' || kind === 'volunteer') {
    px(c, 26 + dx, y + 9, 9, 13, OUT); px(c, 27 + dx, y + 10, 7, 11, PAPER);
    for (let i = 0; i < 3; i++) px(c, 28 + dx, y + 12 + i * 3, 5, 1, '#587d9a');
  } else if (kind === 'vendor') {
    px(c, 26 + dx, y + 16, 14, 8, '#805b48'); px(c, 25 + dx, y + 16, 16, 2, GOLD);
    for (let i = 0; i < 3; i++) { px(c, 27 + dx + i * 4, y + 12, 3, 4, '#6d8b81'); px(c, 28 + dx + i * 4, y + 11, 2, 2, '#96afa1'); }
    px(c, 27 + dx, y + 21, 11, 1, GOLD);
  }
}

export function drawConflictNpc(c, x, y, kind = 'chengguan', pose = 'stand', frame = 0, facing = 1, scale = 1) {
  const type = kind === 'thugs' ? 'thug' : PROFILES[kind] ? kind : 'chengguan';
  const k = PROFILES[type], f = Math.abs(Math.floor(frame)) % 4;
  const action = pose.replace(/[0-3]$/, '');
  const bob = ['walk', 'flee'].includes(action) && f % 2 ? -1 : 0;
  const dx = action === 'hit' ? -3 : action === 'attack' ? 2 : 0;
  const dy = action === 'defend' ? 4 : type === 'elder' ? 2 : bob;
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
  if (facing === -1) { c.translate(32, 0); c.scale(-1, 1); }
  px(c, 2, 51, 30, 2, 'rgba(10,18,24,0.45)');
  legs(c, k, action, f); jacket(c, k, type, dx, 18 + dy);
  head(c, k, type, dx, dy, action); arms(c, k, dx, 18 + dy, action, f);
  if (!['attack', 'defend', 'hit'].includes(action)) equipment(c, type, dx, 18 + dy, f);
  c.restore();
}

export function drawStreetNpc(c, npc, x, y, tick = 0, options = {}) {
  const kind = options.kind || identity(npc);
  const pose = options.pose || (tick ? 'walk' : 'stand');
  drawConflictNpc(c, x, y, kind, pose, tick, options.facing ?? 1, options.scale ?? 0.82);
}
