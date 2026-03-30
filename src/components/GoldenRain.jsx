import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audio } from '../utils/audio';
import { Sparkles, RefreshCw, Check, Zap } from 'lucide-react';

const POOL = [1, 2, 3, 4, 5, 5, 6, 8, 10];
const ROUNDS = 3;

function pickRandom() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

export default function GoldenRain({ bet, onComplete }) {
  const [round, setRound] = useState(0);
  const [hiddenCard, setHiddenCard] = useState(() => pickRandom());
  const [cardState, setCardState] = useState('facedown'); // facedown | swapping | revealed
  const [swapped, setSwapped] = useState(false);
  const [oldCard, setOldCard] = useState(null);
  const [keptCards, setKeptCards] = useState([]);
  const [phase, setPhase] = useState('picking'); // picking | doubleOrNothing | flipping | done
  const [doubleWon, setDoubleWon] = useState(null);
  const [coinSide, setCoinSide] = useState(null); // for coin animation
  const busy = useRef(false);

  const total = keptCards.reduce((s, v) => s + v, 0);
  const finalTotal = phase === 'done' && doubleWon === true ? total * 2 : (phase === 'done' && doubleWon === false ? 0 : total);

  const goNextRound = useCallback((newKept) => {
    setTimeout(() => {
      if (newKept.length >= ROUNDS) {
        setPhase('doubleOrNothing');
      } else {
        setRound(prev => prev + 1);
        setHiddenCard(pickRandom());
        setCardState('facedown');
        setSwapped(false);
        setOldCard(null);
      }
      busy.current = false;
    }, 1800);
  }, []);

  const handleKeep = useCallback(() => {
    if (cardState !== 'facedown' || phase !== 'picking' || busy.current) return;
    busy.current = true;

    // Flip to reveal
    setCardState('revealed');
    setSwapped(false);
    audio.cardDeal();
    if (hiddenCard >= 8) audio.win(hiddenCard);

    const newKept = [...keptCards, hiddenCard];
    setKeptCards(newKept);
    goNextRound(newKept);
  }, [cardState, phase, hiddenCard, keptCards, goNextRound]);

  const handleSwap = useCallback(() => {
    if (cardState !== 'facedown' || phase !== 'picking' || busy.current) return;
    busy.current = true;

    // Step 1: animate card sliding away
    const discarded = hiddenCard;
    setOldCard(discarded);
    setSwapped(true);
    setCardState('swapping');
    audio.cardFlip();

    // Step 2: after swap animation, show new card
    setTimeout(() => {
      const newCard = pickRandom();
      setHiddenCard(newCard);
      setCardState('revealed');
      audio.cardDeal();
      if (newCard >= 8) audio.win(newCard);

      const newKept = [...keptCards, newCard];
      setKeptCards(newKept);
      goNextRound(newKept);
    }, 600);
  }, [cardState, phase, hiddenCard, keptCards, goNextRound]);

  const handleDouble = useCallback(() => {
    if (phase !== 'doubleOrNothing') return;
    setPhase('flipping');
    setCoinSide(null);

    // Animate coin flip for 1.5s then reveal
    setTimeout(() => {
      const win = Math.random() < 0.5;
      setCoinSide(win ? 'win' : 'lose');
      setDoubleWon(win);

      setTimeout(() => {
        setPhase('done');
        if (win) audio.bonus(); else audio.loss();
        const finalMult = win ? total * 2 : 0;
        setTimeout(() => onComplete(finalMult), 2000);
      }, 1000);
    }, 1500);
  }, [phase, total, onComplete]);

  const handleCollect = useCallback(() => {
    if (phase !== 'doubleOrNothing') return;
    setDoubleWon(null);
    setPhase('done');
    audio.bonus();
    setTimeout(() => onComplete(total), 2000);
  }, [phase, total, onComplete]);

  const displayTotal = phase === 'done' ? finalTotal : total;
  const displayPayout = Math.floor(bet * displayTotal);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title" style={{ color: '#FBBF24' }}>
          <Sparkles size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> GOLDEN RAIN
        </h2>
        <p className="vh-subtitle">
          {phase === 'picking' && `Round ${round + 1} of ${ROUNDS} — Keep or Swap?`}
          {phase === 'doubleOrNothing' && 'Double or collect?'}
          {phase === 'flipping' && 'Flipping...'}
          {phase === 'done' && (doubleWon === true ? 'DOUBLED!' : doubleWon === false ? 'Busted...' : 'Collecting!')}
        </p>

        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span className="vh-total-amount" key={displayTotal} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {displayTotal}x
          </motion.span>
          <span className="vh-total-payout">= {displayPayout.toLocaleString()} pts</span>
        </div>

        {keptCards.length > 0 && phase === 'picking' && (
          <div className="gr-history">
            {keptCards.map((val, i) => (
              <div key={i} className="gr-history-card">+{val}x</div>
            ))}
          </div>
        )}

        {/* Card area */}
        {phase === 'picking' && (
          <div className="gr-current">
            <AnimatePresence mode="wait">
              {cardState === 'facedown' && (
                <motion.div
                  key={`facedown-${round}`}
                  className="gr-big-card gr-face-down"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ x: -200, opacity: 0, rotate: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="gr-big-q">?</span>
                </motion.div>
              )}
              {cardState === 'swapping' && (
                <motion.div
                  key={`swapping-${round}`}
                  className="gr-big-card gr-face-down"
                  initial={{ x: 0, opacity: 1 }}
                  animate={{ x: -200, opacity: 0, rotate: -15 }}
                  transition={{ duration: 0.4 }}
                >
                  <span className="gr-big-q">?</span>
                </motion.div>
              )}
              {cardState === 'revealed' && (
                <motion.div
                  key={`revealed-${round}-${hiddenCard}`}
                  className="gr-big-card"
                  initial={swapped ? { x: 200, opacity: 0, rotate: 15 } : { rotateY: 90 }}
                  animate={swapped ? { x: 0, opacity: 1, rotate: 0 } : { rotateY: 0 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                >
                  <span className="gr-big-value">+{hiddenCard}x</span>
                </motion.div>
              )}
            </AnimatePresence>

            {cardState === 'revealed' && swapped && oldCard !== null && (
              <motion.div className="gr-swapped-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                Old card was: <strong>{oldCard}x</strong>
                {hiddenCard > oldCard && <span className="gr-better"> — Better swap!</span>}
                {hiddenCard < oldCard && <span className="gr-worse"> — Oops!</span>}
                {hiddenCard === oldCard && <span className="gr-same"> — Same!</span>}
              </motion.div>
            )}
            {cardState === 'revealed' && !swapped && (
              <motion.div className="gr-swapped-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Kept!
              </motion.div>
            )}
          </div>
        )}

        {/* Coin flip animation */}
        {(phase === 'flipping' || (phase === 'done' && doubleWon !== null)) && (
          <div className="gr-coin-area">
            <motion.div
              className={`gr-coin ${coinSide === 'win' ? 'gr-coin-win' : coinSide === 'lose' ? 'gr-coin-lose' : ''}`}
              animate={phase === 'flipping' && coinSide === null ? {
                rotateX: [0, 180, 360, 540, 720, 900, 1080],
                y: [0, -40, 0, -30, 0, -20, 0],
              } : {}}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            >
              {coinSide === 'win' && <span className="gr-coin-text">2×</span>}
              {coinSide === 'lose' && <span className="gr-coin-text">0</span>}
              {coinSide === null && <span className="gr-coin-text">?</span>}
            </motion.div>
          </div>
        )}

        {/* Keep/Swap buttons */}
        {phase === 'picking' && cardState === 'facedown' && (
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
              <Zap size={18} /> DOUBLE
            </button>
          </div>
        )}

        {phase === 'done' && (
          <motion.div
            className={`vh-result ${finalTotal > 0 ? 'vh-result-clear' : 'vh-result-trap'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {doubleWon === true && `DOUBLED! ${total}x → ${finalTotal}x = ${displayPayout.toLocaleString()} pts!`}
            {doubleWon === false && 'Busted! Lost it all.'}
            {doubleWon === null && `${finalTotal}x = ${displayPayout.toLocaleString()} pts!`}
          </motion.div>
        )}

        <p className="vh-hint">
          {phase === 'done' ? 'Returning to slots...' :
           phase === 'doubleOrNothing' ? '50/50 — double your total or lose everything!' :
           phase === 'flipping' ? '' :
           'Card is face down. Swap slides it away and draws a new one.'}
        </p>
      </div>
    </div>
  );
}
