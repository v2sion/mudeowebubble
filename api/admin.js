// POST /api/admin — 방울 숨김·계정 제재 (ADMIN_KEY 헤더 보호)

import { redis, setCors } from './_lib/redis.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, id, anonKey } = req.body || {};

  if (action === 'hide' && id) {
    await redis.hset(`bubble:${id}`, { hidden: 1 });
    return res.status(200).json({ ok: true, action: 'hide', id });
  }

  if (action === 'unhide' && id) {
    await redis.hset(`bubble:${id}`, { hidden: 0 });
    return res.status(200).json({ ok: true, action: 'unhide', id });
  }

  if (action === 'ban' && anonKey) {
    await redis.hset(`user:${anonKey}`, { banned: 1 });
    await redis.set(`ban:${anonKey}`, '1', { ex: 86400 * 7 });
    return res.status(200).json({ ok: true, action: 'ban', anonKey });
  }

  if (action === 'unban' && anonKey) {
    await redis.hset(`user:${anonKey}`, { banned: 0 });
    await redis.del(`ban:${anonKey}`);
    return res.status(200).json({ ok: true, action: 'unban', anonKey });
  }

  return res.status(400).json({ error: 'action 값이 올바르지 않아요' });
}
