// Gates of Olympus — 6x5 Pay Anywhere slot with tumble/cascade mechanics

export const GRID_COLS = 6;
export const GRID_ROWS = 5;
export const FREE_SPINS_COUNT = 15;
export const FREE_SPINS_RETRIGGER = 5;
export const GATES_BONUS_BUY = 100;

// Symbols ordered by rarity (rarest first)
export const GATES_SYMBOLS = [
  { id: 'crown',     emoji: '👑', weight: 4,  tier: 6 },
  { id: 'chalice',   emoji: '🏆', weight: 6,  tier: 5 },
  { id: 'ring',      emoji: '💍', weight: 8,  tier: 4 },
  { id: 'hourglass', emoji: '⏳', weight: 10, tier: 3 },
  { id: 'yellow',    emoji: '💛', weight: 15, tier: 2 },
  { id: 'blue',      emoji: '💙', weight: 18, tier: 1 },
  { id: 'red',       emoji: '🔴', weight: 20, tier: 1 },
  { id: 'green',     emoji: '💚', weight: 22, tier: 0 },
  { id: 'purple',    emoji: '💜', weight: 25, tier: 0 },
];

export const SCATTER = { id: 'scatter', emoji: '⚡', weight: 3 };

// Pay table: [8+, 9+, 10+, 11+, 12+] multipliers of total bet
// Base game ~52% RTP, free spins make up the rest → total ~97%
const PAY_TABLE = {
  0: [0.2, 0.5, 1, 1.8, 3],       // purple/green
  1: [0.3, 0.7, 1.4, 2.8, 4.5],   // red/blue
  2: [0.4, 0.9, 1.8, 4.5, 7],     // yellow
  3: [0.5, 1.3, 2.8, 6, 10],      // hourglass
  4: [0.8, 1.8, 4.5, 9, 16],      // ring
  5: [1.2, 2.8, 6, 13, 22],       // chalice
  6: [2.5, 4.5, 9, 20, 35],       // crown
};

// Scatter payouts (× bet): 4=1x, 5=2x, 6=25x
const SCATTER_PAY = { 4: 1, 5: 2, 6: 25 };

// Base game orbs — rare, small values
const BASE_ORB_VALUES = [
  { value: 2,   weight: 50 },
  { value: 3,   weight: 25 },
  { value: 5,   weight: 10 },
  { value: 10,  weight: 3 },
];
const BASE_ORB_CHANCE = 0.03;

// Free spin orbs — frequent, bigger values (this is where the big wins come from)
const FS_ORB_VALUES = [
  { value: 2,   weight: 30 },
  { value: 3,   weight: 25 },
  { value: 5,   weight: 20 },
  { value: 10,  weight: 10 },
  { value: 25,  weight: 4 },
  { value: 50,  weight: 1 },
];
const FS_ORB_CHANCE = 0.24;

// Unique ID counter for AnimatePresence keys
let nextId = 1;
function uid() { return nextId++; }

// Build weighted pool
function buildPool() {
  const pool = [];
  for (const sym of GATES_SYMBOLS) {
    for (let i = 0; i < sym.weight; i++) pool.push(sym);
  }
  // Scatter included in pool
  for (let i = 0; i < SCATTER.weight; i++) pool.push(SCATTER);
  return pool;
}

const POOL = buildPool();

function pickRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

// Generate a fresh 6x5 grid — grid[col][row]
export function generateGrid() {
  const grid = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const col = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const sym = pickRandom();
      col.push({ ...sym, instanceId: uid() });
    }
    grid.push(col);
  }
  return grid;
}

// Generate grid guaranteed to have 4+ scatters (for bonus buy)
export function generateBonusBuyGrid() {
  let grid = generateGrid();
  // Count scatters
  let scatterCount = 0;
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (grid[c][r].id === 'scatter') scatterCount++;
    }
  }
  // Force 4 scatters if not enough
  while (scatterCount < 4) {
    const c = Math.floor(Math.random() * GRID_COLS);
    const r = Math.floor(Math.random() * GRID_ROWS);
    if (grid[c][r].id !== 'scatter') {
      grid[c][r] = { ...SCATTER, instanceId: uid() };
      scatterCount++;
    }
  }
  return grid;
}

