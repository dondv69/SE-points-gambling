import { useState, useCallback, useRef } from 'react';
import { motion, animate } from 'framer-motion';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { simulateDrop, getMultiplier, RISK_LEVELS, ROWS } from '../utils/plinkoLogic';
import { MIN_BET } from '../utils/constants';

const RISK_OPTIONS = ['low', 'medium', 'high'];
const BET_PRESETS = [10, 100, 1000, 5000];

const BOARD_WIDTH = 380;
const BOARD_HEIGHT = 340;
const PEG_SIZE = 6;
const BALL_SIZE = 12;

// Row i has (3 + i) pegs, starting at row 0 with 3 pegs, up to row 7 with 10 pegs
function getPegPositions() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const count = 3 + r;
    const rowY = ((r + 1) / (ROWS + 1)) * BOARD_HEIGHT;
    const pegs = [];
    for (let p = 0; p < count; p++) {
      const rowWidth = (count - 1) * (BOARD_WIDTH / 10);
      const startX = (BOARD_WIDTH - rowWidth) / 2;
      pegs.push({ x: startX + p * (BOARD_WIDTH / 10), y: rowY });
    }
    rows.push(pegs);
  }
  return rows;
}

const pegRows = getPegPositions();

// Compute ball positions for each step of the path
function computeBallTrajectory(path) {
  const positions = [];
  // Start position: top center
  positions.push({ x: BOARD_WIDTH / 2, y: 0 });

  for (let r = 0; r < path.length; r++) {
    const row = pegRows[r];
    // Ball enters from the "gap" perspective. At row r, there are (3+r) pegs.
    // The ball position between pegs is tracked by an index.
    // We track it as: cumulative right-turns gives us which gap we're in.
    // After r rows, the ball has bounced r times — the number of rights = slotSoFar
    let slotSoFar = 0;
    for (let i = 0; i <= r; i++) {
      slotSoFar += path[i];
    }

    // The ball lands between peg slotSoFar and slotSoFar+1 in row r
    // But we want to show it hitting a peg first, then deflecting.
    // Position at the peg it hits in this row:
    // At row r there are (3+r) pegs. The ball approaches from one of (2+r) gaps.
    // After bouncing, it goes left or right.
    // Simple approach: ball x after row r is interpolated between the row's pegs
    const pegsInRow = row.length; // 3+r
    // slotSoFar is the cumulative rights after row r+1 conceptually.
    // Actually, let's recalc: after processing row r, rights_so_far tells us our horizontal bucket.
    // The ball's x should be between peg[rights_so_far] and peg[rights_so_far] position area.
    const rightsSoFar = path.slice(0, r + 1).reduce((a, b) => a + b, 0);
    // Map to x: in row r there are (3+r) pegs, and (4+r) = (3+r+1) gaps essentially...
    // The slot index after all rows maps to 0..8. At intermediate rows, the ball is at
    // an intermediate position. Let's use the peg positions directly:
    // The ball is between peg[rightsSoFar] (if it exists) — actually the ball
    // after bouncing off row r is at the midpoint between peg[rightsSoFar] and peg[rightsSoFar+1]
    // in the NEXT row's frame. But for animation, let's position at the peg it bounced off of.
    // We'll just interpolate linearly across the board width based on rightsSoFar / ROWS.
    const fraction = rightsSoFar / ROWS;
    // Map to slot width range: slots are at the bottom spanning board width
    const slotAreaStart = BOARD_WIDTH * 0.05;
    const slotAreaEnd = BOARD_WIDTH * 0.95;
    const x = slotAreaStart + fraction * (slotAreaEnd - slotAreaStart);
    const y = row[0].y + PEG_SIZE;

    positions.push({ x, y });
  }

  // Final: drop to the bottom
  const finalRights = path.reduce((a, b) => a + b, 0);
  const fraction = finalRights / ROWS;
  const slotAreaStart = BOARD_WIDTH * 0.05;
  const slotAreaEnd = BOARD_WIDTH * 0.95;
  positions.push({
    x: slotAreaStart + fraction * (slotAreaEnd - slotAreaStart),
    y: BOARD_HEIGHT + 10,
  });

  return positions;
}

function getSlotColor(multiplier) {
  if (multiplier >= 5) return 'var(--signal-go)';
  if (multiplier >= 1) return 'var(--discharge)';
  return 'var(--signal-stop)';
}

