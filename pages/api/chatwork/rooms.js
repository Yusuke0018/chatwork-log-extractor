export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { apiToken } = req.body;
  try {
    const response = await fetch('https://api.chatwork.com/v2/rooms', {
      headers: {
        'X-ChatWorkToken': apiToken
      }
    });
    if (!response.ok) {
      throw new Error('Invalid API token');
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
