'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import {
  mockClients,
  mockMessages,
  timeAgo,
  type Client,
  type Message,
} from '@boost/core';
import { Input, Spinner, useRealtime, toast } from '@boost/ui';
import { Send, Paperclip, Search, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { api, API_URL } from '@/lib/dashboard/api';

/**
 * Agency messages inbox. Two-pane on desktop, drill-down on mobile.
 *
 * Loads clients + messages from the API and subscribes to SSE so messages
 * from the portal appear live. Falls back to mock data when the API isn't
 * reachable so local dev without the backend still renders something.
 */
export default function MessagesPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Clients list — real API with mock fallback so the page still works
  // when the backend is down.
  const { data: clients } = useSWR<Client[]>('dashboard:messages:clients', async () => {
    try {
      return await api.listClients();
    } catch {
      return mockClients;
    }
  });
  const clientList = clients ?? mockClients;

  // Default-select the first client once the list loads.
  useEffect(() => {
    if (!clientId && clientList.length > 0) setClientId(clientList[0]!.id);
  }, [clientId, clientList]);

  // Messages for the selected client.
  const {
    data: messages,
    mutate,
    isLoading: loadingMessages,
  } = useSWR<Message[]>(
    clientId ? ['dashboard:messages', clientId] : null,
    async () => {
      try {
        return (await api.listMessages(clientId!)) as Message[];
      } catch {
        return mockMessages.filter((m) => m.clientId === clientId);
      }
    },
  );

  // Live updates: revalidate the currently-open thread, and nudge the
  // inbox list preview by refetching that thread when a message lands
  // for any client (cheap — SWR will dedupe).
  const onEvent = useCallback(
    (evt: { type: string; payload: any }) => {
      if (evt.type !== 'message:new') return;
      if (evt.payload?.clientId === clientId) mutate();
    },
    [clientId, mutate],
  );
  useRealtime(API_URL, onEvent);

  const filteredClients = useMemo(
    () => clientList.filter((c) => c.businessName.toLowerCase().includes(q.toLowerCase())),
    [clientList, q],
  );
  const activeClient = clientList.find((c) => c.id === clientId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [clientId, messages?.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !clientId || sending) return;
    setSending(true);
    setDraft('');

    // Optimistic append so the message renders instantly; the realtime
    // broadcast will refresh with the server-confirmed row.
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      clientId,
      sender: 'agency',
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
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const thread = messages ?? [];

  return (
    <>
      <PageHeader title="Messages" subtitle="Real-time chat across every client" />

      <div className="grid h-[calc(100vh-80px)] grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* Inbox list */}
        <aside
          className={`overflow-y-auto border-r border-slate-200 bg-white ${
            mobileView === 'list' ? 'block' : 'hidden'
          } md:block`}
        >
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search clients…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10 no-zoom"
              />
            </div>
          </div>
          <ul>
            {filteredClients.map((c) => (
              <InboxRow
                key={c.id}
                client={c}
                active={c.id === clientId}
                onSelect={() => {
                  setClientId(c.id);
                  setMobileView('thread');
                }}
              />
            ))}
            {filteredClients.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-500">No clients match.</li>
            ) : null}
          </ul>
        </aside>

        {/* Conversation */}
        <section
          className={`flex flex-col bg-slate-50 ${
            mobileView === 'thread' ? 'flex' : 'hidden'
          } md:flex`}
        >
          {activeClient ? (
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-4">
              <button
                onClick={() => setMobileView('list')}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Back to inbox"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                {activeClient.logoUrl ? (
                  <Image src={activeClient.logoUrl} alt="" fill unoptimized />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">
                  {activeClient.businessName}
                </div>
                <div className="truncate text-xs text-slate-500">{activeClient.contactName}</div>
              </div>
            </div>
          ) : null}

          <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
            {loadingMessages && thread.length === 0 ? (
              <div className="flex justify-center pt-10">
                <Spinner size={24} />
              </div>
            ) : thread.length === 0 ? (
              <div className="pt-10 text-center text-sm text-slate-500">
                No messages yet. Say hi 👋
              </div>
            ) : (
              thread.map((m) => {
                const mine = m.sender === 'agency';
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm md:max-w-[65%] ${
                        mine
                          ? 'rounded-br-md bg-gradient-cta text-white shadow-brand'
                          : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {!mine ? (
                        <div className="mb-0.5 text-[11px] font-semibold text-[#1D9CA1]">
                          {m.senderName}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div
                        className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}
                      >
                        {timeAgo(m.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 safe-pb"
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
              placeholder={
                activeClient ? `Reply to ${activeClient.contactName}…` : 'Select a client…'
              }
              disabled={!activeClient || sending}
              className="no-zoom"
            />
            <button
              type="submit"
              disabled={!draft.trim() || !clientId || sending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-cta text-white shadow-brand disabled:opacity-40"
              aria-label="Send"
              aria-busy={sending || undefined}
            >
              {sending ? (
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

/**
 * Inbox row. Fetches the client's latest message so the preview line
 * stays accurate — and refreshes whenever a new message arrives for
 * that client (via SSE broadcast to the same SWR key).
 */
function InboxRow({
  client,
  active,
  onSelect,
}: {
  client: Client;
  active: boolean;
  onSelect: () => void;
}) {
  const { data: msgs, mutate } = useSWR<Message[]>(
    ['dashboard:messages', client.id],
    async () => {
      try {
        return (await api.listMessages(client.id)) as Message[];
      } catch {
        return mockMessages.filter((m) => m.clientId === client.id);
      }
    },
    // Keep previews fresh without hammering the API on every mount.
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );

  const onEvent = useCallback(
    (evt: { type: string; payload: any }) => {
      if (evt.type === 'message:new' && evt.payload?.clientId === client.id) mutate();
    },
    [client.id, mutate],
  );
  useRealtime(API_URL, onEvent);

  const last = msgs?.at(-1);

  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors ${
          active ? 'bg-[#48D886]/5' : 'hover:bg-slate-50'
        }`}
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
          {client.logoUrl ? <Image src={client.logoUrl} alt="" fill unoptimized /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-sm font-semibold text-slate-900">
              {client.businessName}
            </span>
            {last ? (
              <span className="text-[10px] text-slate-400">{timeAgo(last.createdAt)}</span>
            ) : null}
          </div>
          <div className="truncate text-xs text-slate-500">
            {last ? last.body : 'No messages yet'}
          </div>
        </div>
      </button>
    </li>
  );
}
