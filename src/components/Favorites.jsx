import React, { useState, useEffect } from "react";
import { getSavedDebates, toggleSaved } from "../utils/db";

export default function Favorites({ onSelectDebate }) {
  const [debates, setDebates] = useState([]);

  useEffect(() => {
    setDebates(getSavedDebates());
  }, []);

  const handleRemove = (e, debate) => {
    e.stopPropagation();
    toggleSaved(debate);
    setDebates(getSavedDebates());
  };

  if (debates.length === 0) {
    return (
      <div style={{ animation: "fadeIn 0.4s ease" }}>
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg style={{ width: "20px", height: "20px", color: "var(--accent-pink)" }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span style={{ fontSize: "16px", fontWeight: "700" }}>보관함 (0)</span>
        </div>
        <div className="empty-state">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <div className="empty-title">저장된 논쟁거리가 없습니다</div>
          <p className="empty-desc">뉴스를 분석하고 마음에 드는 논쟁거리의 하트를 눌러 저장해 보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
        <svg style={{ width: "20px", height: "20px", color: "var(--accent-pink)" }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span style={{ fontSize: "16px", fontWeight: "700" }}>보관함 ({debates.length})</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {debates.map((debate) => (
          <div
            key={debate.id}
            className="topic-card"
            onClick={() => onSelectDebate(debate)}
            style={{ padding: "16px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <span className="card-tag" style={{ margin: 0 }}>{debate.category}</span>
              <button
                className="favorite-btn active"
                onClick={(e) => handleRemove(e, debate)}
                title="보관함에서 제거"
              >
                <svg style={{ width: "18px", height: "18px" }} fill="currentColor" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
            <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#fff", lineHeight: "1.4", marginBottom: "8px" }}>
              {debate.title}
            </h4>
            {debate.starter && (
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "8px", fontStyle: "italic" }}>
                "{debate.starter}"
              </p>
            )}
            {debate.sourceNews && (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                📰 {debate.sourceNews}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
