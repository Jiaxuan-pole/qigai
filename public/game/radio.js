import { getData } from './data.js';
import { rng, pick } from './rng.js';

const CITY_NEWS = [
  '夜班公交末班车仍会经过站前街，司机提醒乘客别落下行李。',
  '老影院门前换了一张海报，有人停下来读完了片尾的小字。',
  '早市一位摊主找到了失主，落在摊边的围巾已经物归原主。',
  '河岸步道的路灯修好了，晚归的人不用再绕远路。',
  '城市电台收到一封手写来信，点播了一首很老的歌。',
  '小区志愿者在整理旧书，扉页上还留着从前读者的名字。',
  '站口有人替外地旅客画了一张路线图，雨停后墨迹才干。',
  '桥边的早餐铺提前亮了灯，第一锅热气已经升起来了。',
];
const JOB_DISTRICTS = ['station', 'market', 'recycle', 'cinema'];
const SLOT_NAMES = ['清晨', '日间', '午后', '晚间'];

export function hasRadio(state) {
  return (state.items ?? []).some((item) => item.itemId === 'radio'
    && (item.container === 'camp' || Object.hasOwn(state.actors ?? {}, item.container)));
}

export function bulletin(state, ctx = {}) {
  const next = Array.isArray(ctx.forecast)
    ? ctx.forecast.find((weather) => weather.day === state.day + 1)
    : ctx.forecast;
  const lines = [{ kind: 'weather', text: next
    ? `明天天气：${next.label ?? next.kind}${next.temp == null ? '' : `，${next.temp}度`}。`
    : '明天天气：暂无新的预报。' }];
  const closed = ctx.closedTomorrow;
  const closing = Array.isArray(closed) ? closed.length > 0 : Boolean(closed);
  const slots = Array.isArray(closed) ? closed.map((slot) => SLOT_NAMES[slot]).filter(Boolean).join('、') : '';
  lines.push({ kind: 'shop', text: closing
    ? `便利店明天${slots || '部分时段'}关门，请提前安排。`
    : '便利店明天照常营业。' });
  if (state.day >= 63 && state.day <= 65) lines.push({ kind: 'warning', text: '提前预告：第71—74天寒潮，请备好燃料与御寒物资。' });
  if (state.day === 16 || state.day === 17) lines.push({ kind: 'warning', text: '天气提醒：第18天强降雨，请检查棚顶并收好怕水的物品。' });

  state.pendingJobTips ??= [];
  if (rng(state.seed, `radio:${state.day}:0`) < 0.3) {
    const district = pick(rng(state.seed, `radio:${state.day}:1`), JOB_DISTRICTS);
    const day = state.day + 1;
    const name = getData().districts.find((entry) => entry.id === district)?.name ?? district;
    lines.push({ kind: 'job', text: `招工线索：明天${name}有人找短工，可以去问问。` });
    // 晚报会被界面重复读取，同一条线索不能因此重复入队。
    if (!state.pendingJobTips.some((tip) => tip.day === day && tip.from === '电台招工信息' && tip.district === district)) {
      state.pendingJobTips.push({ district, day, from: '电台招工信息', npcId: null });
    }
  }
  // 城管预告：第二天那条街的清街热点更容易出现，摆摊的人可以避开。
  // 用独立的 kind，不占“warning”：警告栏只留给剧情固定的暴雨与寒潮预告；播报最多四条。
  if (state.day >= 7 && lines.length < 4 && rng(state.seed, `radio:${state.day}:3`) < 0.25) {
    const district = pick(rng(state.seed, `radio:${state.day}:4`), ['market', 'station', 'cinema']);
    const name = getData().districts.find((entry) => entry.id === district)?.name ?? district;
    state.flags = state.flags || {};
    state.flags.sweepTomorrow = { district, day: state.day + 1 };
    lines.push({ kind: 'sweep', text: `听说明天${name}查得严，摆摊乞讨的先别去。` });
  }
  if (lines.length < 4) lines.push({ kind: 'flavor', text: pick(rng(state.seed, `radio:${state.day}:2`), CITY_NEWS) });
  return lines;
}
