// 声音层的纯逻辑：档位循环、名字表完整、来源选择（文件/合成/无）、场景推断。
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOLUME_STEPS, VOLUME_GAIN, VOLUME_LABEL, FILES, SYNTH, nextVolume, extOf, resolveSource, sceneFor, initAudio } from '../public/ui/audio.js';

test('音量四档循环，未知值回到第一档', () => {
  assert.deepEqual(VOLUME_STEPS, ['off', 'low', 'mid', 'high']);
  assert.equal(nextVolume('off'), 'low');
  assert.equal(nextVolume('high'), 'off');
  assert.equal(nextVolume('nope'), 'low');
  for (const v of VOLUME_STEPS) { assert.ok(v in VOLUME_GAIN, v + ' 缺增益'); assert.ok(v in VOLUME_LABEL, v + ' 缺标签'); }
  assert.equal(VOLUME_GAIN.off, 0);
});

test('名字表完整：牌局与开场要用的名字都有，文件后缀可识别', () => {
  for (const n of ['card_flip', 'chips', 'shuffle', 'wheel', 'tv_on', 'click', 'coin']) assert.ok(n in FILES.sfx, n + ' 不在 sfx 表');
  for (const n of ['title', 'day', 'camp']) assert.ok(FILES.bgm[n]);
  for (const n of ['fire', 'rain', 'wind']) assert.ok(FILES.ambient[n]);
  assert.equal(extOf('a-kind-of-hope.m4a'), 'm4a');
  assert.equal(extOf('rain-short.ogg'), 'ogg');
  assert.equal(extOf(null), '');
  // 没有文件的名字必须能合成，否则永远不出声。
  for (const kind of ['sfx', 'ambient']) for (const [n, f] of Object.entries(FILES[kind])) if (!f) assert.ok(SYNTH.has(n), n + ' 既无文件也不能合成');
});

test('来源选择：文件可播放放文件，不可播放退到合成，都没有返回 null', () => {
  assert.deepEqual(resolveSource('ambient', 'fire'), { file: '/audio/fireplace-loop.m4a' });
  assert.deepEqual(resolveSource('ambient', 'fire', { canPlay: () => false }), { synth: 'fire' });
  assert.deepEqual(resolveSource('sfx', 'wheel'), { synth: 'wheel' });
  assert.deepEqual(resolveSource('bgm', 'day', { canPlay: (ext) => ext !== 'ogg' }), null);
  assert.equal(resolveSource('sfx', 'not_a_sound'), null);
});

test('场景推断：白天按天气、夜里按过夜地点、放映用电视', () => {
  assert.deepEqual(sceneFor({ weatherKind: 'clear', phase: 'planning' }), { bgm: 'day', ambient: 'street' });
  assert.deepEqual(sceneFor({ weatherKind: 'storm' }), { bgm: 'day', ambient: 'rain' });
  assert.deepEqual(sceneFor({ weatherKind: 'coldwave' }), { bgm: 'day', ambient: 'wind' });
  assert.deepEqual(sceneFor({ weatherKind: 'clear' }, 'night', { spot: 'camp' }), { bgm: 'camp', ambient: null });
  assert.deepEqual(sceneFor({ weatherKind: 'clear' }, 'night', { spot: 'camp', fire: true }), { bgm: 'camp', ambient: 'fire' });
  assert.deepEqual(sceneFor({ weatherKind: 'rain' }, 'night', { spot: 'camp' }), { bgm: 'camp', ambient: 'rain' });
  assert.deepEqual(sceneFor({ weatherKind: 'cold' }, 'night', { spot: 'station' }), { bgm: null, ambient: 'wind' });
  assert.deepEqual(sceneFor(null, 'title'), { bgm: 'title', ambient: null });
  assert.deepEqual(sceneFor(null, 'screening'), { bgm: null, ambient: 'tv' });
});

test('对话音效：解锁后暴露 speak，并为一句台词排入可停止的 WebAudio 短音', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const listeners = new Map();
  const oscillators = [];
  class Param {
    constructor() { this.value = 0; }
    setValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    cancelScheduledValues() {}
  }
  class Node { connect() {}; disconnect() {} }
  class FakeAudioContext {
    constructor() { this.currentTime = 1; this.destination = new Node(); this.state = 'running'; }
    createGain() { const node = new Node(); node.gain = new Param(); return node; }
    createOscillator() { const node = new Node(); node.frequency = new Param(); node.start = () => {}; node.stop = () => { node.stopped = true; }; oscillators.push(node); return node; }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
  }
  globalThis.window = { AudioContext: FakeAudioContext, addEventListener(type, fn) { listeners.set(type, fn); } };
  globalThis.document = {
    hidden: false,
    addEventListener(type, fn) { listeners.set(type, fn); },
    getElementById(id) { return id === 'title' ? { classList: { contains: () => false } } : null; },
    createElement() { return { canPlayType: () => '' }; },
  };
  try {
    initAudio();
    listeners.get('pointerdown')();
    assert.equal(typeof window.jwsnAudio.speak, 'function');
    window.jwsnAudio.speak('xuan', '今晚先问饭。');
    assert.ok(oscillators.length > 0, '没有排入任何对话短音');
    assert.equal(window.jwsnAudio.state.speechActive, true);
    assert.equal(window.jwsnAudio.state.bgm, 'title', '对话短音不应替换当前 BGM 场景');
    const scheduled = oscillators.length;
    window.jwsnAudio.speak('xuan', '今晚先问饭。');
    assert.equal(oscillators.length, scheduled, '同一条仍在播放的台词不应因重复渲染重放');
    window.jwsnAudio.stopSpeech();
    assert.ok(oscillators.every((node) => node.stopped), '停止时应取消所有已排入短音');
    window.jwsnAudio.speak('fan', '慢一点。');
    document.hidden = true;
    listeners.get('visibilitychange')();
    assert.equal(window.jwsnAudio.state.speechCount, 0, '页面隐藏时不应留下已调度短音');
    document.hidden = false;
    listeners.get('visibilitychange')();
    window.jwsnAudio.speak('ma', '我来。');
    window.jwsnAudio.mute(true);
    assert.equal(window.jwsnAudio.state.speechCount, 0, '静音时不应留下已调度短音');
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
