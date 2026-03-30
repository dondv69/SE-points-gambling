import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';
import { Lock, Sparkles, Star, Ticket } from 'lucide-react';

// 4 bonus games, equal 25% chance each
// Overall bonus RTP: ~95%
const SLICES = [
  { id: 'golden',    label: 'GOLDEN RAIN',  color: '#FBBF24' },
  { id: 'freespins', label: 'FREE SPINS',   color: '#7C3AED' },
  { id: 'scratch',   label: 'SCRATCH CARD', color: '#94A3B8' },
  { id: 'vault',     label: 'VAULT HEIST',  color: '#F43F5E' },
];

const SLICE_ANGLE = 360 / SLICES.length;

const ICONS = {
  golden: '✨',
  freespins: '🎰',
  scratch: '🎟️',
  vault: '🔓',
};

const LABELS = {
  golden: 'GOLDEN RAIN',
  freespins: 'FREE SPINS',
  scratch: 'SCRATCH CARD',
  vault: 'VAULT HEIST',
};

export default function BonusPicker({ onResult }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  const handleSpin = useCallback(async () => {
    if (spinning || result) return;
    await audio.ensure();

    // Equal 25% chance
    const idx = Math.floor(Math.random() * SLICES.length);
    const chosen = SLICES[idx].id;
    setSpinning(true);

    const fullSpins = 4 + Math.floor(Math.random() * 3);
    const sliceCenter = idx * SLICE_ANGLE + SLICE_ANGLE / 2;
    const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.4);
    const targetAngle = fullSpins * 360 + (360 - sliceCenter) + jitter;

    setRotation(targetAngle);
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
          {result ? LABELS[result] + '!' :
           spinning ? 'Choosing your bonus...' : 'Spin to choose your bonus game!'}
        </p>

        <div className="bp-wheel-wrapper">
          <div className="bp-pointer">▼</div>

          <motion.div
            className="bp-wheel"
            animate={{ rotate: rotation }}
            transition={{ duration: 3.5, ease: [0.15, 0.85, 0.3, 1] }}
          >
            <svg viewBox="0 0 200 200" className="bp-wheel-svg">
              {SLICES.map((slice, i) => {
                const startAngle = i * SLICE_ANGLE;
                const endAngle = startAngle + SLICE_ANGLE;
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                const x1 = 100 + 98 * Math.cos(startRad);
                const y1 = 100 + 98 * Math.sin(startRad);
                const x2 = 100 + 98 * Math.cos(endRad);
                const y2 = 100 + 98 * Math.sin(endRad);
                const largeArc = SLICE_ANGLE > 180 ? 1 : 0;
                const midRad = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                const textX = 100 + 55 * Math.cos(midRad);
                const textY = 100 + 55 * Math.sin(midRad);
                const textRotation = (startAngle + endAngle) / 2;
                const iconX = 100 + 75 * Math.cos(midRad);
                const iconY = 100 + 75 * Math.sin(midRad);

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A98,98 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={slice.color}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="1.5"
                    />
                    <text
                      x={textX} y={textY}
                      textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                      fill="#fff" fontFamily="'Russo One', sans-serif" fontSize="7" fontWeight="bold"
                    >
                      {slice.label}
                    </text>
                    <text
                      x={iconX} y={iconY}
                      textAnchor="middle" dominantBaseline="central" fontSize="18"
                    >
                      {ICONS[slice.id]}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="18" fill="#0B0B1A" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="'Russo One', sans-serif" fontSize="8">
                BONUS
              </text>
            </svg>
          </motion.div>
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
            style={{ color: SLICES.find(s => s.id === result)?.color }}
          >
            {ICONS[result]} {LABELS[result]}
          </motion.div>
        )}
      </div>
    </div>
  );
}
