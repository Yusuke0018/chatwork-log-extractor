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

  // --- Initial Setup Effect ---
  useEffect(() => {
    // Load API token from local storage on initial render
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
      loadRooms(savedToken);
    }

    // Set default date range (last 3 days)
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);

    // Load saved settings and logs from local storage
    loadAutoSaveSettings();
    loadSavedLogs();

    // Check for auto-save tasks after a short delay
    const autoSaveTimer = setTimeout(() => {
      checkAutoSave();
    }, 2000);
    
    // Cleanup timer on component unmount
    return () => clearTimeout(autoSaveTimer);
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Data Loading Functions ---

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    setAutoSaveRooms(saved);
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs);
  };

  // --- Core Logic Functions ---

  const checkAutoSave = async () => {
    const savedSettings = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const currentLogs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    const token = localStorage.getItem('chatworkApiToken');

    if (!token || savedSettings.length === 0) return;

    const now = new Date();
    let autoSaveCount = 0;
    let updatedLogs = [...currentLogs];

    for (const room of savedSettings.slice(0, 10)) {
      const lastSave = updatedLogs.find(log => log.roomId.toString() === room.roomId.toString() && log.isAutoSave);
      const lastSaveDate = lastSave ? new Date(lastSave.savedAt) : null;

      // Save if it's the first time or if the last save was more than 3 days ago
      if (!lastSaveDate || (now.getTime() - lastSaveDate.getTime()) > 3 * 24 * 60 * 60 * 1000) {
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
            updatedLogs.unshift(logEntry);
            autoSaveCount++;
          }
        } catch (err) {
          console.error(`Auto-save failed for room (${room.roomName}):`, err);
        }
        // Add a small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (autoSaveCount > 0) {
      const trimmedLogs = updatedLogs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      loadSavedLogs(); // Reload logs into state
      setShowSuccess(`${autoSaveCount}件のログを自動保存しました`);
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
      if (!response.ok) throw new Error('Failed to fetch rooms');
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      console.error(err);
      setError('ルームの取得に失敗しました。APIトークンを確認してください。');
      // Set mock data for development/testing if API fails
      setRooms([
        { room_id: '12345', name: '全体ミーティング' },
        { room_id: '12346', name: '経営会議' },
        { room_id: '12347', name: 'スタッフルーム' },
      ]);
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

      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages(data.messages);
      setMessageCount(data.count);
      
      if (data.count === 100) {
        setError('※最新100件のみ表示されています（Chatwork APIの制限）');
      }
      
      const roomName = rooms.find(r => r.room_id.toString() === selectedRoom)?.name || 'Unknown Room';
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
      
      // Use immutable update for savedLogs as well for consistency
      const currentLogs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
      const newLogs = [newLog, ...currentLogs];
      const trimmedLogs = newLogs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      loadSavedLogs(); // Reload logs to update the UI
      
    } catch (err) {
      setError('メッセージの取得に失敗しました。');
      console.error(err);
    }
    setLoading(false);
  };

  const toggleAutoSave = () => {
    if (!selectedRoom) {
      setError('ルームを選択してください');
      return;
    }
    setAutoSaveRooms(currentAutoSaveRooms => {
      const isExisting = currentAutoSaveRooms.some(r => r.roomId.toString() === selectedRoom);
      let newAutoSaveRooms;

      if (isExisting) {
        newAutoSaveRooms = currentAutoSaveRooms.filter(r => r.roomId.toString() !== selectedRoom);
        setShowSuccess('自動保存を解除しました');
      } else {
        if (currentAutoSaveRooms.length >= 10) {
          setError('自動保存は最大10個までです');
          return currentAutoSaveRooms; 
        }
        
        const roomData = {
          roomId: selectedRoom,
          roomName: rooms.find(r => r.room_id.toString() === selectedRoom)?.name || 'Unknown Room',
        };
        
        newAutoSaveRooms = [...currentAutoSaveRooms, roomData];
        setShowSuccess(`自動保存を設定しました（${newAutoSaveRooms.length}/10）`);
      }

      localStorage.setItem('autoSaveRooms', JSON.stringify(newAutoSaveRooms));
      return newAutoSaveRooms;
    });
    setTimeout(() => setShowSuccess(false), 2000);
  };

  // --- Event Handlers & Helper Functions ---

  const handleTokenChange = (e) => {
    const token = e.target.value;
    setApiToken(token);
    if (token) {
      localStorage.setItem('chatworkApiToken', token);
      loadRooms(token);
    } else {
      setRooms([]);
    }
  };

  const isAutoSaveEnabled = (roomId) => {
    return autoSaveRooms.some(r => r.roomId.toString() === roomId.toString());
  };

  const copyToClipboard = async () => {
    if (!messages) return;
    try {
      const textArea = document.createElement("textarea");
      textArea.value = messages;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowSuccess('コピーしました！');
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError('コピーに失敗しました');
      console.error('Clipboard copy failed:', err);
    }
  };

  const downloadAsText = () => {
    if (!messages) return;
    const roomName = rooms.find(r => r.room_id.toString() === selectedRoom)?.name || 'チャット';
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- JSX ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#2563eb' }}>
        Chatworkログ抽出
      </h1>
      
      <div style={{ backgroundColor: '#dbeafe', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#1e40af' }}>
          初回のみAPIトークンを設定してください。設定はブラウザに保存されます。
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
              fontSize: '16px',
              backgroundColor: !apiToken ? '#f3f4f6' : 'white'
            }}
            disabled={!apiToken || rooms.length === 0}
          >
            <option value="">
              {!apiToken ? 'まずAPIトークンを入力' : rooms.length === 0 ? 'ルームを読込中...' : 'ルームを選択'}
            </option>
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
              backgroundColor: isAutoSaveEnabled(selectedRoom) ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedRoom && (isAutoSaveEnabled(selectedRoom) || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {isAutoSaveEnabled(selectedRoom) ? '自動OFF' : '自動ON'}
          </button>
        </div>
        {autoSaveRooms.length > 0 && (
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
            ⏰ 自動保存中: {autoSaveRooms.length}/10 ルーム
          </p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '100%', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
          />
        </div>
      </div>
      
      <button
        onClick={fetchMessages}
        disabled={loading || !selectedRoom}
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: loading || !selectedRoom ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: loading || !selectedRoom ? 'not-allowed' : 'pointer'
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
            alignItems: 'center',
            marginBottom: '10px'  
          }}>
            <h3 style={{margin: 0}}>取得結果</h3>
            <span style={{ color: '#6b7280' }}>{messageCount}件</span>
          </div>
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '15px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px', fontFamily: 'monospace' }}>
              {messages}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button onClick={copyToClipboard} style={{ flex: 1, padding: '12px', border: '2px solid #2563eb', backgroundColor: 'white', color: '#2563eb', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              コピー
            </button>
            <button onClick={downloadAsText} style={{ flex: 1, padding: '12px', border: '2px solid #2563eb', backgroundColor: 'white', color: '#2563eb', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              ダウンロード
            </button>
          </div>
        </div>
      )}
      
      {savedLogs.length > 0 && (
        <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '2px solid #e5e7eb' }}>
          <h3 style={{ marginBottom: '15px' }}>
            保存履歴 (直近50件)
          </h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
            {savedLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => viewSavedLog(log)}
                style={{
                  padding: '10px 15px',
                  marginBottom: '10px',
                  backgroundColor: log.isAutoSave ? '#f0f9ff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#eef2ff'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = log.isAutoSave ? '#f0f9ff' : '#f9fafb'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{color: '#1e3a8a'}}>{log.isAutoSave && '⏰ '}{log.roomName}</strong>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>{log.count}件</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {log.startDate} 〜 {log.endDate}
                </div>
              </div>
            ))}
          </div>
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
          zIndex: 1000
        }}>
          {showSuccess}
        </div>
      )}
      {/* The <style jsx global> tag has been removed to prevent build errors.
        If the build succeeds with this change, the animation can be re-added
        using a standard global CSS file (e.g., styles/globals.css).
      */}
    </div>
  );
}
