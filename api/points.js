const SE_BASE = 'https://api.streamelements.com/kappa/v2';

export default async function handler(req, res) {
  const jwt = process.env.SE_JWT;
  const channelName = process.env.CHANNEL_NAME;

  if (!jwt || !channelName) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Resolve channel ID
  let channelId;
  try {
    const chRes = await fetch(`${SE_BASE}/channels/${channelName}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!chRes.ok) return res.status(chRes.status).json({ error: 'Channel not found' });
    const chData = await chRes.json();
    channelId = chData._id;
  } catch {
    return res.status(500).json({ error: 'Failed to resolve channel' });
  }

  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (req.method === 'GET') {
    // Fetch points
    try {
      const response = await fetch(`${SE_BASE}/points/${channelId}/${sanitized}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!response.ok) return res.status(response.status).json({ error: 'SE API error' });
      const data = await response.json();
      res.json({ points: data.points ?? 0, username: sanitized });
    } catch {
      res.status(500).json({ error: 'Failed to fetch points' });
    }
  } else if (req.method === 'PUT') {
    // Update points
    const { amount } = req.body || {};
    if (typeof amount !== 'number') return res.status(400).json({ error: 'Missing amount' });

    const endpoint = amount >= 0
      ? `${SE_BASE}/points/${channelId}/${sanitized}/${Math.abs(amount)}`
      : `${SE_BASE}/points/${channelId}/${sanitized}/-${Math.abs(amount)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return res.status(response.status).json({ error: `SE API error: ${text}` });
      }
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Failed to update points' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
