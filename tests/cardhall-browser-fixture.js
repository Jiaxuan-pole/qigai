import { loadData } from '../public/game/data.js';
import { fresh, startCasino } from '../public/game/engine.js';
import { inviteCasino } from '../public/game/casino-contract.js';
import { validateSave } from '../public/game/save.js';
import { makeItem } from '../public/game/items.js';

const kind = process.argv[2];
if (!['hall-zjh', 'hall-texas', 'hall-blackjack', 'hall-custom-invited', 'hall-custom-playing', 'night-blackjack'].includes(kind)) throw new Error('unknown fixture');
await loadData();
let state = fresh(260917);
state.pendingMorning = null;
state.day = 7;
state.hour = kind.startsWith('hall-') ? 15 : 21;
state.hourTick = (state.day - 1) * 16 + state.hour - 6;
state.slot = kind.startsWith('hall-') ? 2 : 3;
state.turn = (state.day - 1) * 4 + state.slot;
state.metMa = true;
state.actors.ma.life = 'active';
state.actors.ma.location = 'camp';
makeItem(state, 'cards', 'camp');
if (kind.startsWith('hall-')) {
  state.actors.xuan.location = 'cardhall';
  state.actors.fan.location = 'cardhall';
}
if (kind.startsWith('hall-custom-')) {
  state.cash += 28;
  state.ledger.income += 28;
  state = inviteCasino(state, 'xuan').state;
  if (kind === 'hall-custom-playing') {
    const started = startCasino(state, 'texas', { buyIn: 25, baseBet: 3 });
    if (started.error || started.state.pending.casino?.phase !== 'playing') throw new Error(started.error || 'custom table did not start');
    state = started.state;
  }
}
const result = validateSave(state);
if (!result.ok) throw new Error(result.reason);
process.stdout.write(JSON.stringify(state));
