import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Reel from './Reel';
import BetControls from './BetControls';
import WinDisplay from './WinDisplay';
import BonusOverlay from './BonusOverlay';
import { REEL_COUNT, SPIN_DURATION_BASE, SPIN_STAGGER, BONUS_BUY_MULTIPLIER, BONUS_FREE_SPINS, BONUS_WIN_MULTIPLIER, JACKPOT_CONTRIBUTION_RATE, JACKPOT_SEED } from '../utils/constants';
import { spinReels, evaluateWin, isBonusTriggered, isNearMiss } from '../utils/slotLogic';
import { deductPoints, addPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { Trophy, Sparkles } from 'lucide-react';

export default function SlotMachine({ balance, setBalance, username, jackpot, setJackpot, addHistory, addLeaderboardEntry, showToast }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([null, null, null]);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(null);
  const [bonusMode, setBonusMode] = useState(false);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [nearMiss, setNearMiss] = useState(false);
  const [showBonusIntro, setShowBonusIntro] = useState(false);
  const stoppedReels = useRef(0);
  const currentResults = useRef([]);
  const broadcastChannel = useRef(
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('streamslots_wins') : null
  );

  const canSpin = !spinning && (bonusMode ? bonusSpinsLeft > 0 : balance >= bet);

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (spinning) return;
    await audio.ensure();

    // In bonus mode, free spins — no cost
    const actualBet = bonusMode ? 0 : (isBonusBuy ? bet * BONUS_BUY_MULTIPLIER : bet);

    if (!bonusMode && balance < actualBet) {
      showToast('Not enough points!', 'error');
      return;
    }

    // Deduct bet (unless free spin)
    if (actualBet > 0) {
      setBalance(prev => prev - actualBet);
    }

    setSpinning(true);
    setLastWin(null);
    setNearMiss(false);
    stoppedReels.current = 0;

    // Generate results
    const spinResults = spinReels();
    currentResults.current = spinResults;
    setResults(spinResults);

    // API deduct (not in bonus mode)
    if (actualBet > 0) {
      try {
        await deductPoints(username, actualBet);
      } catch {
        setBalance(prev => prev + actualBet);
        setSpinning(false);
        showToast('API error — bet refunded', 'error');
        return;
      }
    }

    // If bonus buy, force bonus trigger
    if (isBonusBuy) {
      currentResults.current = [
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
      ];
      setResults(currentResults.current);
    }
  }, [spinning, bet, balance, username, showToast, setBalance, bonusMode]);

  const handleReelStop = useCallback((reelIndex) => {
    stoppedReels.current += 1;
    audio.reelStop();

    if (stoppedReels.current >= REEL_COUNT) {
      setSpinning(false);

      const res = currentResults.current;

      // Check bonus trigger
      if (isBonusTriggered(res)) {
        audio.bonus();
        setBonusMode(true);
        setBonusSpinsLeft(BONUS_FREE_SPINS);
        setShowBonusIntro(true);
        showToast('BONUS MODE ACTIVATED!', 'bonus');
        return;
      }

      // Evaluate win — use the bet amount even in bonus mode
      const effectiveBet = bonusMode ? bet : bet;
      const winResult = evaluateWin(res, effectiveBet, jackpot);

      // Apply bonus multiplier
      if (bonusMode && winResult.winAmount > 0) {
        winResult.winAmount = Math.floor(winResult.winAmount * BONUS_WIN_MULTIPLIER);
        winResult.label += ` (${BONUS_WIN_MULTIPLIER}x Bonus)`;
      }

      if (winResult.type === 'jackpot') {
        audio.jackpot();
        setBalance(prev => prev + jackpot);
        addPoints(username, jackpot).catch(() => {});
        setJackpot(JACKPOT_SEED);
        setLastWin({ ...winResult, amount: jackpot });
        addHistory(res, jackpot, 'jackpot');
        addLeaderboardEntry(username, jackpot, 'JACKPOT');
        showToast(`JACKPOT! +${jackpot.toLocaleString()} pts!`, 'jackpot');
        const siteUrl = window.location.origin;
        sendChatMessage(formatWinMessage(username, jackpot, null, 'jackpot', siteUrl));
        broadcastChannel.current?.postMessage({ type: 'jackpot', username, amount: jackpot });
      } else if (winResult.winAmount > 0) {
        audio.win(winResult.multiplier);
        setBalance(prev => prev + winResult.winAmount);
        addPoints(username, winResult.winAmount).catch(() => {});
        setLastWin({ ...winResult, amount: winResult.winAmount });
        const winType = winResult.multiplier >= 25 ? 'mega' : winResult.multiplier >= 10 ? 'big' : 'win';
        addHistory(res, winResult.winAmount - (bonusMode ? 0 : bet), winType === 'mega' ? 'mega' : 'win');
        if (winResult.winAmount >= bet * 5) {
          addLeaderboardEntry(username, winResult.winAmount, winResult.label);
        }
        showToast(`+${winResult.winAmount.toLocaleString()} pts!`, winType === 'mega' ? 'mega' : 'win');
        if (shouldAnnounce(winResult.winAmount, bet, winType)) {
          const siteUrl = window.location.origin;
          sendChatMessage(formatWinMessage(username, winResult.winAmount, winResult.multiplier, winType, siteUrl));
          broadcastChannel.current?.postMessage({ type: winType, username, amount: winResult.winAmount, multiplier: winResult.multiplier });
        }
      } else {
        audio.loss();
        if (!bonusMode) {
          setJackpot(prev => prev + Math.floor(bet * JACKPOT_CONTRIBUTION_RATE));
        }
        setLastWin(null);
        addHistory(res, bonusMode ? 0 : -bet, 'loss');
      }

      if (isNearMiss(res)) {
        setNearMiss(true);
      }

      // Bonus mode countdown
      if (bonusMode) {
        setBonusSpinsLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setBonusMode(false);
            showToast('Bonus mode ended!', 'info');
          }
          return next;
        });
      }
    }
  }, [bonusMode, bet, jackpot, username, setBalance, setJackpot, addHistory, addLeaderboardEntry, showToast]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  // Keyboard: spacebar to spin (proper useEffect, not render-time assignment)
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (canSpin) handleSpin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSpin, handleSpin]);

  return (
    <div className="slot-machine">
      <div className="jackpot-display">
        <span className="jackpot-icon"><Trophy size={18} /></span>
        <span className="jackpot-label">JACKPOT</span>
        <span className="jackpot-amount">{jackpot.toLocaleString()} pts</span>
      </div>

      <div className="reels-container">
        {[0, 1, 2].map(i => (
          <Reel
            key={i}
            reelIndex={i}
            spinning={spinning}
            targetSymbol={results[i]}
            delay={SPIN_DURATION_BASE + i * SPIN_STAGGER}
            onStop={handleReelStop}
            bonusMode={bonusMode}
          />
        ))}
      </div>

      <AnimatePresence>
        {lastWin && <WinDisplay win={lastWin} nearMiss={nearMiss} />}
      </AnimatePresence>

      {bonusMode && (
        <div className="bonus-indicator">
          <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          FREE SPINS: {bonusSpinsLeft} remaining ({BONUS_WIN_MULTIPLIER}x multiplier)
        </div>
      )}

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={spinning}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={bonusMode}
      />

      <AnimatePresence>
        {showBonusIntro && (
          <BonusOverlay onComplete={() => setShowBonusIntro(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
