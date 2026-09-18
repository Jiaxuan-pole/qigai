// 回退台词与晨间对白：断网、超时、校验失败时用这些；程序按场景挑选，不看条件乱塞。
import { rng, pick } from './rng.js';
import { activeWishes, templateOf } from './wishes.js';

const LINES = {
  xuan: {
    lowMind: ['今天这个至少修好了。别问人生，人生没带日志。', '我把自己 git stash 了，等有空再 pop。', '别管我，我在跑一个很长的循环。'],
    normal: ['云原生。抬头全是云。', '这键盘的空格键比我们还没着落。', '先把要留的药钱划出来。墙不会跑。', '今天没崩，算 uptime 一天。'],
    hungry: ['我肚子在报错。', '先吃饭，饭是第一依赖。'],
    tired: ['我这条线程需要 sleep。', '今天别派我复杂活，我脑子在降频。'],
  },
  fan: {
    lowMind: ['先画这张纸吧。墙那么大，一天也画不完。', '光不对。今天光不对。', '镜头还在，我只是不太想举起来。'],
    normal: ['那面墙还差点蓝。', '你看那个人的手，那才是主角。', '衣服什么时候干？我想换一件再出门。', '这条街的颜色比昨天暖一点。'],
    hungry: ['先吃，构图饿着看不准。', '饭呢。别拍了，先吃。'],
    tired: ['今天先不举相机。', '让我坐一会儿。'],
  },
  ma: {
    lowMind: ['我运气不好，命还行。', '今天不碰牌，我知道。', '袋子又坏了。算了。'],
    normal: ['不带钱也能打。输赢又不是非得交学费。', '店里有？我跑一趟。', '我也不是非得每天碰运气。', '站口那边今天缺人，我去问问。'],
    hungry: ['我先吃，吃完能跑三趟。', '饭钱别动，我去挣。'],
    tired: ['腿今天不太听话。', '让我歇一格。'],
  },
};

const NPC_LINES = {
  refusal: ['抱歉，我这会儿赶时间。那边摊子在找人，你可以问问。', '今天没带零钱。', '别在这儿站着，去服务站问问。'],
  gift: ['这份还没动过。你先拿着，别在这儿一直站。', '拿着吧，不用还。', '天冷，趁热吃。'],
  cash: ['就这些，别嫌少。', '拿去买个热的。', '下次别再问我了啊。'],
  tip: ['那边今天缺人手，你去说是我让你去的。', '站口西边今天在招搬货的。'],
};

const NIGHT_LINES = {
  quiet: ['今天没什么新事。有人把明天要用的东西往门边挪了挪。', '桥下风小了。有人已经睡着。'],
  downed: ['先把人带回来。', '现在别说别的，先看他。'],
  grief: ['东西还在那儿。今天不想整理，就先别动。', '那个位置空着。没人坐过去。'],
  wish: ['你上次说想看，后来没看。', '明天能做到吗？做不到就直说。'],
};

export function morningLine(state, actorId) {
  const p = state.actors[actorId];
  if (p.life !== 'active') return null;
  const key = `line:${state.day}:${actorId}`;
  const set = LINES[actorId];
  let pool = set.normal;
  if (p.food <= 25) pool = set.hungry;
  else if (p.energy <= 25) pool = set.tired;
  else if (p.mind < 25) pool = set.lowMind;
  const wish = activeWishes(state, actorId).filter((w) => w.revealed).sort((a, b) => b.intensity - a.intensity)[0];
  if (wish && wish.intensity >= 25 && rng(state.seed, key + ':w') < 0.5) return templateOf(wish).indirectLine;
  return pick(rng(state.seed, key), pool);
}

export function npcLine(state, kind, key) {
  return pick(rng(state.seed, 'npc:' + key), NPC_LINES[kind] || NPC_LINES.refusal);
}

export function nightLine(state) {
  const anyDowned = Object.values(state.actors).some((p) => p.life === 'downed');
  const grief = Object.values(state.actors).some((p) => p.grief > 0);
  const expired = state.wishes.some((w) => w.status === 'active' && w.promise?.expiredNoted);
  const pool = anyDowned ? NIGHT_LINES.downed : grief ? NIGHT_LINES.grief : expired ? NIGHT_LINES.wish : NIGHT_LINES.quiet;
  return pick(rng(state.seed, 'night:' + state.day), pool);
}

// 长谈的回退对白：两个人，主题按当前最重的愿望。
export function talkLines(state, a, b) {
  const names = state.names;
  const wa = activeWishes(state, a).filter((w) => w.revealed).sort((x, y) => y.intensity - x.intensity)[0];
  const wb = activeWishes(state, b).filter((w) => w.revealed).sort((x, y) => y.intensity - x.intensity)[0];
  const lines = [];
  if (wa) lines.push({ speakerId: a, text: templateOf(wa).indirectLine });
  else lines.push({ speakerId: a, text: pick(rng(state.seed, `talk:${state.turn}:${a}`), LINES[a].normal) });
  lines.push({ speakerId: b, text: wb ? templateOf(wb).indirectLine : pick(rng(state.seed, `talk:${state.turn}:${b}`), LINES[b].normal) });
  lines.push({ speakerId: a, text: ['说吧，今天有时间。', '我听着。', '要紧的我顶一格，你缓一缓。'][Math.floor(rng(state.seed, `talk3:${state.turn}`) * 3)] });
  lines.push({ speakerId: b, text: ['那先这样。', '行。明天再说。', '嗯，说出来好一点。'][Math.floor(rng(state.seed, `talk4:${state.turn}`) * 3)] });
  return lines.map((l) => ({ ...l, name: names[l.speakerId] }));
}
