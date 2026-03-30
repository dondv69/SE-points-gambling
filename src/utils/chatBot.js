// Chat messages go through /api/chat serverless function.

export async function sendChatMessage(message) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatWinMessage(username, amount, multiplier, type, siteUrl) {
  const emojis = type === 'jackpot' ? '🏆🏆🏆' : type === 'mega' ? '💎💎💎' : '🎰🎰🎰';

  let msg = `${emojis} ${username} just won ${amount.toLocaleString()} points`;

  if (type === 'jackpot') {
    msg += ' hitting the JACKPOT!';
  } else if (multiplier) {
    msg += ` (${multiplier}x multiplier)!`;
  }

  if (siteUrl) {
    msg += ` | Play: ${siteUrl}`;
  }

  return msg;
}

export function shouldAnnounce(winAmount, bet, type) {
  if (type === 'jackpot') return true;
  if (type === 'bonus') return true;
  if (bet > 0 && winAmount / bet >= 10) return true;
  if (winAmount >= 5000) return true;
  return false;
}
