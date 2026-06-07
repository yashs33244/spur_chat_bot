'use client';

import useSWR from 'swr';
import type { Conversation } from '@/types/conversation';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useConversations() {
  const { data, error, mutate, isLoading } = useSWR<{ conversations: Conversation[] }>(
    '/api/conversations',
    fetcher,
    { refreshInterval: 3000 }
  );

  return {
    conversations: data?.conversations ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
