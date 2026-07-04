import React, { useState, useEffect } from "react";
import NewsFeed from "./components/NewsFeed";
import DebateList from "./components/DebateList";
import TopicDetail from "./components/TopicDetail";
import Favorites from "./components/Favorites";
import ApiKeyPrompt from "./components/ApiKeyPrompt";

export default function App() {
  const [activeTab, setActiveTab] = useState(() =>
    sessionStorage.getItem("nav_tab") || "home"
  );
  const [selectedNews, setSelectedNews] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("nav_news") || "null"); }
    catch { return null; }
  });
  const [selectedDebate, setSelectedDebate] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("nav_debate") || "null"); }
    catch { return null; }
  });
  const [debateCache, setDebateCache] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("debate_cache") || "{}"); }
    catch { return {}; }
  });
  const [currentTime, setCurrentTime] = useState("");
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("claude_api_key") || ""
  );

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setCurrentTime(`${h}:${m < 10 ? "0" + m : m} ${ampm}`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);

  const saveNav = (tab, news, debate) => {
    try {
      sessionStorage.setItem("nav_tab", tab);
      sessionStorage.setItem("nav_news", JSON.stringify(news));
      sessionStorage.setItem("nav_debate", JSON.stringify(debate));
    } catch {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedNews(null);
    setSelectedDebate(null);
    saveNav(tab, null, null);
  };

  const handleDebatesCached = (newsId, debates) => {
    setDebateCache((prev) => {
      const next = { ...prev, [newsId]: debates };
      try { sessionStorage.setItem("debate_cache", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleSelectNews = (news) => {
    setSelectedNews(news);
    setSelectedDebate(null);
    saveNav(activeTab, news, null);
  };

  const handleSelectDebate = (debate) => {
    setSelectedDebate(debate);
    saveNav(activeTab, selectedNews, debate);
  };

  const handleBackFromDebates = () => {
    setSelectedNews(null);
    setSelectedDebate(null);
    saveNav(activeTab, null, null);
  };

  const handleBackFromDetail = () => {
    setSelectedDebate(null);
    saveNav(activeTab, selectedNews, null);
  };

  // 헤더 타이틀 결정
  const getTitle = () => {
    if (selectedDebate) return { main: "TalkSpark", sub: "대화 가이드" };
    if (selectedNews) return { main: "TalkSpark", sub: "논쟁거리 추출 중" };
    if (activeTab === "favorites") return { main: "보관함", sub: "My Saved Sparks" };
    return { main: "TalkSpark", sub: "Today's Sparks" };
  };

  const title = getTitle();
  const showHeader = !selectedDebate;

  return (
    <div className="app-container">
      <ApiKeyPrompt onSave={setApiKey} />

      {/* 상태바 */}
      <div className="status-bar">
        <span className="time">{currentTime}</span>
        <div className="icons">
          <svg style={{ width: "14px", height: "14px" }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
          <svg style={{ width: "16px", height: "16px" }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 5H3a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2zm1 11H2V8h16v8zm2-6h2v4h-2v-4z" />
          </svg>
        </div>
      </div>

      {/* 앱 헤더 */}
      {showHeader && (
        <header className="app-header">
          <div>
            <h1 className="app-title">{title.main}</h1>
            <div className="app-subtitle">{title.sub}</div>
          </div>
          <div className="header-actions">
            {apiKey ? (
              <div
                className="icon-btn"
                title="API 키 재설정"
                onClick={() => {
                  localStorage.removeItem("claude_api_key");
                  setApiKey("");
                  window.location.reload();
                }}
                style={{ cursor: "pointer" }}
              >
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
            ) : (
              <div className="icon-btn" title="API 키 없음" style={{ borderColor: "var(--accent-pink)" }}>
                <span style={{ fontSize: "10px", color: "var(--accent-pink)", fontWeight: "800" }}>KEY</span>
              </div>
            )}
          </div>
        </header>
      )}

      {/* 콘텐츠 영역 */}
      <main className="app-content">
        {selectedDebate ? (
          <TopicDetail topic={selectedDebate} onBack={handleBackFromDetail} />
        ) : selectedNews ? (
          <DebateList
            news={selectedNews}
            apiKey={apiKey}
            cachedDebates={debateCache[selectedNews?.id] || null}
            onDebatesCached={handleDebatesCached}
            onSelectDebate={handleSelectDebate}
            onBack={handleBackFromDebates}
          />
        ) : (
          <>
            {activeTab === "home" && (
              <NewsFeed onSelectNews={handleSelectNews} apiKey={apiKey} />
            )}
            {activeTab === "favorites" && (
              <Favorites onSelectDebate={handleSelectDebate} />
            )}
          </>
        )}
      </main>

      {/* 하단 탭 바 */}
      <nav className="bottom-tabs">
        <button
          className={`tab-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => handleTabChange("home")}
        >
          <svg viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span>뉴스 피드</span>
        </button>

        <button
          className={`tab-item ${activeTab === "favorites" ? "active" : ""}`}
          onClick={() => handleTabChange("favorites")}
        >
          <svg viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>보관함</span>
        </button>
      </nav>
    </div>
  );
}
