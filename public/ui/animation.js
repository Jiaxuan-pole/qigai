const POSES = {
  bins: 'work', scavenge: 'work', beg: 'beg', phonestall: 'stall', shellgame: 'stall',
  repair: 'repair', repair_item: 'repair', sketch: 'sketch', graffiti: 'paint',
  wash: 'wash', bath: 'wash', laundry: 'wash', rest: 'rest', sleep: 'rest', warm: 'rest',
  kitchen: 'carry', carry: 'carry', oddjob: 'carry', run: 'carry', freecards: 'sit', cook: 'cook',
  phone: 'phone', smoke: 'smoke',
  fish: 'fish', talk: 'talk', dialogue: 'talk',
};

export function actionPoseFor(id) { return POSES[id] || 'stand'; }
export function itemPoseFor(id) {
  if (['cigarette', 'cigarette_regular', 'cigarette_premium', 'butts'].includes(id)) return 'smoke';
  if (['beer', 'spirit', 'beer_bottle', 'baijiu', 'vodka'].includes(id)) return 'drink';
  if (['tea', 'coffee', 'espresso', 'americano', 'latte', 'cappuccino', 'mocha', 'cold_brew', 'soda', 'hot_soup', 'hot_soup_heated'].includes(id)) return 'sip';
  if (['meal', 'bread', 'fish_common_cooked', 'fish_rare_cooked', 'meal_hot', 'bread_toasted'].includes(id)) return 'eat';
  return { paint: 'paint', phone: 'phone', sketchbook: 'sketch' }[id] || null;
}
export function settledActionPoses(state, executed) {
  return Object.fromEntries(Object.entries(executed).filter(([id, task]) => state.actors[id]?.life === 'active' && task).map(([id, task]) => [id, task.id === 'beg' && task.style === 'perform' ? 'sketch' : actionPoseFor(task.id || task)]));
}
export function sceneTick(now, reduced = false) { return reduced ? 0 : Math.floor(now / (1000 / 60)); }
export function changedTurn(before, after) { return Boolean(before && after && (before.seed !== after.seed || before.turn !== after.turn || before.hourTick !== after.hourTick)); }
export function actionFrame(pose, now, reduced = false) {
  if (pose === 'stand' || pose === 'sit') return pose;
  if (['smoke', 'drink', 'sip', 'paint'].includes(pose)) {
    const phase = now % 2400;
    return `${pose}${reduced || phase < 550 ? 0 : phase < 1450 ? 1 : 2}`;
  }
  if (pose === 'fish') {
    if (reduced) return 'fish0';
    const phase = now % 2600;
    return phase < 2000 ? 'fish0' : phase < 2300 ? 'fish1' : 'fish2';
  }
  return `${pose}${reduced ? 0 : Math.floor(now / 280) % 2}`;
}
export function walkFrame(now, reduced = false) { return reduced ? 'stand' : `walk${Math.floor(now / 110) % 4}`; }
export function easedProgress(now, start, duration) {
  const t = Math.max(0, Math.min(1, (now - start) / duration));
  return t * t * (3 - 2 * t);
}
