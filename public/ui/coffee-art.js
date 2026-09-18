import { px } from './pixel.js';
import { drawStreetNpc } from './npc-art.js';

export function drawCafeScene(c, { night = false, weatherKind = 'clear', tick = 0 } = {}) {
  const wet = weatherKind === 'rain' || weatherKind === 'storm';
  const outside = night ? '#243a49' : wet ? '#667d81' : '#91a7a2';
  px(c, 0, 0, 960, 540, '#372d2b');
  px(c, 0, 35, 960, 335, '#7d5b43');
  for (let x = 0; x < 960; x += 120) px(c, x, 40, 3, 328, '#674832');
  px(c, 0, 36, 960, 19, '#a17a54');
  px(c, 0, 354, 960, 19, '#4f382d');
  px(c, 0, 373, 960, 167, '#806b55');
  for (let y = 386; y < 540; y += 32) px(c, 0, y, 960, 2, '#aa8c66');
  for (let x = 30; x < 960; x += 80) px(c, x, 373, 2, 167, '#6b5648');

  // Two street doors remain legible at walking height.
  for (const x of [4, 870]) {
    px(c, x, 193, 86, 201, '#392f2c'); px(c, x + 6, 200, 74, 187, '#ad8058');
    px(c, x + 12, 210, 62, 137, outside); px(c, x + 42, 210, 5, 137, '#d7bb8e');
    px(c, x + 12, 282, 62, 5, '#d7bb8e'); px(c, x + 66, 311, 6, 5, '#e3bb72');
    px(c, x + 10, 351, 66, 28, '#523a2f');
  }
  // Window, city outside and a seated corner.
  px(c, 106, 90, 203, 190, '#4b3229'); px(c, 115, 99, 185, 171, outside);
  px(c, 115, 225, 185, 45, '#405858'); px(c, 119, 211, 35, 14, '#526769');
  px(c, 181, 192, 27, 33, '#516467'); px(c, 235, 203, 38, 22, '#516467');
  px(c, 201, 99, 5, 171, '#d0a473'); px(c, 115, 180, 185, 5, '#d0a473');
  if (wet) for (let i = 0; i < 18; i++) px(c, 122 + i * 9, 110 + (i * 31 + tick * 7) % 124, 2, 12, '#aec6c4');
  px(c, 126, 298, 149, 13, '#68472f'); px(c, 136, 311, 10, 51, '#49362d');
  px(c, 254, 311, 10, 51, '#49362d');
  for (const x of [105, 273]) { px(c, x, 320, 39, 12, '#a67551'); px(c, x + 4, 332, 6, 42, '#4e382d'); px(c, x + 29, 332, 6, 42, '#4e382d'); }
  px(c, 151, 283, 26, 15, '#e1d0ae'); px(c, 174, 285, 8, 9, '#e1d0ae'); px(c, 156, 280, 17, 4, '#62422f');

  // Back counter and working equipment form the focal point.
  px(c, 327, 117, 486, 251, '#624631');
  for (let y = 148; y <= 245; y += 48) px(c, 343, y, 452, 8, '#b38a5d');
  for (let x = 363; x < 775; x += 47) { px(c, x, 130, 28, 16, '#e7d4b6'); px(c, x + 26, 135, 8, 8, '#e7d4b6'); }
  for (const x of [356, 416, 476]) { px(c, x, 162, 43, 57, '#806346'); px(c, x + 5, 168, 33, 40, '#bd996b'); px(c, x + 12, 185, 20, 12, '#69472d'); }
  px(c, 549, 168, 127, 81, '#242d2d'); px(c, 555, 174, 115, 69, '#343c39');
  for (let i = 0; i < 5; i++) px(c, 563, 185 + i * 11, 53 + i % 2 * 37, 3, '#d6c294');
  px(c, 700, 170, 53, 75, '#3a3936'); px(c, 707, 178, 39, 42, '#8b9690');
  px(c, 714, 185, 25, 17, '#354443'); px(c, 719, 212, 16, 7, '#d8cbb1');
  px(c, 340, 266, 460, 33, '#c3935e'); px(c, 327, 299, 486, 66, '#68472f');
  for (let x = 348; x < 792; x += 64) px(c, x, 303, 3, 60, '#8d6645');
  px(c, 347, 277, 80, 15, '#303b3b'); px(c, 362, 260, 49, 18, '#89958e');
  px(c, 364, 248, 45, 12, '#333b39'); px(c, 397, 280, 10, 10, '#d8cbb1');
  px(c, 439, 275, 29, 16, '#e5d2ae'); px(c, 465, 279, 9, 8, '#e5d2ae');
  px(c, 492, 273, 29, 18, '#e5d2ae'); px(c, 518, 278, 9, 9, '#e5d2ae');
  if (!night && tick % 3 !== 2) for (let i = 0; i < 3; i++) px(c, 378 + i * 5, 233 - (tick + i) % 3 * 7, 2, 9, '#d8d2bd');
  drawStreetNpc(c, { id: 'barista', job: '咖啡师' }, 736, 291, 0);

  // A warm lamp, bean sacks and plant frame the otherwise clear walking lane.
  for (const x of [400, 738]) { px(c, x, 52, 3, 41, '#55423a'); px(c, x - 16, 91, 35, 10, '#d5a763'); px(c, x - 11, 101, 25, 5, '#f1d6a0'); }
  for (const x of [580, 627]) { px(c, x, 336, 38, 36, '#8a6a44'); px(c, x + 4, 341, 30, 26, '#b99461'); px(c, x + 12, 348, 15, 7, '#543c2d'); }
  px(c, 805, 317, 45, 52, '#754c35'); px(c, 817, 266, 9, 53, '#5a7655');
  for (const [x, y] of [[801, 269], [824, 256], [837, 278], [805, 294]]) px(c, x, y, 25, 11, '#6c9163');
  if (night) { c.fillStyle = 'rgba(16,23,34,.19)'; c.fillRect(0, 0, 960, 540); }
}
