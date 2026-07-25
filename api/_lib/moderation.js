// 금칙어 필터 + 자살/자해 신호 감지.
// containsBlockedWord: 등록 차단 (false positive 허용을 낮추기 위해 범위를 좁게 유지).
// containsCrisisSignal: 차단하지 않고 작성자에게 상담 배너만 노출 (기획 F5).
const BLOCKLIST = [
  '씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새끼', '개새', '좆', '지랄',
  '미친놈', '미친년', '죽어', '꺼져', '걸레', '창녀', '새끼',
  'fuck', 'shit', 'bitch',
  '죽고싶', '자살', '살기싫',
];

// 게시는 허용하되 작성자에게만 상담 안내 배너를 노출하는 신호어.
const CRISIS_SIGNALS = [
  '죽고싶', '자살', '살기싫', '죽어버리고', '사라지고싶', '없어지고싶',
  '자해', '손목', '극단적', '끝내고싶',
];

export function containsBlockedWord(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase().replace(/\s+/g, '');
  return BLOCKLIST.some((word) => normalized.includes(word.toLowerCase()));
}

export function containsCrisisSignal(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase().replace(/\s+/g, '');
  return CRISIS_SIGNALS.some((word) => normalized.includes(word.toLowerCase()));
}
