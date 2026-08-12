// 네이버 랭킹뉴스·섹션 페이지에서 '사람들이 실제로 많이 본' 기사를 뽑아낸다.
//
// 왜 이렇게 하나: 검색 API(sort=date)는 갓 올라온 기사를 시간순으로 줄 뿐이라
// 관심도와 무관하다. 랭킹뉴스는 네이버가 조회수·댓글수로 집계한 결과라
// "사람들이 지금 무슨 이야기를 하는가"에 훨씬 가깝다.
//
// 공식 API가 아니라 HTML 파싱이다. 네이버가 구조를 바꾸면 깨지므로,
// 호출하는 쪽에서 반드시 기존 방식으로 후퇴할 수 있게 해 둘 것.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

const RANKING_URLS = [
  "https://news.naver.com/main/ranking/popularDay.naver",   // 많이 본
  "https://news.naver.com/main/ranking/popularMemo.naver",  // 댓글 많은
];

// 네이버 뉴스는 아직 euc-kr로 내려온다. 그냥 text()로 읽으면 한글이 깨진다.
async function getHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 2000).toString("latin1");
  const charset = /charset=["']?([\w-]+)/i.exec(head)?.[1] || "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

const decodeEntities = (s) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// "6시간전", "3분전", "1일전" → 시간 단위 숫자. 모르면 null.
function parseAgeHours(text) {
  if (!text) return null;
  const m = /(\d+)\s*(분|시간|일)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const hours = m[2] === "분" ? n / 60 : m[2] === "시간" ? n : n * 24;
  return Math.round(hours * 10) / 10;
}

// 비교용 정규화 — 매체명·기호·공백을 없앤다. src/utils/newsFilter.js 와 같은 규칙.
const normalize = (title) =>
  title
    .replace(/\s+[-–—]\s+[^-–—]+$/, "")
    .replace(/[[\](){}<>'"''""·…,.\-–—!?%㎏㎞\s]/g, "")
    .toLowerCase();

function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

// Dice 계수. 같은 사안을 다른 매체가 조금씩 다르게 쓴 제목을 묶으려고 쓴다.
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}

// 검색으로 모은 제목은 매체마다 표현 차이가 커서 Dice 만으로는 같은 사안을 못 묶는다.
// (하영 친일 건이 네 줄로 남았다.) 그래서 '핵심 낱말이 얼마나 겹치는가'를 같이 본다.
const PARTICLES = /(으로|에서|에게|부터|까지|이나|라며|라고|한다|했다|하는|이란|은|는|이|가|을|를|에|의|로|와|과|도|만)$/;

function tokens(title) {
  return new Set(
    title
      .replace(/\s+[-–—]\s+[^-–—]+$/, "")
      .split(/[^가-힣A-Za-z0-9]+/)
      .filter((w) => w.length >= 2)
      .map((w) => (w.length > 2 ? w.replace(PARTICLES, "") : w))
      .filter((w) => w.length >= 2)
  );
}

// 짧은 쪽 기준 겹침 비율. 제목 길이가 크게 달라도 같은 사안을 잡아낸다.
function sameStory(titleA, titleB) {
  // 0.35로는 같은 교통사고를 다르게 쓴 두 제목이 안 묶였다
  // ("갑자기 덤프트럭이…대학생 3명 사망" / "영화촬영 후 귀가하던 예술대생 3명 사망").
  if (similarity(normalize(titleA), normalize(titleB)) >= 0.3) return true;
  const A = tokens(titleA), B = tokens(titleB);
  if (!A.size || !B.size) return false;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  // 낱말 3개 이상이 겹치고, 짧은 쪽의 절반 이상을 덮으면 같은 사안으로 본다.
  return shared >= 3 && shared / Math.min(A.size, B.size) >= 0.5;
}

// 랭킹 목록: <a href="…/article/055/0001380084" class="list_title …">제목</a><span class="list_time">6시간전</span>
export function parseRanking(html) {
  const re =
    /<a href="(https:\/\/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\/(\d+)[^"]*)"[^>]*class="list_title[^"]*"[^>]*>([^<]+)<\/a>\s*<span class="list_time[^"]*">([^<]*)</g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({
      link: m[1].split("?")[0],
      oid: m[2],
      aid: m[3],
      title: decodeEntities(m[4]),
      ageHours: parseAgeHours(m[5]),
    });
  }
  return out;
}

// 섹션 기사 목록: data-imp-url 에 기사 주소가, 바로 뒤 <strong class="sa_text_strong"> 에 제목,
// 이어지는 <div class="sa_text_lede"> 에 요약이 있다(랭킹 목록에는 요약이 없다).
export function parseSection(html) {
  const re =
    /data-imp-url="(https:\/\/n\.news\.naver\.com\/(?:mnews\/)?article\/(\d+)\/(\d+))"[^>]*>\s*<strong class="sa_text_strong">([^<]+)<\/strong>\s*<\/a>\s*(?:<div class="sa_text_lede">([^<]*)<)?/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({
      link: m[1],
      oid: m[2],
      aid: m[3],
      title: decodeEntities(m[4]),
      summary: m[5] ? decodeEntities(m[5]) : "",
    });
  }
  return out;
}

const MAX_AGE_HOURS = 48;
// 0.6은 같은 사안도 못 묶었다("하영 증조부 친일행적…" / "하영 증조부 친일 행적…(종합)").
// 0.4까지 내리면 과하게 합쳐질 위험이 있어 0.45로 둔다.
const CLUSTER_THRESHOLD = 0.45;

async function loadRankingPool() {
  const pages = await Promise.all(RANKING_URLS.map((u) => getHtml(u).catch(() => "")));
  return pages.flatMap((html) => (html ? parseRanking(html) : []));
}

