import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

export function todayKeyKST(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function nowKST(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-anon-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
