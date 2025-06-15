export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { apiToken, roomId, startDate, endDate } = req.body;
  try {
    // 複数回に分けて取得
    const allMessages = [];
    const periods = generatePeriods(startDate, endDate);
    
    for (const period of periods) {
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
      
      const messages = await response.json();
      const filteredMessages = messages.filter(msg => {
        const msgTime = msg.send_time * 1000;
        return msgTime >= period.start && msgTime <= period.end;
      });
      
      allMessages.push(...filteredMessages);
      
      // API制限対策で少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 重複を除去して時系列順にソート
    const uniqueMessages = Array.from(
      new Map(allMessages.map(m => [m.message_id, m])).values()
    ).sort((a, b) => a.send_time - b.send_time);
    
    const formattedMessages = uniqueMessages.map(msg => {
      const date = new Date(msg.send_time * 1000);
      const dateStr = date.toLocaleDateString('ja-JP');
      const timeStr = date.toTimeString().slice(0, 5);
      return `[${dateStr} ${timeStr}] ${msg.account.name}: ${msg.body}`;
    }).join('\n');
    
    res.status(200).json({
      messages: formattedMessages,
      count: uniqueMessages.length,
      info: `${periods.length}回に分けて取得しました`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// 期間を30日ごとに分割
function generatePeriods(startDate, endDate) {
  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59');
  
  let currentStart = new Date(start);
  
  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 30);
    
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime());
    }
    
    periods.push({
      start: currentStart.getTime(),
      end: currentEnd.getTime()
    });
    
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return periods;
}