// Evaluate grid: find all symbols with 8+ occurrences
export function evaluateGrid(grid) {
  const counts = {};  // id → { count, positions: [[col,row], ...], tier }
  let scatterCount = 0;
  const scatterPositions = [];

  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const sym = grid[c][r];
      if (sym.id === 'scatter') {
        scatterCount++;
        scatterPositions.push([c, r]);
        continue;
      }
      if (!counts[sym.id]) {
        counts[sym.id] = { count: 0, positions: [], tier: sym.tier, emoji: sym.emoji };
      }
      counts[sym.id].count++;
      counts[sym.id].positions.push([c, r]);
    }
  }

  const wins = [];
  const allWinPositions = new Set();

  for (const [id, data] of Object.entries(counts)) {
    if (data.count >= 8) {
      const tierIdx = Math.min(data.count - 8, 4); // 0-4 for counts 8-12+
      const multiplier = PAY_TABLE[data.tier][tierIdx];
      wins.push({
        symbolId: id,
        emoji: data.emoji,
        count: data.count,
        multiplier,
        positions: data.positions,
      });
      for (const [c, r] of data.positions) {
        allWinPositions.add(`${c}-${r}`);
      }
    }
  }

  return { wins, allWinPositions, scatterCount, scatterPositions };
}

// Cascade: remove winning positions, gravity drop, fill new symbols
export function cascadeGrid(grid, winPositions) {
  const newGrid = [];
  for (let c = 0; c < GRID_COLS; c++) {
    // Keep non-winning symbols
    const remaining = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      if (!winPositions.has(`${c}-${r}`)) {
        remaining.push(grid[c][r]);
      }
    }
    // Fill from top with new symbols
    const needed = GRID_ROWS - remaining.length;
    const newSymbols = [];
    for (let i = 0; i < needed; i++) {
      const sym = pickRandom();
      // Don't add scatters during cascade (Gates of Olympus behavior)
      if (sym.id === 'scatter') {
        const nonScatter = GATES_SYMBOLS[Math.floor(Math.random() * GATES_SYMBOLS.length)];
        newSymbols.push({ ...nonScatter, instanceId: uid() });
      } else {
        newSymbols.push({ ...sym, instanceId: uid() });
      }
    }
    // New symbols on top, remaining on bottom (gravity)
    newGrid.push([...newSymbols, ...remaining]);
  }
  return newGrid;
}

// Generate multiplier orb for a tumble
export function generateOrbs(isFreeSpinMode = false) {
  const chance = isFreeSpinMode ? FS_ORB_CHANCE : BASE_ORB_CHANCE;
  if (Math.random() > chance) return [];

  const orbPool = isFreeSpinMode ? FS_ORB_VALUES : BASE_ORB_VALUES;
  const totalWeight = orbPool.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * totalWeight;
  let value = 2;
  for (const ov of orbPool) {
    r -= ov.weight;
    if (r <= 0) { value = ov.value; break; }
  }

  return [{
    id: uid(),
    value,
    col: Math.floor(Math.random() * GRID_COLS),
    row: Math.floor(Math.random() * GRID_ROWS),
  }];
}

// Get scatter payout multiplier
export function getScatterPay(count) {
  if (count >= 6) return SCATTER_PAY[6] || 100;
  return SCATTER_PAY[count] || 0;
}

// Simulate entire cascade chain from initial grid
// Returns array of steps: [{ grid, wins, winPositions, orbs, winAmount, scatterCount }]
export function simulateFullSpin(initialGrid, bet, isFreeSpinMode = false) {
  const steps = [];
  let grid = initialGrid;
  let cascadeNum = 0;
  let totalScatters = 0;

  // Evaluate initial grid
  while (true) {
    const { wins, allWinPositions, scatterCount, scatterPositions } = evaluateGrid(grid);

    // Count scatters only on first evaluation (initial spin)
    if (cascadeNum === 0) {
      totalScatters = scatterCount;
    }

    if (wins.length === 0) break;

    // Calculate win amount for this step
    let stepWin = 0;
    for (const w of wins) {
      stepWin += w.multiplier * bet;
    }

    // Generate orbs (more frequent and bigger in free spins)
    const orbs = generateOrbs(isFreeSpinMode);

    steps.push({
      grid: grid.map(col => col.map(s => ({ ...s }))), // deep copy
      wins,
      winPositions: allWinPositions,
      orbs,
      winAmount: Math.floor(stepWin),
      scatterCount: cascadeNum === 0 ? scatterCount : 0,
      scatterPositions: cascadeNum === 0 ? scatterPositions : [],
    });

    // Cascade
    grid = cascadeGrid(grid, allWinPositions);
    cascadeNum++;

    // Safety: max 50 cascades
    if (cascadeNum > 50) break;
  }

  // Push the final (no-win) grid state
  const finalGrid = grid;

  // Pre-compute totals
  const totalBaseWin = steps.reduce((s, step) => s + step.winAmount, 0);
  const totalOrbs = steps.reduce((s, step) => s + step.orbs.reduce((os, o) => os + o.value, 0), 0);

  return { steps, finalGrid, totalScatters, totalBaseWin, totalOrbs };
}
