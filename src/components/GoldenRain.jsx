import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';
import { Sparkles } from 'lucide-react';

// 3 random picks from pool (with replacement) — additive
// Pool avg = 4.89, × 3 = 14.67x avg (147% RTP)
const POOL = [1, 2, 3, 4, 5, 5, 6, 8, 10];
const PICKS = 3;

function pickRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

export default function GoldenRain({ bet, onComplete }) {
  const [reveals, setReveals] = useState([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  const handlePick = useCallback(() => {
    if (done || reveals.length >= PICKS) return;

    const value = pickRandom();
    const newReveals = [...reveals, value];
    const newTotal = total + value;
    setReveals(newReveals);
    setTotal(newTotal);
    audio.cardDeal();

    if (value >= 8) audio.win(value);

    if (newReveals.length >= PICKS) {
      setDone(true);
      audio.bonus();
      setTimeout(() => onComplete(newTotal), 2000);
    }
  }, [done, reveals, total, onComplete]);

  const payout = Math.floor(bet * total);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title" style={{ color: '#FBBF24' }}>
          <Sparkles size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> GOLDEN RAIN
        </h2>
        <p className="vh-subtitle">
          {done ? 'Collecting your winnings!' : `Pick ${PICKS - reveals.length} more multiplier${PICKS - reveals.length > 1 ? 's' : ''}!`}
        </p>

        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span className="vh-total-amount" key={total} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {total}x
          </motion.span>
          <span className="vh-total-payout">= {payout.toLocaleString()} pts</span>
        </div>

        {/* Revealed values */}
        <div className="gr-reveals">
          {reveals.map((val, i) => (
            <motion.div
              key={i}
              className="gr-card"
              initial={{ scale: 0, rotateY: 180 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <span className="gr-card-value">+{val}x</span>
            </motion.div>
          ))}
          {Array.from({ length: PICKS - reveals.length }, (_, i) => (
            <motion.button
              key={`empty-${i}`}
              className="gr-card gr-card-hidden"
              onClick={handlePick}
              disabled={done}
              whileTap={{ scale: 0.9 }}
            >
              <span className="gr-card-q">?</span>
            </motion.button>
          ))}
        </div>

        {done && (
          <motion.div
            className="vh-result vh-result-clear"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {total}x = {payout.toLocaleString()} pts!
          </motion.div>
        )}

        <p className="vh-hint">
          {done ? 'Returning to slots...' : `Possible values: ${[...new Set(POOL)].sort((a,b)=>a-b).join(', ')}x`}
        </p>
      </div>
    </div>
  );
}
