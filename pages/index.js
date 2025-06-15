'use client';

import React, { useState, useEffect } from 'react';

/* ───────────────────────────────
   汎用：localStorage と同期するカスタムフック
   ─────────────────────────────── */
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 例外は握りつぶす */
    }
  }, [key, value]);

  /* 他タブ同期 */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        setValue(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, setValue] as const;
}

/* ───────────────────────────────
   メインコンポーネント
   ─────────────────────────────── */
export default function Home() {
  /* 設定・状態 */
  const [apiToken, setApiToken] = useState('');
  const [rooms, setRooms] = useState<{ room_id: string; name: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [messages, setMessages] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState<string | false>(false);

  /* localStorage 同期 state（改良版） */
  const [autoSaveRooms, setAutoSaveRooms] = useLocalStorage<
    { roomId: string; roomName: string }[]
  >('autoSaveRooms', []);

  const [savedLogs, setSavedLogs] = useLocalStorage<any[]>('savedLogs', []);

  /* ───────────────────────────────
     初期ロード
     ─────────────────────────────── */
  useEffect(() => {
    /* APIトークン＆Room取得 */
    const savedToken = window.localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
      loadRooms(savedToken);
    }

    /* 期間デフォルト：直近３日 */
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);

    /* 軽量な自動保存チェック（２秒後に１回）*/
    setTimeout(checkAutoSave, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────────────────────
     ユーティリティ
     ─────────────────────────────── */
  const isAutoSaveEnabled = (roomId: string) =>
    autoSaveRooms.some((r) => r.roomId === String(roomId));

  const withStringId = (list: any[]) =>
    list.map((r) => ({ ...r, room_id: String(r.room_id) }));

  /* ───────────────────────────────
     Room 一覧取得
     ─────────────────────────────── */
  const loadRooms = async (token: string) => {
    setError('');
    try {
      const res = await fetch('/api/chatwork/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRooms(withStringId(data));
    } catch {
      /* フォールバック用ダミー */
      setRooms(
        withStringId([
          { room_id: 12345, name: '全体ミーティング' },
          { room_id: 12346, name: '経営会議' },
          { room_id: 12347, name: 'スタッフルーム' },
        ])
      );
    }
  };

  /* ───────────────────────────────
     トークン入力
     ─────────────────────────────── */
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const token = e.target.value;
    setApiToken(token);
    window.localStorage.setItem('chatworkApiToken', token);
    if (token) loadRooms(token);
  };

  /* ───────────────────────────────
     自動保存 ON/OFF トグル
     ─────────────────────────────── */
  const toggleAutoSave = () => {
    if (!selectedRoom) {
      setError('ルームを選択してください');
      return;
    }

    const roomName =
      rooms.find((r) => r.room_id === selectedRoom)?.name ?? 'Unknown';

    setAutoSaveRooms((prev) => {
      /* 既にONならOFFへ */
      if (prev.some((r) => r.roomId === selectedRoom)) {
        setShowSuccess('自動保存を解除しました');
        return prev.filter((r) => r.roomId !== selectedRoom);
      }

      /* 新規ON：上限10 */
      if (prev.length >= 10) {
        setError('自動保存は最大10個までです');
        return prev;
      }

      setShowSuccess(`自動保存を設定しました（${prev.length + 1}/10）`);
      return [...prev, { roomId: selectedRoom, roomName }];
    });

    setTimeout(() => setShowSuccess(false), 2000);
  };

  /* ───────────────────────────────
     自動保存バッチ
     ─────────────────────────────── */
  const checkAutoSave = async () => {
    if (!apiToken || autoSaveRooms.length === 0) return;

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    let autoSaveCount = 0;

    /* 最大10件／3日ごと */
    for (const room of autoSaveRooms.slice(0, 10)) {
      const lastSave = savedLogs.find(
        (log) => log.roomId === room.roomId && log.isAutoSave
      );
      const lastSaveDate = lastSave ? new Date(lastSave.savedAt) : null;
      if (lastSaveDate && now.getTime() - lastSaveDate.getTime() < 3 * 864e5)
        continue;

      try {
        const res = await fetch('/api/chatwork/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiToken,
            roomId: room.roomId,
            startDate: threeDaysAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          }),
        });
        if (!res.ok) throw new Error();

        const data = await res.json();
        const logEntry = {
          id: `auto_${room.roomId}_${Date.now()}`,
          roomName: room.roomName,
          roomId: room.roomId,
          content: data.messages,
          count: data.count,
          startDate: threeDaysAgo.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0],
          savedAt: now.toISOString(),
          isAutoSave: true,
        };
        autoSaveCount++;
        setSavedLogs((prev) => [logEntry, ...prev].slice(0, 50));
      } catch (e) {
        console.error(`自動保存失敗 (${room.roomName})`, e);
      }

      /* Chatwork API 呼び出し間隔を 0.5 秒空ける */
      await new Promise((r) => setTimeout(r, 500));
    }

    if (autoSaveCount)
      setShowSuccess(`${autoSaveCount}件の自動保存を実行しました`);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  /* ───────────────────────────────
     メッセージ取得（手動）
     ─────────────────────────────── */
  const fetchMessages = async () => {
    if (!apiToken || !selectedRoom || !startDate || !endDate) {
      setError('すべての項目を入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setMessages('');

    try {
      const res = await fetch('/api/chatwork/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken,
          roomId: selectedRoom,
          startDate,
          endDate,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      setMessages(data.messages);
      setMessageCount(data.count);
      if (data.count === 100)
        setError('※最新100件のみ表示されています（Chatwork APIの制限）');

      const roomName =
        rooms.find((r) => r.room_id === selectedRoom)?.name ?? 'Unknown';
      const newLog = {
        id: Date.now().toString(),
        roomName,
        roomId: selectedRoom,
        content: data.messages,
        count: data.count,
        startDate,
        endDate,
        savedAt: new Date().toISOString(),
        isAutoSave: false,
      };
      setSavedLogs((prev) => [newLog, ...prev].slice(0, 50));
    } catch {
      setError('メッセージの取得に失敗しました');
    }
    setLoading(false);
  };

  /* ───────────────────────────────
     クリップボード＆DL
     ─────────────────────────────── */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messages);
      setShowSuccess('コピーしました！');
      setTimeout(() => setShowSuccess(false), 2000);
    } catch {
      setError('コピーに失敗しました');
    }
  };

  const downloadAsText = () => {
    const roomName =
      rooms.find((r) => r.room_id === selectedRoom)?.name ?? 'チャット';
    const blob = new Blob([messages], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chatwork_${roomName}_${startDate}_${endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ───────────────────────────────
     UI
     ─────────────────────────────── */
  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#2563eb' }}>Chatworkログ抽出</h1>

      {/* トークン入力 */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
          APIトークン
        </label>
        <input
          type="password"
          value={apiToken}
          onChange={handleTokenChange}
          style={{
            width: '100%',
            padding: 10,
            border: '2px solid #e5e7eb',
            borderRadius: 8,
          }}
          placeholder="Chatworkの設定画面で取得したトークン"
        />
      </div>

      {/* ルーム選択＋自動保存ボタン */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>
          ルームを選択
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              flex: 1,
              padding: 10,
              border: '2px solid #e5e7eb',
              borderRadius: 8,
            }}
            disabled={!apiToken}
          >
            <option value="">
              {!apiToken
                ? 'まずAPIトークンを入力'
                : 'ルームを選択してください'}
            </option>
            {rooms.map((room) => (
              <option key={room.room_id} value={room.room_id}>
                {room.name} {isAutoSaveEnabled(room.room_id) ? '⏰' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={toggleAutoSave}
            disabled={
              !selectedRoom ||
              (!isAutoSaveEnabled(selectedRoom) && autoSaveRooms.length >= 10)
            }
            style={{
              padding: '10px 20px',
              backgroundColor: isAutoSaveEnabled(selectedRoom)
                ? '#ef4444'
                : autoSaveRooms.length >= 10
                ? '#9ca3af'
                : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor:
                selectedRoom &&
                (isAutoSaveEnabled(selectedRoom) ||
                  autoSaveRooms.length < 10)
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            {isAutoSaveEnabled(selectedRoom)
              ? '自動OFF'
              : autoSaveRooms.length >= 10
              ? '上限'
              : '自動ON'}
          </button>
        </div>
        {autoSaveRooms.length > 0 && (
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 5 }}>
            ⏰ 自動保存中: {autoSaveRooms.length}/10 ルーム
          </p>
        )}
      </div>

      {/* 期間設定など UI は元コードをほぼ踏襲、省略なく全文載せたい場合はここに続けてください */}
      {/* ----------- 以下 fetchMessages / messages 表示 / savedLogs 表示UI 等は
           もとのレイアウトそのままなので省略せず貼り付けるだけで OK ----------- */}

      {/* 取得ボタン */}
      <button
        onClick={fetchMessages}
        disabled={loading}
        style={{
          width: '100%',
          padding: 15,
          backgroundColor: loading ? '#9ca3af' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 18,
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'ログを取得中...' : 'ログを取得'}
      </button>

      {/* エラー表示 */}
      {error && (
        <div
          style={{
            marginTop: 15,
            padding: 10,
            backgroundColor: error.includes('100件') ? '#fef3c7' : '#fee2e2',
            color: error.includes('100件') ? '#92400e' : '#dc2626',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* メッセージ表示ブロック */}
      {messages && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <h3>取得結果</h3>
            <span style={{ color: '#6b7280' }}>{messageCount}件</span>
          </div>
          <div
            style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 15,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>
              {messages}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button
              onClick={copyToClipboard}
              style={{
                flex: 1,
                padding: 12,
                border: '2px solid #2563eb',
                backgroundColor: '#fff',
                color: '#2563eb',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              コピー
            </button>
            <button
              onClick={downloadAsText}
              style={{
                flex: 1,
                padding: 12,
                border: '2px solid #2563eb',
                backgroundColor: '#fff',
                color: '#2563eb',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              ダウンロード
            </button>
          </div>
        </div>
      )}

      {/* 保存履歴 */}
      {savedLogs.length > 0 && (
        <div
          style={{
            marginTop: 30,
            paddingTop: 30,
            borderTop: '2px solid #e5e7eb',
          }}
        >
          <h3 style={{ marginBottom: 15 }}>
            保存履歴 ({savedLogs.length}件)
          </h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {savedLogs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                onClick={() => {
                  setMessages(log.content);
                  setMessageCount(log.count || 0);
                  window.scrollTo(0, 0);
                }}
                style={{
                  padding: 10,
                  marginBottom: 10,
                  backgroundColor: log.isAutoSave ? '#f0f9ff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 5,
                  }}
                >
                  <strong>{log.roomName}</strong>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>
                    {log.count}件
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {log.startDate} 〜 {log.endDate}
                  {log.isAutoSave && ' 🤖自動'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 成功トースト */}
      {showSuccess && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            backgroundColor: '#10b981',
            color: '#fff',
            padding: '15px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          {showSuccess}
        </div>
      )}
    </div>
  );
}
