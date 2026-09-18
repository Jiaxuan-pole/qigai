// 营地放映：修好的电视留在营地，晚上烧一单位燃料给大家放一部剪好的短片。首映效果最大，之后隔几天可重播。
import { rng } from './rng.js';
import { clamp } from './rules.js';
import { REGULARS, relation } from './npcs.js';
import { fulfillWish } from './wishes.js';
import { burnFuel, fuelCount } from './camp.js';

// 全队两次放映至少隔 5 天（营地与许姐场地共用），否则多部短片轮播就能天天回血。
export const RERUN_GAP_DAYS = 5;
export const GAINS = { premiere: { fan: 8, other: 4 }, rerun: { fan: 3, other: 2 } };

// 片名按素材来历取：有采访就是人物片，有商户花絮就是市场片，否则是街头片。
export function filmName(film) {
  const src = film.sources.join('');
  const base = src.includes('旧影院的采访') ? '旧影院的人' : src.includes('商户宣传的花絮') ? '市场口的两分钟' : '街头';
  return `《${base}》${film.no > 1 ? `（第${film.no}部）` : ''}`;
}

export function recordFilm(state, day, clips) {
  state.films = state.films || [];
  const film = { no: state.films.length + 1, day, sources: clips.map((c) => 'D' + c.day + c.source), screened: 0, lastDay: 0 };
  state.films.push(film);
  return film;
}

// 留用的电视可能还在背包里，没搬进营地箱；只要是队里留下的就算。
export function hasCampTv(state) {
  return state.items.some((x) => x.itemId === 'tv' && (x.container === 'camp' || x.kept));
}

export function canScreen(state, day) {
  return day - (state.flags.lastScreeningDay ?? -RERUN_GAP_DAYS) >= RERUN_GAP_DAYS;
}

// 先放没放过的；都放过就挑最久没放的。间隔由 canScreen 统一管。
export function pickFilm(state) {
  const films = state.films || [];
  return films.find((f) => !f.screened) || [...films].sort((a, b) => a.lastDay - b.lastDay)[0] || null;
}

const GUEST_LINES = {
  reg_chen: '“这不是站口那家？镜头晃得我头晕。”',
  reg_liu: '“放这么晚，明天早市还起不起得来？”嘴上这么说，人没走。',
  reg_zhao: '“那面墙我也拍过，没你这个角度。”',
  reg_wang: '“片尾该写个名字。”',
  reg_lu: '“电视是我给的，片子是你们的，算扯平。”',
  reg_xu: '“第二段剪短点，其他别动。”',
};
const WATCH_LINES = {
  xuan: ['“画面比我电脑上顺。”', '“这段声音是我修的那台收音机录的？”', '“别说，坐在这儿看跟在网吧看不一样。”'],
  ma: ['“我认得那个人，欠我三块钱。”', '“再放一遍，刚才那段我没看清。”', '“这地方拍出来还挺像样。”'],
  fan: ['“……就先这样吧。”', '“看过的可以不看。”', '“第三段本来还有半分钟。”'],
};

// 放一部：营地或许姐场地共用这一条。首映才回应「有人看完」愿望、才给客人信任；重播只留场面和小幅精神。
export function screenFilm(state, day, audience, venue, events) {
  const film = pickFilm(state);
  const premiere = film.screened === 0;
  film.screened += 1;
  film.lastDay = day;
  const title = filmName(film);
  const gains = premiere ? GAINS.premiere : GAINS.rerun;
  for (const id of audience) state.actors[id].mind = clamp(state.actors[id].mind + (id === 'fan' ? gains.fan : gains.other));
  const cands = venue === 'studio' ? REGULARS.filter((r) => r.id === 'reg_xu') : REGULARS.filter((r) => (state.relations[r.id]?.trust || 0) >= 2);
  const guest = cands.length ? cands[Math.floor(rng(state.seed, 'screen:' + day) * cands.length)] : null;
  if (guest && premiere) relation(state, guest.id).trust = clamp(relation(state, guest.id).trust + 1, 0, 5);
  if (premiere && audience.includes('fan')) fulfillWish(state, 'fan', 'fan_seen', 'exact', events);
  state.flags.screenings = (state.flags.screenings || 0) + 1;
  state.flags.lastScreeningDay = day;
  const r = rng(state.seed, 'screenline:' + day);
  const lines = [];
  const talker = audience.find((id) => id !== 'fan');
  if (talker) lines.push({ speakerId: talker, text: WATCH_LINES[talker][Math.floor(r * 3)] });
  if (guest) lines.push({ name: guest.name, text: GUEST_LINES[guest.id] });
  if (audience.includes('fan')) lines.push({ speakerId: 'fan', text: WATCH_LINES.fan[premiere ? 0 : 1 + Math.floor(r * 2)] });
  const names = audience.map((id) => state.names[id]).join('、') + (guest ? '和' + guest.name : '');
  const scr = { title, no: film.no, sources: film.sources, premiere, venue, audience: [...audience], guest: guest ? { id: guest.id, name: guest.name } : null, gains, lines: lines.map((l) => ({ ...l, name: l.name || state.names[l.speakerId] })) };
  state.lastScreening = { day, title, guest: scr.guest, venue };
  events.push(`${venue === 'studio' ? '许姐工作间' : '营地'}放映${title}${premiere ? '首映' : '重播'}：${names}看完了。凡哥精神+${gains.fan}${audience.length > 1 ? '、其他人+' + gains.other : ''}${guest && premiere ? '，' + guest.name + '信任+1' : ''}${venue === 'camp' ? '，烧了1单位燃料' : ''}。`);
  return scr;
}

// 营地夜场：电视在、没暴雨、间隔够、有短片、篝火之外还剩一单位燃料。
export function nightScreening(state, day, wx, audience, events) {
  if (!audience.length || !hasCampTv(state)) return null;
  if (wx.kind === 'storm' || !canScreen(state, day) || !pickFilm(state)) return null;
  if (fuelCount(state) < 1) { events.push('电视在，短片也在，可没燃料没人愿意坐在冷地上看。'); return null; }
  burnFuel(state, 1);
  return screenFilm(state, day, audience, 'camp', events);
}
