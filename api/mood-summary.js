// GET /api/mood-summary
// 최근 3시간 방울의 기분 분포 집계. s-maxage=120 (2분 캐시).

import { redis, setCors } from './_lib/redis.js';

const MOOD_TIPS = {
  joy:     '다들 기분 좋은 하루를 보내고 있나 봐요',
  flutter: '설레는 방울이 유독 많은 하늘이에요',
  calm:    '평온한 방울이 하늘을 채우고 있어요',
  tired:   '다들 지친 하루를 보내고 있나 봐요',
  blue:    '조금 가라앉은 방울이 많은 하늘이에요',
  angry:   '오늘따라 화가 난 방울이 많네요',
  heat:    '다들 더위에 지쳐있어요',
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
  const ids = await redis.zrange('bubbles:zset', threeHoursAgo, '+inf', { byScore: true });

  if (!ids || ids.length === 0) {
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30');
    return res.status(200).json({ topMood: null, pct: 0, tip: '', counts: {} });
  }

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hget(`bubble:${id}`, 'mood');
  const moods = await pipeline.exec();

  const counts = {};
  for (const mood of moods) {
    if (mood) counts[mood] = (counts[mood] || 0) + 1;
  }

  let topMood = null;
  let topCount = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > topCount) { topMood = k; topCount = c; }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = total > 0 ? Math.round((topCount / total) * 100) : 0;

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30');
  return res.status(200).json({
    topMood,
    pct,
    tip: MOOD_TIPS[topMood] || '',
    counts,
    total,
  });
}
