import { px } from './pixel.js';

export const STREET_OBJECTS = {
  camp: [{ id: 'passersby', name: '路过的人', x: 728, y: 412 }],
  market: [{ id: 'bins', name: '翻这个桶', x: 272, y: 421 }, { id: 'bottles', name: '捡瓶罐', x: 705, y: 459 }, { id: 'passersby', name: '问路人', x: 820, y: 410 }],
  recycle: [{ id: 'bins', name: '翻这个桶', x: 270, y: 421 }, { id: 'bottles', name: '捡瓶罐', x: 706, y: 459 }, { id: 'passersby', name: '问路人', x: 822, y: 410 }],
  station: [{ id: 'bins', name: '翻这个桶', x: 270, y: 421 }, { id: 'bottles', name: '捡瓶罐', x: 705, y: 459 }, { id: 'passersby', name: '问路人', x: 822, y: 410 }],
  cinema: [{ id: 'bottles', name: '捡瓶罐', x: 706, y: 459 }, { id: 'passersby', name: '问路人', x: 822, y: 410 }],
  service: [{ id: 'bottles', name: '捡瓶罐', x: 706, y: 459 }, { id: 'passersby', name: '问路人', x: 822, y: 410 }],
  river: [{ id: 'bottles', name: '捡瓶罐', x: 705, y: 459 }, { id: 'passersby', name: '问路人', x: 822, y: 410 }],
  furniture: [{ id: 'passersby', name: '问看家具的客人', x: 822, y: 410 }],
};

function bottle(c, x, y, color = '#8db5a9') {
  px(c, x + 5, y - 5, 5, 5, '#879b98'); px(c, x + 3, y, 9, 23, '#263c41');
  px(c, x + 5, y + 2, 5, 19, color); px(c, x + 6, y + 4, 2, 11, '#d6ece1');
  px(c, x + 4, y + 16, 7, 3, '#dfd1a1');
}
function can(c, x, y) {
  px(c, x, y, 14, 18, '#2c3e43'); px(c, x + 2, y + 2, 10, 14, '#b65f4b');
  px(c, x + 2, y + 5, 2, 8, '#f0ba83'); px(c, x + 4, y - 2, 6, 3, '#b7c6be');
}
function bin(c, x, y) {
  px(c, x - 3, y - 5, 52, 9, '#303f43'); px(c, x - 7, y - 12, 57, 8, '#647673');
  px(c, x + 1, y + 2, 43, 51, '#26383d'); px(c, x + 5, y + 4, 35, 46, '#4b6567');
  px(c, x + 11, y + 8, 4, 32, '#748a84'); px(c, x + 29, y + 8, 4, 32, '#283f42');
  px(c, x - 4, y + 46, 51, 7, '#20343a');
  px(c, x + 45, y + 28, 16, 21, '#3c4945'); px(c, x + 48, y + 26, 13, 5, '#687977');
  px(c, x + 58, y + 41, 17, 6, '#cfbfa0'); px(c, x + 65, y + 40, 5, 2, '#7c9d9a');
  px(c, x - 11, y + 47, 12, 3, '#5a675e'); px(c, x + 14, y + 55, 29, 2, '#3a5a57');
}
export function drawStreetObjects(c, district, wet, tick) {
  const objects = STREET_OBJECTS[district] || [];
  for (const object of objects) {
    if (object.id === 'bins') bin(c, object.x - 20, 392);
    if (object.id === 'bottles') {
      bottle(c, object.x - 33, 441, '#7ab3a6');
      bottle(c, object.x - 15, 445, '#b4c9a0');
      can(c, object.x + 8, 450);
      px(c, object.x + 28, 454, 26, 15, '#896f4f'); px(c, object.x + 33, 456, 16, 3, '#b99866');
      if (wet) px(c, object.x - 39 + tick % 7, 476, 87, 2, '#819fa0');
    }
  }
}
