'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { mockClients, getMessagesForClient, timeAgo, type Message } from '@boost/core';
import { Input, Spinner, toast, useRealtime } from '@boost/ui';
import { Send, Paperclip } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, API_URL } from '@/lib/api';
import { handlePortalAuthError, ALLOW_MOCK_FALLBACK } from '@/lib/auth';

/**
 * Chat page with live delivery via SSE. Optimistic UI on send, then
 * replaced by the server-confirmed row when the broadcast arrives.
 *
 * We load the client once, then fetch messages keyed by that client id so
 * SWR caches correctly and realtime updates don't trigger re-renders.
 */
export default function ChatPage() {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: me } = useSWR('portal:me', async () => {
    try {
      return await api.getMyClient();
    } catch (err) {
      handlePortalAuthError(err);
      if (!ALLOW_MOCK_FALLBACK) throw err;
      return mockClients[0]!;
    }
  });
  const clientId = me?.id ?? mockClients[0]!.id;

  const { data: messages = [], mutate } = useSWR<Message[]>(
    me ? ['portal:messages', clientId] : null,
    async () => {
      try {
        return (await api.listMessages(clientId)) as Message[];
      } catch {
        return getMessagesForClient(clientId);
      }
    },
  );

  // Receive broadcast messages from the agency side in real time.
  const onEvent = useCallback(
    (evt: { type: string; payload: any }) => {
      if (evt.type === 'message:new' && evt.payload?.clientId === clientId) {
        mutate();
      }
    },
    [clientId, mutate],
  );
  useRealtime(API_URL, onEvent);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      clientId,
      sender: 'client',
      senderName: 'You',
      body,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    mutate((prev) => [...(prev ?? []), optimistic], false);

    try {
      await api.sendMessage(clientId, body);
      mutate();
    } catch (e) {
      toast.error('Could not send', (e as Error).message);
      mutate((prev) => (prev ?? []).filter((m) => m.id !== optimistic.id), false);
    }
  };

  return (
    <Shell title="Chat" subtitle="With your BoostMyBranding team">
      {!me ? (
        <div className="mt-10 flex justify-center">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const mine = m.sender === 'client';
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      mine
                        ? 'rounded-br-md bg-gradient-cta text-white'
                        : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    {!mine ? (
                      <div className="mb-0.5 text-[11px] font-semibold text-[#1D9CA1]">
                        {m.senderName}
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <div className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex w-[min(100%-1rem,28rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
      >
        <button
          type="button"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Attach"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="h-10 border-none bg-transparent px-0 no-zoom focus:ring-0 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Shell>
  );
}
