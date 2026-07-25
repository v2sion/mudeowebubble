// POST /api/bubble
// 방울 등록. 쿨다운 10분, 금칙어 필터, 자살/자해 신호 감지.

import { redis, setCors } from './_lib/redis.js';
import { containsBlockedWord, containsCrisisSignal } from './_lib/moderation.js';
import { generateNickname } from './_lib/nickname.js';

const VALID_MOODS = ['joy', 'flutter', 'calm', 'tired', 'blue', 'angry', 'heat'];
const MAX_TEXT = 20;
const COOLDOWN_S = 600;
const BUBBLE_TTL_S = 86400;
const MY_BUBBLE_TTL_S = 86400 * 30;

function nanoid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const anonKey = req.headers['x-anon-key'];
  if (!anonKey) return res.status(400).json({ error: 'x-anon-key required' });

  const { mood, text = '', region = '' } = req.body || {};

  if (!VALID_MOODS.includes(mood)) {
    return res.status(400).json({ error: '유효하지 않은 기분 값이에요' });
  }
  const trimmedText = String(text).trim().slice(0, MAX_TEXT);
  if (containsBlockedWord(trimmedText)) {
    return res.status(422).json({ error: '이 표현은 방울에 담을 수 없어요', blocked: true });
  }

  // 자살/자해 신호 감지 → 게시는 허용, 클라이언트 배너용 플래그 저장
  let crisis = false;
  if (containsCrisisSignal(trimmedText)) {
    crisis = true;
    await redis.set(`crisis:${anonKey}`, '1', { ex: 3600 });
  }

  // 쿨다운 체크 (검증은 항상 상태 변경 전에)
  const banCheck = await redis.hget(`user:${anonKey}`, 'banned');
  if (banCheck === '1') return res.status(403).json({ error: '작성이 제한된 계정이에요' });

  const cooldownOk = await redis.set(`cooldown:${anonKey}`, '1', { nx: true, ex: COOLDOWN_S });
  if (!cooldownOk) {
    const ttl = await redis.ttl(`cooldown:${anonKey}`);
    return res.status(429).json({ error: '마음 방울은 10분에 1개예요', retryAfterSec: ttl });
  }

  // 닉네임 조회 또는 생성
  let nick = await redis.hget(`user:${anonKey}`, 'nick');
  if (!nick) {
    nick = generateNickname();
    await redis.hset(`user:${anonKey}`, { nick, createdAt: Date.now() });
  }

  const id = nanoid();
  const createdAt = Date.now();
  const bubbleData = {
    mood,
    text: trimmedText,
    nick,
    region: String(region).slice(0, 20),
    likes: 0,
    hidden: 0,
    reported: 0,
    anonKey,
    createdAt,
    src: '',
  };

  const pipeline = redis.pipeline();
  pipeline.hset(`bubble:${id}`, bubbleData);
  pipeline.expire(`bubble:${id}`, BUBBLE_TTL_S);
  pipeline.zadd('bubbles:zset', { score: createdAt, member: id });
  // 본인 열람용 복사본 (30일 보관 — 원본 소멸 후에도 내 방울함에 표시)
  pipeline.hset(`my-bubble:${id}`, { ...bubbleData, id });
  pipeline.expire(`my-bubble:${id}`, MY_BUBBLE_TTL_S);
  pipeline.sadd(`mybubbles:${anonKey}`, id);
  pipeline.expire(`mybubbles:${anonKey}`, MY_BUBBLE_TTL_S);
  await pipeline.exec();

  return res.status(200).json({ id, nick, mood, createdAt, crisis });
}
