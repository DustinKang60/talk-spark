import React, { useState, useEffect } from "react";
import { isSaved, toggleSaved } from "../utils/db";


export default function TopicDetail({ topic, onBack }) {
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(["starter", "followups"]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (topic) setSaved(isSaved(topic.id));
  }, [topic]);

  const handleToggleSave = () => {
    const updated = toggleSaved(topic);
    setSaved(updated.some((d) => d.id === topic.id));
  };

  const handleToggle = (section) => {
    setExpanded((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleShare = () => {
    const text = `[TalkSpark 논쟁거리]\n"${topic.title}"\n\n${topic.starter}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!topic) return null;

  return (
    <div className="detail-view">
      {/* 헤더 */}
      <div className="back-header">
        <button className="icon-btn" onClick={onBack} aria-label="뒤로가기">
          <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="back-title">대화 가이드</span>
      </div>

      {/* 메인 카드 */}
      <div className="detail-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span className="card-tag">{topic.category}</span>
          <button
            className={`favorite-btn ${saved ? "active" : ""}`}
            onClick={handleToggleSave}
            title={saved ? "보관함에서 제거" : "보관함에 저장"}
          >
            <svg style={{ width: "22px", height: "22px" }} fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

        <h2 className="detail-title">{topic.title}</h2>
        <p className="detail-desc">{topic.description}</p>

        {topic.sourceNews && (
          <a
            href={topic.sourceLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
          >
            <svg style={{ width: "11px", height: "11px", flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {topic.sourceNews}
          </a>
        )}

        {/* 아코디언: 대화 시작 질문 */}
        <div className={`accordion-section ${expanded.includes("starter") ? "expanded" : ""}`}>
          <div className="accordion-trigger" onClick={() => handleToggle("starter")}>
            <div className="accordion-title-container">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="accordion-title">대화 시작 질문</span>
            </div>
            <span className="accordion-arrow">▼</span>
          </div>
          {expanded.includes("starter") && (
            <div className="accordion-content">
              <p style={{ fontWeight: "500", color: "#fff", fontStyle: "italic" }}>"{topic.starter}"</p>
            </div>
          )}
        </div>

        {/* 아코디언: 꼬리 질문 */}
        {topic.followups?.length > 0 && (
          <div className={`accordion-section ${expanded.includes("followups") ? "expanded" : ""}`}>
            <div className="accordion-trigger" onClick={() => handleToggle("followups")}>
              <div className="accordion-title-container">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="accordion-title">더 깊은 대화 (꼬리 질문 {topic.followups.length}개)</span>
              </div>
              <span className="accordion-arrow">▼</span>
            </div>
            {expanded.includes("followups") && (
              <div className="accordion-content">
                <div className="followup-list">
                  {topic.followups.map((q, i) => (
                    <div key={i} className="followup-item">• {q}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 아코디언: 반대 관점 */}
        {topic.counterOpinion && (
          <div className={`accordion-section ${expanded.includes("counter") ? "expanded" : ""}`}>
            <div className="accordion-trigger" onClick={() => handleToggle("counter")}>
              <div className="accordion-title-container">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="accordion-title">토론을 위한 반대 관점</span>
              </div>
              <span className="accordion-arrow">▼</span>
            </div>
            {expanded.includes("counter") && (
              <div className="accordion-content">
                <p style={{ color: "var(--text-secondary)" }}>{topic.counterOpinion}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 공유 버튼 */}
      <div className="action-btn-container">
        <button className="primary-btn" onClick={handleShare}>
          {copied ? (
            <>
              <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              복사 완료!
            </>
          ) : (
            <>
              <svg style={{ width: "18px", height: "18px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              대화 주제 복사
            </>
          )}
        </button>
      </div>
    </div>
  );
}
