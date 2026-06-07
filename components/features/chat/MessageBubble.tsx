'use client';

import { motion } from 'framer-motion';
import { MarkdownMessage } from './MarkdownMessage';
import { cn } from '@/lib/utils';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

const bubbleVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
};

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="mr-3 mt-1 flex-shrink-0">
          <div className="h-7 w-7 rounded-full bg-sky-600/20 border border-sky-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-sky-400">S</span>
          </div>
        </div>
      )}

      <div className={cn('max-w-[75%]', isUser ? 'max-w-[65%]' : 'max-w-[80%]')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-sky-600 px-4 py-2.5 text-sm text-white">
            {content}
          </div>
        ) : (
          <div className="text-neutral-300">
            <MarkdownMessage content={content} />
            {isStreaming && (
              <motion.span
                className="inline-block w-[3px] rounded-full bg-sky-400 ml-1 align-middle"
                animate={{
                  height: ['14px', '8px', '14px'],
                  opacity: [1, 0.5, 1],
                  backgroundColor: ['#38bdf8', '#7dd3fc', '#38bdf8'],
                }}
                transition={{ duration: 0.7, repeat: Infinity }}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
