'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ConversationItem } from './ConversationItem';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
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
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          style={{ width: SIDEBAR_WIDTH }}
          className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/5 bg-neutral-900 lg:relative lg:z-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Conversations</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 py-3">
            <Button variant="outline" size="sm" className="w-full" onClick={onNewChat}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </Button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            {conversations.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-600 text-center">No conversations yet</p>
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
