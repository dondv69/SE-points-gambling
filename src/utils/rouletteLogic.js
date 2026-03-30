// European single-zero roulette logic

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const NUMBERS = Array.from({ length: 37 }, (_, i) => ({
  number: i,
  color: i === 0 ? 'green' : RED_NUMBERS.includes(i) ? 'red' : 'black',
}));

// Physical order of numbers on a European roulette wheel
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function spinWheel() {
  return Math.floor(Math.random() * 37);
}

export function getNumberColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

/**
 * Evaluate all bets against the winning number.
 * @param {number} winningNumber - 0-36
 * @param {Array<{type: string, value?: number, amount: number}>} bets
 * @returns {number} total payout (including original stake for winning bets)
 */
export function evaluateBets(winningNumber, bets) {
  const color = getNumberColor(winningNumber);
  let totalPayout = 0;

  for (const bet of bets) {
    switch (bet.type) {
      case 'number':
        if (bet.value === winningNumber) {
          totalPayout += bet.amount * 36;
        }
        break;
      case 'red':
        if (color === 'red') totalPayout += bet.amount * 2;
        break;
      case 'black':
        if (color === 'black') totalPayout += bet.amount * 2;
        break;
      case 'odd':
        if (winningNumber !== 0 && winningNumber % 2 === 1) totalPayout += bet.amount * 2;
        break;
      case 'even':
        if (winningNumber !== 0 && winningNumber % 2 === 0) totalPayout += bet.amount * 2;
        break;
      case 'low':
        if (winningNumber >= 1 && winningNumber <= 18) totalPayout += bet.amount * 2;
        break;
      case 'high':
        if (winningNumber >= 19 && winningNumber <= 36) totalPayout += bet.amount * 2;
        break;
      default:
        break;
    }
  }

  return totalPayout;
}
