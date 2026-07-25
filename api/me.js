// GET  /api/me  — 내 방울함 데이터
// POST /api/me  — 닉네임 리롤 또는 방울 즉시 삭제

import { redis, setCors, nowKST } from './_lib/redis.js';
import { generateNickname } from './_lib/nickname.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const anonKey = req.headers['x-anon-key'];
  if (!anonKey) return res.status(400).json({ error: 'x-anon-key required' });

  if (req.method === 'GET') {
    const [nick, ids] = await Promise.all([
      redis.hget(`user:${anonKey}`, 'nick'),
      redis.smembers(`mybubbles:${anonKey}`),
    ]);

    const displayNick = nick || generateNickname();

    if (!ids || ids.length === 0) {
      return res.status(200).json({
        nick: displayNick,
        totalLikes: 0,
        weekMoods: {},
        bubbles: [],
      });
    }

    const pipeline = redis.pipeline();
    for (const id of ids) pipeline.hgetall(`my-bubble:${id}`);
    const results = await pipeline.exec();

    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
    let totalLikes = 0;
    const weekMoods = {};
    const bubbles = [];

    for (let i = 0; i < ids.length; i++) {
      const b = results[i];
      if (!b) continue;
      const createdAt = Number(b.createdAt) || 0;
      const likes = Number(b.likes) || 0;
      totalLikes += likes;
      if (createdAt > sevenDaysAgo && b.mood) {
        weekMoods[b.mood] = (weekMoods[b.mood] || 0) + 1;
      }
      // 원본 방울 생존 여부로 소멸 판단
      const liveInSky = await redis.exists(`bubble:${ids[i]}`);
      bubbles.push({
        id: ids[i],
        mood: b.mood,
        text: b.text || '',
        likes,
        createdAt,
        expired: !liveInSky,
      });
    }

    bubbles.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({ nick: displayNick, totalLikes, weekMoods, bubbles });
  }

  if (req.method === 'POST') {
    const { action, id } = req.body || {};

    if (action === 'reroll') {
      const newNick = generateNickname();
      await redis.hset(`user:${anonKey}`, { nick: newNick });
      return res.status(200).json({ nick: newNick });
    }

    if (action === 'delete' && id) {
      // 내 방울인지 확인
      const owner = await redis.hget(`bubble:${id}`, 'anonKey');
      if (owner !== anonKey) return res.status(403).json({ error: '내 방울만 삭제할 수 있어요' });
      const pipeline = redis.pipeline();
      pipeline.del(`bubble:${id}`);
      pipeline.zrem('bubbles:zset', id);
      await pipeline.exec();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'action 값이 올바르지 않아요' });
  }

  return res.status(405).end();
}
