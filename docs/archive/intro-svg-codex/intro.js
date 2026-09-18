// 开场动画「被城市登出」：按文案分拍，画面随文案变化；点击加速、可跳过。
import { buildScene, sceneForBeat } from './intro-scene.js';

const S = (text) => ({ type: 'stage', text });
const N = (text) => ({ type: 'narr', text });
const L = (who, text) => ({ type: 'line', who, text });

// 保留原始分拍，避免画面升级改变叙事节奏。
export const BEATS = [
  { scene: 'black', lines: [S('黑屏。先传来一阵行李箱轮子拖过地面的声音。轮子坏了一边，每隔几步，就磕一下。')], fx: { wheel: true }, hold: 2600 },
  { scene: 'city', lines: [N('早上六点，雾城照常醒来。')], fx: { dawn: 0.3 }, hold: 1800 },
  { scene: 'city', lines: [N('早餐摊掀开蒸笼，公交车靠站，写字楼外的保安把昨晚吹倒的广告牌扶起来。')], fx: { dawn: 0.6, bus: true, steam: true }, hold: 2400 },
  { scene: 'city', lines: [N('没有什么大事发生。')], fx: { dawn: 0.8 }, hold: 1600 },
  { scene: 'city', lines: [N('只是轩哥和凡哥，没地方住了。')], fx: { dawn: 1 }, hold: 2200 },
  { scene: 'bridge', lines: [S('画面亮起。桥下，两个人，几个袋子，一只合不严的行李箱。')], fx: { xuan: 'crouch', fan: 'stand', bags: true }, hold: 2200 },
  { scene: 'bridge', lines: [N('凡哥把相机包放在纸箱上，又拿起来，垫了件衣服，才重新放下。')], fx: { fan: 'bend', camBag: true }, hold: 2400 },
  { scene: 'bridge', lines: [N('轩哥蹲在旁边，盯着手机。'), N('上一条消息是甲方昨天发的：'), N('“结款的事，我再帮你催一下。”'), N('再往上翻，前天也是这句。')], fx: { phone: 'xuan' }, hold: 3200 },
  { scene: 'bridge', lines: [L('凡哥', '还看呢？'), L('轩哥', '学习一下。'), L('凡哥', '学什么？'), L('轩哥', '怎么用一句话，让一个人每天都觉得明天有希望。')], fx: { phone: 'xuan' }, hold: 3000 },
  { scene: 'bridge', lines: [N('凡哥没接。他掏出烟盒，倒了倒，只剩两根。'), N('一人一根。'), N('打火机按了三下，才着。')], fx: { lighter: true }, hold: 3200 },
  { scene: 'bridge', lines: [S('远处的早餐摊传来收款提示音。凡哥朝那边看了一眼。')], fx: { smoke: true, fanLook: true, ding: true }, hold: 2200 },
  { scene: 'bridge', lines: [L('凡哥', '你还剩多少？'), N('轩哥报了个数。'), L('凡哥', '现金呢？'), L('轩哥', '刚才报的就是全部。')], fx: { smoke: true }, hold: 3000 },
  { scene: 'bridge', lines: [N('凡哥把烟从嘴边拿下来，看了看，像突然觉得这一口抽得有点贵。'), N('两个人沉默了一会儿。')], fx: { smoke: true }, hold: 2800 },
  { scene: 'bridge', lines: [N('桥上有车经过，接缝震得头顶落下一点灰。凡哥伸手护住相机包。')], fx: { car: true, dust: true, fan: 'bend' }, hold: 2800 },
  { scene: 'bridge', lines: [L('轩哥', '你先护一下自己行不行。'), L('凡哥', '相机贵。'), L('轩哥', '你这话说得，我都不知道该反驳哪儿。')], fx: {}, hold: 2800 },
  { scene: 'bridge', lines: [S('凡哥靠着桥柱坐下。他的手机亮了。'), N('有人在旧剧组群里发了一张片场照片。'), N('不是他们那部。'), N('他看了几秒，把通知关掉，手机扣在腿上。')], fx: { fan: 'sit', phone: 'fan' }, hold: 3400 },
  { scene: 'bridge', lines: [L('凡哥', '我那片子，其实还差三个镜头。'), N('轩哥没说话。'), L('凡哥', '补完就能剪。'), L('轩哥', '嗯。'), L('凡哥', '就是现在……'), N('凡哥没往下说。'), N('轩哥也没替他说完。')], fx: { fan: 'sit' }, hold: 3600 },
  { scene: 'bridge', lines: [N('过了一会儿，轩哥从电脑包里掏出充电器，绕好线，又放了回去。附近没有插座，他刚才已经找过一遍了。')], fx: { fan: 'sit', charger: true }, hold: 2800 },
  { scene: 'bridge', lines: [L('轩哥', '我现在倒是彻底实现云办公了。'), N('凡哥抬头。'), N('轩哥指了指桥外的天。'), L('轩哥', '云挺多的。'), L('凡哥', '烂。'), L('轩哥', '免费的，你还挑。'), N('这次凡哥笑了一下，很短。')], fx: { fan: 'sit', clouds: true, point: true }, hold: 3600 },
  { scene: 'bridge', lines: [S('风吹动纸箱上翘起的封口。凡哥从包里摸出一支马克笔。'), N('他把纸箱翻了个面，画了一个方框。'), N('框里两个人，一个戴眼镜，一个背相机。'), N('然后在他们头顶，加了一个屋顶。')], fx: { fan: 'crouch', draw: 3 }, hold: 3600 },
  { scene: 'bridge', lines: [N('轩哥凑过去看。'), L('轩哥', '画大点。'), L('凡哥', '干吗？'), L('轩哥', '我电脑没地方放。'), N('凡哥把方框往外扩了一点。'), L('凡哥', '现在呢？'), L('轩哥', '厕所呢？'), L('凡哥', '你他妈自己画。')], fx: { fan: 'crouch', xuan: 'crouchNear', draw: 4 }, hold: 3600 },
  { scene: 'bridge', lines: [S('轩哥接过笔，却没动。他看了一会儿那两个小人，把笔帽扣了回去。'), N('桥外，有人骑车经过，顺手把一只空饮料瓶放在路边。'), N('再远一点，早餐摊的老板正一个人搬桌子。桌腿卡在门槛上，她试了两次，没抬过去。')], fx: { draw: 4, bike: true, stall: true }, hold: 3800 },
  { scene: 'bridge', lines: [N('凡哥站起来，拍掉裤子上的灰。'), L('凡哥', '去问问，帮忙管不管饭。'), N('轩哥收起手机，拎了拎那个瘪下去的电脑包。'), L('轩哥', '你去问。我看着东西。')], fx: { draw: 4, fan: 'stand', stall: true }, hold: 3200 },
  { scene: 'bridge', lines: [N('凡哥走出两步，又回过头。'), L('凡哥', '那晚上呢？'), L('轩哥', '什么晚上？'), L('凡哥', '今晚睡哪儿？'), N('轩哥看了看桥顶，又看了看纸箱上那个刚画好的屋顶。'), L('轩哥', '先问饭。')], fx: { draw: 4, fan: 'step', stall: true }, hold: 3600 },
  { scene: 'bridge', lines: [S('凡哥朝早餐摊走去。轩哥把行李往干燥的地方挪了挪，用那块画着两个人的纸板，垫住漏底的袋子。')], fx: { draw: 4, fan: 'walkOut', xuan: 'move', stall: true }, hold: 3400 },
  { scene: 'bridge', lines: [S('画面缓缓拉远。城市的声音变大。他们没有再说话。')], fx: { zoomOut: true, fan: 'gone', stall: true }, hold: 3200 },
  { scene: 'title', lines: [], fx: {}, hold: 999999 },
];

