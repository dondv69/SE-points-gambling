const SE_BASE = 'https://api.streamelements.com/kappa/v2';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const channelName = process.env.CHANNEL_NAME;
  const jwt = process.env.SE_JWT;

  if (!channelName || !jwt) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const response = await fetch(`${SE_BASE}/channels/${channelName}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'SE API error' });
    }

    const data = await response.json();
    res.json({ channelId: data._id, displayName: data.displayName || channelName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
}
