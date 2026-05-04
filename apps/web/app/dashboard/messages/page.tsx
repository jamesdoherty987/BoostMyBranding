'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { mockClients, mockMessages, timeAgo, type Message } from '@boost/core';
import { Input } from '@boost/ui';
import { Send, Paperclip, Search, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';

/**
 * Agency messages inbox. Two-pane on desktop, drill-down on mobile.
 */
export default function MessagesPage() {
  const [clientId, setClientId] = useState<string>(mockClients[0]!.id);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [threads, setThreads] = useState<Record<string, Message[]>>(() => seedThreads());
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const messages = threads[clientId] ?? [];
  const filteredClients = mockClients.filter((c) =>
    c.businessName.toLowerCase().includes(q.toLowerCase()),
  );
  const activeClient = mockClients.find((c) => c.id === clientId)!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [clientId, messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const msg: Message = {
      id: `m-${Date.now()}`,
      clientId,
      sender: 'agency',
      senderName: 'Jamie (BoostMyBranding)',
      body,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setThreads((prev) => ({ ...prev, [clientId]: [...(prev[clientId] ?? []), msg] }));
    setDraft('');
  };

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
            {filteredClients.map((c) => {
              const thread = threads[c.id] ?? [];
              const last = thread.at(-1);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setClientId(c.id);
                      setMobileView('thread');
                    }}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 p-4 text-left transition-colors ${
                      c.id === clientId ? 'bg-[#48D886]/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {c.logoUrl ? <Image src={c.logoUrl} alt="" fill unoptimized /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {c.businessName}
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
            })}
          </ul>
        </aside>

        {/* Conversation */}
        <section
          className={`flex flex-col bg-slate-50 ${
            mobileView === 'thread' ? 'flex' : 'hidden'
          } md:flex`}
        >
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-4">
            <button
              onClick={() => setMobileView('list')}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Back to inbox"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-100">
              {activeClient.logoUrl ? <Image src={activeClient.logoUrl} alt="" fill unoptimized /> : null}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{activeClient.businessName}</div>
              <div className="truncate text-xs text-slate-500">{activeClient.contactName}</div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
            {messages.map((m) => {
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
                    <div className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 safe-pb"
          >
            <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Attach">
              <Paperclip className="h-4 w-4" />
            </button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Reply to ${activeClient.contactName}…`}
              className="no-zoom"
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
        </section>
      </div>
    </>
  );
}

function seedThreads(): Record<string, Message[]> {
  const map: Record<string, Message[]> = {};
  for (const c of mockClients) map[c.id] = [];
  for (const m of mockMessages) {
    map[m.clientId] = [...(map[m.clientId] ?? []), m];
  }
  for (const c of mockClients) {
    if ((map[c.id] ?? []).length === 0) {
      map[c.id] = [
        {
          id: `seed-${c.id}`,
          clientId: c.id,
          sender: 'client',
          senderName: c.contactName,
          body: 'Excited to get rolling! Let me know when the first batch is ready.',
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          isRead: true,
        },
      ];
    }
  }
  return map;
}
