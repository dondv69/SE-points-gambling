import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { VISIBLE_ROWS, SYMBOLS_PER_STRIP } from '../utils/constants';
import { generateReelStrip } from '../utils/slotLogic';

const SYMBOL_HEIGHT = 72;
// The target symbol index in the strip — always place it here
const TARGET_IDX = 20;

export default function Reel({ spinning, targetSymbol, delay, onStop, reelIndex, bonusMode }) {
  const [strip, setStrip] = useState(() => generateReelStrip());
  const stripRef = useRef(null);
  const spinFrameRef = useRef(null);
  const animRef = useRef(null);
  const hasStoppedRef = useRef(true);
  const yRef = useRef(0);

  // The reel container height (set in CSS) determines how many rows are visible.
  // We need the target symbol centered in that container.
  // Container height = VISIBLE_ROWS * SYMBOL_HEIGHT (approx, but we use the actual
  // container via CSS). The "center" of the viewport is at containerHeight/2.
  // We want TARGET_IDX symbol's center at the viewport center.
  //
  // Strip top = translateY value.
  // Symbol i center = i * SYMBOL_HEIGHT + SYMBOL_HEIGHT/2
  // We want: translateY + TARGET_IDX * SYMBOL_HEIGHT + SYMBOL_HEIGHT/2 = containerHeight/2
  // So: translateY = containerHeight/2 - TARGET_IDX * SYMBOL_HEIGHT - SYMBOL_HEIGHT/2

  useEffect(() => {
    if (!spinning || !targetSymbol) return;

    hasStoppedRef.current = false;

    // Build new strip with target at fixed position
    const newStrip = generateReelStrip(SYMBOLS_PER_STRIP);
    newStrip[TARGET_IDX] = { ...targetSymbol };
    setStrip(newStrip);

    // Spin animation
    const speed = -5000; // px per second
    let startTime = null;
    const startY = yRef.current;

    const spinLoop = (ts) => {
      if (!startTime) startTime = ts;
      const elapsed = (ts - startTime) / 1000;
      const totalHeight = SYMBOLS_PER_STRIP * SYMBOL_HEIGHT;
      // Continuous downward scroll, wrapping
      const rawY = startY + elapsed * speed;
      const newY = ((rawY % totalHeight) + totalHeight) % totalHeight - totalHeight;
      yRef.current = newY;
      if (stripRef.current) {
        stripRef.current.style.transform = `translateY(${newY}px)`;
      }
      spinFrameRef.current = requestAnimationFrame(spinLoop);
    };

    spinFrameRef.current = requestAnimationFrame(spinLoop);

    // Stop after staggered delay
    const stopTimer = setTimeout(() => {
      cancelAnimationFrame(spinFrameRef.current);

      // Get actual container height from DOM
      const container = stripRef.current?.parentElement;
      const containerHeight = container ? container.clientHeight : VISIBLE_ROWS * SYMBOL_HEIGHT;

      // Calculate target Y: place TARGET_IDX symbol centered in container
      const targetY = containerHeight / 2 - TARGET_IDX * SYMBOL_HEIGHT - SYMBOL_HEIGHT / 2;

      animRef.current = animate(yRef.current, targetY, {
        type: 'spring',
        stiffness: 250,
        damping: 28,
        mass: 0.8,
        onUpdate: (v) => {
          yRef.current = v;
          if (stripRef.current) {
            stripRef.current.style.transform = `translateY(${v}px)`;
          }
        },
        onComplete: () => {
          if (!hasStoppedRef.current) {
            hasStoppedRef.current = true;
            onStop?.(reelIndex);
          }
        },
      });
    }, delay);

    return () => {
      cancelAnimationFrame(spinFrameRef.current);
      clearTimeout(stopTimer);
      if (animRef.current?.stop) animRef.current.stop();
    };
  }, [spinning, targetSymbol, delay, onStop, reelIndex]);

  // When not spinning, ensure the strip is positioned correctly
  useEffect(() => {
    if (!spinning && stripRef.current) {
      const container = stripRef.current.parentElement;
      const containerHeight = container ? container.clientHeight : VISIBLE_ROWS * SYMBOL_HEIGHT;
      const restY = containerHeight / 2 - TARGET_IDX * SYMBOL_HEIGHT - SYMBOL_HEIGHT / 2;
      yRef.current = restY;
      stripRef.current.style.transform = `translateY(${restY}px)`;
    }
  }, [spinning, strip]);

  const glowClass = bonusMode ? 'reel-glow-bonus' : spinning ? 'reel-glow-spin' : '';

  return (
    <div className={`reel-container ${glowClass}`}>
      <div className="reel-mask">
        <div className="reel-strip" ref={stripRef}>
          {strip.map((sym, i) => (
            <div
              key={i}
              className={`reel-symbol ${bonusMode ? 'bonus-symbol' : ''}`}
              style={{ height: SYMBOL_HEIGHT }}
            >
              <span className="symbol-emoji">{sym.emoji}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="reel-active-line" />
      <div className="reel-fade-top" />
      <div className="reel-fade-bottom" />
    </div>
  );
}
