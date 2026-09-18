import { createIntroClock, nextIntroSpeed } from './intro-clock.js';
import { drawMeetingScene } from './meeting-art.js';

const S = (text) => ({ type: 'stage', text });
const N = (text) => ({ type: 'narr', text });
const L = (who, text) => ({ type: 'line', who, text });

export const MEETING_BEATS = [
  { end: 3000, line: N('快回营地时，他们看见常翻的垃圾桶前蹲着一个人。'), phase: 'walk' },
  { end: 6000, line: S('桶盖响了一下。那个人弯着腰，正往袋里翻东西。'), phase: 'bin' },
  { end: 8500, line: L('凡哥', '哎，那桶……我们刚整理过！'), phase: 'rush' },
  { end: 10500, line: L('轩哥', '……马哥？'), phase: 'recognize' },
  { end: 12500, line: L('凡哥', '马哥！'), phase: 'recognize' },
  { end: 15000, line: L('马哥', '轩哥！凡哥！'), phase: 'recognize' },
  { end: 19000, line: N('三个人抱成一团，谁也没先松手。'), phase: 'hug' },
  { end: 21000, line: N('哭够了，他们低头擦了擦脸。'), phase: 'wipe' },
  { end: 24000, line: S('三个人在路边传了一根烟，回桥下去。'), phase: 'smoke' },
  { end: 27000, line: N('两个箱子轮子一齐响。马哥走在中间，尿素袋换着肩。'), phase: 'home' },
];

export function meetingChoreo(age, tick) {
  if (age < 3000) return { phase: 'walk', xuanX: 80 + age / 3000 * 44, fanX: 150 + age / 3000 * 44, maX: 340 };
  if (age < 6000) return { phase: 'bin', xuanX: 124, fanX: 194, maX: 340 };
  if (age < 8500) return { phase: 'rush', xuanX: 124 + (age - 6000) / 2500 * 78, fanX: 194 + (age - 6000) / 2500 * 46, maX: 340 };
  if (age < 15000) return { phase: 'recognize', xuanX: 202, fanX: 240, maX: 300 };
  if (age < 19000) {
    const shake = Math.floor(tick / 4) % 2;
    return { phase: 'hug', xuanX: 215 + shake, fanX: 231 - shake, maX: 223, embrace: true };
  }
  if (age < 21000) return { phase: 'wipe', xuanX: 202, fanX: 240, maX: 300 };
  if (age < 24000) {
    const smokeAge = age - 21000;
    const base = { phase: 'smoke', xuanX: 190, fanX: 250, maX: 220 };
    if (smokeAge < 700) return { ...base, cigarette: true, cigaretteCarrier: 'xuan' };
    if (smokeAge < 1000) return { ...base, cigarette: true, cigaretteTransfer: ['xuan', 'ma'], transferProgress: (smokeAge - 700) / 300 };
    if (smokeAge < 1700) return { ...base, cigarette: true, cigaretteCarrier: 'ma' };
    if (smokeAge < 2000) return { ...base, cigarette: true, cigaretteTransfer: ['ma', 'fan'], transferProgress: (smokeAge - 1700) / 300 };
    return { ...base, cigarette: true, cigaretteCarrier: 'fan' };
  }
  return { phase: 'home', xuanX: 115 + (age - 24000) / 3000 * 56, fanX: 205 + (age - 24000) / 3000 * 56, maX: 160 + (age - 24000) / 3000 * 56, cigarette: false };
}

export function createMeetingLifecycle(onDone, cleanup = () => {}) {
  let finished = false;
  return {
    finish() {
      if (finished) return;
      finished = true;
      cleanup();
      onDone();
    },
  };
}

function speak(line) {
  if (line.type !== 'line') return;
  window.jwsnAudio?.stopSpeech?.();
  window.jwsnAudio?.speak?.(line.who, line.text);
}

export function playMeetingIntro(onDone) {
  const root = document.createElement('div');
  root.className = 'intro';
  root.innerHTML = `<div class="intro-stage"><canvas id="meetingIntroCanvas" width="480" height="270"></canvas></div><div class="intro-text" id="meetingIntroText"></div><div class="intro-btns"><button id="meetingSpeed" type="button" aria-label="相遇速度 1×">速度 1×</button><button id="meetingSkip" class="linkbtn">跳过相遇</button></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('#meetingIntroCanvas');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const text = root.querySelector('#meetingIntroText');
  const speedButton = root.querySelector('#meetingSpeed');
  const clock = createIntroClock();
  let raf = 0, shownBeat = -1;
  const lifecycle = createMeetingLifecycle(onDone, () => {
    cancelAnimationFrame(raf);
    window.jwsnAudio?.stopSpeech?.();
    root.onkeydown = null;
    root.remove();
  });

  function showBeat(index) {
    if (index === shownBeat) return;
    shownBeat = index;
    const line = MEETING_BEATS[index].line;
    text.innerHTML = line.type === 'line' ? `<div class="il line"><b>${line.who}</b><span>${line.text}</span></div>` : `<div class="il ${line.type}"><span>${line.text}</span></div>`;
    speak(line);
  }

  function frame(realNow) {
    const age = clock.advance(realNow);
    const index = MEETING_BEATS.findIndex((beat) => age < beat.end);
    if (index === -1) return lifecycle.finish();
    showBeat(index);
    const tick = Math.floor(age / 40);
    const beat = MEETING_BEATS[index].phase;
    drawMeetingScene(context, { beat, tick, choreo: meetingChoreo(age, tick) });
    raf = requestAnimationFrame(frame);
  }

  speedButton.onclick = (event) => {
    event.stopPropagation();
    clock.advance(performance.now());
    speedButton.textContent = `速度 ${clock.setSpeed(nextIntroSpeed(clock.speed()))}×`;
    speedButton.setAttribute('aria-label', `相遇速度 ${clock.speed()}×`);
  };
  root.querySelector('#meetingSkip').onclick = () => lifecycle.finish();
  canvas.onclick = () => lifecycle.finish();
  root.onkeydown = (event) => {
    if (event.target?.id === 'meetingSpeed') return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); lifecycle.finish(); }
  };
  root.tabIndex = -1;
  root.focus();
  raf = requestAnimationFrame(frame);
}
