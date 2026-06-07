'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ConversationItem } from './ConversationItem';
import { SIDEBAR_WIDTH } from '@/constants';
import type { Conversation } from '@/types/conversation';

type SessionSidebarProps = {
  isOpen: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteRequest: (id: string) => void;
  onClose: () => void;
};

export function SessionSidebar({
  isOpen,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDeleteRequest,
  onClose,
}: SessionSidebarProps) {
  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/conversations/${id}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: -SIDEBAR_WIDTH }}
          animate={{ x: 0 }}
          exit={{ x: -SIDEBAR_WIDTH }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{ width: SIDEBAR_WIDTH }}
          className="fixed inset-y-0 left-0 z-30 flex flex-col bg-[#0d1420] border-r border-white/5 lg:relative lg:z-auto pt-safe"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white tracking-tight">Spur Support</span>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 py-3">
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/7 hover:text-white hover:border-white/12 transition-all active:scale-[0.98]"
              style={{ minHeight: '44px' }}
            >
              <div className="h-5 w-5 rounded-md bg-sky-600/30 flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              New conversation
            </button>
          </div>

          {/* Section label */}
          {conversations.length > 0 && (
            <div className="px-4 pb-1">
              <p className="text-xs font-medium text-neutral-600 uppercase tracking-widest">Recent</p>
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="h-10 w-10 rounded-xl bg-white/4 flex items-center justify-center">
                  <svg className="h-5 w-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                </div>
                <p className="text-xs text-neutral-600 text-center">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeId === conv.id}
                  onSelect={() => onSelect(conv.id)}
                  onDeleteRequest={() => onDeleteRequest(conv.id)}
                  onRename={(name) => handleRename(conv.id, name)}
                />
              ))
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
