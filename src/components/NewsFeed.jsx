import React, { useState, useEffect } from "react";
import { fetchTopNews, fetchAiNews, fetchWorldNews, fetchKeywordNews, fetchEntertainmentNews, getKeywords, addKeyword, removeKeyword, StaleClientError } from "../utils/db";
import { summarizeArticle } from "../utils/claude";

const STATIC_TABS = [
  { id: "headline", label: "헤드라인", fetch: fetchTopNews },
  { id: "entertainment", label: "연예·문화", fetch: fetchEntertainmentNews },
  { id: "ai", label: "AI·기술", fetch: fetchAiNews },
  { id: "world", label: "세계", fetch: fetchWorldNews },
];

function KeywordManager({ onClose, onChanged }) {
  const [keywords, setKeywords] = useState(getKeywords());
  const [input, setInput] = useState("");

  const handleAdd = () => {
    if (!input.trim()) return;
    const next = addKeyword(input.trim());
    setKeywords(next);
    setInput("");
    onChanged();
  };

  const handleRemove = (kw) => {
    const next = removeKeyword(kw);
    setKeywords(next);
    onChanged();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
      display: "flex", alignItems: "flex-end",
    }} onClick={onClose}>
      <div style={{
        background: "#131f35", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px",
        width: "100%", maxHeight: "70vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>키워드 관리</div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "18px" }}>
          × 로 삭제 · 최대 15개 ({keywords.length}/15)
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {keywords.length === 0 && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>등록된 키워드가 없습니다.</p>
          )}
          {keywords.map((kw) => (
            <div key={kw} style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 12px", borderRadius: "16px",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "13px", color: "rgba(255,255,255,0.75)",
            }}>
              {kw}
              <span onClick={() => handleRemove(kw)} style={{
                color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "15px", lineHeight: 1,
              }}>×</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="새 키워드 추가..."
            style={{
              flex: 1, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(0,242,254,0.4)", borderRadius: "8px",
              padding: "9px 12px", color: "#fff", fontSize: "14px", outline: "none",
            }}
          />
          <button onClick={handleAdd} style={{
            background: "var(--accent-cyan)", color: "#0d1a2e", border: "none",
            borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: "700", cursor: "pointer",
          }}>추가</button>
        </div>

        <button onClick={onClose} style={{
          width: "100%", marginTop: "14px", padding: "12px",
          borderRadius: "10px", background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)",
          fontSize: "14px", cursor: "pointer",
        }}>닫기</button>
      </div>
    </div>
  );
}

