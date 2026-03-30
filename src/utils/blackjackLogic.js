// Blackjack game logic — pure functions, no side effects

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a shuffled 52-card deck.
 * Each card: { suit, rank, value, display }
 */
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value;
      if (rank === 'A') value = 11;
      else if (['K', 'Q', 'J'].includes(rank)) value = 10;
      else value = parseInt(rank, 10);

      deck.push({
        suit,
        rank,
        value,
        display: `${rank}${suit}`,
      });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Calculate hand value, accounting for aces.
 * Returns { total: number, soft: boolean }
 */
export function handValue(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }

  // Demote aces from 11 to 1 while busting
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return {
    total,
    soft: aces > 0 && total <= 21,
  };
}

/**
 * Natural blackjack: exactly 2 cards totaling 21.
 */
export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

/**
 * Dealer hits on 16 or below, stands on 17+.
 */
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}
