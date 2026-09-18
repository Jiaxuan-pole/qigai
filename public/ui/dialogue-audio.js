// 对话提示音只表达节奏与角色差异，不合成或传输可辨识的人声。
const VOICES = {
  xuan: { base: 840, type: 'square', gain: 0.055, shape: [0.94, 1.07, 1, 1.12] },
  fan: { base: 560, type: 'sine', gain: 0.05, shape: [1, 0.96, 1.03, 0.98] },
  ma: { base: 300, type: 'triangle', gain: 0.06, shape: [0.92, 1, 0.88, 0.96] },
  npc: { base: 650, type: 'triangle', gain: 0.05, shape: [1, 1.04, 0.98, 1.02] },
};
const PUNCTUATION = new Set(['，', '。', '！', '？', '、', '；', '：', ',', '.', '!', '?', ';', ':', '…']);
const NAMES = { '轩哥': 'xuan', '凡哥': 'fan', '马哥': 'ma' };
const MAX_NOTES = 24;
const MAX_SECONDS = 1.8;

export function speechVoice(speakerId) {
  const id = NAMES[speakerId] || String(speakerId || '').toLowerCase();
  return VOICES[id] || VOICES.npc;
}

// 每个可见文字排一个极短音，标点只留停顿；上限避免长台词盖住音乐。
export function speechPlan(speakerId, text) {
  const voice = speechVoice(speakerId);
  const notes = [];
  let at = 0;
  for (const char of Array.from(String(text || '').trim())) {
    if (/\s/.test(char)) { at += 0.018; continue; }
    if (PUNCTUATION.has(char)) { at += 0.12; continue; }
    if (notes.length >= MAX_NOTES || at + 0.04 > MAX_SECONDS) break;
    const step = notes.length % voice.shape.length;
    notes.push({ at, duration: 0.04, frequency: voice.base * voice.shape[step], gain: voice.gain, type: voice.type });
    at += 0.058;
  }
  return notes;
}
