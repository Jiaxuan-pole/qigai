import { px } from './pixel.js';

function lamp(c, x, y) {
  px(c, x - 17, y, 34, 3, '#b49564');
  px(c, x - 10, y + 3, 20, 8, '#e3bb72');
  px(c, x - 6, y + 11, 12, 3, '#ffdfa0');
  px(c, x - 1, y - 19, 2, 19, '#887254');
}

function chair(c, x, y, color) {
  px(c, x, y, 22, 29, '#202a2b');
  px(c, x + 3, y + 3, 16, 18, color);
  px(c, x + 1, y + 20, 20, 5, '#a07a52');
  px(c, x + 3, y + 25, 3, 15, '#554534');
  px(c, x + 16, y + 25, 3, 15, '#554534');
}

function card(c, x, y, red = false, hidden = false) {
  px(c, x, y, 13, 18, '#1b3030');
  px(c, x + 1, y + 1, 11, 16, hidden ? '#9b554c' : '#e6dfcc');
  if (hidden) { px(c, x + 3, y + 4, 7, 1, '#d1a786'); px(c, x + 5, y + 7, 3, 4, '#d1a786'); }
  else { px(c, x + 3, y + 3, 3, 3, red ? '#ac4d46' : '#2c3f43'); px(c, x + 7, y + 10, 3, 4, red ? '#ac4d46' : '#2c3f43'); }
}

function chips(c, x, y, color) {
  px(c, x - 2, y + 3, 17, 4, '#203536');
  px(c, x, y, 13, 4, color);
  px(c, x + 2, y + 1, 2, 2, '#e8d8aa');
  px(c, x + 9, y + 1, 2, 2, '#e8d8aa');
}

function table(c, x, y, kind) {
  const width = kind === 'texas' ? 198 : kind === 'zjh' ? 162 : 181;
  px(c, x - width / 2 - 5, y + 12, width + 10, 42, '#261f1b');
  px(c, x - width / 2, y + 8, width, 44, '#8c603b');
  px(c, x - width / 2 + 7, y + 14, width - 14, 29, '#213f35');
  px(c, x - width / 2 + 11, y + 17, width - 22, 23, '#267056');
  px(c, x - width / 2 + 10, y + 42, width - 20, 3, '#c39a5e');
  px(c, x - width / 2 + 13, y + 53, 11, 29, '#5b4433');
  px(c, x + width / 2 - 24, y + 53, 11, 29, '#5b4433');
  chair(c, x - width / 2 - 22, y + 32, '#674d4b');
  chair(c, x + width / 2 + 1, y + 32, '#674d4b');
  if (kind === 'blackjack') {
    card(c, x - 17, y + 17, false, true); card(c, x - 1, y + 19, true);
    card(c, x + 24, y + 27, false); chips(c, x - 43, y + 31, '#b28b45');
    px(c, x - 39, y + 36, 79, 2, '#bfa66d');
  } else if (kind === 'zjh') {
    card(c, x - 20, y + 23, false, true); card(c, x - 7, y + 23, false, true); card(c, x + 6, y + 23, false, true);
    chips(c, x + 31, y + 27, '#a95749'); chips(c, x - 42, y + 29, '#d3aa62');
  } else {
    for (let i = 0; i < 5; i++) card(c, x - 37 + i * 15, y + 19, i % 2 === 0);
    chips(c, x - 53, y + 34, '#aa5951'); chips(c, x + 45, y + 33, '#d2a657');
  }
}