// 헤드라인 — 여러 언론사 랭킹에 동시에 오른 사안일수록 전국적으로 화제라고 본다.
// 묶인 기사 수를 그대로 점수로 쓴다.
export async function buildHeadline(limit = 10) {
  const pool = (await loadRankingPool()).filter(
    (a) => a.ageHours === null || a.ageHours <= MAX_AGE_HOURS
  );
  if (!pool.length) throw new Error("랭킹 목록이 비어 있음");

  const clusters = [];
  for (const item of pool) {
    const n = normalize(item.title);
    const hit = clusters.find((c) => similarity(c.norm, n) >= CLUSTER_THRESHOLD);
    if (hit) hit.score += 1;
    else clusters.push({ ...item, norm: n, score: 1 });
  }
  clusters.sort((a, b) => b.score - a.score);
  return pickDistinct(clusters, limit).map(({ norm, ...rest }) => rest);
}

// 묶기 기준(0.45)을 통과해 살아남은 '같은 사안'이 화면에 두 줄로 보이는 일이 있었다
// (하영 친일 건, 프란체스카 홍 건). 실제로 보여줄 10건 안에서만 더 느슨하게
// 한 번 더 거른다. 대상이 적어서 과하게 합쳐질 위험은 작다.
function pickDistinct(sorted, limit) {
  const picked = [];
  for (const item of sorted) {
    if (picked.some((p) => sameStory(p.title, item.title))) continue;
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

// 연예·문화 — 네이버 연예는 페이지 전체가 자바스크립트로 그려져 HTML 파싱이 안 된다.
// 대신 검색으로 연예 기사 풀을 만들고, 전국 랭킹에 오른 것을 위로 올린다.
// (생활/문화 섹션을 쓰면 날씨·건강 기사가 올라와 탭 이름과 어긋난다.)
const ENT_QUERIES = ["드라마", "영화", "가수", "탤런트", "배우", "예능"];

// 연예 검색에 섞여 들어오는 잡음.
// 칼럼·리뷰는 대화거리가 아니고, '탤런트링크'(인력 플랫폼 회사)처럼
// 키워드가 회사 이름에 걸려 들어오는 기업 소식도 연예 기사가 아니다.
const ENT_NOISE = [
  /^\s*\[(opinion|review|칼럼|사설|기고|독자|포토|영상)\]/i,
  /탤런트링크/,
  /투자\s?유치|시리즈\s?[A-C]\s?투자|코스닥\s?상장|MOU\s?체결/,
];

async function searchNews(query) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("네이버 API 자격증명 없음");
  // 따옴표로 정확히 일치시킨다. 그냥 '배우'로 넣으면 '배우자'가 걸려
  // 연예 탭에 법조 기사가 섞여 들어왔다.
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(`"${query}"`)}&display=30&sort=sim`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((it) => ({
    title: decodeEntities(it.title.replace(/<[^>]*>/g, "")),
    summary: decodeEntities(it.description.replace(/<[^>]*>/g, "")),
    link: it.link || it.originallink,
    pubDate: it.pubDate || "",
  }));
}

export async function buildEntertainment(limit = 10) {
  const [pool, ...groups] = await Promise.all([
    loadRankingPool().catch(() => []),
    ...ENT_QUERIES.map((q) => searchNews(q).catch(() => [])),
  ]);
  if (!groups.some((g) => g.length)) throw new Error("연예 검색 결과 없음");

  const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
  const fresh = (list) =>
    list.filter((a) => {
      if (ENT_NOISE.some((re) => re.test(a.title))) return false;
      if (!a.pubDate) return true;
      const t = new Date(a.pubDate).getTime();
      return Number.isNaN(t) || t >= cutoff;
    });

  const score = (a) => {
    const hit = pool.find((r) => sameStory(r.title, a.title));
    return { ...a, score: hit ? 1 : 0, ageHours: hit?.ageHours ?? null };
  };

  // 키워드별로 그대로 이어붙이면 첫 키워드(드라마)가 목록을 다 차지했다.
  // 랭킹에 오른 것을 먼저 놓고, 나머지는 키워드를 번갈아 가며 채운다.
  const scoredGroups = groups.map((g) => fresh(g).map(score));
  const ranked = scoredGroups.flat().filter((a) => a.score > 0);
  const rest = [];
  for (let i = 0; ; i++) {
    const row = scoredGroups.map((g) => g.filter((a) => !a.score)[i]).filter(Boolean);
    if (!row.length) break;
    rest.push(...row);
  }
  return pickDistinct([...ranked, ...rest], limit);
}

// 부문 탭 — 그 섹션 기사 중 전국 랭킹에도 오른 것을 위로 올리고,
// 모자라는 자리는 같은 섹션의 나머지 기사로 채운다(탭이 비지 않게).
export async function buildSection(sectionId, limit = 10) {
  const [sectionHtml, pool] = await Promise.all([
    getHtml(`https://news.naver.com/section/${sectionId}`),
    loadRankingPool().catch(() => []),
  ]);
  const articles = parseSection(sectionHtml);
  if (!articles.length) throw new Error("섹션 목록이 비어 있음");

  const ranked = pool.map((r) => ({ norm: normalize(r.title), age: r.ageHours }));
  const scored = articles.map((a) => {
    const n = normalize(a.title);
    const hit = ranked.find((r) => similarity(r.norm, n) >= CLUSTER_THRESHOLD);
    return { ...a, score: hit ? 1 : 0, ageHours: hit?.age ?? null };
  });
  // 랭킹에 오른 것 먼저, 그 안에서는 섹션이 준 순서를 유지한다.
  scored.sort((a, b) => b.score - a.score);
  return pickDistinct(scored, limit);
}