export default function Plinko({ balance, setBalance, username, showToast, addHistory }) {
  const [risk, setRisk] = useState('medium');
  const [bet, setBet] = useState(10);
  const [customBet, setCustomBet] = useState('');
  const [dropping, setDropping] = useState(false);
  const [ballPos, setBallPos] = useState(null);
  const [winSlot, setWinSlot] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const ballRef = useRef(null);

  const multipliers = RISK_LEVELS[risk];

  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET) setBet(num);
  };

  const handlePreset = (amount) => {
    setBet(amount);
    setCustomBet('');
  };

  const handleDrop = useCallback(async () => {
    if (dropping) return;
    if (bet < MIN_BET) {
      showToast(`Minimum bet is ${MIN_BET}`, 'error');
      return;
    }
    if (balance < bet) {
      showToast('Not enough points!', 'error');
      return;
    }

    setDropping(true);
    setWinSlot(null);
    setLastResult(null);
    setBalance(prev => prev - bet);

    // Deduct points via API
    try {
      await deductPoints(username, bet);
    } catch {
      setBalance(prev => prev + bet);
      setDropping(false);
      showToast('API error — bet refunded', 'error');
      return;
    }

    // Simulate the drop
    const { path, slotIndex } = simulateDrop(ROWS);
    const multiplier = getMultiplier(slotIndex, risk);
    const payout = Math.floor(bet * multiplier);
    const net = payout - bet;

    // Compute trajectory positions
    const trajectory = computeBallTrajectory(path);

    // Animate ball through the trajectory
    const xKeyframes = trajectory.map(p => p.x - BALL_SIZE / 2);
    const yKeyframes = trajectory.map(p => p.y - BALL_SIZE / 2);
    const totalSteps = trajectory.length;
    // Build times array (evenly spaced)
    const times = trajectory.map((_, i) => i / (totalSteps - 1));

    setBallPos({ x: xKeyframes[0], y: yKeyframes[0] });

    // Use framer-motion animate on the ball element
    const ballEl = ballRef.current;
    if (ballEl) {
      await Promise.all([
        animate(ballEl, { x: xKeyframes, y: yKeyframes }, {
          duration: 1.5,
          ease: 'easeIn',
          times,
        }),
      ]);
    }

    // Highlight winning slot
    setWinSlot(slotIndex);

    // Pay out winnings
    if (payout > 0) {
      setBalance(prev => prev + payout);
      try {
        await addPoints(username, payout);
      } catch {}
    }

    // Report to leaderboard
    reportSpin(username, bet, payout);

    // Add to history
    const type = net > 0 ? 'win' : 'loss';
    addHistory([{ emoji: multiplier + 'x' }], net, type);

    setLastResult({ multiplier, payout, net });

    if (net > 0) {
      showToast(`+${payout.toLocaleString()} pts (${multiplier}x)`, 'win');
    } else if (net === 0) {
      showToast(`Push — ${multiplier}x`, 'info');
    }

    setDropping(false);
  }, [dropping, bet, balance, username, risk, setBalance, showToast, addHistory]);

  return (
    <div style={styles.container}>
      {/* Risk selector */}
      <div style={styles.section}>
        <span style={styles.label}>Risk</span>
        <div style={styles.toggleRow}>
          {RISK_OPTIONS.map(r => (
            <button
              key={r}
              style={{
                ...styles.toggleBtn,
                ...(risk === r ? styles.toggleActive : {}),
              }}
              onClick={() => setRisk(r)}
              disabled={dropping}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bet controls */}
      <div style={styles.section}>
        <span style={styles.label}>Bet</span>
        <div style={styles.betRow}>
          {BET_PRESETS.map(amount => (
            <button
              key={amount}
              style={{
                ...styles.presetBtn,
                ...(bet === amount && !customBet ? styles.presetActive : {}),
              }}
              onClick={() => handlePreset(amount)}
              disabled={dropping || amount > balance}
            >
              {amount.toLocaleString()}
            </button>
          ))}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Custom"
            value={customBet}
            onChange={handleCustomBet}
            disabled={dropping}
            style={styles.customInput}
          />
        </div>
      </div>

      {/* Balance */}
      <div style={styles.balanceRow}>
        <span style={styles.balLabel}>Balance</span>
        <span style={styles.balAmount}>{balance.toLocaleString()}</span>
        <span style={styles.balPts}>pts</span>
      </div>

      {/* Peg board */}
      <div style={styles.boardWrapper}>
        <div style={styles.board}>
          {/* Pegs */}
          {pegRows.map((row, ri) =>
            row.map((peg, pi) => (
              <div
                key={`${ri}-${pi}`}
                style={{
                  ...styles.peg,
                  left: peg.x - PEG_SIZE / 2,
                  top: peg.y - PEG_SIZE / 2,
                }}
              />
            ))
          )}

          {/* Ball */}
          {dropping && (
            <motion.div
              ref={ballRef}
              style={styles.ball}
              initial={false}
            />
          )}
        </div>

        {/* Multiplier slots */}
        <div style={styles.slotsRow}>
          {multipliers.map((mult, i) => {
            const isWinner = winSlot === i;
            return (
              <div
                key={i}
                style={{
                  ...styles.slot,
                  background: getSlotColor(mult),
                  opacity: winSlot !== null && !isWinner ? 0.4 : 1,
                  transform: isWinner ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: isWinner ? `0 0 12px ${getSlotColor(mult)}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {mult}x
              </div>
            );
          })}
        </div>
      </div>

      {/* Last result */}
      {lastResult && (
        <div style={{
          ...styles.resultText,
          color: lastResult.net > 0 ? 'var(--signal-go)' : lastResult.net === 0 ? 'var(--discharge)' : 'var(--signal-stop)',
        }}>
          {lastResult.multiplier}x — {lastResult.net >= 0 ? '+' : ''}{lastResult.net.toLocaleString()} pts
        </div>
      )}

      {/* DROP button */}
      <button
        style={{
          ...styles.dropBtn,
          opacity: dropping || balance < bet || bet < MIN_BET ? 0.5 : 1,
        }}
        onClick={handleDrop}
        disabled={dropping || balance < bet || bet < MIN_BET}
      >
        {dropping ? 'DROPPING...' : `DROP ${bet.toLocaleString()}`}
      </button>
    </div>
  );
}

const styles = {
  container: {
    width: 440,
    maxWidth: '100%',
    margin: '0 auto',
    padding: 'var(--sp-4)',
    fontFamily: "'Chakra Petch', sans-serif",
    color: 'var(--ink)',
  },
  section: {
    marginBottom: 'var(--sp-3)',
  },
  label: {
    display: 'block',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--ink-secondary)',
    marginBottom: 'var(--sp-1)',
  },
  toggleRow: {
    display: 'flex',
    gap: 'var(--sp-1)',
  },
  toggleBtn: {
    flex: 1,
    padding: 'var(--sp-2) var(--sp-3)',
    border: '1px solid var(--bezel-strong)',
    borderRadius: 'var(--r-md)',
    background: 'var(--panel)',
    color: 'var(--ink-secondary)',
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  toggleActive: {
    background: 'var(--phosphor)',
    color: 'var(--ink)',
    borderColor: 'var(--phosphor)',
    boxShadow: '0 0 8px var(--phosphor-glow)',
  },
  betRow: {
    display: 'flex',
    gap: 'var(--sp-1)',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: 'var(--sp-1) var(--sp-2)',
    border: '1px solid var(--bezel)',
    borderRadius: 'var(--r-sm)',
    background: 'var(--inset)',
    color: 'var(--ink-secondary)',
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  presetActive: {
    background: 'var(--raised)',
    color: 'var(--ink)',
    borderColor: 'var(--phosphor)',
  },
  customInput: {
    width: 72,
    padding: 'var(--sp-1) var(--sp-2)',
    border: '1px solid var(--bezel)',
    borderRadius: 'var(--r-sm)',
    background: 'var(--inset)',
    color: 'var(--ink)',
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 12,
    outline: 'none',
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    marginBottom: 'var(--sp-3)',
    padding: 'var(--sp-2) var(--sp-3)',
    background: 'var(--inset)',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--bezel-soft)',
  },
  balLabel: {
    fontSize: 11,
    color: 'var(--ink-tertiary)',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  balAmount: {
    fontFamily: "'Russo One', sans-serif",
    fontSize: 16,
    color: 'var(--discharge)',
  },
  balPts: {
    fontSize: 11,
    color: 'var(--ink-tertiary)',
  },
  boardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 'var(--sp-3)',
  },
  board: {
    position: 'relative',
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    background: 'var(--panel)',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--bezel)',
    overflow: 'hidden',
  },
  peg: {
    position: 'absolute',
    width: PEG_SIZE,
    height: PEG_SIZE,
    borderRadius: '50%',
    background: 'var(--ink-muted)',
  },
  ball: {
    position: 'absolute',
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: '50%',
    background: 'var(--discharge)',
    boxShadow: '0 0 8px var(--discharge-glow)',
    zIndex: 10,
    top: 0,
    left: 0,
  },
  slotsRow: {
    display: 'flex',
    gap: 2,
    marginTop: 'var(--sp-2)',
    width: BOARD_WIDTH,
  },
  slot: {
    flex: 1,
    textAlign: 'center',
    padding: 'var(--sp-1) 0',
    borderRadius: 'var(--r-sm)',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Chakra Petch', sans-serif",
    color: 'var(--void)',
  },
  resultText: {
    textAlign: 'center',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 18,
    marginBottom: 'var(--sp-3)',
  },
  dropBtn: {
    width: '100%',
    padding: 'var(--sp-3) 0',
    border: 'none',
    borderRadius: 'var(--r-md)',
    background: 'var(--signal-hot)',
    color: 'var(--ink)',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 16,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'all 0.15s',
    boxShadow: '0 0 12px var(--signal-hot-glow)',
  },
};
