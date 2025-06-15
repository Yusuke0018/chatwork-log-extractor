import React from 'react';

// このコンポーネントは、Firebase を使用してデータを永続化し、
// Chatwork API と連携してチャットログを抽出、表示、保存する機能を提供します。
//
// 主な機能：
// - Firebase Firestore を使用したAPIトークン、自動保存設定、ログ履歴の永続化
// - Chatwork APIトークンを入力し、参加しているルーム一覧を取得
// - 特定のルームと期間を指定して、メッセージログを取得
// - 取得したログの表示、クリップボードへのコピー、テキストファイルとしてダウンロード
// - 特定のルームのログを自動で定期的に保存する機能（最大10ルーム）
// - 保存したログの履歴を表示し、過去のログを再表示する機能
//
// 使用上の注意：
// - このコンポーネントは、別途 /api/chatwork/rooms と /api/chatwork/messages
//   というバックエンドAPIが実装されていることを前提としています。
//   これらのAPIは、フロントエンドから受け取ったリクエストを基に、
//   実際にChatwork APIへアクセスする役割を担います。
// - Firebase の設定が必要です。Firebaseプロジェクトを作成し、
//   その設定情報を環境変数などからこのコンポーネントに渡す必要があります。

// React と Firebase のフックをインポート
const { useState, useEffect, useCallback } = React;

// --- Firebase設定 (通常は外部ファイルや環境変数から読み込みます) ---
// Canvas環境では、これらのグローバル変数が自動的に提供されます。
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-chatwork-log-app';

