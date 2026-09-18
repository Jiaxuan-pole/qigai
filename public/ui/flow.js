// 回合流程弹层：相遇、晨间节点、回合结果、夜结算、夜话（AI 或模板）、结局。
import { $, esc, UI, toast, showModal, closeModal, apply } from './core.js';
import { NAMES, IDS, alive, active, meet, morningChoice, activeWishes } from '../game/engine.js';
import { templateOf, wishSummary } from '../game/wishes.js';
import { talkLines, nightLine } from '../game/text.js';
import { chapterOf, weatherOf } from '../game/story.js';
import { requestDialogue } from './ai.js';
import { zoneName } from './render.js';
import { bridgeScene, screeningScene, bigPortrait, moodOf } from './pixel.js';
import { modalOpen } from './core.js';
import { renderDayReport } from './day-report.js';
import { playMeetingIntro } from './meeting-intro.js';

let meetingPlaying = false;
let meetingShown = null;

export function showMeeting() {
  if (meetingPlaying) return;
  if (!['xuan', 'fan'].every((id) => UI.state.actors[id].life === 'active')) { showMeetingChoices(); return; }
  const key = UI.state.seed + ':' + UI.state.turn;
  if (meetingShown === key) { showMeetingChoices(); return; }
  meetingPlaying = true;
  playMeetingIntro(() => {
    meetingPlaying = false;
    if (UI.state.seed + ':' + UI.state.turn !== key || UI.state.phase !== 'meeting') return;
    meetingShown = key;
    showMeetingChoices();
  });
}

function showMeetingChoices() {
  const together = ['xuan', 'fan'].every((id) => UI.state.actors[id].life === 'active');
  const body = together
    ? '<p>三个人沿着河堤往回走。马哥接过最沉的袋子，谁也没再提刚才的眼泪。</p><div class="dialogue"><b>轩哥</b>床只有两张。<br><b>马哥</b>我睡边上就行。<br><b>凡哥</b>先别分了。回去，把饭热一热。<br><b>马哥</b>……行。那副牌还在，没当掉。<br><b>轩哥</b>你是真能留东西。<br><b>凡哥</b>人留住就行。</div>'
    : '<p>营地附近的垃圾桶旁，马哥抬起了头。听完这些天的事，他半天没有说话，最后把袋子放在了桥柱边。</p><div class="dialogue"><b>马哥</b>我留下。能搭把手的地方，咱们慢慢来。<br><b>马哥</b>那副牌也还在。等缓过劲，再坐一起。</div>';
  showModal('今晚，多一个人', `${body}<div class="meeting-options">${['先回去，饭钱放一起。', '今晚先挤挤，明天再想办法。', '你负责扛袋子，别再失联了。'].map((t, i) => `<button data-meet="${i}">${t}</button>`).join('')}</div>`, { lock: true });
  $('modalContent').querySelectorAll('[data-meet]').forEach((b) => { b.onclick = () => { if (apply(meet(UI.state, Number(b.dataset.meet)))) { closeModal(true); UI.sel.actor = 'ma'; UI.sel.hour = UI.state.hour; UI.render(); toast('马哥回来了。行李放下，先一起把今天过完。'); } }; });
}

export function showMorning() {
  const s = UI.state;
  const node = s.pendingMorning;
  if (!node) return;
  const ch = chapterOf(s.day);
  const isChapterStart = UI.data.chapters.some((c) => c.startDay === s.day);
  const tag = isChapterStart ? `第${ch.number}章 · ${ch.title}` : `D${s.day} / 100`;
  const body = `<p>${esc(node.text)}</p><div class="meeting-options">${node.choices.map((c) => { const err = c.requires ? c.requires(s) : null; return `<button data-mc="${c.id}" ${err ? 'disabled' : ''}>${esc(c.label)}${err ? '（' + esc(err) + '）' : ''}</button>`; }).join('')}</div>`;
  showModal(node.title, body, { lock: true, tag });
  $('modalContent').querySelectorAll('[data-mc]').forEach((b) => { b.onclick = () => { if (apply(morningChoice(UI.state, b.dataset.mc))) { closeModal(true); UI.render(); } }; });
}

