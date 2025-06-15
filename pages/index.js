import React, { useState, useEffect } from 'react';

export default function ChatworkTeamLogExtractor() {
  const [currentUser, setCurrentUser] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState('');
  const [error, setError] = useState('');
  const [savedLogs, setSavedLogs] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('fetch'); // fetch, history, settings

  useEffect(() => {
    // 初期設定
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(oneWeekAgo.toISOString().split('T')[0]);
    
    // 保存されたユーザー情報を読み込み
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
      loadUserSettings(savedUser);
    }
    
    // 保存済みログを読み込み
    loadSavedLogs();
  }, []);

  const loadUserSettings = (userName) => {
    const userToken = localStorage.getItem(`token_${userName}`);
    if (userToken) {
      setApiToken(userToken);
      loadRooms(userToken);
    }
    const autoSave = localStorage.getItem(`autoSave_${userName}`) === 'true';
    setAutoSaveEnabled(autoSave);
  };

  const loadRooms = async (token) => {
    if (!token) return;
    setError('');
    
    try {
      const response = await fetch('/api/chatwork/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token }),
      });

      if (!response.ok) throw new Error('ルーム一覧の取得に失敗しました');
      
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      setError(err.message);
      // デモデータ
      setRooms([
        { room_id: '12345', name: '全体ミーティング' },
        { room_id: '12346', name: '経営会議' },
        { room_id: '12347', name: 'スタッフルーム' },
      ]);
    }
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs);
  };

  const saveUserSettings = () => {
    if (!currentUser) {
      setError('ユーザー名を入力してください');
      return;
    }
    
    localStorage.setItem('currentUser', currentUser);
    localStorage.setItem(`token_${currentUser}`, apiToken);
    localStorage.setItem(`autoSave_${currentUser}`, autoSaveEnabled);
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    
    if (apiToken) {
      loadRooms(apiToken);
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

      if (!response.ok) throw new Error('メッセージの取得に失敗しました');
      
      const data = await response.json();
      setMessages(data.messages);
      
      // ログを保存
      saveLog(data.messages, data.count);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveLog = (content, count) => {
    const roomName = rooms.find(r => r.room_id === selectedRoom)?.name || 'Unknown';
    const newLog = {
      id: Date.now(),
      user: currentUser,
      roomName,
      roomId: selectedRoom,
      startDate,
      endDate,
      content,
      count,
      savedAt: new Date().toISOString(),
    };
    
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    logs.unshift(newLog);
    // 最新50件のみ保持
    const trimmedLogs = logs.slice(0, 50);
    localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
    setSavedLogs(trimmedLogs);
  };

  const setupAutoSave = () => {
    if (!selectedRoom || !currentUser) {
      setError('ユーザーとルームを選択してください');
      return;
    }
    
    const schedule = {
      user: currentUser,
      roomId: selectedRoom,
      roomName: rooms.find(r => r.room_id === selectedRoom)?.name,
      interval: 3, // 3日ごと
      lastRun: null,
      nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    
    let schedules = JSON.parse(localStorage.getItem('autoSaveSchedules') || '[]');
    schedules = schedules.filter(s => !(s.user === currentUser && s.roomId === selectedRoom));
    schedules.push(schedule);
    localStorage.setItem('autoSaveSchedules', JSON.stringify(schedules));
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messages);
      setShowSuccess(true);
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
    setActiveTab('fetch');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: '1rem' }}>
            Chatworkログ管理システム
          </h1>
          
          {/* ユーザー表示 */}
          {currentUser && (
            <div style={{ textAlign: 'center', marginBottom: '1rem', color: '#6b7280' }}>
              ログイン中: <strong>{currentUser}</strong>
            </div>
          )}

          {/* タブナビゲーション */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
            <button
              onClick={() => setActiveTab('fetch')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'fetch' ? '3px solid #2563eb' : 'none',
                color: activeTab === 'fetch' ? '#2563eb' : '#6b7280',
                fontWeight: activeTab === 'fetch' ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              ログ取得
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'history' ? '3px solid #2563eb' : 'none',
                color: activeTab === 'history' ? '#2563eb' : '#6b7280',
                fontWeight: activeTab === 'history' ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              履歴 ({savedLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'settings' ? '3px solid #2563eb' : 'none',
                color: activeTab === 'settings' ? '#2563eb' : '#6b7280',
                fontWeight: activeTab === 'settings' ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              設定
            </button>
          </div>

          {/* ログ取得タブ */}
          {activeTab === 'fetch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!currentUser && (
                <div style={{ backgroundColor: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
                    最初に「設定」タブでユーザー名とAPIトークンを設定してください
                  </p>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  ルームを選択
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                  disabled={!currentUser || !apiToken}
                >
                  <option value="">ルームを選択してください</option>
                  {rooms.map((room) => (
                    <option key={room.room_id} value={room.room_id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('2010-01-01');
                    setEndDate(new Date().toISOString().split('T')[0]);
                  }}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#f3f4f6', color: '#2563eb', fontWeight: '600', borderRadius: '0.5rem', fontSize: '0.875rem', border: '2px solid #2563eb', cursor: 'pointer' }}
                >
                  📅 全期間（最初から今日まで）
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setStartDate('2010-01-01')}
                    style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  >
                    最初から...
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndDate(new Date().toISOString().split('T')[0])}
                    style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  >
                    ...今日まで
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    開始日
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    終了日
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                  />
                </div>
              </div>

              <button
                onClick={fetchMessages}
                disabled={loading || !currentUser}
                style={{ width: '100%', padding: '1rem', backgroundColor: loading ? '#9ca3af' : '#2563eb', color: 'white', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1.125rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'ログを取得中...' : 'ログを取得'}
              </button>

              {messages && !loading && (
                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>取得結果</h2>
                  <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', maxHeight: '400px', overflow: 'auto' }}>
                    <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                      {messages}
                    </pre>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                      onClick={copyToClipboard}
                      style={{ flex: 1, padding: '0.75rem', border: '2px solid #2563eb', backgroundColor: 'white', color: '#2563eb', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}
                    >
                      コピー
                    </button>
                    <button
                      onClick={downloadAsText}
                      style={{ flex: 1, padding: '0.75rem', border: '2px solid #2563eb', backgroundColor: 'white', color: '#2563eb', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}
                    >
                      ダウンロード
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 履歴タブ */}
          {activeTab === 'history' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>保存済みログ</h2>
              {savedLogs.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center' }}>まだログが保存されていません</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {savedLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => viewSavedLog(log)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>{log.roomName}</strong>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{log.count}件</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {log.startDate} 〜 {log.endDate}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        保存者: {log.user} | {new Date(log.savedAt).toLocaleString('ja-JP')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 設定タブ */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  ユーザー名（スタッフ名）
                </label>
                <input
                  type="text"
                  value={currentUser}
                  onChange={(e) => setCurrentUser(e.target.value)}
                  placeholder="例：大岩祐介"
                  style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  APIトークン
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Chatworkの設定画面で取得したトークン"
                  style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                />
              </div>

              <button
                onClick={saveUserSettings}
                style={{ width: '100%', padding: '1rem', backgroundColor: '#2563eb', color: 'white', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1rem', border: 'none', cursor: 'pointer' }}
              >
                設定を保存
              </button>

              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>自動保存設定</h3>
                
                <div style={{ backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                    選択したルームのログを3日ごとに自動保存します。
                    ※ブラウザを開いた時に自動実行されます。
                  </p>
                </div>

                <button
                  onClick={setupAutoSave}
                  disabled={!selectedRoom || !currentUser}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#10b981', color: 'white', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1rem', border: 'none', cursor: !selectedRoom || !currentUser ? 'not-allowed' : 'pointer' }}
                >
                  このルームの自動保存を設定
                </button>
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '0.5rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* 成功メッセージ */}
      {showSuccess && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', backgroundColor: '#10b981', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          ✓ 保存しました！
        </div>
      )}
    </div>
  );
}
}
