'use client';

import { useReducer, useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import type { UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import { FollowUpChips } from './FollowUpChips';
import { InputBar } from './InputBar';
import { TypingIndicator } from './TypingIndicator';
import { SessionSidebar } from '@/components/features/sidebar/SessionSidebar';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useConversations } from '@/hooks/useConversations';
import { useFollowUp } from '@/hooks/useFollowUp';
import { cn } from '@/lib/utils';
import { ANIMATION_DURATION } from '@/constants';
import type { Message } from '@/types/conversation';
import { v4 as uuidv4 } from 'uuid';

type State = {
  sidebarOpen: boolean;
  deleteTargetId: string | null;
  lastUserMessage: string;
  showFollowUps: boolean;
};

type Action =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_DELETE_TARGET'; id: string }
  | { type: 'CLEAR_DELETE_TARGET' }
  | { type: 'SET_LAST_USER_MSG'; msg: string }
  | { type: 'SHOW_FOLLOW_UPS' }
  | { type: 'HIDE_FOLLOW_UPS' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'CLOSE_SIDEBAR': return { ...state, sidebarOpen: false };
    case 'SET_DELETE_TARGET': return { ...state, deleteTargetId: action.id };
    case 'CLEAR_DELETE_TARGET': return { ...state, deleteTargetId: null };
    case 'SET_LAST_USER_MSG': return { ...state, lastUserMessage: action.msg };
    case 'SHOW_FOLLOW_UPS': return { ...state, showFollowUps: true };
    case 'HIDE_FOLLOW_UPS': return { ...state, showFollowUps: false };
    default: return state;
  }
}

function dbMessagesToUIMessages(dbMessages: Message[]): UIMessage[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.sender === 'user' ? 'user' : 'assistant',
    parts: [{ type: 'text' as const, text: m.text }],
  }));
}

function extractText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join('');
}

type ChatInterfaceProps = {
  initialSessionId?: string;
  initialMessages?: Message[];
};

export function ChatInterface({ initialSessionId, initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState<string>(() => initialSessionId ?? uuidv4());
  const [input, setInput] = useState('');

  const [state, dispatch] = useReducer(reducer, {
    sidebarOpen: true,
    deleteTargetId: null,
    lastUserMessage: '',
    showFollowUps: false,
  });

  const { conversations, mutate: mutateConversations } = useConversations();
  const { questions: followUpQuestions, fetchFollowUps, clearFollowUps, loadStoredFollowUps } = useFollowUp();

  const uiInitialMessages = useMemo(
    () => dbMessagesToUIMessages(initialMessages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { sessionId } }),
    [sessionId]
  );

  const { messages, sendMessage, status, setMessages, error, clearError, stop } = useChat({
    messages: uiInitialMessages,
    transport,
    onFinish({ message }) {
      const text = extractText(message);
      dispatch({ type: 'SHOW_FOLLOW_UPS' });
      fetchFollowUps(state.lastUserMessage, text, sessionId);
      mutateConversations();
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!initialSessionId) {
      router.replace(`/${sessionId}`, { scroll: false });
      setTimeout(() => mutateConversations(), 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // On session restore, if the last AI message has stored follow-ups, show them immediately.
  useEffect(() => {
    if (initialMessages.length === 0) return;
    const lastMsg = initialMessages[initialMessages.length - 1];
    if (lastMsg.sender === 'ai' && lastMsg.followUps && lastMsg.followUps.length > 0) {
      loadStoredFollowUps(lastMsg.followUps);
      dispatch({ type: 'SHOW_FOLLOW_UPS' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      dispatch({ type: 'SET_LAST_USER_MSG', msg: input });
      dispatch({ type: 'HIDE_FOLLOW_UPS' });
      clearFollowUps();
      sendMessage({ text: input });
      setInput('');
    },
    [input, isLoading, sendMessage, clearFollowUps]
  );

  const handleFollowUpSelect = useCallback(
    (question: string) => {
      dispatch({ type: 'HIDE_FOLLOW_UPS' });
      dispatch({ type: 'SET_LAST_USER_MSG', msg: question });
      clearFollowUps();
      sendMessage({ text: question });
    },
    [sendMessage, clearFollowUps]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      dispatch({ type: 'CLEAR_DELETE_TARGET' });
      mutateConversations();
      if (id === sessionId) {
        setMessages([]);
        const newId = uuidv4();
        router.replace(`/${newId}`, { scroll: false });
      }
    },
    [sessionId, router, mutateConversations, setMessages]
  );

  const handleSelectConversation = useCallback(
    (id: string) => {
      dispatch({ type: 'CLOSE_SIDEBAR' });
      router.push(`/${id}`);
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    dispatch({ type: 'CLOSE_SIDEBAR' });
    clearFollowUps();
    router.push('/');
  }, [router, clearFollowUps]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
      <SessionSidebar
        isOpen={state.sidebarOpen}
        conversations={conversations}
        activeId={sessionId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteRequest={(id) => dispatch({ type: 'SET_DELETE_TARGET', id })}
        onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
      />

      <AnimatePresence>
        {state.sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="flex-shrink-0 p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-sky-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-sm font-medium text-white">Spur Support</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full flex-shrink-0', isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500')} />
            <button
              onClick={handleNewChat}
              title="New chat"
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {isEmpty ? (
              <WelcomeScreen onSuggestionClick={handleFollowUpSelect} />
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role as 'user' | 'assistant'}
                    content={extractText(msg)}
                    isStreaming={status === 'streaming' && i === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}
                {status === 'submitted' && <TypingIndicator key="typing" />}
                {status === 'error' && error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-1 h-7 w-7 flex-shrink-0 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-red-400">
                        {error.message?.includes('quota') || error.message?.includes('rate')
                          ? 'Rate limit reached. Please wait a moment before trying again.'
                          : 'Something went wrong. Please try again.'}
                      </p>
                      <button
                        onClick={() => { clearError(); }}
                        className="self-start text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="max-w-3xl mx-auto w-full">
          <FollowUpChips
            questions={followUpQuestions}
            onSelect={handleFollowUpSelect}
            isVisible={state.showFollowUps && !isLoading}
          />
        </div>

        <div className="border-t border-white/5">
          <div className="max-w-3xl mx-auto w-full">
            <InputBar
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onSubmit={handleSend}
              onStop={stop}
              isLoading={isLoading}
              isStreaming={status === 'streaming' || status === 'submitted'}
            />
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!state.deleteTargetId}
        onClose={() => dispatch({ type: 'CLEAR_DELETE_TARGET' })}
        title="Delete conversation"
      >
        <p className="mb-5 text-sm text-neutral-400">
          This conversation will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'CLEAR_DELETE_TARGET' })}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => state.deleteTargetId && handleDeleteConversation(state.deleteTargetId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function WelcomeScreen({ onSuggestionClick }: { onSuggestionClick: (q: string) => void }) {
  const suggestions = [
    'What channels does Spur support?',
    'How does WhatsApp Business API work?',
    'Does Spur integrate with Shopify?',
    'What is Instagram DM Automation?',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center min-h-full text-center py-16"
    >
      <div className="h-16 w-16 rounded-2xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center mb-4">
        <span className="text-3xl font-bold text-sky-400">S</span>
      </div>
      <h1 className="text-xl font-semibold text-white mb-2">Spur Support</h1>
      <p className="text-sm text-neutral-400 mb-8 max-w-sm">
        Ask me anything about Spur's features, integrations, pricing, or getting started.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
