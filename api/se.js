const SE_BASE = 'https://api.streamelements.com/kappa/v2';

export async function getChannelId() {
  const jwt = process.env.SE_JWT;
  const channelName = process.env.CHANNEL_NAME;
  if (!jwt || !channelName) throw new Error('misconfigured');

  const chRes = await fetch(`${SE_BASE}/channels/${channelName}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!chRes.ok) throw new Error('channel not found');
  const chData = await chRes.json();
  return { channelId: chData._id, jwt };
}

export async function seAddPoints(channelId, jwt, username, amount) {
  const res = await fetch(`${SE_BASE}/points/${channelId}/${username}/${Math.abs(amount)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('SE add failed');
  return res.json();
}

export async function seDeductPoints(channelId, jwt, username, amount) {
  const res = await fetch(`${SE_BASE}/points/${channelId}/${username}/-${Math.abs(amount)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('SE deduct failed');
  return res.json();
}

export async function seGetPoints(channelId, jwt, username) {
  const res = await fetch(`${SE_BASE}/points/${channelId}/${username}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error('SE get failed');
  const data = await res.json();
  return data.points ?? 0;
}

export function sanitize(username) {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, '');
}
