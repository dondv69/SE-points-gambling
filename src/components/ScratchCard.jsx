import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';
import { HelpCircle } from 'lucide-react';

// 9 panels, pick 3, additive — 52% RTP (harsh)
// Pool: [0, 0, 0, 0, 0, 1, 2, 5, 10]
const POOL = [0, 0, 0, 0, 0, 1, 2, 5, 10];
const PICKS_NEEDED = 3;

function shufflePool() {
  const p = [...POOL];
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

export default function ScratchCard({ bet, onComplete }) {
  const [panels] = useState(() => shufflePool());
  const [revealed, setRevealed] = useState(new Set());
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  const picksLeft = PICKS_NEEDED - revealed.size;
  const payout = Math.floor(bet * total);

  const handleReveal = useCallback((index) => {
    if (done || revealed.has(index) || revealed.size >= PICKS_NEEDED) return;

    const value = panels[index];
    const newRevealed = new Set(revealed);
    newRevealed.add(index);
    setRevealed(newRevealed);

    const newTotal = total + value;
    setTotal(newTotal);

    if (value > 0) {
      audio.cardDeal();
      if (value >= 5) audio.win(value);
    } else {
      audio.loss();
    }

    if (newRevealed.size >= PICKS_NEEDED) {
      setDone(true);
      setTimeout(() => onComplete(newTotal), 2000);
    }
  }, [done, revealed, panels, total, onComplete]);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title" style={{ color: '#94A3B8' }}>SCRATCH CARD</h2>
        <p className="vh-subtitle">
          {done ? (total > 0 ? `You won ${total}x!` : 'No luck this time...') : `Pick ${picksLeft} panel${picksLeft > 1 ? 's' : ''} to reveal!`}
        </p>

        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span className="vh-total-amount" key={total} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {total}x
          </motion.span>
          <span className="vh-total-payout">= {payout.toLocaleString()} pts</span>
        </div>

        {/* 3x3 grid */}
        <div className="sc-grid">
          {panels.map((value, i) => {
            const isRevealed = revealed.has(i);
            const showAll = done && !isRevealed;

            return (
              <motion.button
                key={i}
                className={`sc-panel ${isRevealed ? (value > 0 ? 'sc-win' : 'sc-zero') : ''} ${showAll ? (value > 0 ? 'sc-missed' : 'sc-zero-dim') : ''}`}
                onClick={() => handleReveal(i)}
                disabled={isRevealed || done}
                whileTap={!isRevealed && !done ? { scale: 0.9 } : {}}
              >
                {isRevealed && (value > 0 ? <span className="sc-value">+{value}x</span> : <span className="sc-empty">0</span>)}
                {showAll && (value > 0 ? <span className="sc-value" style={{ opacity: 0.4 }}>+{value}x</span> : <span className="sc-empty" style={{ opacity: 0.3 }}>0</span>)}
                {!isRevealed && !showAll && <HelpCircle size={20} />}
              </motion.button>
            );
          })}
        </div>

        {done && (
          <motion.div
            className={`vh-result ${total > 0 ? 'vh-result-clear' : 'vh-result-trap'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {total > 0 ? `${total}x = ${payout.toLocaleString()} pts` : 'Better luck next time!'}
          </motion.div>
        )}

        <p className="vh-hint">
          {done ? 'Returning to slots...' : '5 panels are empty, 4 have prizes!'}
        </p>
      </div>
    </div>
  );
}
