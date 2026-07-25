// POST /api/report
// 방울 신고. 3회 누적 시 자동 숨김.

import { redis, setCors } from './_lib/redis.js';

const AUTO_HIDE_THRESHOLD = 3;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const anonKey = req.headers['x-anon-key'];
  if (!anonKey) return res.status(400).json({ error: 'x-anon-key required' });

  const { id, reason = '' } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const exists = await redis.exists(`bubble:${id}`);
  if (!exists) return res.status(404).json({ error: '방울을 찾을 수 없어요' });

  // 동일 사용자의 동일 방울 중복 신고 방지
  const alreadyReported = !(await redis.set(`report:${anonKey}:${id}`, '1', { nx: true, ex: 90000 }));
  if (alreadyReported) return res.status(409).json({ error: '이미 신고한 방울이에요' });

  const pipeline = redis.pipeline();
  pipeline.incr(`reports:${id}`);
  pipeline.hset(`bubble:${id}`, { reported: 1, lastReportReason: String(reason).slice(0, 50) });
  const [count] = await pipeline.exec();

  if (count >= AUTO_HIDE_THRESHOLD) {
    await redis.hset(`bubble:${id}`, { hidden: 1 });
  }

  return res.status(200).json({ ok: true, autoHidden: count >= AUTO_HIDE_THRESHOLD });
}
