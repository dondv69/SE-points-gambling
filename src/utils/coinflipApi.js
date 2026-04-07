export async function coinflipStart(username, amount, choice) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'flip', username, amount, choice }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Flip failed');
  }
  return res.json();
}

export async function coinflipDouble(betId, username) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'double', betId, username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Double failed');
  }
  return res.json();
}

export async function coinflipCashout(betId, username) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cashout', betId, username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Cashout failed');
  }
  return res.json();
}