const NOTABLE = /濒死|死亡|已获救|返还|得到|买了|翻了|求助|举着纸板|画速写|开口|领到|愿望|崩溃|伤害|感染|缓解|热点|确诊|捡了|卖给|过夜|被赶|没有处理|洗漱|洗了|整理|评估|完成了一次护理|缺一份饭|小倒霉|收音机|篝火|燃料|保温桶|钓鱼|熟练度|修好了|施工|委托|宣传片|借来|还了|拦下了|翻了|放映|短片/;

export function showResults(events, turnLabel) {
  const notable = events.filter((e) => NOTABLE.test(e));
  if (!notable.length) return false;
  const cls = (e) => (/濒死|死亡|伤害|崩溃|感染|缺一份饭|被赶/.test(e) ? 'bad' : /获救|返还|得到|买了|领到|缓解|卖给|捡了/.test(e) ? 'good' : '');
  showModal(turnLabel, `<div class="result-list">${notable.map((e) => `<div class="${cls(e)}">${esc(e)}</div>`).join('')}</div><div class="modalbuttons"><button class="primary" id="resultsOk">回到排程</button></div>`, { tag: 'TURN RESULT' });
  $('resultsOk').onclick = () => closeModal();
  return true;
}

function animateScene(canvas, draw) {
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const start = performance.now();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, stopped = false;
  const stop = () => { stopped = true; cancelAnimationFrame(raf); observer.disconnect(); media.removeEventListener('change', restart); };
  const frame = (now) => {
    if (stopped) return;
    if (!canvas.isConnected || !modalOpen()) { stop(); return; }
    draw(c, media.matches ? 0 : Math.floor((now - start) / (1000 / 60)));
    if (!media.matches) raf = requestAnimationFrame(frame);
  };
  const restart = () => { cancelAnimationFrame(raf); frame(performance.now()); };
  const observer = new MutationObserver(() => { if (!canvas.isConnected || !modalOpen()) stop(); });
  observer.observe($('modalOverlay'), { attributes: true, childList: true, subtree: true });
  media.addEventListener('change', restart);
  frame(start);
  return stop;
}

export function showNight(n, events) {
  const s = UI.state;
  const dayReport = s.lastDayReport?.day === n.day ? renderDayReport(s.lastDayReport) : '';
  const scene = n.spot === 'camp' ? '<div class="intro-stage" style="width:100%;margin:0 auto 10px"><canvas id="nightCanvas" tabindex="-1" width="480" height="270" aria-label="桥下营地夜景" style="width:100%;height:100%;display:block;image-rendering:pixelated"></canvas></div>' : '';
  const notable = events.filter((e) => NOTABLE.test(e) || /没有干燥床位|过期|第\d+天/.test(e));
  showModal('第' + n.day + '天 · 今晚的账', `${scene}<div class="summaryrow"><span>开始余额</span><b>${n.start}</b></div><div class="summaryrow"><span>工作与返还合计</span><b>+${n.income}</b></div><div class="summaryrow"><span>各项支出</span><b>-${n.expense}</b></div><div class="summaryrow"><span>结余</span><b>${n.end}</b></div><div class="modal-grid"><div class="invitem"><strong>${n.food}</strong><span>有效食物 / 需${n.survivors * 2}</span></div><div class="invitem"><strong>${n.spot === 'shelter' ? '服务站' : n.spot === 'station' ? '候车室' : n.beds + '/' + n.survivors}</strong><span>${n.spot === 'camp' ? '干燥床位 / 存活' : '今晚过夜'}</span></div><div class="invitem"><strong>${s.art}</strong><span>留下的涂鸦</span></div></div><div class="notebox">${notable.map(esc).join('<br>') || '正常休整已结算。'}${n.food < n.survivors * 2 ? '<br>余粮不足，请为明天留出吃饭的安排。' : ''}</div>${dayReport}<p class="small">每天只在确认推进时结算；离线不会继续消耗生命。</p><div class="modalbuttons"><button class="primary" id="nightOk">${s.phase === 'tail' ? '进入救援尾声' : s.phase === 'ending' || s.phase === 'gameover' ? '看结局' : '安排明天'}</button></div>`, { tag: 'NIGHT', focus: scene ? '#nightCanvas' : undefined });
  $('modal').scrollTop = 0;
  const weather = weatherOf(s.seed, n.day).kind;
  const stop = scene ? animateScene($('nightCanvas'), (c, tick) => bridgeScene(c, {
    night: true, fire: events.some((event) => event.startsWith('篝火烧了')), dawn: 0.2, who: active(s), tick, camp: s.camp.rain, beds: s.camp.beds, art: s.art,
    rain: ['rain', 'storm'].includes(weather), snow: weather === 'coldwave',
  })) : () => {};
  $('nightOk').onclick = () => { stop(); closeModal(); };
}

