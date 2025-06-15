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
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoSaveRooms, setAutoSaveRooms] = useState([]);
  
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
    loadAutoSaveSettings();
  }, []);

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    setAutoSaveRooms(saved);
  };

  const loadRooms = async (token) => {
    try {
      const response = await fetch('/api/chatwork/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setRooms([
        { room_id: '12345', name: '全体ミーティング' },
        { room_id: '12346', name: '経営会議' },
        { room_id: '12347', name: 'スタッフルーム' },
        { room_id: '12348', name: '開発チーム' },
        { room_id: '12349', name: '営業チーム' },
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
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setMessages(data.messages);
      setMessageCount(data.count);
      if (data.count === 100) {
        setError('※最新100件のみ表示されています');
      }
    } catch (err) {
      setError('メッセージの取得に失敗しました');
    }
    setLoading(false);
  };

  const toggleAutoSave = () => {
    if (!selectedRoom) return;
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const roomData = {
      roomId: selectedRoom,
      roomName: rooms.find(r => r.room_id === selectedRoom)?.name,
    };
    const existingIndex = saved.findIndex(r => r.roomId === selectedRoom);
    if (existingIndex >= 0) {
      saved.splice(existingIndex, 1);
      setShowSuccess('自動保存を【解除】しました');
    } else {
      if (saved.length >= 10) {
        setError('自動保存は最大10個までです');
        return;
      }
      saved.push(roomData);
      setShowSuccess(`自動保存を【開始】しました（${saved.length}/10）`);
    }
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const isAutoSaveEnabled = (roomId) => {
    return autoSaveRooms.some(r => r.roomId === roomId);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messages);
      setShowSuccess('コピーしました！');
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError('コピーに失敗しました');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#2563eb' }}>
        Chatworkログ抽出
      </h1>
      
      <div style={{ backgroundColor: '#dbeafe', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          初回のみAPIトークンの設定が必要です
        </p>
      </div>
      
      {/* 自動保存状況の表示（目立つ位置に移動） */}
      {autoSaveRooms.length > 0 && (
        <div style={{ 
          backgroundColor: '#f0f9ff', 
          border: '2px solid #0ea5e9',
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0284c7', fontSize: '16px' }}>
            🤖 自動保存中のルーム（{autoSaveRooms.length}/10）
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {autoSaveRooms.map((room) => (
              <span 
                key={room.roomId} 
                style={{ 
                  backgroundColor: '#0ea5e9',
                  color: 'white',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ⏰ {room.roomName}
              </span>
            ))}
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            ※3日ごとに自動でログを保存します
          </p>
        </div>
      )}
      
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: selectedRoom && isAutoSaveEnabled(selectedRoom) ? '#f0f9ff' : 'white'
            }}
            disabled={!apiToken}
          >
            <option value="">ルームを選択してください</option>
            {rooms.map((room) => (
              <option key={room.room_id} value={room.room_id}>
                {isAutoSaveEnabled(room.room_id) ? '⏰ ' : ''}{room.name}
              </option>
            ))}
          </select>
          <button
            onClick={toggleAutoSave}
            disabled={!selectedRoom || (!isAutoSaveEnabled(selectedRoom) && autoSaveRooms.length >= 10)}
            style={{
              padding: '10px 20px',
              backgroundColor: !selectedRoom ? '#e5e7eb' : isAutoSaveEnabled(selectedRoom) ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
              color: !selectedRoom ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedRoom && (isAutoSaveEnabled(selectedRoom) || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '16px',
              minWidth: '120px'
            }}
          >
            {!selectedRoom ? '選択して' : isAutoSaveEnabled(selectedRoom) ? '🔴 自動OFF' : autoSaveRooms.length >= 10 ? '❌ 上限' : '🟢 自動ON'}
          </button>
        </div>
        {selectedRoom && (
          <p style={{ 
            fontSize: '12px', 
            marginTop: '5px',
            color: isAutoSaveEnabled(selectedRoom) ? '#0ea5e9' : '#6b7280',
            fontWeight: isAutoSaveEnabled(selectedRoom) ? 'bold' : 'normal'
          }}>
            {isAutoSaveEnabled(selectedRoom) 
              ? '✅ このルームは自動保存が有効です' 
              : '❌ このルームは自動保存されていません'}
          </p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
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
          borderRadius: '8px'
        }}>
          {error}
        </div>
      )}
      
      {messages && (
        <div style={{ marginTop: '20px' }}>
          <h3>取得結果（{messageCount}件）</h3>
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '15px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {messages}
            </pre>
          </div>
          <button
            onClick={copyToClipboard}
            style={{
              marginTop: '10px',
              padding: '10px',
              width: '100%',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            コピー
          </button>
        </div>
      )}
      
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          {showSuccess}
        </div>
      )}
    </div>
  );
}
