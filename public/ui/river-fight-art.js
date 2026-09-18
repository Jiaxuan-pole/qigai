import { px, person } from './intro-art.js';

const COLORS = {
  sky: '#8199a0', cloud: '#bfd0cf', reed: '#536c55', reedDark: '#35483c',
  bank: '#c9ad74', bankLight: '#dec98c', bankDark: '#8b754c', grass: '#77905a',
  water: '#397c93', waterLight: '#76bdc5', waterDeep: '#285e73', foam: '#b9e9ed',
  fish: '#d7b46b', fishDark: '#9a713d', wood: '#71503a', metal: '#394e56',
};

function riverbank(c, tick) {
  px(c, 0, 0, 480, 270, COLORS.sky);
  px(c, 0, 32, 480, 2, COLORS.cloud);
  for (const [x, h] of [[18, 54], [47, 36], [373, 53], [421, 41], [456, 62]]) {
    px(c, x, 92 - h, 3, h, COLORS.reedDark);
    px(c, x - 5, 84 - h / 2, 5, 3, COLORS.reed);
    px(c, x + 3, 72 - h / 3, 5, 3, COLORS.reed);
  }
  px(c, 0, 132, 480, 12, '#667c65');
  px(c, 0, 144, 216, 126, COLORS.bank);
  px(c, 0, 151, 216, 3, COLORS.bankLight);
  px(c, 0, 226, 216, 44, COLORS.bankDark);
  for (let x = 4; x < 210; x += 17) {
    const y = 173 + (x * 7) % 38;
    px(c, x, y, 7, 2, COLORS.bankLight);
    px(c, x + 3, y + 4, 3, 2, COLORS.grass);
  }
  px(c, 205, 142, 275, 128, COLORS.water);
  px(c, 205, 142, 275, 4, COLORS.waterLight);
  for (let x = 213; x < 480; x += 31) {
    const y = 154 + ((x * 11 + tick * 3) % 98);
    px(c, x, y, 17, 2, COLORS.waterLight);
    px(c, x + 7, y + 3, 22, 1, COLORS.waterDeep);
  }
  px(c, 207, 140, 3, 130, COLORS.bankDark);
}

function fishingGear(c) {
  px(c, 58, 183, 54, 6, COLORS.wood);
  px(c, 62, 189, 5, 17, COLORS.wood); px(c, 103, 189, 5, 17, COLORS.wood);
  px(c, 77, 174, 4, 12, COLORS.metal); px(c, 81, 178, 7, 3, '#d8d6cf');
  px(c, 110, 166, 4, 24, COLORS.wood); px(c, 110, 164, 91, 2, COLORS.wood);
  px(c, 198, 166, 1, 18, '#d7e8e4'); px(c, 195, 183, 7, 2, '#d7e8e4');
  px(c, 42, 208, 18, 11, '#5c6b64'); px(c, 45, 206, 12, 3, '#92a096');
}

function fish(c, x, y, facingLeft) {
  const dir = facingLeft ? -1 : 1;
  px(c, x, y, 13, 6, COLORS.fish);
  px(c, x + 3, y, 7, 2, '#efd58a');
  px(c, x + (dir > 0 ? -4 : 13), y + 1, 4, 5, COLORS.fishDark);
  px(c, x + (dir > 0 ? 10 : 1), y + 2, 2, 2, '#263238');
  px(c, x + 5, y + 6, 3, 2, COLORS.fishDark);
}

function splash(c, x, y, tick) {
  const burst = tick % 2;
  px(c, x - 25, y + 9, 51, 5, COLORS.foam);
  px(c, x - 18, y + 3, 36, 8, COLORS.foam);
  px(c, x - 10, y - 7 - burst, 20, 12, COLORS.foam);
  px(c, x - 31, y - 2 + burst, 5, 9, COLORS.foam);
  px(c, x + 26, y - 4, 5, 11, COLORS.foam);
  px(c, x - 39, y + 15, 17, 2, COLORS.waterLight);
  px(c, x + 21, y + 17, 22, 2, COLORS.waterLight);
}

function wetDrips(c, x, y, tick) {
  const drop = tick % 3;
  px(c, x + 5, y + 39, 2, 5 + drop, COLORS.waterLight);
  px(c, x + 20, y + 33, 2, 4 + (drop === 0 ? 2 : 0), COLORS.waterLight);
  px(c, x + 11, y + 47, 2, 2, COLORS.waterLight);
}

function swimmer(c, choreo, tick) {
  const bob = tick % 2;
  person(c, choreo.maX, choreo.maY + bob, 'ma', 'crouch', tick, { flip: true, headUp: true });
  px(c, choreo.maX + (tick % 2 ? 25 : -3), choreo.maY + 26, 8, 3, '#b98358');
  px(c, choreo.maX + (tick % 2 ? 30 : -8), choreo.maY + 29, 5, 3, '#8f633f');
  px(c, 205, 142, 275, 8, COLORS.waterLight);
  px(c, choreo.maX - 7, 149, 15, 2, COLORS.foam);
  px(c, choreo.maX + 20, 153, 17, 2, COLORS.foam);
}

function ma(c, choreo, tick) {
  if (choreo.phase === 'swim') return swimmer(c, choreo, tick);
  const pose = choreo.phase === 'empty-hook' ? 'sit'
    : choreo.phase === 'climb' ? 'crouch'
      : choreo.phase === 'shake' ? 'stand'
        : choreo.phase === 'splash' ? 'crouch'
          : choreo.phase === 'run' ? `walk${tick % 4}` : 'stand';
  person(c, choreo.maX, choreo.maY, 'ma', pose, tick, {
    flip: choreo.phase !== 'run',
    arm: choreo.phase === 'anger' ? 'point' : choreo.phase === 'leap' ? 'reach' : 'none',
    headDown: choreo.phase === 'empty-hook',
  });
  if (choreo.phase === 'climb' || choreo.phase === 'shake') wetDrips(c, choreo.maX, choreo.maY, tick);
}

export function drawRiverFightScene(c, { choreo, tick }) {
  riverbank(c, tick);
  fishingGear(c);
  const fishY = choreo.phase === 'swim' ? 170 + (tick % 2) * 5 : 176;
  fish(c, choreo.fishX, fishY, choreo.fishX < 350);
  ma(c, choreo, tick);
  if (choreo.phase === 'splash') splash(c, choreo.maX + 12, 153, tick);
  if (choreo.phase === 'leap') px(c, choreo.maX + 4, choreo.maY + 48, 21, 2, 'rgba(0,0,0,0.25)');
}
