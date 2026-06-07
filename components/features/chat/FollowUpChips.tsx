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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-wrap gap-2 px-4 pb-2"
      >
        {questions.map((q, i) => (
          <motion.button
            key={q}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onSelect(q)}
            className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 transition-all"
          >
            {q}
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
