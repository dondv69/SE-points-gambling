// Simulate ONLY free spin sessions to find average payout
// Run: node scripts/gates-bonus-sim.mjs

const GRID_COLS = 6, GRID_ROWS = 5;

const SYMBOLS = [
  { id: 'crown',     weight: 4,  tier: 6 },
  { id: 'chalice',   weight: 6,  tier: 5 },
  { id: 'ring',      weight: 8,  tier: 4 },
  { id: 'hourglass', weight: 10, tier: 3 },
  { id: 'yellow',    weight: 15, tier: 2 },
  { id: 'blue',      weight: 18, tier: 1 },
  { id: 'red',       weight: 20, tier: 1 },
  { id: 'green',     weight: 22, tier: 0 },
  { id: 'purple',    weight: 25, tier: 0 },
];
const SCATTER = { id: 'scatter', weight: 3 };

const PAY_TABLE = {
  0: [0.4, 0.8, 1.5, 3, 5],
  1: [0.6, 1.2, 2.2, 4.5, 7],
  2: [0.7, 1.5, 3, 7, 12],
  3: [1, 2.2, 4.5, 9, 16],
  4: [1.5, 3, 7, 14, 25],
  5: [2.2, 4.5, 10, 20, 35],
  6: [4.5, 7.5, 15, 30, 50],
};
const SCATTER_PAY = { 4: 1, 5: 2, 6: 25 };
const ORB_VALUES = [
  { value: 2, weight: 50 },
  { value: 3, weight: 25 },
  { value: 5, weight: 10 },
  { value: 10, weight: 3 },
];
const ORB_TW = ORB_VALUES.reduce((s, o) => s + o.weight, 0);
const ORB_CHANCE = 0.03;
const FS_COUNT = 12;
const FS_RETRIGGER = 5;

const POOL = [];
for (const sym of SYMBOLS) for (let i = 0; i < sym.weight; i++) POOL.push(sym);
for (let i = 0; i < SCATTER.weight; i++) POOL.push(SCATTER);
function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }

function genGrid() {
  const g = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const col = [];
    for (let r = 0; r < GRID_ROWS; r++) col.push(pick());
    g.push(col);
  }
  return g;
}

function evalGrid(grid) {
  const counts = {};
  let sc = 0;
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const s = grid[c][r];
      if (s.id === 'scatter') { sc++; continue; }
      if (!counts[s.id]) counts[s.id] = { n: 0, pos: [], tier: s.tier };
      counts[s.id].n++;
      counts[s.id].pos.push(`${c}-${r}`);
    }
  }
  const wins = [], wp = new Set();
  for (const d of Object.values(counts)) {
    if (d.n >= 8) {
      const ti = Math.min(d.n - 8, 4);
      wins.push({ mult: PAY_TABLE[d.tier][ti] });
      for (const p of d.pos) wp.add(p);
    }
  }
  return { wins, wp, sc };
}

function cascade(grid, wp) {
  const ng = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const rem = [];
    for (let r = 0; r < GRID_ROWS; r++) if (!wp.has(`${c}-${r}`)) rem.push(grid[c][r]);
    const need = GRID_ROWS - rem.length;
    for (let i = 0; i < need; i++) {
      let s = pick();
      while (s.id === 'scatter') s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      rem.unshift(s);
    }
    ng.push(rem);
  }
  return ng;
}

function genOrb(fsMode) {
  const chance = fsMode ? FS_ORB_CHANCE : ORB_CHANCE;
  if (Math.random() > chance) return 0;
  let r = Math.random() * ORB_TW;
  for (const o of ORB_VALUES) { r -= o.weight; if (r <= 0) return o.value; }
  return 2;
}

let FS_ORB_CHANCE = 0.15; // much higher in free spins

