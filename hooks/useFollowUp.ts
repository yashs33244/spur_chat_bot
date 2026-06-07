'use client';

import { useState, useCallback } from 'react';

export function useFollowUp() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const fetchFollowUps = useCallback(
    async (userMessage: string, aiResponse: string, sessionId?: string) => {
      setQuestions([]);
      setIsFetching(true);
      try {
        const res = await fetch('/api/chat/followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage, lastAiMessage: aiResponse, sessionId }),
        });
        const data = await res.json();
        setQuestions(data.questions ?? []);
      } catch {
        setQuestions([]);
      } finally {
        setIsFetching(false);
      }
    },
    []
  );

  const clearFollowUps = useCallback(() => setQuestions([]), []);

  // Load stored follow-ups directly without making an API call.
  // Used when restoring a session that already has persisted follow-ups.
  const loadStoredFollowUps = useCallback((stored: string[]) => {
    setQuestions(stored);
  }, []);

  return { questions, isFetching, fetchFollowUps, clearFollowUps, loadStoredFollowUps };
}
