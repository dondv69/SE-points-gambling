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
    msg += ` (${multiplier}x)!`;
  }

  if (siteUrl) {
    msg += ` | Play: ${siteUrl}`;
  }

  return msg;
}

// Dynamic announce threshold:
// Small bets (under 100) → only announce 100x+
// Medium bets (100-999) → announce 10x+
// Large bets (1000+) → announce 10x+
// Always announce jackpots and wins over 10,000 points
export function shouldAnnounce(winAmount, bet, type) {
  if (type === 'jackpot') return true;
  if (winAmount >= 10000) return true;
  const multiplier = bet > 0 ? winAmount / bet : 0;
  if (bet < 100) return multiplier >= 100;
  return multiplier >= 10;
}
