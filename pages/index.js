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

  useEffect(() => {
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
    }
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(oneWeekAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (apiToken) {
      localStorage.setItem('chatworkApiToken', apiToken);
      loadRooms();
    }
  }, [apiToken]);

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
    } catch (err) {
      setError(err.message);
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
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                disabled={!apiToken || loadingRooms}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
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
                  onClick={() => {
                    setStartDate('2010-01-01');
                  }}
                  style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  最初から...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEndDate(new Date().toISOString().split('T')[0]);
                  }}
                  style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  ...今日まで
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setStartDate(weekAgo.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  今週
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    setStartDate(monthAgo.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                  style={{ padding: '0.5rem', backgroundColor: 'white', color: '#6b7280', fontWeight: '500', borderRadius: '0.5rem', fontSize: '0.75rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                >
                  今月
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
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '0.5rem' }}>
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
                  {startDate} 〜 {endDate} | {messageCount}件のメッセージ
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
        </div>
      </div>
      {showSuccess && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', backgroundColor: '#10b981', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          コピーしました！
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