export default function NewsFeed({ onSelectNews, apiKey }) {
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem("ts_active_tab") || "headline"
  );
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);   // null | "load"(못 불러옴) | "stale"(기기에 남은 옛 버전)
  const [showManager, setShowManager] = useState(false);
  const [keywords, setKeywords] = useState(getKeywords());
  const [summaries, setSummaries] = useState({});   // newsId → { text, loading, error }
  const [copied, setCopied] = useState(null);
  const [pullY, setPullY] = useState(0);   // pull-to-refresh 당긴 거리
  const touchStartY = React.useRef(0);
  const pullArmed = React.useRef(false);   // 맨 위에서 시작한 당김만 새로고침으로 친다

  const loadTab = (tabId) => {
    setLoading(true);
    setError(null);
    const staticTab = STATIC_TABS.find((t) => t.id === tabId);
    const fetcher = staticTab ? staticTab.fetch : fetchKeywordNews;
    fetcher().then((data) => {
      setError(data.length === 0 ? "load" : null);
      setCache((prev) => ({ ...prev, [tabId]: data }));
      setLoading(false);
    }).catch((e) => {
      // 403은 기기에 남은 옛 코드가 원인 → 네트워크 탓으로 안내하면 사용자가 헤맨다
      setError(e instanceof StaleClientError ? "stale" : "load");
      setLoading(false);
    });
  };

  // 옛 버전에 갇힌 기기를 되살린다. 캐시된 코드만 지우므로
  // 보관함·키워드·API 키(localStorage)는 그대로 남는다.
  const handleUpdateApp = async () => {
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* 지우지 못해도 새로고침은 시도한다 */ }
    window.location.reload();
  };

  useEffect(() => {
    if (cache[activeTab]) return;
    loadTab(activeTab);
  }, [activeTab]);

  // 실제로 스크롤되는 것은 .app-content 다(body는 overflow:hidden).
  // window.scrollY 를 보던 옛 코드는 언제나 0이라 방어가 되지 않았고,
  // 목록 맨 아래에서 손가락을 아래로 내리면 당김으로 잡혀 새로고침이 걸렸다.
  // 그래서 맨 밑까지 내려간 뒤 조금만 올리면 첫 기사로 튀어 올랐다.
  const scrollerOf = (el) => el?.closest(".app-content") ?? null;

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    const scroller = scrollerOf(e.currentTarget);
    // 손을 댄 순간 목록이 맨 위에 있을 때만 당김으로 친다.
    pullArmed.current = !scroller || scroller.scrollTop <= 0;
  };

  const handleTouchMove = (e) => {
    if (!pullArmed.current) return;
    const scroller = scrollerOf(e.currentTarget);
    if (scroller && scroller.scrollTop > 0) {
      pullArmed.current = false;
      setPullY(0);
      return;
    }
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setPullY(Math.min(dy, 80));
  };

  const handleTouchEnd = () => {
    if (pullArmed.current && pullY >= 60) {
      setCache((prev) => ({ ...prev, [activeTab]: undefined }));
      loadTab(activeTab);
    }
    pullArmed.current = false;
    setPullY(0);
  };

  const handleKeywordChanged = () => {
    setKeywords(getKeywords());
    // 키워드 탭 캐시 초기화해서 다음 진입 시 새로 로드
    setCache((prev) => ({ ...prev, keyword: undefined }));
    if (activeTab === "keyword") loadTab("keyword");
  };

  const news = cache[activeTab] || [];

  const handleCardClick = (e, item) => {
    if (e.target.closest("a") || e.target.closest("button[data-summary]")) return;
    onSelectNews(item);
  };

  const handleCopySummary = (e, id, text) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleSummary = async (e, item) => {
    e.stopPropagation();
    if (summaries[item.id]?.text || summaries[item.id]?.loading) return;
    setSummaries((prev) => ({ ...prev, [item.id]: { loading: true } }));
    const result = await summarizeArticle(item.link, apiKey);
    setSummaries((prev) => ({
      ...prev,
      [item.id]: result.error
        ? { error: result.error }
        : { text: result.summary },
    }));
  };

  const tabLabel = (tabId) => {
    if (tabId === "headline") return "중요도 순";
    if (tabId === "ai") return "AI·기술";
    if (tabId === "world") return "세계";
    return "키워드 검색";
  };

  return (
    <div
      style={{ animation: "fadeIn 0.4s ease" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullY > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          height: `${pullY}px`, transition: "height 0.1s",
          color: "var(--text-muted)", fontSize: "12px", gap: "6px",
        }}>
          {pullY >= 60
            ? <><div className="spinner" style={{ width: "14px", height: "14px" }} />놓으면 새로고침</>
            : "↓ 당겨서 새로고침"}
        </div>
      )}
      {/* 탭 — 기사를 스크롤해도 상단에 고정된다 (.feed-tabs) */}
      <div className="feed-tabs">
        {[...STATIC_TABS, { id: "keyword", label: "키워드" }].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { sessionStorage.setItem("ts_active_tab", tab.id); setActiveTab(tab.id); }}
            style={{
              // 탭 5개 폭이 화면 폭과 정확히 같아져 마지막 탭이 가장자리에 붙었다.
              // 좌우 padding만 16→12로 줄인다(글자 크기는 유지). 버튼 합 355→315.
              padding: "6px 12px", borderRadius: "20px", border: "none",
              fontSize: "13px", fontWeight: activeTab === tab.id ? "600" : "400",
              cursor: "pointer",
              background: activeTab === tab.id ? "var(--accent-cyan)" : "var(--card-bg)",
              color: activeTab === tab.id ? "#0d1a2e" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="converter-loading">
          <div className="spinner" />
          <p className="spinner-text">뉴스 수집 중...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          {activeTab === "keyword" && keywords.length === 0 ? (
            <>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="empty-title">등록된 키워드가 없습니다</div>
              <p className="empty-desc">아래 버튼을 눌러 관심 키워드를 추가해 보세요.</p>
              <button onClick={() => setShowManager(true)} style={{
                marginTop: "12px", padding: "10px 24px", borderRadius: "20px",
                background: "var(--accent-cyan)", color: "#0d1a2e", border: "none",
                fontSize: "13px", fontWeight: "700", cursor: "pointer",
              }}>키워드 추가</button>
            </>
          ) : error === "stale" ? (
            <>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <div className="empty-title">앱이 오래된 버전이에요</div>
              <p className="empty-desc">최신 버전으로 바꾸면 바로 해결됩니다.<br />저장한 논쟁거리와 키워드는 그대로 남아요.</p>
              <button onClick={handleUpdateApp} style={{
                marginTop: "12px", padding: "10px 24px", borderRadius: "20px",
                background: "var(--accent-cyan)", color: "#0d1a2e", border: "none",
                fontSize: "13px", fontWeight: "700", cursor: "pointer",
              }}>최신 버전으로 업데이트</button>
            </>
          ) : (
            <>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="empty-title">뉴스를 불러오지 못했습니다</div>
              <p className="empty-desc">네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <svg style={{ width: "12px", height: "12px", color: "var(--accent-cyan)" }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              구글 뉴스 {tabLabel(activeTab)} · {news.length}건
            </div>
            {activeTab === "keyword" && (
              <button onClick={() => setShowManager(true)} style={{
                fontSize: "11px", color: "rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", padding: "4px 10px", cursor: "pointer",
              }}>관리</button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {news.map((item) => (
              <div key={item.id} className="news-card" onClick={(e) => handleCardClick(e, item)}>
                {activeTab === "keyword" && (
                  <span style={{
                    display: "inline-block", fontSize: "10px", color: "var(--accent-cyan)",
                    background: "rgba(0,242,254,0.12)", borderRadius: "8px",
                    padding: "2px 8px", marginBottom: "7px",
                  }}>{item.category}</span>
                )}
                <h4 className="news-title">{item.title}</h4>
                {item.summary && (
                  <p className="news-summary">
                    {item.summary.slice(0, 80)}{item.summary.length > 80 ? "…" : ""}
                  </p>
                )}

                {/* 키워드 탭 전용: 요약 결과 */}
                {activeTab === "keyword" && summaries[item.id]?.loading && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div className="spinner" style={{ width: "12px", height: "12px" }} />
                    원문 읽는 중...
                  </div>
                )}
                {activeTab === "keyword" && summaries[item.id]?.text && (
                  <div style={{ margin: "8px 0" }}>
                    <div style={{
                      fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.04)", borderRadius: "8px",
                      borderLeft: "2px solid var(--accent-cyan)",
                    }}>
                      {summaries[item.id].text}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                      <button
                        data-summary="true"
                        onClick={(e) => handleCopySummary(e, item.id, summaries[item.id].text)}
                        style={{
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "6px", padding: "4px 10px", cursor: "pointer",
                          fontSize: "11px", color: copied === item.id ? "var(--accent-cyan)" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {copied === item.id ? "복사됨 ✓" : "요약 복사"}
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === "keyword" && summaries[item.id]?.error && (
                  <div style={{ fontSize: "11px", color: "var(--accent-pink)", margin: "6px 0" }}>
                    요약 실패: {summaries[item.id].error}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="convert-hint">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>AI로 논쟁거리 3개 추출</span>
                    </div>
                    {activeTab === "keyword" && !summaries[item.id]?.text && !summaries[item.id]?.loading && (
                      <button
                        data-summary="true"
                        onClick={(e) => handleSummary(e, item)}
                        style={{
                          fontSize: "11px", color: "var(--text-muted)",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "6px", padding: "3px 8px", cursor: "pointer",
                        }}
                      >요약보기</button>
                    )}
                  </div>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: "11px", color: "var(--text-muted)", textDecoration: "none",
                        display: "flex", alignItems: "center", gap: "3px",
                        padding: "4px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      원문
                      <svg style={{ width: "10px", height: "10px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showManager && (
        <KeywordManager
          onClose={() => setShowManager(false)}
          onChanged={handleKeywordChanged}
        />
      )}
    </div>
  );
}
