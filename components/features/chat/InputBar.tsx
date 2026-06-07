'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

type InputBarProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  maxLength?: number;
};

export function InputBar({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  isStreaming,
  maxLength = 2000,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 200;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2.5 px-4 py-3 pb-safe"
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about Spur..."
          maxLength={maxLength}
          rows={1}
          disabled={isLoading}
          className={cn(
            'w-full resize-none rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-base text-white placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-sky-500/60 focus:border-sky-500/30 focus:bg-white/6',
            'disabled:opacity-50 transition-all leading-relaxed overflow-y-auto',
            isNearLimit ? 'pb-7' : ''
          )}
          style={{ minHeight: '48px', maxHeight: '180px' }}
        />
        {isNearLimit && (
          <span
            className={cn(
              'absolute bottom-2 right-3.5 text-xs pointer-events-none tabular-nums',
              remaining < 50 ? 'text-red-400' : 'text-neutral-500'
            )}
          >
            {remaining}
          </span>
        )}
      </div>

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="flex-shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center transition-all bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 active:scale-95"
          title="Stop generating"
          aria-label="Stop generating"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2.5" />
          </svg>
        </button>
      ) : (
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className={cn(
            'flex-shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center transition-all',
            'bg-sky-600 text-white hover:bg-sky-500 active:scale-95',
            'disabled:opacity-35 disabled:pointer-events-none'
          )}
          title="Send message"
          aria-label="Send message"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      )}
    </form>
  );
}
