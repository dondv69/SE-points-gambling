import { Disc3, Zap } from 'lucide-react';
import { BET_PRESETS, MAX_BET_PERCENT, MAX_BET_CAP, BONUS_BUY_MULTIPLIER } from '../utils/constants';

export default function BetControls({ bet, setBet, balance, spinning, onSpin, onBonusBuy, bonusMode }) {
  const maxBet = Math.max(
    BET_PRESETS[0],
    Math.min(Math.floor(balance * MAX_BET_PERCENT), MAX_BET_CAP)
  );

  return (
    <div className="bet-controls">
      {!bonusMode && (
        <div className="bet-row">
          <span className="bet-label">Bet:</span>
          <div className="bet-buttons">
            {BET_PRESETS.map(amount => (
              <button
                key={amount}
                className={`bet-btn ${bet === amount ? 'active' : ''}`}
                onClick={() => setBet(amount)}
                disabled={spinning || amount > balance}
              >
                {amount.toLocaleString()}
              </button>
            ))}
            <button
              className={`bet-btn ${bet === maxBet ? 'active' : ''}`}
              onClick={() => setBet(maxBet)}
              disabled={spinning || balance <= 0}
            >
              MAX
            </button>
          </div>
          <div className="balance-display">
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      )}

      {bonusMode && (
        <div className="bet-row">
          <div className="balance-display" style={{ marginLeft: 0 }}>
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      )}

      <div className="spin-row">
        <button
          className={`spin-btn ${bonusMode ? 'spin-btn-bonus' : ''}`}
          onClick={onSpin}
          disabled={spinning || (!bonusMode && balance < bet)}
        >
          {spinning ? <span className="spinner" /> : bonusMode ? (
            <><Disc3 size={22} /> FREE SPIN</>
          ) : (
            <><Disc3 size={22} /> SPIN</>
          )}
        </button>

        {!bonusMode && (
          <button
            className="bonus-buy-btn"
            onClick={onBonusBuy}
            disabled={spinning || balance < bet * BONUS_BUY_MULTIPLIER}
            title={`Costs ${(bet * BONUS_BUY_MULTIPLIER).toLocaleString()} pts`}
          >
            <Zap size={16} /> Bonus {BONUS_BUY_MULTIPLIER}x
          </button>
        )}
      </div>
    </div>
  );
}
