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
  const [savedLogs, setSavedLogs] = useState([]);
  
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
    loadSavedLogs();
    
    setTimeout(() => {
      checkAutoSave();
    }, 2000);
  }, []);

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    setAutoSaveRooms(saved);
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs);
  };

  const checkAutoSave = async () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    const token = localStorage.getItem('chatworkApiToken');
    
    if (!token || saved.length === 0) return;
    
    const now = new Date();
    let autoSaveCount = 0;
    
    for (const room of saved.slice(0, 10)) {
      const lastSave = logs.find(log => log.roomId === room.roomId && log.isAutoSave);
      const lastSaveDate = lastSave ? new Date(lastSave.savedAt) : null;
      
      if (!lastSaveDate || (now - lastSaveDate) > 3 * 24 * 60 * 60 * 1000) {
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        
        try {
          const response = await fetch('/api/chatwork/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiToken: token,
              roomId: room.roomId,
              startDate: threeDaysAgo.toISOString().split('T')[0],
              endDate: now.toISOString().split('T')[0],
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            const logEntry = {
              id: `auto_${room.roomId}_${Date.now()}`,
              roomName: room.roomName,
              roomId: room.roomId,
              content: data.messages,
              count: data.count,
              startDate: threeDaysAgo.toISOString().split('T')[0],
              endDate: now.toISOString().split('T')[0],
              savedAt: now.toISOString(),
              isAutoSave: true
            };
            
            logs.unshift(logEntry);
            autoSaveCount++;
          }
        } catch (err) {
          console.error(`自動保存エラー (${room.roomName}):`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (autoSaveCount > 0) {
      const trimmedLogs = logs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      loadSavedLogs();
      setShowSuccess(`${autoSaveCount}件の自動保存を実行しました`);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

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
        { room_id: '12347', name: 'スタッフルーム' },
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
      
      const roomName = rooms.find(r => r.room_id === selectedRoom)?.name || 'Unknown';
      const newLog = {
        id: Date.now().toString(),
        roomName,
        roomId: selectedRoom,
        content: data.messages,
        count: data.count,
        startDate,
        endDate,
        savedAt: new Date().toISOString(),
        isAutoSave: false
      };
      
      const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
      logs.unshift(newLog);
      const trimmedLogs = logs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      loadSavedLogs();
      
    } catch (err) {
      setError('メッセージの取得に失敗しました');
    }
    setLoading(false);
  };

  const toggleAutoSave = () => {
    if (!selectedRoom) {
      setError('ルームを選択してください');
      return;
    }

    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const roomData = {
      roomId: selectedRoom,
      roomName: rooms.find(r => r.room_id === selectedRoom)?.name,
    };

    const existingIndex = saved.findIndex(r => r.roomId === selectedRoom);
    
    if (existingIndex >= 0) {
      saved.splice(existingIndex, 1);
      setShowSuccess('自動保存を解除しました');
    } else {
      if (saved.length >= 10) {
        setError('自動保存は最大10個までです');
        return;
      }
      saved.push(roomData);
      setShowSuccess(`自動保存を設定しました（${saved.length}/10）`);
    }

    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    
    setTimeout(() => setShowSuccess(false), 2000);
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

  const downloadAsText = () => {
    const roomName = rooms.find(r => r.room_id === selectedRoom)?.name || 'チャット';
    const blob = new Blob([messages], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chatwork_${roomName}_${startDate}_${endDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const viewSavedLog = (log) => {
    setMessages(log.content);
    setMessageCount(log.count || 0);
    window.scrollTo(0, 0);
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              flex: 1,
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
                {room.name} {isAutoSaveEnabled(room.room_id) ? '⏰' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={toggleAutoSave}
            disabled={!selectedRoom || (!isAutoSaveEnabled(selectedRoom) && autoSaveRooms.length >= 10)}
            style={{
              padding: '10px 20px',
              backgroundColor: isAutoSaveEnabled(selectedRoom) ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedRoom && (isAutoSaveEnabled(selectedRoom) || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed'
            }}
          >
            {isAutoSaveEnabled(selectedRoom) ? '自動OFF' : autoSaveRooms.length >= 10 ? '上限' : '自動ON'}
          </button>
        </div>
        {autoSaveRooms.length > 0 && (
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
            ⏰ 自動保存中: {autoSaveRooms.length}/10 ルーム
          </p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={() => {
              setStartDate('2010-01-01');
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#f3f4f6',
              border: '2px solid #2563eb',
              color: '#2563eb',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            全期間
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
              setStartDate(threeDaysAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            直近3日間
          </button>
        </div>
        
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
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              onClick={copyToClipboard}
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #2563eb',
                backgroundColor: 'white',
                color: '#2563eb',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              コピー
            </button>
            <button
              onClick={downloadAsText}
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #2563eb',
                backgroundColor: 'white',
                color: '#2563eb',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ダウンロード
            </button>
          </div>
        </div>
      )}
      
      {savedLogs.length > 0 && (
        <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '2px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: '15px' }}>
            保存履歴 ({savedLogs.length}件)
          </h3>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {savedLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                onClick={() => viewSavedLog(log)}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: log.isAutoSave ? '#f0f9ff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
