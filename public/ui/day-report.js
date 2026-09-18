const NAMES = { xuan: '轩哥', fan: '凡哥', ma: '马哥' };
const STATS = { health: '健康', food: '饱腹', energy: '体力', coffeeCredit: '咖啡余力', mind: '精神', hygiene: '卫生', warmth: '保暖', fishingSkill: '钓鱼熟练度' };
const LIVES = { active: '正常', downed: '倒下', dead: '离世', unrecruited: '未加入' };
const WISH_STATUS = { fulfilled: '已满足', deferred: '已延期', declined: '已婉拒', active: '仍想要' };
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const number = (value) => Number.isFinite(value) ? value : 0;

export function renderDayReport(report) {
  if (!report || !Number.isInteger(report.day) || !report.actors || !Array.isArray(report.activities)) return '';
  const activityByActor = (id) => report.activities.filter((a) => a.participants?.includes(id));
  const wishByActor = (id) => report.wishes?.items?.filter((w) => w.actorId === id) || [];
  const cards = Object.entries(NAMES).map(([id, name]) => {
    const actor = report.actors[id];
    if (!actor) return '';
    const grouped = new Map();
    for (const action of activityByActor(id)) {
      const key = `${action.label}\0${action.participants.join(',')}\0${action.income}`;
      const existing = grouped.get(key);
      if (existing) { existing.count++; existing.income += number(action.income); }
      else grouped.set(key, { ...action, count: 1, income: number(action.income) });
    }
    const activityList = [...grouped.values()].map((a) => `<li>${esc(name)}${a.controlledActorId === id ? '参与合作' : '自动'}${esc(a.label)}${a.count > 1 ? `×${a.count}` : ''}${a.participants.length > 1 ? `（与${a.participants.filter((p) => p !== id).map((p) => esc(NAMES[p] || p)).join('、')}合作，团队收入${a.income}元，仅计一次）` : `，收入${a.income}元`}</li>`).join('');
    const stats = Object.entries(STATS).map(([key, title]) => {
      const value = actor.stats?.[key]; if (!value) return '';
      const delta = number(value.delta); const tone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
      return `<li class="day-report-${tone}">${title} ${number(value.start)}→${number(value.end)}（${delta > 0 ? '+' : ''}${delta}）</li>`;
    }).join('');
    const wishes = wishByActor(id).map((w) => `<li>${esc(w.name)}：${Object.hasOwn(WISH_STATUS, w.status) ? WISH_STATUS[w.status] : '仍想要'}${w.reason ? ` · ${esc(w.reason)}` : ''}</li>`).join('');
    return `<details class="day-report-actor"><summary>${esc(name)} · 自动独立收入${number(actor.autoSoloIncome)}元 · ${LIVES[actor.life?.end] || '状态未知'}</summary><div><strong>自动完成</strong><ul>${activityList || '<li>今天没有自动完成的记录</li>'}</ul><strong>全天指标变化</strong><ul>${stats}</ul><strong>愿望</strong><ul>${wishes || '<li>没有已说出口的愿望</li>'}</ul></div></details>`;
  }).join('');
  return `<section class="day-report" aria-label="第${report.day}天人物日报"><h3>第${report.day}天 · 人物日报</h3>${report.partial ? '<p>从恢复进度后开始记录，前半天不在本报内。</p>' : ''}<p>自动完成及参与的收入：${number(report.totalAutoIncome)}元；全天现金 ${number(report.startCash)}→${number(report.endCash)}（${number(report.cashDelta) >= 0 ? '+' : ''}${number(report.cashDelta)}元）。</p>${number(report.controlledBonusIncome) > 0 ? `<p>主控小游戏奖金 +${number(report.controlledBonusIncome)}元</p>` : ''}<p>指标变化覆盖全天吃饭、休息和环境影响，并非自动劳动的单独功效。</p>${cards}${report.wishes?.hiddenCount ? '<p>还有未说出口的念头。</p>' : ''}</section>`;
}
