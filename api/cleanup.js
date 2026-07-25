// POST /api/cleanup — 24h 지난 방울을 zset에서 제거 (일 1회 크론).
// GitHub Actions .github/workflows/cleanup.yml 에서 호출 (00:05 KST).
// bubble:{id} HASH 자체는 Redis TTL로 자동 소멸 — zset 인덱스만 수동 청소.

import { redis, setCors } from './_lib/redis.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const removed = await redis.zremrangebyscore('bubbles:zset', 0, cutoff);

  return res.status(200).json({ ok: true, removed, cutoff: new Date(cutoff).toISOString() });
}
