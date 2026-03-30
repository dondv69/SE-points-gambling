import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';

const SLICES = [
  { multiplier: 100, color: '#F43F5E', label: '100x' },
  { multiplier: 10,  color: '#7C3AED', label: '10x' },
  { multiplier: 5,   color: '#06B6D4', label: '5x' },
  { multiplier: 3,   color: '#FBBF24', label: '3x' },
  { multiplier: 2,   color: '#34D399', label: '2x' },
];

// Hidden probabilities (not equal!) — tuned for 99% bonus RTP
const WEIGHTS = [
  { multiplier: 100, weight: 0.003 },
  { multiplier: 10,  weight: 0.015 },
  { multiplier: 5,   weight: 0.060 },
  { multiplier: 3,   weight: 0.739 },
  { multiplier: 2,   weight: 0.183 },
];

function pickMultiplier() {
  const r = Math.random();
  let cumulative = 0;
  for (const w of WEIGHTS) {
    cumulative += w.weight;
    if (r <= cumulative) return w.multiplier;
  }
  return 2; // fallback
}

const SLICE_ANGLE = 360 / SLICES.length; // 72 degrees each

export default function BonusWheel({ onResult }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const hasSpun = useRef(false);

  // Auto-spin on mount
  useEffect(() => {
    if (hasSpun.current) return;
    hasSpun.current = true;

    const timer = setTimeout(async () => {
      await audio.ensure();
      const chosen = pickMultiplier();
      setSpinning(true);

      // Find the slice index
      const sliceIdx = SLICES.findIndex(s => s.multiplier === chosen);
      // Calculate target angle: we want this slice under the pointer (top)
      // Slice center = sliceIdx * 72 + 36 degrees
      // We need to rotate so this center is at 0 (top)
      // Plus several full rotations for drama
      const fullSpins = 5 + Math.floor(Math.random() * 3);
      const sliceCenter = sliceIdx * SLICE_ANGLE + SLICE_ANGLE / 2;
      // Add randomness within the slice
      const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.6);
      const targetAngle = fullSpins * 360 + (360 - sliceCenter) + jitter;

      setRotation(targetAngle);

      // Wait for animation to finish
      setTimeout(() => {
        setSpinning(false);
        setResult(chosen);
        audio.bonus();
        // Notify parent after a short pause for drama
        setTimeout(() => onResult(chosen), 1500);
      }, 4000);
    }, 500);

    return () => clearTimeout(timer);
  }, [onResult]);

  return (
    <div className="bonus-wheel-overlay">
      <div className="bonus-wheel-content">
        <h2 className="bonus-wheel-title">BONUS ROUND</h2>
        <p className="bonus-wheel-subtitle">Spinning for your multiplier...</p>

        <div className="wheel-wrapper">
          {/* Pointer */}
          <div className="wheel-pointer">▼</div>

          {/* Wheel */}
          <motion.div
            className="wheel"
            animate={{ rotate: rotation }}
            transition={{
              duration: 4,
              ease: [0.15, 0.85, 0.35, 1],
            }}
          >
            <svg viewBox="0 0 200 200" className="wheel-svg">
              {SLICES.map((slice, i) => {
                const startAngle = i * SLICE_ANGLE;
                const endAngle = startAngle + SLICE_ANGLE;
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                const x1 = 100 + 95 * Math.cos(startRad);
                const y1 = 100 + 95 * Math.sin(startRad);
                const x2 = 100 + 95 * Math.cos(endRad);
                const y2 = 100 + 95 * Math.sin(endRad);
                const largeArc = SLICE_ANGLE > 180 ? 1 : 0;
                const midRad = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                const textX = 100 + 60 * Math.cos(midRad);
                const textY = 100 + 60 * Math.sin(midRad);
                const textRotation = (startAngle + endAngle) / 2;

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A95,95 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={slice.color}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="1"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                      fill="#fff"
                      fontFamily="'Russo One', sans-serif"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {slice.label}
                    </text>
                  </g>
                );
              })}
              {/* Center circle */}
              <circle cx="100" cy="100" r="18" fill="var(--void, #0B0B1A)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </svg>
          </motion.div>
        </div>

        {/* Result display */}
        {result && (
          <motion.div
            className="wheel-result"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="wheel-result-mult">{result}x</span>
            <span className="wheel-result-label">3 Free Spins!</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
