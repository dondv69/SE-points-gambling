import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';
import { Lock, Sparkles } from 'lucide-react';

// Two options: Free Spins (multiplier wheel → 3 spins) or Vault Heist
// 50/50 chance, but visually a 4-slice wheel for drama
const SLICES = [
  { id: 'freespins', label: 'FREE SPINS', color: '#7C3AED', icon: '🎰' },
  { id: 'vault',     label: 'VAULT HEIST', color: '#FBBF24', icon: '🔓' },
  { id: 'freespins', label: 'FREE SPINS', color: '#6525CC', icon: '🎰' },
  { id: 'vault',     label: 'VAULT HEIST', color: '#D97706', icon: '🔓' },
];

const SLICE_ANGLE = 360 / SLICES.length; // 90 degrees each

export default function BonusPicker({ onResult }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const handleSpin = useCallback(async () => {
    if (spinning || result) return;
    await audio.ensure();

    // 50/50 pick
    const chosen = Math.random() < 0.5 ? 'freespins' : 'vault';
    setSpinning(true);

    // Find a matching slice index
    const sliceIdx = SLICES.findIndex(s => s.id === chosen);
    const fullSpins = 4 + Math.floor(Math.random() * 3);
    const sliceCenter = sliceIdx * SLICE_ANGLE + SLICE_ANGLE / 2;
    const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.5);
    const targetAngle = fullSpins * 360 + (360 - sliceCenter) + jitter;

    // Animate via CSS transition (set rotation state)
    const wheel = document.getElementById('bonus-picker-wheel');
    if (wheel) {
      wheel.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.3, 1)';
      wheel.style.transform = `rotate(${targetAngle}deg)`;
    }

    audio.bonus();

    setTimeout(() => {
      setSpinning(false);
      setResult(chosen);
      setTimeout(() => onResult(chosen), 1200);
    }, 3800);
  }, [spinning, result, onResult]);

  return (
    <div className="bp-overlay">
      <div className="bp-content">
        <h2 className="bp-title">BONUS!</h2>
        <p className="bp-subtitle">
          {result ? (result === 'vault' ? 'VAULT HEIST!' : 'FREE SPINS!') :
           spinning ? 'Choosing your bonus...' : 'Spin to choose your bonus game!'}
        </p>

        <div className="bp-wheel-wrapper">
          <div className="bp-pointer">▼</div>
          <div className="bp-wheel" id="bonus-picker-wheel">
            {SLICES.map((slice, i) => {
              const startAngle = i * SLICE_ANGLE;
              const endAngle = startAngle + SLICE_ANGLE;
              const midAngle = (startAngle + endAngle) / 2 - 90;
              const midRad = midAngle * (Math.PI / 180);
              const textX = 50 + 30 * Math.cos(midRad);
              const textY = 50 + 30 * Math.sin(midRad);

              return (
                <div
                  key={i}
                  className="bp-slice"
                  style={{
                    background: slice.color,
                    clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180)}%)`,
                  }}
                >
                  <span
                    className="bp-slice-label"
                    style={{
                      position: 'absolute',
                      left: `${textX}%`,
                      top: `${textY}%`,
                      transform: `translate(-50%, -50%) rotate(${midAngle + 90}deg)`,
                    }}
                  >
                    {slice.icon}
                  </span>
                </div>
              );
            })}
            <div className="bp-center" />
          </div>
        </div>

        {!spinning && !result && (
          <button className="wheel-spin-btn" onClick={handleSpin}>
            SPIN
          </button>
        )}

        {result && (
          <motion.div
            className="bp-result"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {result === 'vault' ? (
              <><Lock size={24} /> VAULT HEIST</>
            ) : (
              <><Sparkles size={24} /> FREE SPINS</>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
