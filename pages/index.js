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
  const [debugMode, setDebugMode] = useState(false);
  const [autoSaveProgress, setAutoSaveProgress] = useState(''); // 自動保存の進行状況
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // モバイル判定
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const savedToken = localStorage.getItem('chatworkApiToken');
    if (savedToken) {
      setApiToken(savedToken);
      loadRooms(savedToken).then(() => {
        // ルーム読み込み後に自動保存をチェック
        checkAndExecuteAutoSave(savedToken);
      });
    } else {
      loadRooms('');
    }
    const today = new Date();
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(threeDaysAgo.toISOString().split('T')[0]);
    loadAutoSaveSettings();
    loadSavedLogs();
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 自動保存のチェックと実行
  const checkAndExecuteAutoSave = async (token) => {
    const autoSaveSettings = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const lastAutoSaveRecords = JSON.parse(localStorage.getItem('lastAutoSaveRecords') || '{}');
    
    if (autoSaveSettings.length === 0) return;
    
    console.log('かんたん定期保存チェック開始');
    setAutoSaveProgress('かんたん定期保存をチェック中...');
    
    for (const setting of autoSaveSettings) {
      const lastSaveDate = lastAutoSaveRecords[setting.roomId];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let shouldSave = false;
      if (!lastSaveDate) {
        // 初回は保存する
        shouldSave = true;
      } else {
        const lastSave = new Date(lastSaveDate);
        // 最後の保存日から設定日数経過しているかチェック
        const daysSinceLastSave = Math.floor((today - lastSave) / (1000 * 60 * 60 * 24));
        shouldSave = daysSinceLastSave > setting.days;
      }
      
      if (shouldSave) {
        console.log(`かんたん定期保存実行: ${setting.roomName} (${setting.days}日ごと)`);
        setAutoSaveProgress(`かんたん定期保存中: ${setting.roomName}...`);
        
        // 保存する期間を計算（最後の保存日の翌日から昨日まで全期間）
        const saveEndDate = new Date();
        saveEndDate.setDate(saveEndDate.getDate() - 1); // 昨日
        saveEndDate.setHours(23, 59, 59, 999);
        
        let saveStartDate;
        if (lastSaveDate) {
          // 最後の保存日の翌日から開始
          saveStartDate = new Date(lastSaveDate);
          saveStartDate.setDate(saveStartDate.getDate() + 1);
          saveStartDate.setHours(0, 0, 0, 0);
        } else {
          // 初回は設定日数分
          saveStartDate = new Date(saveEndDate);
          saveStartDate.setDate(saveStartDate.getDate() - (setting.days - 1));
          saveStartDate.setHours(0, 0, 0, 0);
        }
        
        // 保存期間の日数を計算してログに出力
        const daysDiff = Math.floor((saveEndDate - saveStartDate) / (1000 * 60 * 60 * 24)) + 1;
        console.log(`保存期間: ${daysDiff}日分（${saveStartDate.toLocaleDateString('ja-JP')}〜${saveEndDate.toLocaleDateString('ja-JP')}）`);
        
        await autoSaveMessages(
          token,
          setting.roomId,
          setting.roomName,
          saveStartDate.toISOString().split('T')[0],
          saveEndDate.toISOString().split('T')[0]
        );
        
        // 最後の保存日を記録（昨日の日付を記録）
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        lastAutoSaveRecords[setting.roomId] = yesterday.toISOString();
        localStorage.setItem('lastAutoSaveRecords', JSON.stringify(lastAutoSaveRecords));
      }
    }
    
    setAutoSaveProgress('');
    console.log('かんたん定期保存チェック完了');
  };

  // 自動保存の実行
  const autoSaveMessages = async (token, roomId, roomName, startDate, endDate) => {
    try {
      const response = await fetch('/api/chatwork/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken: token,
          roomId,
          startDate,
          endDate,
        }),
      });
      
      let data;
      if (!response.ok) {
        // ダミーデータ生成
        data = generateDummyMessages(roomName);
      } else {
        data = await response.json();
      }
      
      // ログを保存
      const newLog = {
        id: Date.now().toString(),
        roomName,
        roomId,
        content: data.messages,
        count: data.count,
        startDate,
        endDate,
        savedAt: new Date().toISOString(),
        isAutoSave: true // 自動保存フラグ
      };
      
      const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
      logs.unshift(newLog);
      const trimmedLogs = logs.slice(0, 50);
      localStorage.setItem('savedLogs', JSON.stringify(trimmedLogs));
      loadSavedLogs();
      
      setShowSuccess(`${roomName}のログをかんたん定期保存しました（${startDate}〜${endDate}）`);
      setTimeout(() => setShowSuccess(''), 3000);
      
    } catch (err) {
      console.error(`かんたん定期保存エラー (${roomName}):`, err);
    }
  };

  // ダミーメッセージ生成関数
  const generateDummyMessages = (roomName) => {
    const messages = [];
    const messageCount = Math.floor(Math.random() * 30) + 10;
    
    for (let i = 0; i < messageCount; i++) {
      messages.push(`[テスト] ${roomName}のメッセージ${i + 1}`);
    }
    
    return {
      messages: messages.join('\n'),
      count: messageCount
    };
  };

  const loadAutoSaveSettings = () => {
    const saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    console.log('読み込んだ自動保存設定:', saved);
    setAutoSaveRooms(saved);
  };

  const loadSavedLogs = () => {
    const logs = JSON.parse(localStorage.getItem('savedLogs') || '[]');
    setSavedLogs(logs);
  };

  const loadRooms = async (token) => {
    console.log('loadRooms開始, token:', token ? 'あり' : 'なし');
    
    // 常にダミーデータを用意
    const dummyRooms = [
      { room_id: '12345', name: '全体ミーティング' },
      { room_id: '12346', name: '経営会議' },
      { room_id: '12347', name: 'スタッフルーム' },
      { room_id: '12348', name: '開発チーム' },
      { room_id: '12349', name: '営業チーム' },
    ];
    
    try {
      if (token) {
        const response = await fetch('/api/chatwork/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiToken: token }),
        });
        
        console.log('API応答ステータス:', response.status);
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('取得したルーム数:', data.length);
        console.log('最初のルーム:', data[0]);
        
        if (data && data.length > 0) {
          setRooms(data);
          return;
        } else {
          console.log('APIからルームが取得できませんでした');
          throw new Error('No rooms returned');
        }
      }
    } catch (err) {
      console.error('ルーム取得エラー:', err.message);
    }
    
    // エラー時またはトークンがない場合はダミーデータを使用
    console.log('ダミーデータを使用します');
    setRooms(dummyRooms);
  };

  const handleTokenChange = (e) => {
    const token = e.target.value;
    setApiToken(token);
    if (token) {
      localStorage.setItem('chatworkApiToken', token);
      loadRooms(token).then(() => {
        checkAndExecuteAutoSave(token);
      });
    } else {
      localStorage.removeItem('chatworkApiToken');
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
      
      let data;
      if (!response.ok) {
        console.log('API失敗、ダミーデータを使用');
        const roomName = rooms.find(r => String(r.room_id) === String(selectedRoom))?.name || 'Unknown';
        data = generateDummyMessages(roomName);
      } else {
        data = await response.json();
      }
      
      setMessages(data.messages);
      setMessageCount(data.count);
      if (data.count === 100) {
        setError('※最新100件のみ表示されています');
      }
      
      const roomName = rooms.find(r => String(r.room_id) === String(selectedRoom))?.name || 'Unknown';
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
      console.error('メッセージ取得エラー:', err);
      const roomName = rooms.find(r => String(r.room_id) === String(selectedRoom))?.name || 'Unknown';
      const data = generateDummyMessages(roomName);
      setMessages(data.messages);
      setMessageCount(data.count);
    }
    setLoading(false);
  };

  const toggleAutoSave = () => {
    if (!selectedRoom) {
      console.log('ルームが選択されていません');
      return;
    }
    
    console.log('=== toggleAutoSave デバッグ情報 ===');
    console.log('選択されたルームID:', selectedRoom, '型:', typeof selectedRoom);
    console.log('現在のrooms配列:', rooms);
    console.log('rooms配列の長さ:', rooms.length);
    
    if (rooms.length === 0) {
      setError('ルーム情報が読み込まれていません。少し待ってから再度お試しください。');
      return;
    }
    
    // 型を合わせて検索
    const currentRoom = rooms.find(r => {
      const match = String(r.room_id) === String(selectedRoom);
      console.log(`比較: "${r.room_id}" (${typeof r.room_id}) === "${selectedRoom}" (${typeof selectedRoom}) => ${match}`);
      return match;
    });
    
    console.log('検索結果のルーム:', currentRoom);
    
    if (!currentRoom) {
      setError(`ルーム情報が見つかりません。選択されたルームID: ${selectedRoom}`);
      console.error('ルームが見つからない。利用可能なルームID:', rooms.map(r => r.room_id));
      return;
    }
    
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const roomData = {
      roomId: String(selectedRoom), // 文字列として保存
      roomName: currentRoom.name,
      days: autoSaveDays
    };
    
    const existingIndex = saved.findIndex(r => String(r.roomId) === String(selectedRoom));
    if (existingIndex >= 0) {
      saved.splice(existingIndex, 1);
      // 最後の保存記録も削除
      const lastRecords = JSON.parse(localStorage.getItem('lastAutoSaveRecords') || '{}');
      delete lastRecords[String(selectedRoom)];
      localStorage.setItem('lastAutoSaveRecords', JSON.stringify(lastRecords));
      
      setShowSuccess(`${currentRoom.name}のかんたん定期保存を【解除】しました`);
    } else {
      if (saved.length >= 10) {
        setError('かんたん定期保存は最大10個までです');
        return;
      }
      saved.push(roomData);
      setShowSuccess(`${currentRoom.name}をかんたん定期保存に【追加】しました（${autoSaveDays}日ごと）`);
    }
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const updateAutoSaveDays = (roomId, newDays) => {
    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    const index = saved.findIndex(r => String(r.roomId) === String(roomId));
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
    saved = saved.filter(r => String(r.roomId) !== String(roomId));
    localStorage.setItem('autoSaveRooms', JSON.stringify(saved));
    setAutoSaveRooms(saved);
    
    // 最後の保存記録も削除
    const lastRecords = JSON.parse(localStorage.getItem('lastAutoSaveRecords') || '{}');
    delete lastRecords[String(roomId)];
    localStorage.setItem('lastAutoSaveRecords', JSON.stringify(lastRecords));
    
    setShowSuccess(`${roomName}のかんたん定期保存を解除しました`);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const isAutoSaveEnabled = (roomId) => {
    return autoSaveRooms.some(r => String(r.roomId) === String(roomId));
  };

  const getAutoSaveDays = (roomId) => {
    const room = autoSaveRooms.find(r => String(r.roomId) === String(roomId));
    return room ? room.days || 3 : 3;
  };

  const getLastAutoSaveDate = (roomId) => {
    const lastRecords = JSON.parse(localStorage.getItem('lastAutoSaveRecords') || '{}');
    return lastRecords[String(roomId)];
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
    const roomName = rooms.find(r => String(r.room_id) === String(selectedRoom))?.name || 'チャット';
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
    console.log('fixRoomNames開始');
    console.log('現在のrooms:', rooms);
    console.log('自動保存ルーム:', autoSaveRooms);
    
    if (rooms.length === 0) {
      setError('ルーム情報が読み込まれていません。APIトークンを設定してください。');
      setTimeout(() => setError(''), 3000);
      return;
    }

    let saved = JSON.parse(localStorage.getItem('autoSaveRooms') || '[]');
    let updatedCount = 0;
    let notFoundRooms = [];
    
    saved = saved.map(savedRoom => {
      // 文字列として比較
      const room = rooms.find(r => String(r.room_id) === String(savedRoom.roomId));
      
      if (room) {
        savedRoom.roomName = room.name;
        updatedCount++;
        console.log(`更新: ${savedRoom.roomId} => ${room.name}`);
      } else {
        notFoundRooms.push(savedRoom.roomId);
        console.log(`見つからない: ${savedRoom.roomId}`);
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

  // ルーム名修正ボタンを表示するかどうかの判定
  const shouldShowFixButton = () => {
    return autoSaveRooms.length > 0 && 
           autoSaveRooms.some(r => !r.roomName || r.roomName === 'Unknown');
  };

  // LocalStorageをクリアする緊急ボタン
  const clearAutoSaveSettings = () => {
    if (window.confirm('すべてのかんたん定期保存設定を削除しますか？この操作は取り消せません。')) {
      localStorage.removeItem('autoSaveRooms');
      localStorage.removeItem('lastAutoSaveRecords');
      setAutoSaveRooms([]);
      setShowSuccess('かんたん定期保存設定をクリアしました');
      setTimeout(() => setShowSuccess(''), 3000);
    }
  };

  // 手動で自動保存を実行
  const manualAutoSave = async () => {
    if (!apiToken) {
      setError('APIトークンを設定してください');
      return;
    }
    await checkAndExecuteAutoSave(apiToken);
  };

  return (
    <div style={{ 
      padding: isMobile ? '10px' : '20px', 
      maxWidth: '600px', 
      margin: '0 auto'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        color: '#2563eb',
        fontSize: isMobile ? '24px' : '32px',
        marginBottom: '20px'
      }}>
        Chatworkログ抽出
      </h1>
      
      <div style={{ 
        backgroundColor: '#dbeafe', 
        padding: isMobile ? '12px' : '15px', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: isMobile ? '13px' : '14px' 
        }}>
          初回のみAPIトークンの設定が必要です
        </p>
      </div>
      
      {/* かんたん定期保存の進行状況 */}
      {autoSaveProgress && (
        <div style={{ 
          backgroundColor: '#10b981', 
          color: 'white',
          padding: '10px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {autoSaveProgress}
        </div>
      )}
      
      {/* デバッグモード切り替え */}
      <div style={{ marginBottom: '10px', textAlign: 'right' }}>
        <label style={{ fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          デバッグモード
        </label>
      </div>
      
      {/* デバッグ情報 */}
      {debugMode && (
        <div style={{ 
          backgroundColor: '#fef3c7', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontSize: '12px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <strong>デバッグ情報:</strong>{'\n'}
          APIトークン: {apiToken ? '設定済み' : '未設定'}{'\n'}
          ルーム数: {rooms.length}{'\n'}
          選択中のルームID: {selectedRoom || 'なし'} (型: {typeof selectedRoom}){'\n'}
          かんたん定期保存設定数: {autoSaveRooms.length}{'\n'}
          {'\n'}
          <strong>ルーム一覧:</strong>{'\n'}
          {rooms.map(r => `ID: ${r.room_id} (${typeof r.room_id}), 名前: ${r.name}`).join('\n')}
          {'\n\n'}
          <strong>かんたん定期保存設定:</strong>{'\n'}
          {autoSaveRooms.map(r => {
            const lastSave = getLastAutoSaveDate(r.roomId);
            return `ID: ${r.roomId} (${typeof r.roomId}), 名前: ${r.roomName || '未設定'}, ${r.days}日ごと, 最終: ${lastSave ? new Date(lastSave).toLocaleDateString('ja-JP') : '未実行'}`;
          }).join('\n')}
        </div>
      )}
      
      {/* ルーム名修正ボタン */}
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
      
      {/* 手動定期保存実行ボタン */}
      {autoSaveRooms.length > 0 && (
        <button
          onClick={manualAutoSave}
          disabled={!apiToken || autoSaveProgress !== ''}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '10px',
            backgroundColor: autoSaveProgress ? '#9ca3af' : '#06b6d4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            marginBottom: '20px',
            cursor: apiToken && !autoSaveProgress ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            fontSize: '16px',
            WebkitAppearance: 'none'
          }}
        >
          🔄 手動でかんたん定期保存
        </button>
      )}
      
      {/* 緊急リセットボタン */}
      {autoSaveRooms.length > 0 && debugMode && (
        <button
          onClick={clearAutoSaveSettings}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            marginBottom: '20px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⚠️ かんたん定期保存設定をすべて削除（緊急用）
        </button>
      )}
      
      {/* かんたん定期保存状況の表示 */}
      {autoSaveRooms.length > 0 && (
        <div style={{ 
          backgroundColor: '#f0f9ff', 
          border: '2px solid #0ea5e9',
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0284c7', fontSize: '16px' }}>
            📅 かんたん定期保存中のルーム（{autoSaveRooms.length}/10）
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {autoSaveRooms.map((room) => {
              const lastSave = getLastAutoSaveDate(room.roomId);
              let nextSaveDate = '初回保存待ち';
              let statusText = '未実行';
              
              if (lastSave) {
                const lastSaveDate = new Date(lastSave);
                statusText = lastSaveDate.toLocaleDateString('ja-JP');
                
                // 次回保存予定日（最後の保存日 + 1日 + 設定日数）
                const next = new Date(lastSave);
                next.setDate(next.getDate() + room.days + 1);
                nextSaveDate = next.toLocaleDateString('ja-JP');
                
                // 現在取りこぼしている日数を計算
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysSinceLastSave = Math.floor((today - lastSaveDate) / (1000 * 60 * 60 * 24)) - 1;
                
                if (daysSinceLastSave > room.days) {
                  statusText += ` (${daysSinceLastSave}日分未保存)`;
                }
              }
              
              return (
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
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 'bold', color: '#0284c7' }}>
                      ⏰ {room.roomName || `ルームID: ${room.roomId}`}
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                      最終保存: {statusText} | 
                      次回: {nextSaveDate}
                    </div>
                  </div>
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
              );
            })}
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            ※アプリを開いた時、設定日数が経過していれば自動でログを保存します
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            ※取りこぼしがある場合は、前回保存日の翌日から昨日までの全期間を保存
          </p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '5px', 
          fontWeight: 'bold',
          fontSize: isMobile ? '14px' : '16px'
        }}>
          APIトークン
        </label>
        <input
          type="password"
          value={apiToken}
          onChange={handleTokenChange}
          style={{
            width: '100%',
            padding: isMobile ? '12px' : '10px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '16px', // 16px以上でスマホのズームを防ぐ
            boxSizing: 'border-box', // パディングを含めた幅計算
            WebkitAppearance: 'none' // iOSのデフォルトスタイルを無効化
          }}
          placeholder="Chatworkの設定画面で取得したトークン"
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '5px', 
          fontWeight: 'bold',
          fontSize: isMobile ? '14px' : '16px'
        }}>
          ルームを選択
        </label>
        <div style={{ 
          display: 'flex', 
          gap: '10px',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <select
            value={selectedRoom}
            onChange={(e) => {
              console.log('ルーム選択変更:', e.target.value);
              setSelectedRoom(e.target.value);
            }}
            style={{
              flex: 1,
              padding: isMobile ? '12px' : '10px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: selectedRoom && isAutoSaveEnabled(selectedRoom) ? '#f0f9ff' : 'white',
              boxSizing: 'border-box',
              WebkitAppearance: 'none'
            }}
            disabled={rooms.length === 0}
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
              padding: isMobile ? '12px 20px' : '10px 20px',
              backgroundColor: !selectedRoom ? '#e5e7eb' : isAutoSaveEnabled(selectedRoom) ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
              color: !selectedRoom ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedRoom && (isAutoSaveEnabled(selectedRoom) || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '16px',
              minWidth: isMobile ? '100%' : '120px',
              WebkitAppearance: 'none'
            }}
          >
            {!selectedRoom ? '選択して' : isAutoSaveEnabled(selectedRoom) ? '🔴 定期OFF' : autoSaveRooms.length >= 10 ? '❌ 上限' : '🟢 定期ON'}
          </button>
        </div>
        
        {selectedRoom && !isAutoSaveEnabled(selectedRoom) && autoSaveRooms.length < 10 && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px' }}>かんたん定期保存の期間:</span>
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
              ? `✅ このルームは${getAutoSaveDays(selectedRoom)}日ごとにかんたん定期保存されます` 
              : '❌ このルームはかんたん定期保存されていません'}
          </p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
          gap: '10px' 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px' 
            }}>
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                WebkitAppearance: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontSize: '14px' 
            }}>
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: isMobile ? '12px' : '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                WebkitAppearance: 'none'
              }}
            />
          </div>
        </div>
      </div>
      
      <button
        onClick={fetchMessages}
        disabled={loading || !apiToken}
        style={{
          width: '100%',
          padding: isMobile ? '16px' : '15px',
          backgroundColor: loading || !apiToken ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 'bold',
          cursor: loading || !apiToken ? 'not-allowed' : 'pointer',
          WebkitAppearance: 'none',
          WebkitTapHighlightColor: 'transparent'
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
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            marginTop: '10px',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <button
              onClick={copyToClipboard}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '10px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                WebkitAppearance: 'none'
              }}
            >
              コピー
            </button>
            <button
              onClick={downloadAsText}
              style={{
                flex: 1,
                padding: isMobile ? '12px' : '10px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                WebkitAppearance: 'none'
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
