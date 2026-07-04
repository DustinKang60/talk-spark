import React, { useState, useEffect } from "react";
import { extractDebates } from "../utils/claude";

function DifficultyDots({ level }) {
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: i <= level ? "var(--accent-cyan)" : "rgba(255,255,255,0.1)",
          }}
        />
      ))}
    </div>
  );
}

export default function DebateList({ news, apiKey, cachedDebates, onDebatesCached, onSelectDebate, onBack }) {
  const [debates, setDebates] = useState(cachedDebates);
  const [loading, setLoading] = useState(!cachedDebates);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cachedDebates) return; // 캐시 있으면 API 호출 생략
    if (!apiKey) {
      setError("API 키가 없습니다. 앱 상단에서 Claude API 키를 입력해 주세요.");
      setLoading(false);
      return;
    }
    extractDebates(news, apiKey).then((result) => {
      if (!result || result.error) {
        setError(result?.error || "알 수 없는 오류");
      } else {
        setDebates(result);
        onDebatesCached(news.id, result);
      }
      setLoading(false);
    });
  }, [news.id]);

  return (
    <div style={{ animation: "slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards" }}>
      {/* 뒤로가기 헤더 */}
      <div className="back-header">
        <button className="icon-btn" onClick={onBack} aria-label="뒤로가기">
          <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="back-title">논쟁거리 추출</span>
      </div>

      {/* 원본 뉴스 요약 */}
      <div style={{
        padding: "14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        marginBottom: "20px",
      }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
          {news.category} · 원본 뉴스
        </span>
        <p style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginTop: "6px", lineHeight: "1.4" }}>
          {news.title}
        </p>
        {news.link && (
          <a
            href={news.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "11px", color: "var(--accent-cyan)", textDecoration: "none", display: "inline-block", marginTop: "8px" }}
          >
            원문 보기 ➜
          </a>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="converter-loading">
          <div className="spinner" />
          <p className="spinner-text" style={{ textAlign: "center" }}>
            Claude가 논쟁거리를 분석 중입니다...
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "0 16px" }}>
            뉴스 내용을 읽고 서로 다른 관점의 대화 주제 3개를 추출하고 있습니다.
          </p>
        </div>
      )}

      {/* 에러 */}
      {!loading && error && (
        <div className="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="empty-title">추출 실패</div>
          <p className="empty-desc">{error}</p>
        </div>
      )}

      {/* 결과 */}
      {!loading && debates && (
        <>
          <div style={{ marginBottom: "14px", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg style={{ width: "14px", height: "14px", color: "var(--accent-cyan)" }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            AI가 추출한 논쟁거리 {debates.length}개 · 클릭해서 대화 가이드 보기
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {debates.map((debate, idx) => (
              <div
                key={debate.id}
                className="topic-card"
                onClick={() => onSelectDebate(debate)}
                style={{ padding: "18px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span className="card-tag" style={{ margin: 0 }}>{debate.category}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <DifficultyDots level={debate.difficulty || 3} />
                    <span style={{ fontSize: "10px", color: "var(--accent-purple)", fontWeight: "700" }}>
                      #{idx + 1}
                    </span>
                  </div>
                </div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", lineHeight: "1.4", marginBottom: "8px" }}>
                  {debate.title}
                </h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "10px" }}>
                  {debate.starter}
                </p>
                <div style={{ fontSize: "11px", color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                  <svg style={{ width: "11px", height: "11px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  꼬리질문 {debate.followups?.length || 0}개 · 반대 관점 포함
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