// --- Firebaseサービスのインポート (CDN経由) ---
// HTMLファイルで <script type="module"> ... </script> として読み込む必要があります。
// この例では、Reactコンポーネント内にインポート文を記述していますが、
// 実際にはHTMLの<head>セクションで読み込むのが一般的です。
// ここでは、グローバルスコープに `firebase` オブジェクトが存在することを想定しています。
// 例: import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// --- メインのReactコンポーネント ---
export default function App() {
    // --- State管理 ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);

    const [apiToken, setApiToken] = useState('');
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [messages, setMessages] = useState('');
    const [messageCount, setMessageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(''); // 文字列を保持するように変更
    const [autoSaveRooms, setAutoSaveRooms] = useState([]);
    const [savedLogs, setSavedLogs] = useState([]);

    // --- Firebaseの初期化と認証 ---
    useEffect(() => {
        // Firebaseの各サービスを動的にインポート
        const { initializeApp } = window.firebase.app;
        const { getFirestore, doc, getDoc, setDoc, onSnapshot, collection } = window.firebase.firestore;
        const { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } = window.firebase.auth;

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestore);
            setAuth(authInstance);

            onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // __initial_auth_token はCanvas環境から提供されるカスタムトークン
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        try {
                            await signInWithCustomToken(authInstance, __initial_auth_token);
                        } catch (e) {
                            console.error("Custom token sign-in failed, falling back to anonymous.", e);
                            await signInAnonymously(authInstance);
                        }
                    } else {
                        await signInAnonymously(authInstance);
                    }
                }
            });
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            setError("アプリケーションの初期化に失敗しました。");
        }
    }, []);

    // --- Firestoreからデータをロードする関数 ---
    const loadDataFromFirestore = useCallback(async (uid) => {
        if (!db || !uid) return;
        const { doc, getDoc, onSnapshot } = window.firebase.firestore;

        // APIトークンをロード
        const tokenDocRef = doc(db, "artifacts", appId, "users", uid, "settings", "apiToken");
        const tokenDocSnap = await getDoc(tokenDocRef);
        if (tokenDocSnap.exists()) {
            const token = tokenDocSnap.data().token;
            setApiToken(token);
            if (token) {
                loadRooms(token);
            }
        }

        // 自動保存ルームをロード (リアルタイム更新)
        const autoSaveRef = doc(db, "artifacts", appId, "users", uid, "settings", "autoSaveRooms");
        onSnapshot(autoSaveRef, (docSnap) => {
            if (docSnap.exists()) {
                setAutoSaveRooms(docSnap.data().rooms || []);
            } else {
                setAutoSaveRooms([]);
            }
        });
        
        // 保存ログをロード (リアルタイム更新)
        const logsRef = doc(db, "artifacts", appId, "users", uid, "data", "savedLogs");
        onSnapshot(logsRef, (docSnap) => {
            if (docSnap.exists()) {
                 const logsData = docSnap.data().logs || [];
                 // 念のため日付でソート
                 logsData.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
                 setSavedLogs(logsData);
            } else {
                setSavedLogs([]);
            }
        });

    }, [db, appId]);

    // --- ユーザーIDが確定したらデータをロード ---
    useEffect(() => {
        if (userId) {
            loadDataFromFirestore(userId);
        }
    }, [userId, loadDataFromFirestore]);


    // --- 初期の日付設定 ---
    useEffect(() => {
        const today = new Date();
        const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
        setEndDate(today.toISOString().split('T')[0]);
        setStartDate(threeDaysAgo.toISOString().split('T')[0]);
    }, []);

    // --- Chatwork APIからルーム一覧を取得 ---
    const loadRooms = async (token) => {
        setError('');
        if (!token) return;

        try {
            // バックエンドAPI (/api/chatwork/rooms) を呼び出す
            const response = await fetch('/api/chatwork/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiToken: token }),
            });
            if (!response.ok) {
                 const errorData = await response.json().catch(() => null);
                 throw new Error(errorData?.error || 'ルーム取得に失敗しました。');
            }
            const data = await response.json();
            // APIのレスポンスが { room_id, name } の形式であることを期待
            setRooms(data);
        } catch (err) {
            setError(err.message + ' APIトークンが正しいか、バックエンドAPIが動作しているか確認してください。');
            console.error(err);
            setRooms([]); // 失敗時は空にする
        }
    };

    // --- APIトークン変更時の処理 ---
    const handleTokenChange = async (e) => {
        const token = e.target.value;
        setApiToken(token);
        if (token && db && userId) {
            const { doc, setDoc } = window.firebase.firestore;
            // Firestoreに保存
            const tokenDocRef = doc(db, "artifacts", appId, "users", userId, "settings", "apiToken");
            await setDoc(tokenDocRef, { token: token });
            loadRooms(token);
        }
    };
    
    // --- ログをFirestoreに保存するヘルパー関数 ---
    const saveLogToFirestore = useCallback(async (newLog) => {
        if (!db || !userId) return;
        const { doc, getDoc, setDoc } = window.firebase.firestore;
    
        const logsRef = doc(db, "artifacts", appId, "users", userId, "data", "savedLogs");
        
        // 既存のログを取得
        const docSnap = await getDoc(logsRef);
        const existingLogs = docSnap.exists() ? (docSnap.data().logs || []) : [];
    
        // 新しいログを追加し、50件に制限
        const updatedLogs = [newLog, ...existingLogs].slice(0, 50);
        
        // Firestoreに保存
        await setDoc(logsRef, { logs: updatedLogs });
        // stateはonSnapshotで自動的に更新される
    
    }, [db, userId, appId]);

    // --- メッセージ取得処理 ---
    const fetchMessages = async () => {
        if (!apiToken || !selectedRoom || !startDate || !endDate) {
            setError('すべての項目を入力してください');
            return;
        }

        setLoading(true);
        setError('');
        setMessages('');

        try {
            // バックエンドAPI (/api/chatwork/messages) を呼び出す
            const response = await fetch('/api/chatwork/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiToken,
                    roomId: selectedRoom, // API側でキャメルケースを期待している場合はこのまま
                    startDate,
                    endDate,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'メッセージ取得に失敗しました。');
            }
            
            const data = await response.json();
            setMessages(data.messages);
            setMessageCount(data.count);
            
            if (data.count === 100) {
                setError('※最新100件のみ表示されています（Chatwork APIの制限）');
            }
            
            // 取得成功時にログを保存
            const room = rooms.find(r => r.room_id.toString() === selectedRoom);
            const newLog = {
                id: Date.now().toString(),
                room_id: selectedRoom,
                roomName: room ? room.name : 'Unknown Room',
                content: data.messages,
                count: data.count,
                startDate,
                endDate,
                savedAt: new Date().toISOString(),
                isAutoSave: false
            };
            await saveLogToFirestore(newLog);

        } catch (err) {
            setError(err.message);
            console.error(err);
        }
        setLoading(false);
    };
    
    // --- 自動保存の切り替え ---
    const toggleAutoSave = async () => {
        if (!selectedRoom || !db || !userId) {
            setError('ルームを選択してください');
            return;
        }
        const { doc, setDoc } = window.firebase.firestore;

        // autoSaveRooms は onSnapshot でリアルタイムに更新されている
        const isAlreadySaved = autoSaveRooms.some(r => r.room_id.toString() === selectedRoom);
        let updatedRooms = [...autoSaveRooms];

        if (isAlreadySaved) {
            // 既存のものを削除
            updatedRooms = autoSaveRooms.filter(r => r.room_id.toString() !== selectedRoom);
            setShowSuccess('自動保存を解除しました');
        } else {
            if (autoSaveRooms.length >= 10) {
                setError('自動保存は最大10個までです');
                return;
            }
            const roomData = rooms.find(r => r.room_id.toString() === selectedRoom);
            if (roomData) {
                 updatedRooms.push({ room_id: roomData.room_id, name: roomData.name });
                 setShowSuccess(`自動保存を設定しました（${updatedRooms.length}/10）`);
            }
        }
        
        // Firestoreを更新
        const autoSaveRef = doc(db, "artifacts", appId, "users", userId, "settings", "autoSaveRooms");
        await setDoc(autoSaveRef, { rooms: updatedRooms });

        setTimeout(() => setShowSuccess(''), 2000);
    };
    
    // --- 互換性の高いクリップボードコピー機能 ---
    const copyToClipboard = () => {
        if (!messages) return;

        // 一時的なtextareaを作成
        const textArea = document.createElement('textarea');
        textArea.value = messages;
        
        // スタイルを設定して画面外に配置
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            // document.execCommandは非推奨だが、iframe環境での互換性のために使用
            const successful = document.execCommand('copy');
            if (successful) {
                setShowSuccess('コピーしました！');
                setTimeout(() => setShowSuccess(''), 2000);
            } else {
                throw new Error('Copy command was not successful.');
            }
        } catch (err) {
            setError('コピーに失敗しました。お使いのブラウザではサポートされていない可能性があります。');
            console.error('Clipboard copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    };

    // --- テキストファイルとしてダウンロード ---
    const downloadAsText = () => {
        const room = rooms.find(r => r.room_id.toString() === selectedRoom);
        const roomName = room ? room.name : 'Chat';
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

    // --- 保存済みログを表示 ---
    const viewSavedLog = (log) => {
        setMessages(log.content);
        setMessageCount(log.count || 0);
        setSelectedRoom(log.room_id);
        setStartDate(log.startDate);
        setEndDate(log.endDate);
        setError(''); // 過去ログ表示時はエラーをクリア
        window.scrollTo(0, 0);
    };
    
    // --- レンダリング ---
    if (!userId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>アプリケーションを初期化しています...</p>
            </div>
        );
    }
    
    const isAutoSaveEnabled = autoSaveRooms.some(r => r.room_id.toString() === selectedRoom);

    return (
     <div style={{ fontFamily: "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif", padding: '20px', maxWidth: '700px', margin: '0 auto', color: '#333' }}>
        <h1 style={{ textAlign: 'center', color: '#2563eb', borderBottom: '2px solid #2563eb', paddingBottom: '10px' }}>
            Chatworkログ抽出ツール
        </h1>
        
        <div style={{ backgroundColor: '#eef2ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '5px solid #6366f1' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
                Chatwork APIトークンを入力して、指定したルームのログを取得・保存できます。データはクラウドに安全に保存されます。
            </p>
        </div>
        
        {/* --- APIトークン入力 --- */}
        <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Chatwork APIトークン
            </label>
            <input
                type="password"
                value={apiToken}
                onChange={handleTokenChange}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px' }}
                placeholder="Chatworkの設定画面で取得したトークン"
            />
        </div>
        
        {/* --- ルーム選択 & 自動保存 --- */}
        <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                ルームを選択
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', background: '#fff' }}
                    disabled={!apiToken || rooms.length === 0}
                >
                    <option value="">
                        {!apiToken ? 'まずAPIトークンを入力' : rooms.length === 0 ? 'ルームを読み込み中...' : 'ルームを選択'}
                    </option>
                    {rooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                            {room.name} {autoSaveRooms.some(r => r.room_id === room.room_id) ? '⏰' : ''}
                        </option>
                    ))}
                </select>
                <button
                    onClick={toggleAutoSave}
                    disabled={!selectedRoom || (!isAutoSaveEnabled && autoSaveRooms.length >= 10)}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: isAutoSaveEnabled ? '#ef4444' : autoSaveRooms.length >= 10 ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: selectedRoom && (isAutoSaveEnabled || autoSaveRooms.length < 10) ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold'
                    }}
                >
                    {isAutoSaveEnabled ? '自動OFF' : '自動ON'}
                </button>
            </div>
             {autoSaveRooms.length > 0 && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                    ⏰ 自動保存中: {autoSaveRooms.length}/10 ルーム
                </p>
            )}
        </div>
        
        {/* --- 期間設定 --- */}
        <div style={{ marginBottom: '20px', background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                 {/* Preset buttons */}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>開始日</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}/>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>終了日</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}/>
                </div>
            </div>
        </div>

        {/* --- 実行ボタン --- */}
        <button
            onClick={fetchMessages}
            disabled={loading || !selectedRoom}
            style={{ width: '100%', padding: '15px', backgroundColor: loading || !selectedRoom ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: loading || !selectedRoom ? 'not-allowed' : 'pointer' }}
        >
            {loading ? 'ログを取得中...' : 'ログを取得'}
        </button>
        
        {/* --- エラー表示 --- */}
        {error && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '14px' }}>
                {error}
            </div>
        )}

        {/* --- 取得結果 --- */}
        {messages && (
            <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>取得結果</h3>
                    <span style={{ color: '#6b7280', fontWeight: 'bold' }}>{messageCount}件</span>
                </div>
                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '14px', lineHeight: '1.6' }}>
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
        
        {/* --- 保存履歴 --- */}
        {savedLogs.length > 0 && (
            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
                <h3 style={{ marginBottom: '15px' }}>保存履歴 ({savedLogs.length}件)</h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                    {savedLogs.map((log) => (
                        <div
                            key={log.id}
                            onClick={() => viewSavedLog(log)}
                            style={{ padding: '12px', marginBottom: '10px', backgroundColor: log.isAutoSave ? '#f0f9ff' : '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = log.isAutoSave ? '#f0f9ff' : '#fff'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <strong style={{ color: '#1e3a8a' }}>{log.roomName}</strong>
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>{log.count}件</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                {log.startDate} 〜 {log.endDate}
                                {log.isAutoSave && <span style={{ marginLeft: '10px', background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>自動</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* --- 成功通知 --- */}
        {showSuccess && (
            <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#10b981', color: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', zIndex: 1000 }}>
                {showSuccess}
            </div>
        )}
    </div>
    );
}