// 营地放映场面：像素电视前坐一排人，片名、来历、观众反应；数值已在结算里生效，这里只展示。
export function showScreening(scr) {
  const s = UI.state;
  const names = scr.audience.map((id) => NAMES[id]).join('、') + (scr.guest ? '、' + scr.guest.name + '（客人）' : '');
  showModal('营地放映 · ' + scr.title, `<div class="intro-stage" style="width:100%;margin:0 auto 10px"><canvas id="screenCanvas" tabindex="-1" aria-label="营地短片放映" width="480" height="270" style="width:100%;height:100%;display:block;image-rendering:pixelated"></canvas></div><p class="small">${scr.premiere ? '首映' : '重播'} · 素材：${esc(scr.sources.join('、'))} · 观众：${esc(names)}</p><div class="dialogue">${scr.lines.map((l) => `<b>${esc(l.name)}</b>${esc(l.text)}<br>`).join('')}</div><div class="notebox">凡哥精神+${esc(scr.gains.fan)}，其他人+${esc(scr.gains.other)}${scr.guest ? '；' + esc(scr.guest.name) + '信任+1' : ''}；烧了1单位燃料。${scr.premiere ? '凡哥的「有人看完」愿望达成。' : '重播的效果减半，隔五天才会再放。'}</div><div class="modalbuttons"><button class="primary" id="screenOk">看完了</button></div>`, { tag: 'CAMP SCREENING', wide: true, focus: '#screenCanvas' });
  $('modal').scrollTop = 0;
  const weather = weatherOf(s.seed, scr.day ?? Math.max(1, s.day - 1)).kind;
  const stop = animateScene($('screenCanvas'), (c, tick) => screeningScene(c, { who: scr.audience, guest: Boolean(scr.guest), tick, camp: s.camp.rain, beds: s.camp.beds, art: s.art, rain: ['rain', 'storm'].includes(weather) }));
  $('screenOk').onclick = () => { stop(); closeModal(); };
}

export function showTalk(title, lines, extraHtml = '') {
  // 说话的人在顶上露个头像，表情跟当前状态走。
  const cast = [...new Set(lines.map((l) => l.speakerId).filter((id) => id && NAMES[id]))];
  const heads = cast.length ? `<div class="talk-heads">${cast.map((id) => `<div class="talk-head"><canvas data-head="${id}" width="48" height="56" aria-hidden="true"></canvas><span>${esc(NAMES[id])}</span></div>`).join('')}</div>` : '';
  showModal(title, `${heads}<div class="dialogue">${lines.map((l) => `<b>${esc(NAMES[l.speakerId] || l.name || '')}</b>${esc(l.text)}<br>`).join('')}</div>${extraHtml}<div class="modalbuttons"><button class="primary" id="talkOk">好</button></div>`, { tag: 'NIGHT TALK' });
  const s = UI.state;
  $('modalContent').querySelectorAll('[data-head]').forEach((cv) => bigPortrait(cv, cv.dataset.head, moodOf(s && s.actors[cv.dataset.head])));
  if (lines.length) window.jwsnAudio?.speak?.(lines[0].speakerId || lines[0].name, lines[0].text);
  $('talkOk').onclick = () => closeModal();
}

