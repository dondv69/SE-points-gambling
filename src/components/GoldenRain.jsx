import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audio } from '../utils/audio';
import { Sparkles, RefreshCw, Check } from 'lucide-react';

// 3 rounds. Each round: draw a card, player sees it, then KEEP or SWAP.
// SWAP draws a new card (old one is revealed as "what you had").
// Pool picks with replacement. Values add up.
// Pool avg = 4.89, × 3 rounds = 14.67x avg (147% RTP)
const POOL = [1, 2, 3, 4, 5, 5, 6, 8, 10];
const ROUNDS = 3;

function pickRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

export default function GoldenRain({ bet, onComplete }) {
  const [round, setRound] = useState(0); // 0-2
  const [currentCard, setCurrentCard] = useState(() => pickRandom());
  const [decided, setDecided] = useState(false); // has player chosen keep/swap this round
  const [swappedFrom, setSwappedFrom] = useState(null); // old card if swapped
  const [keptCards, setKeptCards] = useState([]); // final values for each round
  const [done, setDone] = useState(false);

  const total = keptCards.reduce((s, v) => s + v, 0);
  const payout = Math.floor(bet * total);

  const advanceRound = useCallback((value) => {
    const newKept = [...keptCards, value];
    setKeptCards(newKept);

    if (newKept.length >= ROUNDS) {
      const finalTotal = newKept.reduce((s, v) => s + v, 0);
      setDone(true);
      audio.bonus();
      setTimeout(() => onComplete(finalTotal), 2500);
    } else {
      // Next round after short delay
      setTimeout(() => {
        setRound(prev => prev + 1);
        setCurrentCard(pickRandom());
        setDecided(false);
        setSwappedFrom(null);
      }, 1500);
    }
  }, [keptCards, onComplete]);

  const handleKeep = useCallback(() => {
    if (decided || done) return;
    setDecided(true);
    audio.cardDeal();
    if (currentCard >= 8) audio.win(currentCard);
    advanceRound(currentCard);
  }, [decided, done, currentCard, advanceRound]);

  const handleSwap = useCallback(() => {
    if (decided || done) return;
    setDecided(true);
    const oldCard = currentCard;
    const newCard = pickRandom();
    setSwappedFrom(oldCard);
    setCurrentCard(newCard);
    audio.cardFlip();
    if (newCard >= 8) audio.win(newCard);
    advanceRound(newCard);
  }, [decided, done, currentCard, advanceRound]);

  const finalTotal = done ? keptCards.reduce((s, v) => s + v, 0) : 0;
  const finalPayout = Math.floor(bet * finalTotal);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title" style={{ color: '#FBBF24' }}>
          <Sparkles size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> GOLDEN RAIN
        </h2>
        <p className="vh-subtitle">
          {done ? 'Collecting your winnings!' : `Round ${round + 1} of ${ROUNDS} — Keep or Swap?`}
        </p>

        {/* Running total from previous rounds */}
        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span className="vh-total-amount" key={done ? finalTotal : total} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {done ? finalTotal : total}x
          </motion.span>
          <span className="vh-total-payout">= {(done ? finalPayout : payout).toLocaleString()} pts</span>
        </div>

        {/* Previous kept cards */}
        {keptCards.length > 0 && (
          <div className="gr-history">
            {keptCards.map((val, i) => (
              <div key={i} className="gr-history-card">+{val}x</div>
            ))}
          </div>
        )}

        {/* Current card */}
        {!done && (
          <div className="gr-current">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${round}-${currentCard}-${decided}`}
                className={`gr-big-card ${decided ? 'gr-big-decided' : ''}`}
                initial={{ scale: 0.5, rotateY: 90 }}
                animate={{ scale: 1, rotateY: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <span className="gr-big-value">+{currentCard}x</span>
              </motion.div>
            </AnimatePresence>

            {/* Show what you swapped from */}
            {swappedFrom !== null && (
              <motion.div
                className="gr-swapped-info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Old card was: <strong>{swappedFrom}x</strong>
                {currentCard > swappedFrom && <span className="gr-better"> — Better swap!</span>}
                {currentCard < swappedFrom && <span className="gr-worse"> — Oops!</span>}
                {currentCard === swappedFrom && <span className="gr-same"> — Same!</span>}
              </motion.div>
            )}
          </div>
        )}

        {/* Keep / Swap buttons */}
        {!decided && !done && (
          <div className="gr-actions">
            <button className="gr-keep-btn" onClick={handleKeep}>
              <Check size={18} /> KEEP {currentCard}x
            </button>
            <button className="gr-swap-btn" onClick={handleSwap}>
              <RefreshCw size={18} /> SWAP
            </button>
          </div>
        )}

        {/* Final result */}
        {done && (
          <motion.div
            className="vh-result vh-result-clear"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {keptCards.map(v => v + 'x').join(' + ')} = {finalTotal}x = {finalPayout.toLocaleString()} pts!
          </motion.div>
        )}

        <p className="vh-hint">
          {done ? 'Returning to slots...' : `Possible values: ${[...new Set(POOL)].sort((a, b) => a - b).join(', ')}x`}
        </p>
      </div>
    </div>
  );
}
