import React, { useState, useEffect } from 'react';

export default function Home() {
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
    }
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#2563eb' }}>
        Chatworkログ抽出
      </h1>
      
      <div style={{ marginTop: '20px' }}>
        <label>APIトークン</label>
        <input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: '5px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px'
          }}
          placeholder="Chatworkの設定画面で取得したトークン"
        />
      </div>
      
      <p style={{ marginTop: '20px', color: '#6b7280' }}>
        ステップ1：基本構造OK ✓
      </p>
    </div>
  );
}
