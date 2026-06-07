'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const STATUS_MESSAGES = [
  'Thinking...',
  'Searching Spur knowledge...',
  'Crafting response...',
  'Almost there...',
];

export function TypingIndicator() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3"
    >
      {/* Pulsing avatar with glow ring */}
      <div className="relative mt-1 flex-shrink-0">
        <motion.div
          animate={{ boxShadow: ['0 0 0 0 rgba(56,189,248,0)', '0 0 0 6px rgba(56,189,248,0.15)', '0 0 0 0 rgba(56,189,248,0)'] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="h-7 w-7 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center"
        >
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="text-xs font-bold text-sky-400"
          >
            S
          </motion.span>
        </motion.div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        {/* Bouncing dots */}
        <div className="flex items-end gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block rounded-full bg-sky-500/60"
              animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.18,
              }}
              style={{ width: 7, height: 7 }}
            />
          ))}
        </div>

        {/* Cycling status text */}
        <div className="h-4 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-xs text-neutral-500 leading-4"
            >
              {STATUS_MESSAGES[statusIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
