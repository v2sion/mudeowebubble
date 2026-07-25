// 비눗방울 테마 닉네임 자동 생성기.
// 감정 웰니스 앱 톤에 맞게 부드럽고 감성적인 조합.
const ADJECTIVES = [
  '몽글몽글', '포근한', '두근두근', '반짝이는', '잔잔한',
  '살랑살랑', '포슬포슬', '보글보글', '느긋한', '따뜻한',
  '새근새근', '나른한', '설레는', '촉촉한', '맑은',
];
const NOUNS = [
  '솜사탕', '구름술사', '딸기우유', '별사탕', '빗방울',
  '바람개비', '비눗방울', '물방울', '아이스크림', '봄눈송이',
  '민들레씨', '달빛요정', '무지개토끼', '구름고양이', '하늘부표',
];

export function generateNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}
