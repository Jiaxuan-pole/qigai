// 生成 QA 用的中途状态：D6 牌局日、有病人的状态、D100 末夜。用默认排程 + 每天买够饭的简单策略。
import { writeFileSync } from 'node:fs';
import { loadData } from '../public/game/data.js';
import { fresh, meet, morningChoice, assign, buyNow, alive, IDS } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';
import { addDisease } from '../public/game/health.js';
import { makeItem } from '../public/game/items.js';

await loadData();
const out = process.argv[2] || '/tmp';
function runTo(seed, day, slot) {
  let s = fresh(seed);
  let guard = 0;
  while ((s.day < day || (s.day === day && s.slot < slot)) && !['ending', 'gameover'].includes(s.phase) && guard++ < 3000) {
    if (s.phase === 'meeting') { s = meet(s, 0).state; continue; }
    if (s.pendingMorning) { const c = s.pendingMorning.choices.find((x) => !x.requires || !x.requires(s)); s = morningChoice(s, c.id).state; continue; }
    // 清晨让轩哥去便利店买饭；其余默认
    if (s.slot === 0 && s.actors.xuan.life === 'active') { const need = Math.max(0, alive(s).length * 2 - s.effectiveFood + 1); const a = assign(s, 'xuan', 0, 'shop', { zone: 'market', cart: need > 0 && s.cash >= need * 8 ? [{ shopId: 'convenience', itemId: 'meal', qty: Math.min(6, need) }] : [], destination: 'camp' }); if (!a.error) s = a.state; }
    for (const id of IDS) { const p = s.actors[id]; if (p.life === 'active' && p.mind < 35 && s.slot >= 1) { const a = assign(s, id, s.slot, id === 'xuan' ? 'joke' : id === 'fan' ? 'sketch' : 'freecards'); if (!a.error) s = a.state; } }
    const r = settle(s);
    if (r.error) { const at = r.at; if (!at) { console.log('ERR', r.error); break; } const a = assign(s, at.actorId, at.slot, s.actors[at.actorId].life === 'downed' ? 'aid' : 'rest'); if (a.error) { console.log('ERR2', r.error, a.error); break; } s = a.state; continue; }
    s = r.state;
  }
  return s;
}
const d6 = runTo(2024, 6, 1);
writeFileSync(out + '/state-d6.json', JSON.stringify(d6));
console.log('d6', d6.day, d6.slot, d6.phase, 'events', d6.events.filter((e) => e.status === 'open').map((e) => e.templateId));
const sick = runTo(2024, 12, 0);
if (sick.pendingMorning) { const c = sick.pendingMorning.choices[0]; Object.assign(sick, morningChoice(sick, c.id).state); }
const ev = [];
addDisease(sick, 'xuan', 'wound', 40, '测试伤口', ev);
sick.actors.xuan.exposure.wound = true;
makeItem(sick, 'bandage', 'xuan');
makeItem(sick, 'care_course', 'camp');
writeFileSync(out + '/state-sick.json', JSON.stringify(sick));
console.log('sick', sick.day, sick.actors.xuan.diseases);
const d100 = runTo(2024, 100, 3);
writeFileSync(out + '/state-d100.json', JSON.stringify(d100));
console.log('d100', d100.day, d100.slot, d100.phase, 'alive', alive(d100).length, 'cash', d100.cash);
