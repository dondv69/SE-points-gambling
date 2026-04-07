import { ensureTables, getDb } from './db.js';

const SE_BASE = 'https://api.streamelements.com/kappa/v2';

export default async function handler(req, res) {
  await ensureTables();
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
    const { amount, game } = req.body || {};
    if (typeof amount !== 'number') return res.status(400).json({ error: 'Missing amount' });
    if (amount > 0) return res.status(403).json({ error: 'Direct point additions are blocked. Use /api/payout.' });
    if (!game) return res.status(400).json({ error: 'Missing game' });

    const validGames = ['slots', 'gates', 'blackjack', 'roulette', 'mines'];
    if (!validGames.includes(game)) return res.status(400).json({ error: 'Invalid game' });

    const db = getDb();

    // Check for recent bets to prevent duplicate deductions
    const recentBets = await db`
      SELECT COUNT(*) as count FROM bets 
      WHERE username = ${sanitized} 
      AND game = ${game}
      AND status = 'active'
      AND created_at > NOW() - INTERVAL '5 seconds'
    `;
    if (recentBets[0].count > 5) {
      return res.status(429).json({ error: 'Too many bets' });
    }

    const endpoint = `${SE_BASE}/points/${channelId}/${sanitized}/-${Math.abs(amount)}`;

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
      
      // Create bet record for payout verification
      const betResult = await db`
        INSERT INTO bets (username, amount, game, status)
        VALUES (${sanitized}, ${Math.abs(amount)}, ${game}, 'active')
        RETURNING id
      `;
      
      const data = await response.json();
      res.json({ ...data, betId: betResult[0].id });
    } catch {
      res.status(500).json({ error: 'Failed to update points' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
