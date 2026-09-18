// 引擎冒烟：默认排程跑 N 天，遇到相遇/晨间节点自动处理，打印每日摘要。
import { loadData } from '../public/game/data.js';
import { fresh, meet, morningChoice, alive, IDS, NAMES } from '../public/game/engine.js';
import { settle } from '../public/game/settle.js';

const days = Number(process.argv[2] || 10);
await loadData();
let s = fresh(Number(process.argv[3] || 260916));
let guard = 0;
while (s.day <= days && !['ending', 'gameover'].includes(s.phase) && guard++ < 2000) {
  if (s.phase === 'meeting') { s = meet(s, 0).state; continue; }
  if (s.pendingMorning) { const c = s.pendingMorning.choices.find((x) => !x.requires || !x.requires(s)); s = morningChoice(s, c.id).state; continue; }
  const r = settle(s);
  if (r.error) {
    // 预检失败：把出错的人本格改成休息再试
    const at = r.at;
    if (!at) { console.log('ERR', r.error); break; }
    const { assign } = await import('../public/game/engine.js');
    const a = assign(s, at.actorId, at.slot, s.actors[at.actorId].life === 'downed' ? 'aid' : 'rest');
    if (a.error) { console.log('ERR2', r.error, a.error); break; }
    s = a.state; continue;
  }
  s = r.state;
  if (s.ledger.start + s.ledger.income - s.ledger.expense !== s.cash) { console.log('LEDGER MISMATCH at turn', s.turn, s.ledger, s.cash); break; }
  if (r.night) console.log(`D${r.night.day} 现金${s.cash} 食物${s.effectiveFood} 存活${alive(s).length} ` + IDS.map((id) => { const p = s.actors[id]; return `${NAMES[id]}:${p.life[0]} H${p.health} F${p.food} E${p.energy} M${p.mind} W${p.warmth} C${p.hygiene}${p.diseases.length ? ' 病' + p.diseases.map((d) => d.kind + d.severity).join('/') : ''}`; }).join(' | ') + ` 愿望${s.wishes.filter((w) => w.status === 'active').length} 事件${s.events.filter((e) => e.status === 'open').length}`);
}
console.log('phase', s.phase, 'turn', s.turn, 'day', s.day);
if (s.ending) console.log(s.ending);
