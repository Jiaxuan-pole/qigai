// 零依赖 HTTP 服务：静态 public/ + 设计数据 + /api 模型代理。监听 0.0.0.0，局域网设备可直接打开。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiInfo, complete, extractJson } from './ai.js';
import { DIALOGUE_SYSTEM, EVENT_SYSTEM } from './prompts.js';
import { validateDialogue, validateEventProposal } from '../public/game/rules.js';
import { BEG_SYSTEM, checkBegContext, validateBegPayload } from './beg-ai.js';
import { AUTOPLAN_SYSTEM, checkAutoPlanContext, validateAutoPlanPayload } from './autoplan.js';
import { WISH_SYSTEM, checkWishContext, validateWishPayload } from './wishes-ai.js';
import { cardNpcReply } from './card-npc-ai.js';
import { createSavesApi, defaultSavesApi } from './saves-api.js';
import { loadData } from '../public/game/data.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
await loadData();
const PUBLIC = resolve(ROOT, 'public');
const DATA_FILE = join(ROOT, '03_开发数据_商店物品愿望事件100日.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const handleSaves = process.env.JWSN_SAVES_DIR ? createSavesApi(process.env.JWSN_SAVES_DIR) : defaultSavesApi(ROOT);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const BODY_CAP = 64 * 1024;
const MAX_INFLIGHT = 3;
let inflight = 0;
const perIp = new Map();

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));

async function serveStatic(req, res, urlPath) {
  if (urlPath === '/data/design.json') {
    const body = await readFile(DATA_FILE);
    return send(res, 200, body, MIME['.json']);
  }
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = resolve(PUBLIC, '.' + rel);
  if (!file.startsWith(PUBLIC + '/') && file !== PUBLIC) return send(res, 403, 'forbidden', 'text/plain');
  try {
    const st = await stat(file);
    if (!st.isFile()) return send(res, 404, 'not found', 'text/plain');
    const body = await readFile(file);
    return send(res, 200, body, MIME[extname(file)] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'not found', 'text/plain');
  }
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > BODY_CAP) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const isStr = (x, max) => typeof x === 'string' && x.length > 0 && x.length <= max;
const isStrList = (x, max, each) => Array.isArray(x) && x.length <= max && x.every((s) => isStr(s, each));

// 请求体形状校验：只放行 04 约定里的字段，长度封顶，防止把整份存档或指令喂给模型。
function checkDialogueContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return '不是对象';
  if (!isStr(ctx.requestId, 64) || !isStr(ctx.sceneId, 64) || !Number.isInteger(ctx.stateRevision)) return '缺少请求标识';
  if (!isStrList(ctx.allowedCast, 3, 8) || !isStrList(ctx.requiredChoiceIds, 6, 40) || !isStrList(ctx.allowedWishIds, 6, 40)) return '名单字段无效';
  if (!isStrList(ctx.factsForThisScene, 12, 120) || !isStr(ctx.sceneTone, 40)) return '场景事实无效';
  if (ctx.wishCues && !Array.isArray(ctx.wishCues)) return 'wishCues 无效';
  if (ctx.actorKnowledge && typeof ctx.actorKnowledge !== 'object') return 'actorKnowledge 无效';
  if (ctx.recentLines && !isStrList(ctx.recentLines, 8, 160)) return 'recentLines 无效';
  return null;
}

function checkEventContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return '不是对象';
  if (!isStr(ctx.requestId, 64)) return '缺少请求标识';
  for (const k of ['templateIds', 'themeIds', 'choiceBundleIds', 'castIds', 'choiceIds']) if (!isStrList(ctx[k], 12, 40)) return k + ' 无效';
  if (!isStrList(ctx.facts, 12, 120) || !isStr(ctx.place, 60) || !isStr(ctx.time, 40)) return '场景无效';
  return null;
}

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/ai/status' && req.method === 'GET') return json(res, 200, aiInfo());
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'method' });
  if (!aiInfo().available) return json(res, 503, { ok: false, reason: 'AI 未配置' });
  const ip = req.socket.remoteAddress || '?';
  if (inflight >= MAX_INFLIGHT || perIp.get(ip)) return json(res, 429, { ok: false, reason: '请求过于频繁' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false, reason: '请求体无效' }); }
  inflight += 1; perIp.set(ip, true);
  try {
    if (urlPath === '/api/card-npc') {
      const result = await cardNpcReply(body, complete, extractJson);
      return json(res, result.status, result.body);
    }
    if (urlPath === '/api/wishes') {
      const err = await checkWishContext(body);
      if (err) return json(res, 400, { ok: false, reason: err });
      const { text, ms } = await complete(WISH_SYSTEM, JSON.stringify(body), { timeoutMs: 20000 });
      const payload = extractJson(text);
      if (!validateWishPayload(payload, body)) return json(res, 200, { ok: false, reason: '愿望输出无效', ms });
      return json(res, 200, { ok: true, payload, ms });
    }
    if (urlPath === '/api/autoplan') {
      const err = checkAutoPlanContext(body);
      if (err) return json(res, 400, { ok: false, reason: err });
      const { text, ms } = await complete(AUTOPLAN_SYSTEM, JSON.stringify(body), { timeoutMs: 20000 });
      const payload = extractJson(text);
      if (!validateAutoPlanPayload(payload, body)) return json(res, 200, { ok: false, reason: 'AI 排程输出无效，请重试。', ms });
      return json(res, 200, { ok: true, payload, ms });
    }
    if (urlPath === '/api/beg') {
      const err = checkBegContext(body);
      if (err) return json(res, 400, { ok: false, reason: err });
      const { text, ms } = await complete(BEG_SYSTEM, JSON.stringify(body), { timeoutMs: 20000 });
      const payload = extractJson(text);
      if (!validateBegPayload(payload, body)) return json(res, 200, { ok: false, reason: '求助文本无效', ms });
      return json(res, 200, { ok: true, payload, ms });
    }
    if (urlPath === '/api/dialogue') {
      const err = checkDialogueContext(body);
      if (err) return json(res, 400, { ok: false, reason: err });
      const { text, ms } = await complete(DIALOGUE_SYSTEM, JSON.stringify(body));
      const payload = extractJson(text);
      const v = validateDialogue(payload, body);
      if (!v.ok) { console.log('[ai] dialogue rejected:', v.reason); return json(res, 200, { ok: false, reason: v.reason, ms }); }
      return json(res, 200, { ok: true, payload, ms });
    }
    if (urlPath === '/api/event') {
      const err = checkEventContext(body);
      if (err) return json(res, 400, { ok: false, reason: err });
      const { text, ms } = await complete(EVENT_SYSTEM, JSON.stringify(body));
      const payload = extractJson(text);
      const v = validateEventProposal(payload, body);
      if (!v.ok) return json(res, 200, { ok: false, reason: v.reason, ms });
      return json(res, 200, { ok: true, payload, empty: Boolean(v.empty), ms });
    }
    return json(res, 404, { ok: false, reason: 'no such api' });
  } catch (e) {
    console.log('[ai] error:', e.message);
    return json(res, 200, { ok: false, reason: '模型调用失败：' + e.message });
  } finally {
    inflight -= 1; perIp.delete(ip);
  }
}

const server = createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  try {
    if (await handleSaves(req, res, urlPath)) return;
    if (urlPath.startsWith('/api/')) return await handleApi(req, res, urlPath);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method', 'text/plain');
    return await serveStatic(req, res, urlPath);
  } catch (e) {
    console.log('[server] error', e.message);
    return send(res, 500, 'server error', 'text/plain');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.error(`端口 ${PORT} 已被占用。换一个：PORT=8788 npm start`); process.exit(1); }
  throw e;
});

server.listen(PORT, HOST, () => {
  const addrs = [];
  for (const list of Object.values(networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) addrs.push(n.address);
  const ai = aiInfo();
  console.log('今晚睡哪儿 已启动');
  console.log(`  本机：http://localhost:${PORT}`);
  for (const a of addrs) console.log(`  局域网：http://${a}:${PORT}`);
  console.log(`  AI 对话：${ai.available ? '可用 ' + ai.model : '未配置（用本地台词模板）'}`);
});
