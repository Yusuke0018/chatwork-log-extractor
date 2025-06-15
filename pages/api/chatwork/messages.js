export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { apiToken, roomId, startDate, endDate } = req.body;
  try {
    const response = await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages?force=1`,
      {
        headers: {
          'X-ChatWorkToken': apiToken
        }
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    const allMessages = await response.json();
    
    // エラーチェック（配列でない場合）
    if (!Array.isArray(allMessages)) {
      throw new Error('メッセージの取得に失敗しました');
    }
    
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate + 'T23:59:59').getTime();
    
    const filteredMessages = allMessages.filter(msg => {
      const msgTime = msg.send_time * 1000;
      return msgTime >= startTime && msgTime <= endTime;
    });
    
    const formattedMessages = filteredMessages.map(msg => {
      const date = new Date(msg.send_time * 1000);
      const dateStr = date.toLocaleDateString('ja-JP');
      const timeStr = date.toTimeString().slice(0, 5);
      return `[${dateStr} ${timeStr}] ${msg.account.name}: ${msg.body}`;
    }).join('\n');
    
    res.status(200).json({
      messages: formattedMessages || '該当期間のメッセージはありません',
      count: filteredMessages.length,
      totalFetched: allMessages.length // 取得した総数
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
