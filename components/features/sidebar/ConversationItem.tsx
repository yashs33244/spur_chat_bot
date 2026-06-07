'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn, truncate } from '@/lib/utils';
import type { Conversation } from '@/types/conversation';

type ConversationItemProps = {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDeleteRequest: () => void;
  onRename: (name: string) => void;
};

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDeleteRequest,
  onRename,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(conversation.name ?? 'New conversation');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  // Keep edit value in sync when conversation name updates from server
  useEffect(() => {
    if (!isEditing && !isSaving) {
      setEditValue(conversation.name ?? 'New conversation');
      setOptimisticName(null);
    }
  }, [conversation.name, isEditing, isSaving]);

  const commitRename = async () => {
    const trimmed = editValue.trim();
    setIsEditing(false);

    if (!trimmed || trimmed === (conversation.name ?? 'New conversation')) {
      setEditValue(conversation.name ?? 'New conversation');
      return;
    }

    // Optimistic update - show new name immediately
    setOptimisticName(trimmed);
    setIsSaving(true);

    try {
      await onRename(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = optimisticName ?? conversation.name ?? 'New conversation';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
        isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
      )}
      onClick={() => !isEditing && !isSaving && onSelect()}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setEditValue(displayName);
              setIsEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          maxLength={60}
          className="flex-1 bg-transparent text-sm text-white outline-none border-b border-sky-500 pb-0.5"
        />
      ) : (
        <span className={cn('flex-1 truncate text-sm', isSaving && 'text-neutral-500')}>
          {truncate(displayName, 28)}
        </span>
      )}

      {isSaving && !isEditing && (
        <span className="flex-shrink-0 h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-sky-400" />
      )}

      {!isEditing && !isSaving && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            title="Rename"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="p-1 rounded text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </motion.div>
  );
}
