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
import { usePushNotifications, isIOSDevice, isInstalledPWA } from '@/hooks/usePushNotifications';
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
    // Open by default on desktop (lg: 1024px+), closed on mobile
    sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    deleteTargetId: null,
    lastUserMessage: '',
    showFollowUps: false,
  });

  const { conversations, mutate: mutateConversations } = useConversations();
  const { questions: followUpQuestions, fetchFollowUps, clearFollowUps, loadStoredFollowUps } = useFollowUp();
  const { permission, requestPermission, notify } = usePushNotifications();

  // iOS requires PWA install for Web Push. Show guidance when needed.
  // Initialize via lazy useState to read localStorage once on mount (avoids set-state-in-effect rule).
  const [showIOSBanner, setShowIOSBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    const dismissed = localStorage.getItem('ios-notif-banner-dismissed');
    return !dismissed && isIOSDevice() && !isInstalledPWA();
  });
  const dismissIOSBanner = useCallback(() => {
    localStorage.setItem('ios-notif-banner-dismissed', '1');
    setShowIOSBanner(false);
  }, []);

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
      // Push notification when user is in another tab
      const preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');
      notify('Spur Support replied', preview, `/${sessionId}`);
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
      // Request permission on first send (default), or silently re-register subscription
      // for returning users whose permission is already granted but have a new session ID
      if (permission === 'default' || permission === 'granted') requestPermission(sessionId).catch(() => {});
      dispatch({ type: 'SET_LAST_USER_MSG', msg: input });
      dispatch({ type: 'HIDE_FOLLOW_UPS' });
      clearFollowUps();
      sendMessage({ text: input });
      setInput('');
    },
    [input, isLoading, sendMessage, clearFollowUps, permission, requestPermission, sessionId]
  );

  const handleFollowUpSelect = useCallback(
    (question: string) => {
      if (permission === 'default' || permission === 'granted') requestPermission(sessionId).catch(() => {});
      dispatch({ type: 'HIDE_FOLLOW_UPS' });
      dispatch({ type: 'SET_LAST_USER_MSG', msg: question });
      clearFollowUps();
      sendMessage({ text: question });
    },
    [sendMessage, clearFollowUps, permission, requestPermission, sessionId]
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
    <div className="flex h-svh bg-[#080c14] text-white overflow-hidden">
      <SessionSidebar
        isOpen={state.sidebarOpen}
        conversations={conversations}
        activeId={sessionId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteRequest={(id) => dispatch({ type: 'SET_DELETE_TARGET', id })}
        onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
      />

      {/* Backdrop - mobile only */}
      <AnimatePresence>
        {state.sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: 'rgba(4, 6, 12, 0.75)', backdropFilter: 'blur(2px)' }}
            onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-white/5 px-4 pt-safe" style={{ paddingBottom: '12px', paddingTop: 'max(12px, var(--safe-top))' }}>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/6 transition-colors active:scale-95"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white tracking-tight">Spur Support</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 px-2">
              <div className={cn(
                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
              )} />
              <span className="text-xs text-neutral-500 hidden sm:block">
                {isLoading ? 'Replying' : 'Online'}
              </span>
            </div>

            {/* Notification bell - always visible, state reflects platform support */}
            <button
              onClick={async () => {
                if (permission === 'unsupported') {
                  // Re-show the iOS install banner if dismissed
                  if (isIOSDevice()) setShowIOSBanner(true);
                  return;
                }
                if (permission === 'default') await requestPermission(sessionId);
              }}
              disabled={permission === 'denied'}
              aria-label={
                permission === 'granted'
                  ? 'Notifications enabled'
                  : permission === 'denied'
                  ? 'Notifications blocked'
                  : 'Enable notifications'
              }
              title={
                permission === 'granted'
                  ? 'Notifications on'
                  : permission === 'denied'
                  ? 'Blocked - enable in browser settings'
                  : permission === 'unsupported'
                  ? 'Tap for iOS notification setup'
                  : 'Enable reply notifications'
              }
              className={cn(
                'h-10 w-10 flex items-center justify-center rounded-xl transition-colors',
                permission === 'granted'
                  ? 'text-sky-400 hover:bg-sky-500/10'
                  : permission === 'denied'
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-400 hover:text-white hover:bg-white/6'
              )}
            >
              {permission === 'granted' ? (
                <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Z" />
                </svg>
              ) : (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              )}
            </button>

            {/* New chat */}
            <button
              onClick={handleNewChat}
              title="New chat"
              className="h-10 w-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/6 transition-colors active:scale-95"
              aria-label="New chat"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </header>

        {/* iOS PWA install banner */}
        <AnimatePresence>
          {showIOSBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 px-4 py-2.5 bg-sky-600/10 border-b border-sky-500/15 text-sm text-sky-300"
            >
              <svg className="h-4 w-4 flex-shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="flex-1 leading-snug">
                To get reply notifications on iPhone: tap{' '}
                <svg className="inline h-3.5 w-3.5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                {' '}Share then <strong>Add to Home Screen</strong>
              </span>
              <button
                onClick={dismissIOSBanner}
                className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-lg text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                aria-label="Dismiss"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
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
                    <div className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <p className="text-base text-red-400 leading-snug">
                        {error.message?.includes('quota') || error.message?.includes('rate')
                          ? 'Rate limit reached. Please wait a moment before trying again.'
                          : 'Something went wrong. Please try again.'}
                      </p>
                      <button
                        onClick={() => { clearError(); }}
                        className="self-start text-sm text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
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

        {/* Follow-up chips */}
        <div className="max-w-2xl mx-auto w-full">
          <FollowUpChips
            questions={followUpQuestions}
            onSelect={handleFollowUpSelect}
            isVisible={state.showFollowUps && !isLoading}
          />
        </div>

        {/* Input */}
        <div className="border-t border-white/5">
          <div className="max-w-2xl mx-auto w-full">
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
        <p className="mb-5 text-base text-neutral-400 leading-relaxed">
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-full text-center py-12"
    >
      {/* Logo mark */}
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-sky-900/40">
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-[#080c14] flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
        </div>
      </div>

      <h1 className="text-xl font-semibold text-white mb-2 tracking-tight">
        Spur Support
      </h1>
      <p className="text-base text-neutral-400 mb-8 max-w-xs leading-relaxed">
        Ask me anything about Spur&apos;s features, integrations, or getting started.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {suggestions.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onSuggestionClick(s)}
            className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-4 py-3 text-left text-sm text-neutral-300 hover:bg-white/6 hover:border-white/10 hover:text-white transition-all active:scale-[0.98]"
            style={{ minHeight: '52px', touchAction: 'manipulation' }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-sky-500/60 flex-shrink-0" />
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
