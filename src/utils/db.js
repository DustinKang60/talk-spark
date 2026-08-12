import { CLIENT_TOKEN } from "./apiToken";
import { refine } from "./newsFilter";

const AUTH_HEADERS = { "X-TalkSpark-Client": CLIENT_TOKEN };

// 서버가 403을 주면 기기에 남은 '옛 버전'이 인증 토큰을 안 보내고 있다는 뜻이다.
// 화면에서 "네트워크 문제"가 아니라 "앱이 오래됐다"로 정확히 안내하려고 따로 구분한다.
export class StaleClientError extends Error {
  constructor() {
    super("STALE_CLIENT");
    this.name = "StaleClientError";
  }
}

// 즐겨찾기(저장된 논쟁거리) 관리 — debate 객체 전체를 저장
export const getSavedDebates = () => {
  try {
    return JSON.parse(localStorage.getItem("talkspark_saved") || "[]");
  } catch {
    return [];
  }
};

export const isSaved = (debateId) =>
  getSavedDebates().some((d) => d.id === debateId);

export const toggleSaved = (debate) => {
  const saved = getSavedDebates();
  const idx = saved.findIndex((d) => d.id === debate.id);
  if (idx > -1) {
    saved.splice(idx, 1);
  } else {
    saved.unshift(debate);
    if (saved.length > 60) saved.pop();
  }
  localStorage.setItem("talkspark_saved", JSON.stringify(saved));
  return saved;
};

// 구글 뉴스 피드
const isNative =
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

const getRssUrl = (path) =>
  isNative
    ? `https://news.google.com/rss${path}`
    : `/api/rss?path=${encodeURIComponent(path)}`;

const clean = (str) =>
  (str || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*34;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();

const parseRss = (xml, category, idPrefix, limit = 10) => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = doc.getElementsByTagName("item");
  if (!items.length) throw new Error("RSS 아이템 없음");
  const result = [];
  const count = Math.min(items.length, limit);
  for (let i = 0; i < count; i++) {
    const item = items[i];
    result.push({
      id: `${idPrefix}_${i}`,
      title: clean(item.getElementsByTagName("title")[0]?.textContent),
      summary: clean(item.getElementsByTagName("description")[0]?.textContent),
      link: item.getElementsByTagName("link")[0]?.textContent || "",
      pubDate: item.getElementsByTagName("pubDate")[0]?.textContent || "",
      category,
    });
  }
  return result;
};

// 네이버 랭킹뉴스 — 사람들이 실제로 많이 본 순서다.
// 검색 API(sort=date)는 갓 올라온 기사를 시간순으로 줄 뿐이라 관심도와 무관했다.
const rankUrl = (tab) =>
  isNative
    ? `https://talk-spark-eta.vercel.app/api/naver-rank?tab=${tab}`
    : `/api/naver-rank?tab=${tab}`;

// 랭킹은 네이버 HTML을 파싱해 얻는다. 구조가 바뀌면 서버가 502를 주므로
// 그때는 기존 방식(fallback)으로 조용히 되돌아간다. 앱이 멈추지는 않게.
const fetchRanked = async (tab, category, idPrefix, fallback) => {
  try {
    const res = await fetch(rankUrl(tab), { headers: AUTH_HEADERS });
    if (res.status === 403) throw new StaleClientError();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error("빈 목록");
    return data.items.map((it, i) => ({
      id: `${idPrefix}_${i}`,
      title: clean(it.title),
      summary: clean(it.summary || ""),
      link: it.link,
      pubDate: "",
      category,
    }));
  } catch (e) {
    if (e instanceof StaleClientError) throw e;   // 화면에서 따로 안내
    console.warn(`랭킹 로드 실패(${tab}) — 기존 방식으로 전환:`, e);
    return fallback();
  }
};

const fetchTopNewsRss = async () => {
  const url = getRssUrl("?hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (res.status === 403) throw new StaleClientError();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), "헤드라인", "gnews_top");
  } catch (e) {
    if (e instanceof StaleClientError) throw e;
    console.error("뉴스 로드 실패:", e);
    return [];
  }
};

export const fetchTopNews = () =>
  fetchRanked("headline", "헤드라인", "rank_top", fetchTopNewsRss);