function simulateFreeSpin(bet, incomingMult) {
  const grid = genGrid();
  let cur = grid, baseWin = 0, orbTotal = 0, cascN = 0;
  const scatters = evalGrid(grid).sc;
  while (true) {
    const { wins, wp } = evalGrid(cur);
    if (wins.length === 0) break;
    for (const w of wins) baseWin += Math.floor(w.mult * bet);
    orbTotal += genOrb(true);
    cur = cascade(cur, wp);
    cascN++;
    if (cascN > 50) break;
  }
  const newMult = incomingMult + orbTotal;
  let totalWin = baseWin;
  if (newMult > 1 && totalWin > 0) totalWin = Math.floor(totalWin * newMult);
  return { totalWin, scatters, newMult };
}

// Simulate N free spin sessions
const BET = 100;
const N = 500_000;
let totalPayout = 0;
const payouts = [];

function runTest(label, fsOrbChance, fsCount) {
  FS_ORB_CHANCE = fsOrbChance;
  let tp = 0;
  const pp = [];
  for (let i = 0; i < N; i++) {
    let spinsLeft = fsCount;
    let accMult = 0, sw = 0;
    while (spinsLeft > 0) {
      const fs = simulateFreeSpin(BET, accMult);
      sw += fs.totalWin; accMult = fs.newMult; spinsLeft--;
      if (fs.scatters >= 3) spinsLeft += FS_RETRIGGER;
    }
    tp += sw; pp.push(sw);
  }
  pp.sort((a, b) => a - b);
  const avg = tp / N;
  console.log(`${label}: avg=${avg.toFixed(0)} (${(avg/BET).toFixed(1)}x)  buy RTP=${(avg/(BET*100)*100).toFixed(1)}%  med=${pp[Math.floor(N/2)]} (${(pp[Math.floor(N/2)]/BET).toFixed(1)}x)`);
}

console.log(`${N.toLocaleString()} sessions per test (bet=${BET}, buy=100x)...\n`);

for (const orbCh of [0.10, 0.15, 0.20, 0.25]) {
  for (const fsc of [12, 15]) {
    runTest(`orbFS=${(orbCh*100).toFixed(0)}% fs=${fsc}`, orbCh, fsc);
  }
}

process.exit(0);

// old code below
console.log(`Simulating ${N.toLocaleString()} free spin sessions (bet=${BET})...\n`);

for (let i = 0; i < N; i++) {
  let spinsLeft = FS_COUNT;
  let accMult = 0;
  let sessionWin = 0;

  while (spinsLeft > 0) {
    const fs = simulateFreeSpin(BET, accMult);
    sessionWin += fs.totalWin;
    accMult = fs.newMult;
    spinsLeft--;
    if (fs.scatters >= 3) spinsLeft += FS_RETRIGGER;
  }

  totalPayout += sessionWin;
  payouts.push(sessionWin);
}

payouts.sort((a, b) => a - b);
const avg = totalPayout / N;
const avgMult = avg / BET;
const median = payouts[Math.floor(N / 2)];
const p25 = payouts[Math.floor(N * 0.25)];
const p75 = payouts[Math.floor(N * 0.75)];
const p95 = payouts[Math.floor(N * 0.95)];
const zeroPct = payouts.filter(p => p === 0).length / N * 100;

console.log(`Average payout:   ${avg.toFixed(0)} (${avgMult.toFixed(1)}x bet)`);
console.log(`Bonus buy cost:   ${BET * 100} (100x)`);
console.log(`Bonus buy RTP:    ${(avg / (BET * 100) * 100).toFixed(1)}%`);
console.log(`\nDistribution:`);
console.log(`  Zero wins:      ${zeroPct.toFixed(1)}%`);
console.log(`  25th pctile:    ${p25} (${(p25/BET).toFixed(1)}x)`);
console.log(`  Median:         ${median} (${(median/BET).toFixed(1)}x)`);
console.log(`  75th pctile:    ${p75} (${(p75/BET).toFixed(1)}x)`);
console.log(`  95th pctile:    ${p95} (${(p95/BET).toFixed(1)}x)`);
console.log(`  Max:            ${payouts[N-1]} (${(payouts[N-1]/BET).toFixed(1)}x)`);
