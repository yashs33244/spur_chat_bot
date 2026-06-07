'use client';

import { motion, AnimatePresence } from 'framer-motion';

type FollowUpChipsProps = {
  questions: string[];
  onSelect: (question: string) => void;
  isVisible: boolean;
};

export function FollowUpChips({ questions, onSelect, isVisible }: FollowUpChipsProps) {
  if (!isVisible || questions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <div
          className="flex gap-2 px-4 pb-2 overflow-x-auto scroll-fade-right"
          style={{ scrollbarWidth: 'none' }}
        >
          {questions.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelect(q)}
              className="flex-shrink-0 rounded-full border border-sky-500/25 bg-sky-500/8 px-4 py-2.5 text-sm text-sky-300 hover:bg-sky-500/15 hover:border-sky-400/40 active:scale-95 transition-all leading-snug"
              style={{ minHeight: '44px', touchAction: 'manipulation' }}
            >
              {q}
            </motion.button>
          ))}
          {/* Right spacer so last chip is fully visible before fade */}
          <div className="flex-shrink-0 w-8" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
