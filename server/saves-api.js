import { join } from 'node:path';
import { SaveError, createSaveStore } from './save-store.js';

export function createSavesApi(dir) {
  const store = createSaveStore(dir);
  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const bodyOf = async (req) => {
    let size = 0;
    const parts = [];
    for await (const part of req) {
      size += part.length;
      if (size > 1024 * 1024) throw new SaveError(413, '存档超过1MB限制');
      parts.push(part);
    }
    try {
      const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('shape');
      return body;
    }
    catch { throw new SaveError(400, '请求体不是有效 JSON'); }
  };
  return async (req, res, path) => {
    if (!/^\/api\/saves(?:\/[^/]+)?$/.test(path)) return false;
    try {
      if (path === '/api/saves') {
        if (req.method === 'GET') send(res, 200, { ok: true, saves: await store.list() });
        else if (req.method === 'POST') {
          const record = await store.create(await bodyOf(req));
          send(res, 201, { ok: true, save: record });
        } else send(res, 405, { ok: false, reason: '请求方法无效' });
      } else {
        const id = path.slice('/api/saves/'.length);
        if (req.method === 'GET') send(res, 200, { ok: true, save: await store.get(id) });
        else if (req.method === 'PUT') send(res, 200, { ok: true, save: await store.update(id, await bodyOf(req)) });
        else send(res, 405, { ok: false, reason: '请求方法无效' });
      }
    } catch (error) {
      if (!(error instanceof SaveError)) console.error('[saves] error:', error);
      send(res, error.status || 500, { ok: false, reason: error.status ? error.message : '存档写入失败，请稍后重试', current: error.current ?? undefined });
    }
    return true;
  };
}

export const defaultSavesApi = (root) => createSavesApi(join(root, '.saves'));