export function drawingStep(beat, line, character = 0) {
  if (beat < 19) return 0;
  if (beat > 20) return 4;
  const cues = beat === 19
    ? [[1, '方框', 1], [2, '两个人', 2], [3, '屋顶', 3]]
    : [[4, '扩了一点', 4]];
  let step = beat === 19 ? 0 : 3;
  for (const [index, word, value] of cues) {
    if (line > index || (line === index && character >= BEATS[beat].lines[index].text.indexOf(word) + word.length)) step = value;
  }
  return step;
}

export function playIntro(onDone) {
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '开场 · 被城市登出');
  root.innerHTML = `<div class="intro-stage">${buildScene()}<div class="intro-title hidden" id="introTitle"><div class="eyebrow">DAY 1 / MORNING</div><h1 aria-label="今晚睡哪儿">${[...'今晚睡哪儿'].map((letter, i) => `<span aria-hidden="true" style="--i:${i}">${letter}</span>`).join('')}</h1><p>第 1 日 · 清晨</p><p class="intro-prompt">先给两个人，安排一点今天能做的事。</p><button class="primary big" id="introStart">开始安排</button></div></div><div class="intro-text" id="introText" tabindex="0" aria-label="开场文字"></div><div class="intro-btns"><button id="introNext">继续 ▸</button><button id="introSkip" class="linkbtn">跳过开场</button></div>`;
  document.body.appendChild(root);
  const svg = root.querySelector('#introScene');
  const textEl = root.querySelector('#introText');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let beat = 0, lineIdx = 0, charIdx = 0, typing = true, holdTimer = null, raf = 0, done = false;
  let camera = [0, 0, 480, 270];

  function moveCamera(target, duration = 1400) {
    cancelAnimationFrame(raf);
    const from = [...camera];
    if (motion.matches || duration === 0 || from.every((v, i) => v === target[i])) {
      camera = [...target];
      svg.setAttribute('viewBox', camera.join(' '));
      return;
    }
    const started = performance.now();
    function frame(now) {
      if (done) return;
      const t = Math.min(1, (now - started) / duration);
      const ease = t * t * (3 - 2 * t);
      camera = from.map((value, i) => value + (target[i] - value) * ease);
      svg.setAttribute('viewBox', camera.join(' '));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  function syncMotion() {
    if (motion.matches) {
      svg.pauseAnimations();
      moveCamera(sceneForBeat(beat).camera, 0);
    } else svg.unpauseAnimations();
  }

  function startBeat(index) {
    if (done) return;
    if (index >= BEATS.length) return finish();
    clearTimeout(holdTimer);
    beat = index;
    const b = BEATS[beat];
    const scene = sceneForBeat(beat);
    lineIdx = 0; charIdx = 0; typing = b.lines.length > 0;
    root.className = `intro ${scene.className}`;
    root.dataset.beat = String(beat);
    root.dataset.scene = b.scene;
    root.dataset.line = '0';
    root.dataset.draw = String(drawingStep(beat, 0));
    textEl.replaceChildren();
    textEl.scrollTop = 0;
    moveCamera(scene.camera, b.scene === 'title' ? 0 : scene.duration);
    if (b.scene === 'title') {
      root.querySelector('#introTitle').classList.remove('hidden');
      root.querySelector('.intro-btns').classList.add('hidden');
      textEl.classList.add('hidden');
      root.focus();
    }
  }

  function appendLine(line) {
    const el = document.createElement('div');
    el.className = `il ${line.type}`;
    if (line.type === 'line') {
      const speaker = document.createElement('b');
      speaker.textContent = line.who;
      el.appendChild(speaker);
    }
    el.appendChild(document.createElement('span'));
    textEl.appendChild(el);
    return el;
  }

  function scheduleNext(delay) {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => startBeat(beat + 1), delay);
  }

  function typeStep() {
    if (done || !typing) return;
    const b = BEATS[beat];
    const line = b.lines[lineIdx];
    if (!line) {
      typing = false;
      scheduleNext(b.hold);
      return;
    }
    const follow = textEl.scrollHeight - textEl.scrollTop - textEl.clientHeight < 32;
    const el = textEl.children[lineIdx] || appendLine(line);
    charIdx += 1;
    el.lastElementChild.textContent = line.text.slice(0, charIdx);
    root.dataset.line = String(lineIdx);
    root.dataset.draw = String(drawingStep(beat, lineIdx, charIdx));
    if (follow) textEl.scrollTop = textEl.scrollHeight;
    if (charIdx >= line.text.length) { lineIdx += 1; charIdx = 0; }
  }

  function hurry() {
    if (done || BEATS[beat].scene === 'title') return;
    const b = BEATS[beat];
    if (typing) {
      textEl.replaceChildren();
      for (const line of b.lines) appendLine(line).lastElementChild.textContent = line.text;
      root.dataset.line = String(b.lines.length);
      root.dataset.draw = String(drawingStep(beat, b.lines.length));
      lineIdx = b.lines.length; charIdx = 0; typing = false;
      scheduleNext(Math.min(b.hold, 1800));
    } else startBeat(beat + 1);
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearInterval(typeInterval);
    clearTimeout(holdTimer);
    motion.removeEventListener('change', syncMotion);
    root.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    onDone();
  }

  root.querySelector('#introNext').onclick = hurry;
  root.querySelector('#introSkip').onclick = () => startBeat(BEATS.length - 1);
  root.querySelector('#introStart').onclick = finish;
  svg.onclick = hurry;
  textEl.onclick = hurry;
  root.onkeydown = (event) => {
    if (event.key === 'Tab') {
      const focusable = [...root.querySelectorAll('button, [tabindex="0"]')].filter((el) => el.getClientRects().length);
      const current = focusable.indexOf(document.activeElement);
      if (event.shiftKey && current <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && (current < 0 || current === focusable.length - 1)) { event.preventDefault(); focusable[0]?.focus(); }
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    if (event.repeat) { event.preventDefault(); return; }
    if (BEATS[beat].scene === 'title') { event.preventDefault(); finish(); }
    else if (event.target.tagName !== 'BUTTON') { event.preventDefault(); hurry(); }
  };
  root.tabIndex = -1;
  root.focus();
  const typeInterval = setInterval(typeStep, 55);
  motion.addEventListener('change', syncMotion);
  startBeat(0);
  syncMotion();
}
