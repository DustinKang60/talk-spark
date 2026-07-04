// ApiKeyPrompt.jsx - modal for entering Claude API key
import React, { useState, useEffect } from 'react';

export default function ApiKeyPrompt({ onSave }) {
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);

  // Show prompt if key not stored
  useEffect(() => {
    const saved = localStorage.getItem('claude_api_key');
    if (!saved) setShow(true);
    else setApiKey(saved);
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('claude_api_key', apiKey.trim());
      setShow(false);
      if (onSave) onSave(apiKey.trim());
    }
  };

  const handleClose = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="api-key-modal" style={modalStyle}>
      <div style={dialogStyle}>
        <h3 style={{ marginBottom: '8px', color: '#fff' }}>Claude API 키 입력</h3>
        <input
          type="password"
          placeholder="Enter your Claude API Key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={inputStyle}
        />
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary-btn" onClick={handleClose} style={btnStyle}>취소</button>
          <button className="primary-btn" onClick={handleSave} style={{ ...btnStyle, marginLeft: '8px' }}>저장</button>
        </div>
      </div>
    </div>
  );
}

const modalStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
};

const dialogStyle = {
  background: 'var(--bg-primary)',
  padding: '24px',
  borderRadius: '12px',
  minWidth: '280px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)'
};

const btnStyle = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer'
};
