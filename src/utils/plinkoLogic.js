// Plinko drop simulation — 8 rows of pegs, ball bounces left/right

export const ROWS = 8;

export const RISK_LEVELS = {
  low:    [1.5, 1.2, 1.0, 0.5, 0.3, 0.5, 1.0, 1.2, 1.5],
  medium: [3,   1.5, 1.0, 0.5, 0.2, 0.5, 1.0, 1.5, 3],
  high:   [10,  5,   2,   0.5, 0.2, 0.5, 2,   5,   10],
};

/**
 * Simulate a Plinko ball drop.
 * At each row the ball goes left (0) or right (1) with 50/50 chance.
 * The final slot index equals the count of right-bounces (0–rows).
 * @param {number} rows — number of peg rows (default 8)
 * @returns {{ path: number[], slotIndex: number }}
 */
export function simulateDrop(rows = ROWS) {
  const path = [];
  let slotIndex = 0;

  for (let i = 0; i < rows; i++) {
    const direction = Math.random() < 0.5 ? 0 : 1;
    path.push(direction);
    slotIndex += direction;
  }

  return { path, slotIndex };
}

/**
 * Look up the multiplier for a given slot and risk level.
 * @param {number} slotIndex — 0-based bucket index (0 to rows)
 * @param {'low'|'medium'|'high'} risk
 * @returns {number}
 */
export function getMultiplier(slotIndex, risk) {
  const multipliers = RISK_LEVELS[risk] || RISK_LEVELS.medium;
  return multipliers[slotIndex] ?? 0;
}
