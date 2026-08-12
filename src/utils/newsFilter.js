// 뉴스 목록 정리 — 같은 소식 중복 제거 + 보도자료 인용 기사 제외.
// 브라우저 API에 의존하지 않는 순수 함수만 둔다(그래야 따로 돌려보고 검증할 수 있다).

// 구글 뉴스 RSS 제목은 "본문 제목 - 매체명" 형태다. 중복 판정에는 매체명이 방해가 된다.
const stripSource = (title) => title.replace(/\s+[-–—]\s+[^-–—]+$/, "").trim();

// 괄호·기호·공백을 지운 비교용 문자열. '스마T움'과 '스마티움'처럼
// 한두 글자만 다른 같은 기사를 잡으려고 완전일치 대신 유사도를 쓴다.
const normalize = (title) =>
  stripSource(title)
    .replace(/[[\](){}<>'"''""·…,.\-–—!?%]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const bigrams = (s) => {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
};

// Dice 계수. 1이면 같은 문자열, 0이면 겹치는 두 글자 조합이 없다.
export const similarity = (a, b) => {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
};

const DUP_THRESHOLD = 0.75;

// 앞에 나온 기사와 제목이 거의 같으면 뒤엣것을 버린다.
// 구글 뉴스가 준 순서를 그대로 존중해 먼저 나온 것을 남긴다.
export const dedupe = (articles) => {
  const kept = [];
  for (const a of articles) {
    const n = normalize(a.title);
    if (kept.some((k) => similarity(normalize(k.title), n) >= DUP_THRESHOLD)) continue;
    kept.push(a);
  }
  return kept;
};

// 지자체·기관 보도자료를 지역지가 그대로 받아쓴 기사를 걸러낸다.
// 오탐(멀쩡한 기사를 버리는 것)이 더 나쁘므로 확실한 신호만 넣는다.
// '개최', '모집', '공모'처럼 일반 기사에도 흔한 말은 일부러 뺐다.
const PR_PATTERNS = [
  // 지자체가 제목에 등장하는 경우. 앞에 2~4글자를 요구해서 '도시'처럼
  // 우연히 '시'로 끝나는 낱말이 걸리지 않게 한다. '수원특례시'도 잡는다.
  /[가-힣]{2,4}(특례시|시|군|구)(청)?[,\s]/,
  /제\s?\d+회/,                      // 제23회
  /개막/, /위촉/, /간담회/, /설명회/, /경진대회/, /박람회/,
  // 보도자료 특유의 홍보 문구. 일반 기사에서는 거의 안 쓰인다.
  /쾌거/, /새지평/, /1번지/, /척척/,
];

export const isPressRelease = (title) => {
  const t = stripSource(title);
  return PR_PATTERNS.some((re) => re.test(t));
};

// 중복 제거 → 보도자료 제외 순서로 정리한다.
export const refine = (articles) =>
  dedupe(articles).filter((a) => !isPressRelease(a.title));