// 夜话：按 04 约定组装上下文，服务端校验；失败回退模板。
export async function eveningTalk() {
  const s = UI.state;
  const cast = active(s).filter((id) => s.actors[id].location === 'camp' || s.actors[id].location === 'service');
  if (cast.length < 2) return;
  const wishes = cast.flatMap((id) => wishSummary(s, id).slice(0, 1).map((w) => ({ actor: id, w })));
  const facts = [
    `第${UI.night?.day ?? Math.max(1, s.day - 1)}天晚上，${cast.map((id) => NAMES[id]).join('、')}在${zoneName(s.actors[cast[0]].location)}`,
    s.cash < 40 ? '公共现金很紧' : s.cash < 150 ? '公共现金还够几天' : '公共现金比较宽裕',
    s.effectiveFood < alive(s).length * 2 ? '明天的饭还没备够' : '明天的饭已经备好',
    ...(s.lastScreening && s.lastScreening.day === s.day - 1 ? [`刚才在营地放了短片${s.lastScreening.title}${s.lastScreening.guest ? '，' + s.lastScreening.guest.name + '也来看了' : ''}`] : []),
    ...cast.filter((id) => s.actors[id].mind < 30).map((id) => `${NAMES[id]}今天精神很差`),
    ...cast.filter((id) => s.actors[id].diseases.length).map((id) => `${NAMES[id]}身体不舒服`),
    ...wishes.map(({ actor, w }) => `${NAMES[actor]}的愿望「${w.tpl.name}」${w.intensity >= 60 ? '积压很久' : '刚提起'}`),
    ...s.deaths.map((d) => `${NAMES[d.id]}已经不在了`),
  ].slice(0, 10);
  const ctx = {
    requestId: `talk_d${s.day}_${s.stateRevision}`,
    sceneId: 'camp_evening',
    stateRevision: s.stateRevision,
    sceneTone: alive(s).some((id) => s.actors[id].life === 'downed') ? '紧张，先救人' : s.deaths.length && s.actors[cast[0]].grief ? '沉默，有人不在了' : '疲惫但可以商量',
    allowedCast: cast,
    allowedWishIds: wishes.map(({ w }) => w.templateId),
    requiredChoiceIds: ['rest'],
    factsForThisScene: facts,
    wishCues: wishes.map(({ w }) => ({ wishId: w.templateId, stage: w.intensity >= 85 ? '执念' : w.intensity >= 60 ? '积压' : '暗示', substitutes: w.tpl.substitutes })),
    actorKnowledge: Object.fromEntries(cast.map((id) => [id, ['知道共同账目', '知道今天各自做了什么']])),
  };
  if (UI.ai.enabled) toast('营地里有人开口了……（模型生成中，最多十几秒；失败会用本地台词）', 14000);
  const payload = await requestDialogue(ctx);
  if (payload && payload.lines?.length) { showTalk('夜话', payload.lines, '<p class="small muted">由模型生成，已校验只含在场人物台词；不改变任何数值。</p>'); return; }
  const [a, b] = cast;
  showTalk('夜话', talkLines(s, a, b), `<p class="small muted">${esc(nightLine(s))}</p>`);
}

export function showEnding() {
  const s = UI.state;
  const e = s.ending;
  if (!e) return;
  const survivors = alive(s);
  const stats = `<div class="modal-grid"><div class="invitem"><strong>${survivors.length}/3</strong><span>走到最后的人</span></div><div class="invitem"><strong>¥${s.cash}</strong><span>最后的现金</span></div><div class="invitem"><strong>${s.art}</strong><span>涂鸦作品</span></div><div class="invitem"><strong>${s.flags.runs || 0}</strong><span>马哥跑腿</span></div><div class="invitem"><strong>${s.flags.gambles || 0}</strong><span>付费博彩次数</span></div><div class="invitem"><strong>${s.deaths.length}</strong><span>死亡</span></div></div>`;
  showModal(e.title, `<div class="dialogue">${e.lines.map((l) => esc(l) + '<br>').join('')}</div>${stats}<p class="small">第${s.day}天，回合${s.turn}。${e.grade === 'wipe' ? '所有人都没有走到第100天。' : e.grade === 'route' ? '长期路线完成了。' : '活到了第100天。'}</p><div class="modalbuttons"><button id="endExport">导出这局记录</button><button id="endTitle" class="primary">回到标题</button></div>`, { lock: true, tag: 'DAY 100' });
  $('endExport').onclick = () => UI.exportSave();
  $('endTitle').onclick = () => { closeModal(true); UI.goTitle(); };
}
