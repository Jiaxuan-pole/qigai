import test from 'node:test';
import assert from 'node:assert/strict';
import { speechPlan, speechVoice } from '../public/ui/dialogue-audio.js';

test('像素语音按角色给出可区分的音调，不产生人声文本', () => {
  assert.ok(speechVoice('xuan').base > speechVoice('fan').base);
  assert.ok(speechVoice('fan').base > speechVoice('ma').base);
  assert.equal(speechVoice('陌生人').base, speechVoice('npc').base);
  assert.ok(speechPlan('轩哥', '今晚先问饭。').every((note) => note.type === 'square'));
});

test('像素语音按标点留停顿，长句不超过 24 个短音或 1.8 秒', () => {
  const short = speechPlan('fan', '行，慢慢来。');
  assert.ok(short[1].at - short[0].at > short[2].at - short[1].at, '标点后应有额外停顿');
  const long = speechPlan('ma', '这是一段足够长的对话，用来验证轻量提示音不会因为台词变长而盖住背景音乐，也不会无限排入新的短音。');
  assert.ok(long.length <= 24);
  assert.ok(long.at(-1).at + long.at(-1).duration <= 1.8);
});
