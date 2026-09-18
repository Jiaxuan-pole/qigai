import { createIntroClock, nextIntroSpeed } from './intro-clock.js';
import { drawRiverFightScene } from './river-fight-art.js';

const N = (text) => ({ type: 'narr', text });
const S = (text) => ({ type: 'stage', text });
const L = (who, text) => ({ type: 'line', who, text });

export const RIVER_FIGHT_LINE = '这个鱼就是欠干';
export const RIVER_FIGHT_DURATION = 16000;
export const RIVER_FIGHT_BEATS = [
  { end: 3000, phase: 'empty-hook', line: N('马哥盯着空钩，半天没动。') },
  { end: 4800, phase: 'anger', line: L('马哥', RIVER_FIGHT_LINE) },
  { end: 6600, phase: 'run', line: N('小凳一响，他踩着河岸跑了出去。') },
  { end: 7900, phase: 'leap', line: S('他腾空跃过竿尖。') },
  { end: 9300, phase: 'splash', line: N('水花倒是上来了。') },
  { end: 12700, phase: 'swim', line: S('水里一颗脑袋、两只手，追着鱼影扑腾。') },
  { end: 14700, phase: 'climb', line: N('他湿漉漉地爬回岸边。') },
  { end: RIVER_FIGHT_DURATION, phase: 'shake', line: N('马哥甩了甩水。') },
];

function clamp(value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function phaseAt(age) {
  return RIVER_FIGHT_BEATS.find((beat) => age < beat.end) || RIVER_FIGHT_BEATS.at(-1);
}

export function riverFightChoreo(age, tick = 0) {
  const phase = phaseAt(age).phase;
  let maX = 83;
  let maY = 128;
  if (phase === 'run') maX = 83 + 108 * clamp((age - 4800) / 1800);
  if (phase === 'leap') {
    const jump = clamp((age - 6600) / 1300);
    maX = 191 + 94 * jump;
    maY = 128 - Math.round(Math.sin(jump * Math.PI) * 48);
  }
  if (phase === 'splash') { maX = 285; maY = 126; }
  if (phase === 'swim') {
    maX = 282 + Math.round(Math.sin((age - 9300) / 410) * 15);
    maY = 112;
  }
  if (phase === 'climb') {
    const climb = clamp((age - 12700) / 2000);
    maX = 292 - Math.round(84 * climb);
    maY = 126 + Math.round(climb * 7);
  }
  if (phase === 'shake') { maX = 208 + (tick % 2); maY = 133; }
  const fishX = phase === 'swim'
    ? 356 + Math.round(Math.sin((age + tick * 110) / 230) * 42)
    : 362;
  return { phase, maX, maY, fishX };
}

export function createRiverFightLifecycle(onDone, cleanup = () => {}) {
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

export function riverFightStageFrame(age) {
  const index = RIVER_FIGHT_BEATS.findIndex((beat) => age < beat.end);
  const start = index <= 0 ? 0 : RIVER_FIGHT_BEATS[index - 1].end;
  return riverFightChoreo(start, 0);
}

export function playRiverFight(encounter, onDone) {
  void encounter;
  const root = document.createElement('div');
  root.className = 'intro';
  if (root.dataset) root.dataset.sfxScene = 'river-fight';
  root.innerHTML = `<div class="intro-stage"><canvas id="riverFightCanvas" width="480" height="270" aria-label="马哥跳进河里追鱼"></canvas></div><div class="intro-text" id="riverFightText"></div><div class="intro-btns"><button id="riverFightSpeed" type="button" aria-label="河岸过场速度 1×">速度 1×</button><button id="riverFightSkip" class="linkbtn" type="button">跳过过场</button></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('#riverFightCanvas');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const text = root.querySelector('#riverFightText');
  const speedButton = root.querySelector('#riverFightSpeed');
  const skipButton = root.querySelector('#riverFightSkip');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const clock = createIntroClock();
  let raf = 0;
  let shownBeat = -1;
  const lifecycle = createRiverFightLifecycle(onDone, () => {
    cancelAnimationFrame(raf);
    window.jwsnAudio?.stopSpeech?.();
    window.jwsnAudio?.cancelScope?.('river-fight');
    root.onkeydown = null;
    canvas.onclick = null;
    speedButton.onclick = null;
    skipButton.onclick = null;
    root.remove();
  });

  function showBeat(index) {
    if (index === shownBeat) return;
    shownBeat = index;
    const cue = { run: 'footstep', leap: 'cloth', splash: 'splash', swim: 'swim', climb: 'splash', shake: 'cloth' }[RIVER_FIGHT_BEATS[index].phase];
    if (cue) window.jwsnAudio?.play?.(cue, { scope: 'river-fight' });
    const line = RIVER_FIGHT_BEATS[index].line;
    text.innerHTML = line.type === 'line'
      ? `<div class="il line"><b>${line.who}</b><span>${line.text}</span></div>`
      : `<div class="il ${line.type}"><span>${line.text}</span></div>`;
    speak(line);
  }

  function frame(realNow) {
    const age = clock.advance(realNow);
    const index = RIVER_FIGHT_BEATS.findIndex((beat) => age < beat.end);
    if (index === -1) return lifecycle.finish();
    showBeat(index);
    const choreo = reduceMotion ? riverFightStageFrame(age) : riverFightChoreo(age, Math.floor(age / 45));
    drawRiverFightScene(context, { choreo, tick: reduceMotion ? 0 : Math.floor(age / 45) });
    raf = requestAnimationFrame(frame);
  }

  speedButton.onclick = (event) => {
    event.stopPropagation();
    clock.advance(performance.now());
    speedButton.textContent = `速度 ${clock.setSpeed(nextIntroSpeed(clock.speed()))}×`;
    speedButton.setAttribute('aria-label', `河岸过场速度 ${clock.speed()}×`);
  };
  skipButton.onclick = () => lifecycle.finish();
  canvas.onclick = () => lifecycle.finish();
  root.onkeydown = (event) => {
    if (event.target?.id === 'riverFightSpeed') return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      lifecycle.finish();
    }
  };
  root.tabIndex = -1;
  root.focus();
  raf = requestAnimationFrame(frame);
}