function guest(c, x, y, id) {
  const looks = {
    hall_lan: { hair: '#332c2d', skin: '#ecc19a', coat: '#775277', accent: '#c8a777', face: 1 },
    hall_qiao: { hair: '#252e31', skin: '#b98358', coat: '#a0784e', accent: '#547e79', face: 2 },
    hall_dealer: { hair: '#3c3330', skin: '#d9a577', coat: '#303a42', accent: '#d7cbb1', face: 3 },
  }[id];
  px(c, x - 7, y + 1, 14, 18, looks.coat);
  px(c, x - 4, y + 17, 4, 13, '#2c383a'); px(c, x + 1, y + 17, 4, 13, '#2c383a');
  px(c, x - 9, y + 7, 3, 12, looks.skin); px(c, x + 6, y + 7, 3, 12, looks.skin);
  px(c, x - 6, y - 13, 12, 14, looks.skin);
  px(c, x - 7, y - 16, 14, id === 'hall_qiao' ? 5 : 7, looks.hair);
  if (id === 'hall_lan') { px(c, x - 9, y - 11, 3, 13, looks.hair); px(c, x - 4, y + 3, 8, 3, looks.accent); px(c, x - 11, y + 17, 4, 3, looks.skin); }
  if (id === 'hall_qiao') { px(c, x - 5, y - 19, 11, 3, looks.accent); px(c, x - 7, y - 16, 14, 2, looks.accent); px(c, x + 8, y + 16, 7, 3, looks.skin); }
  if (id === 'hall_dealer') { px(c, x - 2, y + 2, 4, 12, looks.accent); px(c, x - 3, y + 6, 6, 2, '#a85a51'); px(c, x + 8, y + 16, 12, 2, looks.skin); }
  px(c, x - 4, y - 6, 2, 2, '#302d2b'); px(c, x + 2, y - 6, 2, 2, '#302d2b');
  if (looks.face === 1) px(c, x - 1, y - 2, 3, 1, '#a5655f');
  if (looks.face === 2) px(c, x - 3, y - 2, 6, 1, '#6d4333');
  if (looks.face === 3) px(c, x - 2, y - 3, 4, 1, '#805b42');
}

export function drawCardhallScene(c, { night = false, weatherKind = 'clear' } = {}) {
  px(c, 0, 0, 960, 540, night ? '#253d44' : '#415858');
  px(c, 0, 120, 960, 282, '#423b37');
  for (let i = 0; i < 24; i++) px(c, i * 41, 121, 2, 275, '#514640');
  px(c, 72, 140, 816, 256, '#8c745b');
  px(c, 83, 151, 794, 233, '#382f2d');
  px(c, 95, 162, 770, 209, '#555046');
  px(c, 95, 314, 770, 57, '#574c40');
  for (let i = 0; i < 15; i++) px(c, 99 + i * 53, 318, 2, 51, '#645645');
  px(c, 100, 164, 755, 15, '#6f5b45');
  for (const x of [244, 480, 716]) lamp(c, x, 175);
  px(c, 104, 190, 99, 95, '#23383b'); px(c, 109, 195, 89, 85, '#68878b');
  px(c, 114, 199, 79, 30, '#a5b0a3'); px(c, 147, 195, 4, 85, '#263e41');
  px(c, 109, 190, 19, 94, '#715546'); px(c, 179, 190, 19, 94, '#715546');
  px(c, 751, 190, 99, 95, '#23383b'); px(c, 756, 195, 89, 85, '#68878b');
  px(c, 760, 200, 81, 26, '#a5b0a3'); px(c, 794, 195, 4, 85, '#263e41');
  px(c, 756, 190, 19, 94, '#715546'); px(c, 826, 190, 19, 94, '#715546');
  px(c, 392, 204, 175, 30, '#243d39'); px(c, 401, 211, 157, 4, '#d4b478');
  c.fillStyle = '#e6dfcc'; c.font = 'bold 19px sans-serif'; c.textAlign = 'center'; c.fillText('街角棋牌馆', 480, 230);
  px(c, 195, 347, 555, 15, '#7a6349'); px(c, 207, 360, 530, 7, '#a48559');
  table(c, 247, 290, 'zjh'); table(c, 480, 290, 'blackjack'); table(c, 713, 290, 'texas');
  guest(c, 182, 274, 'hall_lan'); guest(c, 780, 273, 'hall_qiao'); guest(c, 479, 262, 'hall_dealer');
  px(c, 343, 279, 21, 3, '#e6dfcc'); px(c, 345, 275, 17, 5, '#d7cbb1'); px(c, 350, 271, 7, 4, '#b8a38d');
  px(c, 590, 287, 18, 2, '#e6dfcc'); px(c, 593, 282, 12, 5, '#d7cbb1');
  px(c, 68, 385, 825, 11, '#b58c5f');
  px(c, 0, 396, 960, 42, '#697471'); px(c, 0, 438, 960, 8, '#a4a693'); px(c, 0, 446, 960, 94, '#3b4c51');
  for (let i = 0; i < 8; i++) px(c, 30 + i * 130, 503, 67, 3, '#97a19b');
  px(c, 430, 378, 100, 15, '#2e3e3b'); px(c, 440, 381, 80, 8, '#e3bb72');
  c.fillStyle = '#243d39'; c.font = 'bold 11px sans-serif'; c.fillText('14:00 - 22:00', 480, 388);
  if (['rain', 'storm'].includes(weatherKind)) for (let i = 0; i < 20; i++) px(c, (i * 67) % 960, 458 + (i % 4) * 13, 9, 1, '#75949b');
}
