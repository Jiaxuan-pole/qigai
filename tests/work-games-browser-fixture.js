import { loadData } from '../public/game/data.js';
import { ready, plan } from './engine-fixtures.js';
import { startWorkGame } from '../public/game/work-games.js';
import { acceptedVariantsA } from '../public/game/work-games-families-a.js';
import { acceptedVariantsB } from '../public/game/work-games-families-b.js';
import { validateSave } from '../public/game/save.js';

const kind = process.argv[2];
const variants = { sorting: 'scavenge', memory: 'kitchen', circuit: 'repair', audit: 'table', camera: 'shoot', sequence: 'edit', route: 'run', balance: 'carry', relay: 'coop', cups: 'shellgame' };
if (kind !== 'mixed' && !Object.hasOwn(variants, kind)) throw new Error('Use mixed or one of: ' + Object.keys(variants).join(', '));
await loadData();
let state = ready(9301, { turn: 16, ma: true });
for (const actor of Object.values(state.actors)) { actor.energy = 100; actor.health = 100; actor.food = 100; actor.warmth = 100; actor.mind = 100; }
state.parts = 10; state.battery = 10;
if (kind === 'mixed') {
  state = plan(state, 'xuan', 'repair');
  state = plan(state, 'fan', 'shoot');
  state = plan(state, 'ma', 'run');
} else {
  const variant = variants[kind];
  const meta = acceptedVariantsA[variant] || acceptedVariantsB[variant];
  const opened = startWorkGame(state, { actorId: 'xuan', controllerId: 'xuan', source: meta.jobId ? 'job' : 'sale', sourceUid: `browser-${variant}`, basePay: 30, variant });
  if (opened.error) throw new Error(opened.error);
  state = opened.state;
}
const check = validateSave(state);
if (!check.ok) throw new Error(check.reason);
process.stdout.write(JSON.stringify(state));
