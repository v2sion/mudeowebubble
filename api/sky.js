// GET /api/sky?region=강남구
// 현재 하늘 방울 목록. region 파라미터가 있으면 해당 지역 필터링.
// s-maxage=30: 전 사용자 공통 데이터 — KV 용량 원칙 (배틀 패턴 재사용).

import { redis, setCors } from './_lib/redis.js';

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BUBBLES = 50;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const region = req.query.region || null;
  const now = Date.now();
  const cutoff = now - TTL_MS;

  const ids = await redis.zrange('bubbles:zset', cutoff, '+inf', {
    byScore: true,
    rev: true,
    offset: 0,
    count: MAX_BUBBLES,
  });

  if (!ids || ids.length === 0) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
    return res.status(200).json({ bubbles: [], total: 0 });
  }

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall(`bubble:${id}`);
  const results = await pipeline.exec();

  const bubbles = [];
  for (let i = 0; i < ids.length; i++) {
    const b = results[i];
    if (!b || b.hidden === '1' || b.hidden === 1) continue;
    // region 없는 방울(기존 데이터)은 항상 포함, region 있는 방울은 지역 일치만 포함
    if (region && b.region && b.region !== region) continue;
    bubbles.push({
      id: ids[i],
      mood: b.mood,
      text: b.text || '',
      nick: b.nick,
      region: b.region || '',
      likes: Number(b.likes) || 0,
      src: b.src || '',
      createdAt: Number(b.createdAt) || 0,
    });
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=10');
  return res.status(200).json({ bubbles, total: bubbles.length });
}
