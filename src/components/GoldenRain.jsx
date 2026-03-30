import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audio } from '../utils/audio';
import { Sparkles, RefreshCw, Check, Zap } from 'lucide-react';

// 3 rounds blind keep/swap + optional double-or-nothing
// Card is FACE DOWN when choosing. You don't see the value until after.
const POOL = [1, 2, 3, 4, 5, 5, 6, 8, 10];
const ROUNDS = 3;

function pickRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

// Phases: picking (3 rounds) → doubleOrNothing → done
export default function GoldenRain({ bet, onComplete }) {
  const [round, setRound] = useState(0);
  const [hiddenCard, setHiddenCard] = useState(() => pickRandom());
  const [revealed, setRevealed] = useState(false); // card flipped after choice
  const [swapped, setSwapped] = useState(false);
  const [oldCard, setOldCard] = useState(null);
  const [keptCards, setKeptCards] = useState([]);
  const [phase, setPhase] = useState('picking'); // picking | doubleOrNothing | done
  const [doubleWon, setDoubleWon] = useState(null); // null | true | false

  const total = keptCards.reduce((s, v) => s + v, 0);
  const finalTotal = phase === 'done' && doubleWon === true ? total * 2 : (phase === 'done' && doubleWon === false ? 0 : total);
  const payout = Math.floor(bet * finalTotal);

  const advanceRound = useCallback((value) => {
    const newKept = [...keptCards, value];
    setKeptCards(newKept);
    setRevealed(true);

    if (value >= 8) audio.win(value);
    else audio.cardDeal();

    // After short delay, go to next round or double-or-nothing
    setTimeout(() => {
      if (newKept.length >= ROUNDS) {
        setPhase('doubleOrNothing');
      } else {
        setRound(prev => prev + 1);
        setHiddenCard(pickRandom());
        setRevealed(false);
        setSwapped(false);
        setOldCard(null);
      }
    }, 1500);
  }, [keptCards]);

  const handleKeep = useCallback(() => {
    if (revealed || phase !== 'picking') return;
    advanceRound(hiddenCard);
  }, [revealed, phase, hiddenCard, advanceRound]);

  const handleSwap = useCallback(() => {
    if (revealed || phase !== 'picking') return;
    const discarded = hiddenCard;
    const newCard = pickRandom();
    setOldCard(discarded);
    setHiddenCard(newCard);
    setSwapped(true);
    audio.cardFlip();
    advanceRound(newCard);
  }, [revealed, phase, hiddenCard, advanceRound]);

  const handleDouble = useCallback(() => {
    if (phase !== 'doubleOrNothing') return;
    const win = Math.random() < 0.5;
    setDoubleWon(win);
    setPhase('done');
    if (win) {
      audio.bonus();
    } else {
      audio.loss();
    }
    const finalMult = win ? total * 2 : 0;
    setTimeout(() => onComplete(finalMult), 2500);
  }, [phase, total, onComplete]);

  const handleCollect = useCallback(() => {
    if (phase !== 'doubleOrNothing') return;
    setDoubleWon(null);
    setPhase('done');
    audio.bonus();
    setTimeout(() => onComplete(total), 2000);
  }, [phase, total, onComplete]);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title" style={{ color: '#FBBF24' }}>
          <Sparkles size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> GOLDEN RAIN
        </h2>
        <p className="vh-subtitle">
          {phase === 'picking' && `Round ${round + 1} of ${ROUNDS} — Keep or Swap?`}
          {phase === 'doubleOrNothing' && 'Double or Nothing? Or collect your winnings.'}
          {phase === 'done' && (doubleWon === true ? 'DOUBLED!' : doubleWon === false ? 'Busted...' : 'Collecting!')}
        </p>

        {/* Total */}
        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span className="vh-total-amount" key={phase === 'done' ? finalTotal : total} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {phase === 'done' ? finalTotal : total}x
          </motion.span>
          <span className="vh-total-payout">= {(phase === 'done' ? Math.floor(bet * finalTotal) : Math.floor(bet * total)).toLocaleString()} pts</span>
        </div>

        {/* Previous cards */}
        {keptCards.length > 0 && (
          <div className="gr-history">
            {keptCards.map((val, i) => (
              <div key={i} className="gr-history-card">+{val}x</div>
            ))}
          </div>
        )}

        {/* Card area — picking phase */}
        {phase === 'picking' && (
          <div className="gr-current">
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.div
                  key={`hidden-${round}`}
                  className="gr-big-card gr-face-down"
                  initial={{ scale: 0.8, rotateY: 0 }}
                  animate={{ scale: 1, rotateY: 0 }}
                >
                  <span className="gr-big-q">?</span>
                </motion.div>
              ) : (
                <motion.div
                  key={`revealed-${round}`}
                  className="gr-big-card"
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <span className="gr-big-value">+{hiddenCard}x</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Swap info */}
            {revealed && swapped && oldCard !== null && (
              <motion.div className="gr-swapped-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                Old card was: <strong>{oldCard}x</strong>
                {hiddenCard > oldCard && <span className="gr-better"> — Better swap!</span>}
                {hiddenCard < oldCard && <span className="gr-worse"> — Oops!</span>}
                {hiddenCard === oldCard && <span className="gr-same"> — Same!</span>}
              </motion.div>
            )}
            {revealed && !swapped && (
              <motion.div className="gr-swapped-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Kept!
              </motion.div>
            )}
          </div>
        )}

        {/* Keep / Swap buttons */}
        {phase === 'picking' && !revealed && (
          <div className="gr-actions">
            <button className="gr-keep-btn" onClick={handleKeep}>
              <Check size={18} /> KEEP
            </button>
            <button className="gr-swap-btn" onClick={handleSwap}>
              <RefreshCw size={18} /> SWAP
            </button>
          </div>
        )}

        {/* Double or Nothing */}
        {phase === 'doubleOrNothing' && (
          <div className="gr-actions">
            <button className="gr-keep-btn" onClick={handleCollect}>
              <Check size={18} /> COLLECT {total}x
            </button>
            <button className="gr-double-btn" onClick={handleDouble}>
              <Zap size={18} /> DOUBLE ({total * 2}x or 0)
            </button>
          </div>
        )}

        {/* Done result */}
        {phase === 'done' && (
          <motion.div
            className={`vh-result ${finalTotal > 0 ? 'vh-result-clear' : 'vh-result-trap'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {doubleWon === true && `DOUBLED! ${total}x → ${finalTotal}x = ${payout.toLocaleString()} pts!`}
            {doubleWon === false && `Busted! Lost it all.`}
            {doubleWon === null && `${finalTotal}x = ${payout.toLocaleString()} pts!`}
          </motion.div>
        )}

        <p className="vh-hint">
          {phase === 'done' ? 'Returning to slots...' :
           phase === 'doubleOrNothing' ? '50/50 chance to double your total or lose everything!' :
           `Card is face down. Swap draws a new random card.`}
        </p>
      </div>
    </div>
  );
}