export const fetchEntertainmentNews = () =>
  fetchRanked("entertainment", "연예·문화", "rank_ent", fetchEntertainmentNewsSearch);

const fetchEntertainmentNewsSearch = async () => {
  const queries = ["드라마", "영화", "가수", "탤런트", "배우", "예능"];
  const baseUrl = isNative
    ? "https://talk-spark-eta.vercel.app/api/naver-news"
    : "/api/naver-news";
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await fetch(`${baseUrl}?query=${encodeURIComponent(q)}`, { headers: AUTH_HEADERS });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.items) return [];
        return data.items.slice(0, 2).map((item, i) => ({
          id: `naver_ent_${q}_${i}`,
          title: clean(item.title),
          summary: clean(item.description),
          link: item.originallink || item.link,
          pubDate: item.pubDate || "",
          category: "연예·문화",
        }));
      } catch { return []; }
    })
  );
  return results.flat();
};

export const fetchAiNews = async () => {
  const url = getRssUrl("/search?q=인공지능+AI&hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (res.status === 403) throw new StaleClientError();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 중복·보도자료를 걷어내면 건수가 줄므로 넉넉히 파싱한 뒤 걸러서 10건을 채운다.
    return refine(parseRss(await res.text(), "AI·기술", "gnews_ai", 40)).slice(0, 10);
  } catch (e) {
    if (e instanceof StaleClientError) throw e;
    console.error("AI 뉴스 로드 실패:", e);
    return [];
  }
};

// 키워드 관리
const DEFAULT_KEYWORDS = [];

export const getKeywords = () => {
  try {
    const stored = localStorage.getItem("talkspark_keywords");
    if (stored === null) {
      localStorage.setItem("talkspark_keywords", JSON.stringify(DEFAULT_KEYWORDS));
      return DEFAULT_KEYWORDS;
    }
    return JSON.parse(stored);
  } catch { return DEFAULT_KEYWORDS; }
};

export const saveKeywords = (keywords) => {
  localStorage.setItem("talkspark_keywords", JSON.stringify(keywords.slice(0, 15)));
};

export const addKeyword = (kw) => {
  const trimmed = kw.trim();
  if (!trimmed) return getKeywords();
  const list = getKeywords();
  if (list.includes(trimmed) || list.length >= 15) return list;
  const next = [...list, trimmed];
  saveKeywords(next);
  return next;
};

export const removeKeyword = (kw) => {
  const next = getKeywords().filter((k) => k !== kw);
  saveKeywords(next);
  return next;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const parseNaverNews = (data, keyword, idPrefix) => {
  if (!data.items || !data.items.length) return [];
  const now = Date.now();
  return data.items
    .map((item, i) => ({
      id: `${idPrefix}_${i}`,
      title: clean(item.title),
      summary: clean(item.description),
      link: item.originallink || item.link,
      pubDate: item.pubDate || "",
      category: keyword,
    }))
    .filter((article) => {
      if (!article.pubDate) return false;
      return now - new Date(article.pubDate).getTime() <= THREE_DAYS_MS;
    });
};

export const fetchKeywordNews = async () => {
  const keywords = getKeywords();
  if (keywords.length === 0) return [];
  const baseUrl = isNative
    ? "https://talk-spark-eta.vercel.app/api/naver-news"
    : "/api/naver-news";
  let sawStaleClient = false;
  const results = await Promise.all(
    keywords.map(async (kw) => {
      try {
        const res = await fetch(`${baseUrl}?query=${encodeURIComponent('"' + kw + '"')}`, { headers: AUTH_HEADERS });
        if (res.status === 403) { sawStaleClient = true; return []; }
        if (!res.ok) return [];
        const data = await res.json();
        return parseNaverNews(data, kw, `naver_kw_${kw}`);
      } catch { return []; }
    })
  );
  if (sawStaleClient) throw new StaleClientError();
  return results.flat();
};

export const fetchWorldNews = () =>
  fetchRanked("world", "세계", "rank_world", fetchWorldNewsRss);

const fetchWorldNewsRss = async () => {
  const url = getRssUrl("/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url, { headers: AUTH_HEADERS });
    if (res.status === 403) throw new StaleClientError();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), "세계", "gnews_world");
  } catch (e) {
    if (e instanceof StaleClientError) throw e;
    console.error("세계 뉴스 로드 실패:", e);
    return [];
  }
};
