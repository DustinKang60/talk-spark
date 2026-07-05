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

export const fetchTopNews = async () => {
  const url = getRssUrl("?hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), "헤드라인", "gnews_top");
  } catch (e) {
    console.error("뉴스 로드 실패:", e);
    return [];
  }
};

export const fetchAiNews = async () => {
  const url = getRssUrl("/search?q=인공지능+AI&hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), "AI·기술", "gnews_ai");
  } catch (e) {
    console.error("AI 뉴스 로드 실패:", e);
    return [];
  }
};

// 키워드 관리
const DEFAULT_KEYWORDS = [
  "KCB", "코리아크레딧뷰로", "신용평점", "신용점수", "신용평가",
  "신용정보원", "금융감독원 신용", "마이데이터", "신용회복위원회", "올크레딧", "오케이네임"
];

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

const SEEN_KEY = "talkspark_seen_articles";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const getSeenArticles = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch { return {}; }
};

const markArticlesSeen = (links) => {
  const seen = getSeenArticles();
  const now = Date.now();
  links.forEach((link) => { seen[link] = now; });
  // 7일 지난 항목 정리
  Object.keys(seen).forEach((k) => {
    if (now - seen[k] > 7 * 24 * 60 * 60 * 1000) delete seen[k];
  });
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
};

const parseNaverNews = (data, keyword, idPrefix) => {
  if (!data.items || !data.items.length) return [];
  const now = Date.now();
  const seen = getSeenArticles();
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
      const age = now - new Date(article.pubDate).getTime();
      if (age > THREE_DAYS_MS) return false;
      if (seen[article.link]) return false;
      return true;
    });
};

export const fetchKeywordNews = async () => {
  const keywords = getKeywords();
  if (keywords.length === 0) return [];
  const baseUrl = isNative
    ? "https://talk-spark-eta.vercel.app/api/naver-news"
    : "/api/naver-news";
  const results = await Promise.all(
    keywords.map(async (kw) => {
      try {
        const res = await fetch(`${baseUrl}?query=${encodeURIComponent('"' + kw + '"')}`);
        if (!res.ok) return [];
        const data = await res.json();
        return parseNaverNews(data, kw, `naver_kw_${kw}`);
      } catch { return []; }
    })
  );
  const articles = results.flat();
  markArticlesSeen(articles.map((a) => a.link));
  return articles;
};

export const fetchWorldNews = async () => {
  const url = getRssUrl("/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text(), "세계", "gnews_world");
  } catch (e) {
    console.error("세계 뉴스 로드 실패:", e);
    return [];
  }
};
