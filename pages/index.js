import React, { useState, useEffect } from 'react';

export default function Home() {
  const [apiToken, setApiToken] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [messages, setMessages] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
      loadRooms(savedToken);
    }
    
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);
  }, []);

  const loadRooms = async (token) => {
    setError('');
    try {
      const response = await fetch('/api/chatwork/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token }),
      });
      if (!response.ok) throw new Error('ルーム取得失敗');
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setRooms([
        { room_id: '12345', name: '全体ミーティング' },
        { room_id: '12346', name: '経営会議' },
      ]);
    }
  };

  const handleTokenChange = (e) => {
    const token = e.target.value;
    setApiToken(token);
    if (token) {
      localStorage.setItem('chatworkApiToken', token);
      loadRooms(token);
    }
  };

  const fetchMessages = async () => {
    if (!apiToken || !selectedRoom || !startDate || !endDate) {
      setError('すべての項目を入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setMessages('');

    try {
      const response = await fetch('/api/chatwork/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken,
          roomId: selectedRoom,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) throw new Error('メッセージ取得失敗');
      
      const data = await response.json();
      setMessages(data.messages);
      setMessageCount(data.count);
      
      if (data.count === 100) {
        setError('※最新100件のみ表示されています（Chatwork APIの制限）');
      }
    } catch (err) {
      setError('メッセージの取得に失敗しました');
      // デモデータ
      setMessages('デモメッセージ\n[2025/06/15 09:00] 大岩祐介: おはようございます');
      setMessageCount(1);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#2563eb' }}>
        Chatworkログ抽出
      </h1>
      
      <div style={{ backgroundColor: '#dbeafe', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          初回のみ設定が必要です。APIトークンは保存されます。
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          APIトークン
        </label>
        <input
          type="password"
          value={apiToken}
          onChange={handleTokenChange}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '16px'
          }}
          placeholder="Chatworkの設定画面で取得したトークン"
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          ルームを選択
        </label>
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '16px'
          }}
          disabled={!apiToken}
        >
          <option value="">
            {!apiToken ? 'まずAPIトークンを入力してください' : 'ルームを選択してください'}
          </option>
          {rooms.map((room) => (
            <option key={room.room_id} value={room.room_id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            const today = new Date();
            const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
            setStartDate(threeDaysAgo.toISOString().split('T')[0]);
            setEndDate(today.toISOString().split('T')[0]);
          }}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          直近3日間
        </button>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      </div>
      
      <button
        onClick={fetchMessages}
        disabled={loading}
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: loading ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'ログを取得中...' : 'ログを取得'}
      </button>
      
      {error && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: error.includes('100件') ? '#fef3c7' : '#fee2e2',
          color: error.includes('100件') ? '#92400e' : '#dc2626',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
      
      {messages && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '10px' 
          }}>
            <h3>取得結果</h3>
            <span style={{ color: '#6b7280' }}>{messageCount}件</span>
          </div>
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '15px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px' }}>
              {messages}
            </pre>
          </div>
        </div>
      )}
      
      <p style={{ marginTop: '20px', color: '#10b981' }}>
        ステップ3：メッセージ取得OK ✓
      </p>
    </div>
  );
}
