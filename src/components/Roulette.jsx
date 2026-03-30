import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NUMBERS, spinWheel, evaluateBets, getNumberColor } from '../utils/rouletteLogic';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';

const CHIP_VALUES = [10, 50, 100, 500, 1000];

const COLOR_MAP = {
  red: 'var(--signal-hot)',
  black: '#1a1a2e',
  green: 'var(--signal-go)',
};

const COLOR_EMOJI = {
  red: '🔴',
  black: '⚫',
  green: '🟢',
};

// Build 12x3 grid: row 0 = [3,2,1], row 1 = [6,5,4], ..., row 11 = [36,35,34]
// Standard layout: column 1 = 1,4,7,...34; column 2 = 2,5,8,...35; column 3 = 3,6,9,...36
// Each row from top: [1,2,3], [4,5,6], ..., [34,35,36]
const GRID_ROWS = Array.from({ length: 12 }, (_, r) => [
  r * 3 + 1,
  r * 3 + 2,
  r * 3 + 3,
]);

export default function Roulette({ balance, setBalance, username, showToast, addHistory }) {
  const [phase, setPhase] = useState('betting'); // betting | spinning | result
  const [selectedChip, setSelectedChip] = useState(10);
  const [bets, setBets] = useState([]);
  const [winningNumber, setWinningNumber] = useState(null);
  const [payout, setPayout] = useState(0);
  const [wheelRotation, setWheelRotation] = useState(0);

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  const placeBet = useCallback((type, value) => {
    if (phase !== 'betting') return;
    if (selectedChip > balance - totalBet) {
      showToast('Not enough points!', 'error');
      return;
    }
    setBets(prev => {
      // Stack on existing bet of same type+value
      const idx = prev.findIndex(b => b.type === type && b.value === value);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], amount: updated[idx].amount + selectedChip };
        return updated;
      }
      return [...prev, { type, value, amount: selectedChip }];
    });
  }, [phase, selectedChip, balance, totalBet, showToast]);

  const clearBets = useCallback(() => {
    if (phase !== 'betting') return;
    setBets([]);
  }, [phase]);

  const handleSpin = useCallback(async () => {
    if (phase !== 'betting' || bets.length === 0) return;
    if (totalBet > balance) {
      showToast('Not enough points!', 'error');
      return;
    }

    // Optimistic deduct
    setBalance(prev => prev - totalBet);
    setPhase('spinning');

    try {
      await deductPoints(username, totalBet);
    } catch {
      setBalance(prev => prev + totalBet);
      setPhase('betting');
      showToast('API error — bet refunded', 'error');
      return;
    }

    const result = spinWheel();
    setWinningNumber(result);

    // Animate wheel: spin several full rotations + land
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const finalRotation = wheelRotation + spins * 360;
    setWheelRotation(finalRotation);

    // Wait for animation
    setTimeout(async () => {
      const totalPayout = evaluateBets(result, bets);
      setPayout(totalPayout);

      if (totalPayout > 0) {
        setBalance(prev => prev + totalPayout);
        try {
          await addPoints(username, totalPayout);
        } catch {}
      }

      const net = totalPayout - totalBet;
      const color = getNumberColor(result);

      try {
        await reportSpin(username, totalBet, totalPayout);
      } catch {}

      addHistory(
        [{ emoji: `${COLOR_EMOJI[color]} ${result}` }],
        net,
        'roulette'
      );

      setPhase('result');
    }, 3200);
  }, [phase, bets, totalBet, balance, username, showToast, setBalance, wheelRotation, addHistory]);

  const newRound = useCallback(() => {
    setBets([]);
    setWinningNumber(null);
    setPayout(0);
    setPhase('betting');
  }, []);

  const resultColor = winningNumber !== null ? getNumberColor(winningNumber) : null;
  const net = payout - totalBet;

  return (
    <div style={{
      maxWidth: 440,
      margin: '0 auto',
      fontFamily: "'Chakra Petch', sans-serif",
      color: 'var(--ink)',
    }}>
      {/* Chip Selector */}
      <div style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        justifyContent: 'center',
        marginBottom: 'var(--sp-3)',
        flexWrap: 'wrap',
      }}>
        {CHIP_VALUES.map(v => (
          <button
            key={v}
            onClick={() => setSelectedChip(v)}
            disabled={phase !== 'betting'}
            style={{
              width: 52,
              height: 32,
              borderRadius: 'var(--r-md)',
              border: selectedChip === v ? '2px solid var(--phosphor)' : '2px solid transparent',
              background: selectedChip === v ? 'var(--phosphor)' : 'var(--panel)',
              color: 'var(--ink)',
              fontFamily: "'Russo One', sans-serif",
              fontSize: 13,
              cursor: phase === 'betting' ? 'pointer' : 'default',
              opacity: phase !== 'betting' ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Zero */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
        <button
          onClick={() => placeBet('number', 0)}
          disabled={phase !== 'betting'}
          style={{
            width: '100%',
            maxWidth: 109,
            height: 28,
            background: COLOR_MAP.green,
            border: bets.some(b => b.type === 'number' && b.value === 0) ? '2px solid var(--discharge)' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: 'var(--r-sm)',
            color: '#fff',
            fontFamily: "'Russo One', sans-serif",
            fontSize: 13,
            cursor: phase === 'betting' ? 'pointer' : 'default',
            opacity: phase !== 'betting' ? 0.6 : 1,
          }}
        >
          0
        </button>
      </div>

      {/* Number Grid: 12 rows x 3 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 2,
        marginBottom: 'var(--sp-2)',
      }}>
        {GRID_ROWS.flat().map(n => {
          const color = getNumberColor(n);
          const hasBet = bets.some(b => b.type === 'number' && b.value === n);
          const isWinner = phase === 'result' && winningNumber === n;
          return (
            <button
              key={n}
              onClick={() => placeBet('number', n)}
              disabled={phase !== 'betting'}
              style={{
                height: 28,
                background: isWinner ? 'var(--discharge)' : COLOR_MAP[color],
                border: hasBet ? '2px solid var(--discharge)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--r-sm)',
                color: isWinner ? '#000' : '#fff',
                fontFamily: "'Russo One', sans-serif",
                fontSize: 12,
                cursor: phase === 'betting' ? 'pointer' : 'default',
                opacity: phase !== 'betting' ? 0.6 : 1,
                transition: 'all 0.15s',
                fontWeight: isWinner ? 'bold' : 'normal',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Outside Bets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--sp-1)',
        marginBottom: 'var(--sp-3)',
      }}>
        {[
          { label: '🔴 Red', type: 'red' },
          { label: '⚫ Black', type: 'black' },
          { label: 'Odd', type: 'odd' },
          { label: 'Even', type: 'even' },
          { label: '1-18', type: 'low' },
          { label: '19-36', type: 'high' },
        ].map(({ label, type }) => {
          const hasBet = bets.some(b => b.type === type);
          return (
            <button
              key={type}
              onClick={() => placeBet(type, undefined)}
              disabled={phase !== 'betting'}
              style={{
                height: 34,
                background: hasBet ? 'rgba(124, 58, 237, 0.3)' : 'var(--panel)',
                border: hasBet ? '2px solid var(--phosphor)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--r-md)',
                color: 'var(--ink)',
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: phase === 'betting' ? 'pointer' : 'default',
                opacity: phase !== 'betting' ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active Bets Summary */}
      {bets.length > 0 && (
        <div style={{
          background: 'rgba(124, 58, 237, 0.1)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp-2) var(--sp-3)',
          marginBottom: 'var(--sp-2)',
          fontSize: 13,
          color: 'var(--ink-secondary)',
          maxHeight: 72,
          overflowY: 'auto',
        }}>
          {bets.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {b.type === 'number' ? `#${b.value}` : b.type.charAt(0).toUpperCase() + b.type.slice(1)}
              </span>
              <span style={{ color: 'var(--discharge)' }}>{b.amount}</span>
            </div>
          ))}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            marginTop: 'var(--sp-1)',
            paddingTop: 'var(--sp-1)',
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
            color: 'var(--ink)',
          }}>
            <span>Total</span>
            <span>{totalBet}</span>
          </div>
        </div>
      )}

      {/* Wheel Animation Area */}
      <AnimatePresence>
        {(phase === 'spinning' || phase === 'result') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 'var(--sp-3)',
            }}
          >
            <motion.div
              animate={{ rotate: wheelRotation }}
              transition={{
                duration: 3,
                ease: [0.2, 0.8, 0.3, 1], // deceleration curve
              }}
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: `conic-gradient(
                  var(--signal-hot) 0deg 60deg,
                  #1a1a2e 60deg 120deg,
                  var(--signal-go) 120deg 130deg,
                  var(--signal-hot) 130deg 190deg,
                  #1a1a2e 190deg 250deg,
                  var(--signal-hot) 250deg 310deg,
                  #1a1a2e 310deg 360deg
                )`,
                border: '4px solid var(--phosphor)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--sp-2)',
                boxShadow: '0 0 24px rgba(124, 58, 237, 0.4)',
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--void)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Russo One', sans-serif",
                fontSize: 16,
                color: phase === 'result' ? COLOR_MAP[resultColor] : 'var(--ink)',
                border: '2px solid var(--panel)',
              }}>
                {phase === 'result' ? winningNumber : '?'}
              </div>
            </motion.div>

            {/* Result Display */}
            {phase === 'result' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  fontFamily: "'Russo One', sans-serif",
                  fontSize: 22,
                  color: COLOR_MAP[resultColor],
                  marginBottom: 'var(--sp-1)',
                }}>
                  {winningNumber} {resultColor.toUpperCase()}
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: net >= 0 ? 'var(--signal-go)' : 'var(--signal-stop)',
                }}>
                  {payout > 0 ? `Won ${payout} (+${net})` : 'No win'}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        {phase === 'betting' && (
          <>
            <button
              onClick={clearBets}
              disabled={bets.length === 0}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'var(--panel)',
                color: 'var(--ink-secondary)',
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                cursor: bets.length > 0 ? 'pointer' : 'default',
                opacity: bets.length === 0 ? 0.4 : 1,
              }}
            >
              Clear
            </button>
            <button
              onClick={handleSpin}
              disabled={bets.length === 0 || totalBet > balance}
              style={{
                flex: 2,
                height: 42,
                borderRadius: 'var(--r-md)',
                border: 'none',
                background: bets.length > 0 && totalBet <= balance
                  ? 'linear-gradient(135deg, var(--phosphor), var(--signal-hot))'
                  : 'var(--panel)',
                color: '#fff',
                fontFamily: "'Russo One', sans-serif",
                fontSize: 15,
                cursor: bets.length > 0 && totalBet <= balance ? 'pointer' : 'default',
                opacity: bets.length === 0 || totalBet > balance ? 0.4 : 1,
                boxShadow: bets.length > 0 ? '0 0 16px rgba(124, 58, 237, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              SPIN ({totalBet})
            </button>
          </>
        )}

        {phase === 'spinning' && (
          <div style={{
            flex: 1,
            height: 42,
            borderRadius: 'var(--r-md)',
            background: 'var(--panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Russo One', sans-serif",
            fontSize: 14,
            color: 'var(--phosphor)',
            animation: 'pulse 1s infinite',
          }}>
            Spinning...
          </div>
        )}

        {phase === 'result' && (
          <button
            onClick={newRound}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 'var(--r-md)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--phosphor), var(--signal-hot))',
              color: '#fff',
              fontFamily: "'Russo One', sans-serif",
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(124, 58, 237, 0.3)',
            }}
          >
            NEW ROUND
          </button>
        )}
      </div>
    </div>
  );
}
