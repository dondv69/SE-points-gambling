import { Disc3 } from 'lucide-react';
import { getTwitchLoginUrl } from '../utils/twitch';

export default function UserLogin() {
  return (
    <div className="login-overlay">
      <div className="login-panel">
        <h2 className="login-title">
          <Disc3 size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          StreamSlots
        </h2>
        <p className="login-desc">
          Log in with your Twitch account to gamble SE points.
        </p>

        <a href={getTwitchLoginUrl()} className="setup-btn twitch-login-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 8 }}>
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
          </svg>
          Login with Twitch
        </a>
      </div>
    </div>
  );
}
