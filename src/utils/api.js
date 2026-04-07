// All SE API calls go through /api/* serverless functions.
// JWT never touches the browser.

export async function getChannelId() {
  const res = await fetch('/api/channel');
  if (!res.ok) throw new Error('Could not connect to StreamElements');
  const data = await res.json();
  return data.channelId;
}

export async function fetchPoints(username) {
  const res = await fetch(`/api/points?username=${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error('Could not fetch points');
  const data = await res.json();
  return data.points ?? 0;
}

export async function deductPoints(username, amount, game) {
  if (!game) throw new Error('Game type required');
  const res = await fetch(`/api/points?username=${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: -Math.abs(amount), game }),
  });
  if (!res.ok) throw new Error('Failed to deduct points');
  return res.json();
}

export async function addPoints(username, amount, game = 'unknown', betId) {
  if (!betId) throw new Error('Bet ID required for payout');
  const res = await fetch('/api/payout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, amount: Math.abs(amount), game, betId }),
  });
  if (!res.ok) throw new Error('Failed to add points');
  return res.json();
}
