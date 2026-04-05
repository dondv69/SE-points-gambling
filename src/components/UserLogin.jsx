import { AlertTriangle, Disc3 } from 'lucide-react';
import { getTwitchLoginUrl } from '../utils/twitch';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function UserLogin() {
  const [acknowledged, setAcknowledged] = useLocalStorage('se_slots_disclaimer_ack', false);

  return (
    <div className="login-overlay">
      <div className="login-panel">
        <h2 className="login-title">
          <Disc3 size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          StreamSlots
        </h2>
        <p className="login-desc">
          Log in with Twitch to use your stream reward points in this mini-game.
        </p>

        <div className="login-disclaimer" role="note" aria-label="Free points disclaimer">
          <div className="login-disclaimer-title">
            <AlertTriangle size={16} />
            Free points only
          </div>
          <p>
            This app uses fictional StreamElements and Twitch stream points for entertainment only.
            These points have no cash value and cannot be withdrawn, cashed out, or exchanged for money.
          </p>
        </div>

        <label className="login-ack">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I understand this is a stream-only points system, not real-money gambling.
          </span>
        </label>

        <button
          type="button"
          className="setup-btn twitch-login-btn"
          onClick={() => {
            window.location.href = getTwitchLoginUrl();
          }}
          disabled={!acknowledged}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
          </svg>
          Login with Twitch
        </button>
      </div>
    </div>
  );
}
