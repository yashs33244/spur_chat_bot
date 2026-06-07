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
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

function SpurAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
        'bg-gradient-to-br from-sky-500 to-indigo-600',
        pulse && 'ring-2 ring-sky-500/20'
      )}
    >
      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    </div>
  );
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex w-full items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="mb-0.5">
          <SpurAvatar pulse={isStreaming} />
        </div>
      )}

      <div className={cn(isUser ? 'max-w-[72%] sm:max-w-[60%]' : 'max-w-[82%] sm:max-w-[75%]')}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-blue-600 px-4 py-3 text-base text-white leading-relaxed shadow-lg shadow-sky-900/20">
            {content}
          </div>
        ) : (
          <div className="text-[#c8d8e8] text-base leading-relaxed">
            <MarkdownMessage content={content} />
            {isStreaming && (
              <motion.span
                className="inline-block w-0.5 rounded-full bg-sky-400 ml-0.5 align-middle"
                animate={{
                  height: ['15px', '8px', '15px'],
                  opacity: [1, 0.4, 1],
                }}
                transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
