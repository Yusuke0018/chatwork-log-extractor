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
  const [showSuccess, setShowSuccess] = useState('');
  const [autoSaveRooms, setAutoSaveRooms] = useState([]);
  const [autoSaveDays, setAutoSaveDays] = useState(3);
  const [savedLogs, setSavedLogs] = useState([]);
  
  useEffect(() => {
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
      loadRooms(savedToken);
    } else {
      // APIトークンがない場合もダミーデータを読み込む
      loadRooms('');
    }
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);
    loadAutoSaveSettings();
    loadSavedLogs();
  }, []);

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    setAutoSaveRooms(saved);
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs);
  };

  const loadRooms = async (token) => {
    try {
      if (token) {
        const response = await fetch('/api/chatwork/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiToken: token }),
        });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        setRooms(data);
      } else {
        // トークンがない場合は最初からダミーデータを設定
        throw new Error('No token');
      }
    } catch (err) {
      // ダミーデータを常に設定
      const dummyRooms = [
        { room_id: '12345', name: '全体ミーティング' },
        { room_id: '12346', name: '経営会議' },
        { room_id: '12347', name: 'スタッフルーム' },
        { room_id: '12348', name: '開発チーム' },
        { room_id: '12349', name: '営業チーム' },
      ];
      setRooms(dummyRooms);
    }
  };

  const handleTokenChange = (e) => {
    const token = e.target.value;
    setApiToken(token);
    if (token) {
      localStorage.setItem('chatworkApiToken', token);
      loadRooms(token);
    } else {
      // トークンが削除された場合もダミーデータを読み込む
      loadRooms('');
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
    if (!selectedRoom) return;
    
    const currentRoom = rooms.find(r => r.room_id === selectedRoom);
    if (!currentRoom) {
      setError('ルーム情報が見つかりません。APIトークンを確認してください。');
      return;
    }
    
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const roomData = {
      roomId: selectedRoom,
      roomName: currentRoom.name,
      days: autoSaveDays
    };
    
    const existingIndex = saved.findIndex(r => r.roomId === selectedRoom);
    if (existingIndex >= 0) {
      saved.splice(existingIndex, 1);
      setShowSuccess(`${currentRoom.name}の自動保存を【解除】しました`);
    } else {
      if (saved.length >= 10) {
        setError('自動保存は最大10個までです');
        return;
      }
      saved.push(roomData);
      setShowSuccess(`${currentRoom.name}を自動保存に【追加】しました（${autoSaveDays}日ごと）`);
    }
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const updateAutoSaveDays = (roomId, newDays) => {
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const index = saved.findIndex(r => r.roomId === roomId);
    if (index >= 0) {
      saved[index].days = newDays;
      localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
      setAutoSaveRooms(saved);
      setShowSuccess(`${saved[index].roomName}の保存期間を${newDays}日に変更しました`);
      setTimeout(() => setShowSuccess(''), 3000);
    }
  };

  const removeAutoSave = (roomId, roomName) => {
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    saved = saved.filter(r => r.roomId !== roomId);
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    setShowSuccess(`${roomName}の自動保存を解除しました`);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const isAutoSaveEnabled = (roomId) => {
    return autoSaveRooms.some(r => r.roomId === roomId);
  };

  const getAutoSaveDays = (roomId) => {
    const room = autoSaveRooms.find(r => r.roomId === roomId);
    return room ? room.days || 3 : 3;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messages);
      setShowSuccess('コピーしました！');
      setTimeout(() => setShowSuccess(''), 2000);
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
    setSelectedRoom(log.roomId || '');
    setStartDate(log.startDate);
    setEndDate(log.endDate);
    window.scrollTo(0, 0);
  };

  const fixRoomNames = () => {
    if (rooms.length === 0) {
      setError('ルーム情報が読み込まれていません。APIトークンを設定してください。');
      setTimeout(() => setError(''), 3000);
      return;
    }

    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    let updatedCount = 0;
    let notFoundRooms = [];
    
    saved = saved.map(savedRoom => {
      // 文字列と数値の両方でマッチングを試みる
      const room = rooms.find(r => 
        r.room_id === savedRoom.roomId || 
        r.room_id === String(savedRoom.roomId) ||
        String(r.room_id) === String(savedRoom.roomId)
      );
      
      if (room) {
        savedRoom.roomName = room.name;
        updatedCount++;
      } else {
        notFoundRooms.push(savedRoom.roomId);
      }
      return savedRoom;
    });
    
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    
    if (notFoundRooms.length > 0) {
      setError(`一部のルームが見つかりません: ${notFoundRooms.join(', ')}`);
      setTimeout(() => setError(''), 5000);
    } else if (updatedCount > 0) {
      setShowSuccess(`${updatedCount}件のルーム名を更新しました`);
      setTimeout(() => setShowSuccess(''), 3000);
    } else {
      setShowSuccess('更新するルームがありませんでした');
      setTimeout(() => setShowSuccess(''), 3000);
    }
  };

  // ルーム名修正ボタンを表示するかどうかの判定を改善
  const shouldShowFixButton = () => {
    return autoSaveRooms.length > 0 && 
           autoSaveRooms.some(r => !r.roomName || r.roomName === 'Unknown');
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
      
      {/* ルーム名修正ボタン（一時的） */}
      {shouldShowFixButton() && (
        <button
          onClick={fixRoomNames}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            marginBottom: '20px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔧 ルーム名を修正（1回だけクリック）
        </button>
      )}
      
      {/* デバッグ情報（開発時のみ表示） */}
      {shouldShowFixButton() && (
        <div style={{ 
          backgroundColor: '#fef3c7', 
          padding: '10px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontSize: '12px'
        }}>
          <p style={{ margin: '0 0 5px 0' }}>
            ルーム情報: {rooms.length}件読み込み済み
          </p>
          <p style={{ margin: 0 }}>
            修正が必要な自動保存: {autoSaveRooms.filter(r => !r.roomName || r.roomName === 'Unknown').length}件
          </p>
        </div>
      )}
      
      {/* 自動保存状況の表示 */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {autoSaveRooms.map((room) => (
              <div 
                key={room.roomId} 
                style={{ 
                  backgroundColor: 'white',
                  border: '1px solid #0ea5e9',
                  padding: '10px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#0284c7', flex: 1 }}>
                  ⏰ {room.roomName || `ルームID: ${room.roomId}`}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>
                      保存期間:
                    </span>
                    <select
                      value={room.days || 3}
                      onChange={(e) => updateAutoSaveDays(room.roomId, parseInt(e.target.value))}
                      style={{
                        padding: '5px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(day => (
                        <option key={day} value={day}>{day}日</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => removeAutoSave(room.roomId, room.roomName || room.roomId)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    解除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            ※設定した日数ごとに自動でログを保存します
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
            disabled={!apiToken && rooms.length === 0}
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
        
        {selectedRoom && !isAutoSaveEnabled(selectedRoom) && autoSaveRooms.length < 10 && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px' }}>自動保存の期間:</span>
            <select
              value={autoSaveDays}
              onChange={(e) => setAutoSaveDays(parseInt(e.target.value))}
              style={{
                padding: '5px 10px',
                border: '2px solid #e5e7eb',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <option key={day} value={day}>{day}日ごと</option>
              ))}
            </select>
          </div>
        )}
        
        {selectedRoom && (
          <p style={{ 
            fontSize: '12px', 
            marginTop: '5px',
            color: isAutoSaveEnabled(selectedRoom) ? '#0ea5e9' : '#6b7280',
            fontWeight: isAutoSaveEnabled(selectedRoom) ? 'bold' : 'normal'
          }}>
            {isAutoSaveEnabled(selectedRoom) 
              ? `✅ このルームは${getAutoSaveDays(selectedRoom)}日ごとに自動保存されます` 
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
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={copyToClipboard}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
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
                padding: '10px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ダウンロード
            </button>
          </div>
        </div>
      )}
      
      {/* 保存履歴の表示 */}
      {savedLogs.length > 0 && (
        <div style={{ 
          marginTop: '30px', 
          paddingTop: '30px', 
          borderTop: '2px solid #e5e7eb' 
        }}>
          <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>
            📋 保存履歴（最新{Math.min(savedLogs.length, 20)}件）
          </h3>
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {savedLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                onClick={() => viewSavedLog(log)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: log.isAutoSave ? '#f0f9ff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ color: '#1f2937' }}>{log.roomName}</strong>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    {log.count}件 {log.isAutoSave && '🤖'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {log.startDate} 〜 {log.endDate}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                  保存日時: {new Date(log.savedAt).toLocaleString('ja-JP')}
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
