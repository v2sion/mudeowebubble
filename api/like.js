// POST /api/like
// 방울 공감. 동일 방울 1인 1회 제한.

import { redis, setCors } from './_lib/redis.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const anonKey = req.headers['x-anon-key'];
  if (!anonKey) return res.status(400).json({ error: 'x-anon-key required' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const exists = await redis.exists(`bubble:${id}`);
  if (!exists) return res.status(404).json({ error: '방울을 찾을 수 없어요 (소멸됐을 수 있어요)' });

  // 중복 공감 방지 (25h — 방울 TTL 24h보다 1h 여유)
  const alreadyLiked = !(await redis.set(`liked:${anonKey}:${id}`, '1', { nx: true, ex: 90000 }));
  if (alreadyLiked) return res.status(409).json({ error: '이미 공감한 방울이에요' });

  const newLikes = await redis.hincrby(`bubble:${id}`, 'likes', 1);
  // 본인 열람용 복사본에도 반영
  await redis.hincrby(`my-bubble:${id}`, 'likes', 1).catch(() => {});

  return res.status(200).json({ likes: newLikes });
}
