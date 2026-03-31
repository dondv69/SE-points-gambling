// Final tuning sim — targets:
// - Base hit rate ~50%, avg win on hit ~1x bet
// - Bonus trigger ~1/200 (0.5%)
// - Bonus avg payout ~95x (for 100x buy)
// - Total RTP ~95%

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

const POOL = [];
for (const sym of SYMBOLS) for (let i = 0; i < sym.weight; i++) POOL.push(sym);
for (let i = 0; i < SCATTER.weight; i++) POOL.push(SCATTER);
function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }

let CFG;

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
    if (d.n >= CFG.minMatch) {
      const ti = Math.min(d.n - CFG.minMatch, CFG.payTable[0].length - 1);
      wins.push({ mult: CFG.payTable[d.tier][ti] });
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
  const chance = fsMode ? CFG.fsOrbChance : CFG.orbChance;
  if (Math.random() > chance) return 0;
  const vals = fsMode && CFG.fsOrbValues ? CFG.fsOrbValues : CFG.orbValues;
  const tw = fsMode && CFG.fsOrbTW ? CFG.fsOrbTW : CFG.orbTW;
  let r = Math.random() * tw;
  for (const o of vals) { r -= o.weight; if (r <= 0) return o.value; }
  return 2;
}

function simCascade(bet, fsMode, inMult) {
  const grid = genGrid();
  let cur = grid, baseWin = 0, orbTotal = 0, cascN = 0;
  const scatters = evalGrid(grid).sc;
  while (true) {
    const { wins, wp } = evalGrid(cur);
    if (wins.length === 0) break;
    for (const w of wins) baseWin += Math.floor(w.mult * bet);
    orbTotal += genOrb(fsMode);
    cur = cascade(cur, wp);
    cascN++;
    if (cascN > 50) break;
  }
  const accMult = (fsMode ? inMult : 0) + orbTotal;
  let totalWin = baseWin;
  const eff = accMult > 0 ? accMult : 1;
  if (eff > 1 && totalWin > 0) totalWin = Math.floor(totalWin * eff);
  const sp = CFG.scatterPay[Math.min(scatters, 6)] || 0;
  if (sp > 0) totalWin += Math.floor(sp * bet);
  return { totalWin, baseWin, scatters, accMult };
}

function run(label, cfg) {
  CFG = cfg;
  const BET = 100, N = 2_000_000;
  let totalWon = 0, baseWon = 0, fsWon = 0, fsTriggers = 0, hits = 0;

  for (let i = 0; i < N; i++) {
    const { totalWin, baseWin, scatters } = simCascade(BET, false, 0);
    totalWon += totalWin;
    baseWon += totalWin;
    if (baseWin > 0) hits++;

    if (scatters >= 4) {
      fsTriggers++;
      let spinsLeft = cfg.fsCount;
      let accMult = 0, sw = 0;
      while (spinsLeft > 0) {
        const fs = simCascade(BET, true, accMult);
        sw += fs.totalWin; accMult = fs.accMult; spinsLeft--;
        if (fs.scatters >= 3) spinsLeft += cfg.fsRetrigger;
      }
      totalWon += sw; fsWon += sw;
    }
  }

  const rtp = totalWon / (N * BET) * 100;
  const baseRtp = baseWon / (N * BET) * 100;
  const fsRtp = fsWon / (N * BET) * 100;
  const hitRate = hits / N * 100;
  const fsRate = fsTriggers / N * 100;
  const avgFsPayout = fsTriggers > 0 ? fsWon / fsTriggers / BET : 0;

  console.log(`\n${label}:`);
  console.log(`  RTP: ${rtp.toFixed(1)}%  (base ${baseRtp.toFixed(1)}% + FS ${fsRtp.toFixed(1)}%)`);
  console.log(`  Hit rate: ${hitRate.toFixed(1)}%  FS trigger: 1/${Math.round(N/fsTriggers)} (${fsRate.toFixed(2)}%)`);
  console.log(`  Avg FS session: ${avgFsPayout.toFixed(1)}x bet  (buy RTP: ${(avgFsPayout/100*100).toFixed(1)}%)`);
}

console.log('1M spins per test...');

// Base game orbs (rare, small)
const baseOrbVals = [
  { value: 2,  weight: 50 },
  { value: 3,  weight: 25 },
  { value: 5,  weight: 10 },
  { value: 10, weight: 3 },
];
const baseOrbTW = baseOrbVals.reduce((s, o) => s + o.weight, 0);

// Free spin orbs (more frequent, bigger values)
const fsOrbVals = [
  { value: 2,  weight: 30 },
  { value: 3,  weight: 25 },
  { value: 5,  weight: 20 },
  { value: 10, weight: 10 },
  { value: 25, weight: 4 },
  { value: 50, weight: 1 },
];
const fsOrbTW = fsOrbVals.reduce((s, o) => s + o.weight, 0);

// Base pay ~53% → total with FS ~95%
const pay = {
  0: [0.2, 0.5, 1, 1.8, 3],
  1: [0.3, 0.7, 1.4, 2.8, 4.5],
  2: [0.4, 0.9, 1.8, 4.5, 7],
  3: [0.5, 1.3, 2.8, 6, 10],
  4: [0.8, 1.8, 4.5, 9, 16],
  5: [1.2, 2.8, 6, 13, 22],
  6: [2.5, 4.5, 9, 20, 35],
};

const scatPay = { 4: 1, 5: 2, 6: 25 };

// Override genOrb to use separate orb pools
const origGenOrb = genOrb;

for (const fsOrb of [0.23, 0.24]) {
  for (const fsc of [15]) {
    run(`fsOrb=${(fsOrb*100)}% fs=${fsc}`, {
      payTable: pay, minMatch: 8, scatterPay: scatPay,
      orbValues: baseOrbVals, orbTW: baseOrbTW, orbChance: 0.03,
      fsOrbChance: fsOrb, fsOrbValues: fsOrbVals, fsOrbTW: fsOrbTW,
      fsCount: fsc, fsRetrigger: 5,
    });
  }
}
