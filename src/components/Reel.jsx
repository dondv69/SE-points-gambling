import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { VISIBLE_ROWS, SYMBOLS_PER_STRIP } from '../utils/constants';
import { generateReelStrip } from '../utils/slotLogic';

const SYMBOL_HEIGHT = 72;

export default function Reel({ spinning, targetSymbol, delay, onStop, reelIndex, bonusMode }) {
  const [strip, setStrip] = useState(() => generateReelStrip());
  const yRef = useRef(0);
  const containerRef = useRef(null);
  const stripRef = useRef(null);
  const animRef = useRef(null);
  const spinFrameRef = useRef(null);
  const hasStoppedRef = useRef(true);

  useEffect(() => {
    if (!spinning) return;

    hasStoppedRef.current = false;
    const newStrip = generateReelStrip();

    // Place target symbol in the middle of the strip
    if (targetSymbol) {
      const middleIdx = Math.floor(newStrip.length / 2);
      newStrip[middleIdx] = { ...targetSymbol };
    }
    setStrip(newStrip);

    // Animate: fast constant spin, then spring-stop after delay
    let startY = yRef.current;
    const speed = -4000; // px per second
    let startTime = null;

    const spinLoop = (ts) => {
      if (!startTime) startTime = ts;
      const elapsed = (ts - startTime) / 1000;
      const totalHeight = SYMBOLS_PER_STRIP * SYMBOL_HEIGHT;
      const newY = (startY + elapsed * speed) % totalHeight;
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

      // Target: land with target symbol in middle visible row
      const middleRow = Math.floor(VISIBLE_ROWS / 2);
      const targetIdx = Math.floor(strip.length / 2);
      const targetY = -(targetIdx - middleRow) * SYMBOL_HEIGHT;

      // Spring settle
      const currentY = { value: yRef.current };
      animRef.current = animate(currentY.value, targetY, {
        type: 'spring',
        stiffness: 300,
        damping: 30,
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

  const glowClass = bonusMode ? 'reel-glow-bonus' : spinning ? 'reel-glow-spin' : '';

  return (
    <div className={`reel-container ${glowClass}`} ref={containerRef}>
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
      {/* Top/bottom fade masks */}
      <div className="reel-fade-top" />
      <div className="reel-fade-bottom" />
    </div>
  );
}
