import React, { useState, useEffect } from 'react';

export default function ChatworkLogExtractor() {
  const [apiToken, setApiToken] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [messages, setMessages] = useState('');
  const [error, setError] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoSaveRooms, setAutoSaveRooms] = useState([]);
  const [savedLogs, setSavedLogs] = useState([]);

  useEffect(() => {
    // LocalStorageからトークンを読み込み
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
    }

    // デフォルトの日付を設定（3日前から今日まで）
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);
    
    // 自動保存設定を読み込み
    loadAutoSaveSettings();
    
    // 保存済みログを読み込み
    loadSavedLogs();
    
    // 自動保存チェック（ページ読み込み時）
    checkAutoSave();
  }, []);

  useEffect(() => {
    if (apiToken) {
      localStorage.setItem('chatworkApiToken', apiToken);
      loadRooms();
    }
  }, [apiToken]);

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    setAutoSaveRooms(saved);
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs.slice(0, 20)); // 最新20件のみ表示
  };

  const loadRooms = async () => {
    if (!apiToken) return;

    setLoadingRooms(true);
    setError('');
    
    try {
      const response = await fetch('/api/chatwork/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiToken }),
      });

      if (!response.ok) {
        throw new Error('ルーム一覧の取得に失敗しました。APIトークンを確認してください。');
      }

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
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchMessages = async () => {
    if (!apiToken || !selectedRoom || !startDate || !endDate) {
      setError('すべての項目を入力してください');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('開始日は終了日より前の日付を選択してください');
      return;
    }

    setLoading(true);
    setError('');
    setMessages('');

    try {
      const response = await fetch('/api/chatwork/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken,
          roomId: selectedRoom,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        throw new Error('メッセージの取得に失敗しました');
      }

      const data = await response.json();
      setMessages(data.messages);
      setMessageCount(data.count);
      
      // 100件制限の通知
      if (data.count === 100) {
        setError('※最新100件のみ表示されています（Chatwork APIの制限）');
      }
      
    } catch (err) {
      setError(err.message);
      // デモデータ
      const demoMessages = generateDemoMessages();
      setMessages(demoMessages);
      setMessageCount(25);
    } finally {
      setLoading(false);
    }
  };

  const generateDemoMessages = () => {
    const messages = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const sampleMessages = [
      { name: '大岩祐介', message: 'おはようございます。本日の診療開始します。' },
      { name: '看護師A', message: '承知しました。準備完了しています。' },
      { name: '受付B', message: '本日の予約は32名です。' },
      { name: '大岩祐介', message: 'ありがとうございます。スムーズに進めていきましょう。' },
      { name: '看護師C', message: '午後の検査準備も完了しました。' }
    ];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      messages.push(`\n========== ${dateStr} ==========\n`);
      
      sampleMessages.forEach((msg, index) => {
        const hour = 8 + index;
        const time = `${hour.toString().padStart(2, '0')}:${(index * 10).toString().padStart(2, '0')}`;
        messages.push(`[${time}] ${msg.name}: ${msg.message}`);
      });
    }
    
    return messages.join('\n');
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
      lastSaved: null,
      nextSave: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    };

    const existingIndex = saved.findIndex(r => r.roomId === selectedRoom);
    
    if (existingIndex >= 0) {
      // 既に登録されている場合は削除
      saved.splice(existingIndex, 1);
      setShowSuccess('自動保存を解除しました');
    } else {
      // 新規登録（10個まで）
      if (saved.length >= 10) {
        setError('自動保存は最大10個までです。他のルームの自動保存を解除してください。');
        return;
      }
      saved.push(roomData);
      setShowSuccess(`自動保存を設定しました（${saved.length}/10）`);
    }

    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const checkAutoSave = async () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    const token = localStorage.getItem('chatworkApiToken');
    
    if (!token) return;

    const now = new Date();
    let updated = false;

    // 最大10個まで処理
    for (const room of saved.slice(0, 10)) {
      const nextSave = new Date(room.nextSave || 0);
      
      if (now >= nextSave) {
        // 3日分のログを取得
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
            
            // ログを保存
            const logEntry = {
              id: Date.now() + Math.random(),
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
            
            // 次回保存日を更新
            room.lastSaved = now.toISOString();
            room.nextSave = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
            updated = true;
          }
        } catch (err) {
          console.error('自動保存エラー:', err);
        }
      }
    }

    if (updated) {
      // 最新50件のみ保持
      const trimmedLogs = logs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
      loadSavedLogs();
      loadAutoSaveSettings();
      setShowSuccess('自動保存を実行しました');
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const isAutoSaveEnabled = (roomId) => {
    return autoSaveRooms.some(r => r.roomId === roomId);
  };

  const viewSavedLog = (log) => {
    setMessages(log.content);
    setStartDate(log.startDate);
    setEndDate(log.endDate);
    window.scrollTo(0, 0);
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb', textAlign: 'center', marginBottom: '2rem' }}>
            Chatworkログ抽出
          </h1>

          <div style={{ backgroundColor: '#dbeafe', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#1e40af' }}>
              <strong>初回のみ設定が必要です</strong><br />
              APIトークンは保存されるので、次回からは入力不要です。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                ルームを選択
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                  disabled={!apiToken || loadingRooms}
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
                    padding: '0.75rem 1rem',
                    backgroundColor: isAutoSaveEnabled(selectedRoom) ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    border: 'none',
                    cursor: selectedRoom && (isAutoSaveEnabled(selectedRoom) || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed'
                  }}
                  title={autoSaveRooms.length >= 10 && !isAutoSaveEnabled(selectedRoom) ? '自動保存は最大10個まで' : '3日ごとに自動保存'}
                >
                  {isAutoSaveEnabled(selectedRoom) ? '自動OFF' : autoSaveRooms.length >= 10 ? '上限到達' : '自動ON'}
                </button>
              </div>
              {autoSaveRooms.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    ⏰ 自動保存中: {autoSaveRooms.length}/10 ルーム
                  </p>
                  {autoSaveRooms.length >= 8 && (
                    <p style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                      ※あと{10 - autoSaveRooms.length}個まで設定可能
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
                    setStartDate(threeDaysAgo.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  style={{ padding: '0.5rem', backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
                >
                  直近3日間
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setStartDate(weekAgo.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  今週
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
              disabled={loading}
              style={{ width: '100%', padding: '1rem', backgroundColor: loading ? '#9ca3af' : '#2563eb', color: 'white', fontWeight: '600', borderRadius: '0.5rem', fontSize: '1.125rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'ログを取得中...' : 'ログを取得'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: error.includes('100件') ? '#fef3c7' : '#fee2e2', color: error.includes('100件') ? '#92400e' : '#dc2626', borderRadius: '0.5rem' }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', width: '3rem', height: '3rem', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '1rem', color: '#6b7280' }}>ログを取得中...</p>
            </div>
          )}

          {messages && !loading && (
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>取得結果</h2>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {startDate} 〜 {endDate} | {messageCount}件
                </span>
              </div>
              
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

          {autoSaveRooms.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                自動保存設定中のルーム ({autoSaveRooms.length}/10)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {autoSaveRooms.map((room) => (
                  <div
                    key={room.roomId}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#dbeafe',
                      border: '1px solid #3b82f6',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>⏰ {room.roomName}</span>
                    <span style={{ color: '#6b7280' }}>
                      次回: {new Date(room.nextSave).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {savedLogs.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                保存履歴 {savedLogs.filter(log => log.isAutoSave).length > 0 && `(自動保存: ${savedLogs.filter(log => log.isAutoSave).length}件)`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflow: 'auto' }}>
                {savedLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => viewSavedLog(log)}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: log.isAutoSave ? '#f0f9ff' : '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong>{log.roomName}</strong>
                      <span style={{ color: '#6b7280' }}>{log.count}件</span>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                      {log.startDate} 〜 {log.endDate}
                      {log.isAutoSave && ' 🤖自動'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showSuccess && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', backgroundColor: '#10b981', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          {showSuccess}
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
  );
}
