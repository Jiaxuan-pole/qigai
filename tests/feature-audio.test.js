import test from 'node:test';
import assert from 'node:assert/strict';
import { FILES, SYNTH, resolveSource } from '../public/ui/audio.js';

test('新增 cue 都能解析到存在的短素材或合成实现', async () => {
  const { access } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const names = ['fish_bite', 'reel', 'fish_catch', 'fish_escape', 'splash', 'swim', 'coffee_sip', 'cook_sizzle', 'charcoal_ignite', 'meal', 'work_sort', 'work_rotate', 'work_camera', 'work_cut', 'work_handoff', 'work_success', 'work_miss', 'cups_shuffle', 'parcel_arrive', 'parcel_open', 'furniture_place', 'furniture_move', 'sleep_ground', 'sleep_bed'];
  for (const name of names) {
    const source = resolveSource('sfx', name);
    assert.ok(source, name);
    if (source.file) await access(fileURLToPath(new URL(`../public${source.file}`, import.meta.url)));
    else assert.ok(SYNTH.has(name));
  }
  assert.equal(Object.keys(FILES.sfx).length >= names.length, true);
});

test('格斗 cue 使用本地短音素材', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['combat_swing', 'combat_hit', 'combat_block', 'combat_flee', 'combat_win', 'combat_lose']) {
    const source = resolveSource('sfx', name);
    assert.ok(source?.file, `${name} 缺少声音文件`);
    const data = await readFile(new URL(`../public${source.file}`, import.meta.url));
    assert.equal(data.subarray(0, 4).toString(), 'OggS', `${name} 不是 Ogg 音频`);
  }
});

for (const [sound, scope] of [['parcel_open', 'furniture'], ['combat_hit', 'combat']]) test(`${scope} 作用域取消、静音、隐藏能阻止迟到解码播放并停止已发声节点`, async () => {
  const old = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, localStorage: globalThis.localStorage };
  const listeners = new Map();
  const starts = [];
  const pending = [];
  class Param { value = 0; setValueAtTime(v) { this.value = v; } exponentialRampToValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Node { connect() {} disconnect() {} }
  class AudioContext {
    currentTime = 1; state = 'running'; destination = new Node();
    createGain() { const n = new Node(); n.gain = new Param(); return n; }
    createBufferSource() { const n = new Node(); n.start = () => starts.push(n); n.stop = () => { n.stopped = true; }; return n; }
    decodeAudioData(_ab, done) { pending.push(done); }
    resume() { this.state = 'running'; } suspend() { this.state = 'suspended'; }
  }
  globalThis.localStorage = { getItem: () => 'low', setItem() {} };
  globalThis.window = { AudioContext, addEventListener(type, fn) { listeners.set(type, fn); } };
  globalThis.document = { hidden: false, addEventListener(type, fn) { listeners.set(type, fn); }, getElementById() { return null; }, createElement() { return { canPlayType: () => 'probably' }; } };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  try {
    const { initAudio } = await import(`../public/ui/audio.js?feature-lifecycle=${scope}`);
    initAudio(); listeners.get('pointerdown')();
    const first = window.jwsnAudio.play(sound, { scope });
    for (let i = 0; i < 5 && !pending.length; i++) await new Promise((resolve) => setImmediate(resolve));
    assert.ok(pending.length >= 1);
    window.jwsnAudio.cancelScope(scope);
    pending.at(-1)({ duration: 0.2 });
    await first;
    assert.equal(starts.length, 0);
    const second = window.jwsnAudio.play(sound, { scope });
    await second;
    assert.equal(starts.length, 1);
    window.jwsnAudio.cancelScope(scope);
    assert.equal(starts[0].stopped, true);
    assert.equal(window.jwsnAudio.state.sfxActive, 0);
    const third = window.jwsnAudio.play(sound); await third;
    window.jwsnAudio.mute(true);
    assert.equal(starts[1].stopped, true);
    assert.equal(window.jwsnAudio.state.sfxActive, 0);
    window.jwsnAudio.mute(false);
    document.hidden = true; listeners.get('visibilitychange')();
    await window.jwsnAudio.play(sound);
    assert.equal(starts.length, 2);
  } finally { Object.assign(globalThis, old); }
});
