export default async function handler(req, res) {
  const schedules = req.body.schedules || [];
  
  for (const schedule of schedules) {
    const nextRun = new Date(schedule.nextRun);
    const now = new Date();
    
    if (now >= nextRun) {
      // ログを取得
      const response = await fetch(
        `https://api.chatwork.com/v2/rooms/${schedule.roomId}/messages?force=1`,
        {
          headers: { 'X-ChatWorkToken': schedule.token }
        }
      );
      
      if (response.ok) {
        const messages = await response.json();
        // 保存処理
        console.log(`自動保存完了: ${schedule.roomName}`);
      }
      
      // 次回実行日を更新
      schedule.lastRun = now.toISOString();
      schedule.nextRun = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    }
  }
  
  res.status(200).json({ message: '自動保存チェック完了', schedules });
}
