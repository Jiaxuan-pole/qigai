import { px, person, personAnchors, smokeCurl, tossCig } from './intro-art.js';

function street(c, tick) {
  px(c, 0, 0, 480, 270, '#17232a');
  px(c, 0, 0, 480, 82, '#24343e');
  px(c, 0, 82, 480, 8, '#5b6a6b');
  px(c, 0, 90, 480, 110, '#46575a');
  px(c, 0, 200, 480, 70, '#29383d');
  px(c, 0, 232, 480, 3, '#59686a');
  for (let x = 18; x < 480; x += 51) px(c, x + (tick % 5), 242, 24, 1, '#3a4c50');
  px(c, 338, 94, 84, 106, '#3a4648');
  px(c, 348, 106, 54, 8, '#b9a273'); px(c, 356, 120, 38, 44, '#263034');
}

function bin(c, open) {
  px(c, 330, 184, 42, 44, '#596467'); px(c, 334, 189, 34, 34, '#677477');
  px(c, 328, open ? 176 : 180, 46, 6, '#8a9693');
  if (open) { px(c, 334, 169, 34, 5, '#70807e'); px(c, 336, 166, 30, 3, '#2b3537'); }
  px(c, 336, 226, 7, 4, '#1d2528'); px(c, 360, 226, 7, 4, '#1d2528');
}

function luggage(c, x, y, tipped = false) {
  if (tipped) { px(c, x, y + 21, 29, 8, '#4a4a52'); px(c, x + 3, y + 19, 24, 3, '#5f5f69'); px(c, x + 4, y + 29, 6, 3, '#1d2226'); px(c, x + 20, y + 29, 6, 3, '#1d2226'); return; }
  px(c, x, y, 22, 29, '#4a4a52'); px(c, x + 2, y + 2, 18, 25, '#5f5f69'); px(c, x + 4, y + 8, 14, 2, '#252c31');
  px(c, x + 3, y + 29, 6, 4, '#1d2226'); px(c, x + 15, y + 29, 6, 4, '#1d2226');
}

function sack(c, x, y, slipped) {
  const dy = slipped ? 28 : 0;
  px(c, x, y + dy, 22, 18, '#d7cfaa'); px(c, x + 2, y - 3 + dy, 18, 4, '#ece5c4'); px(c, x + 3, y + 4 + dy, 16, 1, '#a99c78');
  px(c, x + 7, y + 8 + dy, 7, 2, '#73725e'); px(c, x + 9, y + 11 + dy, 1, 4, '#73725e'); px(c, x + 12, y + 11 + dy, 1, 4, '#73725e');
}

function tears(c, x, y, tick) {
  const drop = tick % 2;
  px(c, x, y, 1, 3 + drop, '#8fc3e6'); px(c, x + 7, y + 1, 1, 2 + drop, '#8fc3e6');
}

export function drawMeetingScene(c, view) {
  const { beat, tick, choreo } = view;
  street(c, tick);
  bin(c, beat === 'bin' || beat === 'rush');
  const { xuanX, fanX, maX } = choreo;
  const hug = beat === 'hug';
  const smoke = beat === 'smoke';
  const walkHome = beat === 'home';
  if (beat === 'bin' || beat === 'rush') {
    const stride = Math.floor(tick / 2) % 4;
    const walk = beat === 'rush';
    person(c, xuanX, 186, 'xuan', walk ? 'walk' + stride : 'stand', stride, { arm: 'reach' });
    person(c, fanX, 186, 'fan', walk ? 'walk' + ((stride + 2) % 4) : 'stand', stride, { flip: true, arm: 'reach' });
    person(c, maX, 186, 'ma', 'bend', 0, { flip: true });
  }
  else if (hug) {
    person(c, xuanX, 186, 'xuan', 'stand', 0, { arm: 'hug' });
    person(c, maX, 186, 'ma', 'stand', 0, { flip: true, arm: 'hug' });
    person(c, fanX, 186, 'fan', 'stand', 0, { flip: true, arm: 'hug' });
    px(c, xuanX + 15, 204, fanX - xuanX + 6, 3, '#d9a577');
    tears(c, xuanX + 15, 199, tick); tears(c, maX + 8, 199, tick + 1); tears(c, fanX + 7, 199, tick);
    luggage(c, 151, 200, true); luggage(c, 268, 200, true); sack(c, 274, 185, true);
    return;
  } else if (beat === 'wipe') {
    person(c, xuanX, 186, 'xuan', 'stand', 0, { arm: 'wipe' });
    person(c, maX, 186, 'ma', 'stand', 0, { flip: true, arm: 'wipe' });
    person(c, fanX, 186, 'fan', 'stand', 0, { flip: true, arm: 'wipe' });
    tears(c, xuanX + 15, 199, tick); tears(c, maX + 8, 199, tick + 1); tears(c, fanX + 7, 199, tick);
    luggage(c, xuanX + 33, 202); luggage(c, fanX + 33, 202); sack(c, fanX - 8, 181, false);
    return;
  } else if (smoke) {
    const holder = choreo.cigaretteCarrier;
    const transfer = choreo.cigaretteTransfer;
    person(c, xuanX, 186, 'xuan', 'sit', 0, { arm: transfer?.includes('xuan') ? 'reach' : 'none', cig: holder === 'xuan', ember: 1 });
    person(c, maX, 186, 'ma', 'sit', 0, { flip: true, arm: transfer?.includes('ma') ? 'reach' : 'none', cig: holder === 'ma', ember: 1 });
    person(c, fanX, 186, 'fan', 'sit', 0, { flip: true, arm: transfer?.includes('fan') ? 'reach' : 'none', cig: holder === 'fan', ember: 1 });
    luggage(c, xuanX + 33, 202); luggage(c, fanX + 33, 202); sack(c, fanX - 8, 181, false);
    const anchors = {
      xuan: personAnchors(xuanX, 186, 'sit', 0, {}).cigarette,
      ma: personAnchors(maX, 186, 'sit', 0, { flip: true }).cigarette,
      fan: personAnchors(fanX, 186, 'sit', 0, { flip: true }).cigarette,
    };
    if (transfer) {
      const [from, to] = transfer;
      tossCig(c, anchors[from][0], anchors[from][1], anchors[to][0], anchors[to][1], choreo.transferProgress, '#e9e2d2', 5, 1);
    } else if (holder) {
      smokeCurl(c, anchors[holder][0], anchors[holder][1] - 1, tick, holder.length, 0.6);
    }
    return;
  } else {
    const stride = Math.floor(tick / 2) % 4;
    const pose = beat === 'recognize' ? 'stand' : 'walk';
    person(c, xuanX, 186, 'xuan', pose === 'walk' ? 'walk' + stride : pose, stride, { arm: beat === 'recognize' ? 'none' : 'reach' });
    person(c, fanX, 186, 'fan', pose === 'walk' ? 'walk' + ((stride + 2) % 4) : pose, stride, { flip: true, arm: beat === 'recognize' ? 'none' : 'reach' });
    person(c, maX, 186, 'ma', walkHome ? 'walk' + ((stride + 1) % 4) : 'stand', stride, { flip: !walkHome });
  }
  luggage(c, xuanX + 33, 202); luggage(c, fanX + 33, 202); sack(c, walkHome ? maX - 8 : fanX - 8, 181, false);
}
