'use client';

/**
 * Floating AI chat button for the rendered site. In edit mode a small pill
 * sits in the bottom-right corner; clicking it opens a chat panel that
 * talks to the existing `/api/v1/automation/edit-website` endpoint.
 *
 * Uses the context's `onAIEdit` callback to delegate the actual network
 * call + config refresh to the host (the dashboard's websites page). The
 * host controls authentication, optimistic state, and which config to
 * send as "current" — this component just handles the chat UX.
 *
 * Not rendered on the public site — `editMode` gates the entire thing.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { AI_MODELS, defaultModelFor, type AiModelKey } from '@boost/core';
import { useSiteContext } from './context';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

/**
 * Suggested starter prompts shown on first open. Kept short and
 * actionable — the user can click to insert into the input.
 *
 * The list maps to the full edit surface exposed by `editWebsiteWithAI`
 * — colours, hero variants, illustrations, sections, layout, items,
 * stats, contact info, SEO, navigation, pages. Agencies skim these to
 * learn what the AI can actually change.
 */
const SUGGESTIONS = [
  'Make the hero darker and more premium',
  'Rewrite the headline to be punchier',
  'Change the primary color to navy blue',
  'Swap the hero illustration to a coffee cup on the left',
  'Use the marquee variant for the logo strip',
  'Add a Menu page with our espresso drinks and brunch',
  'Feature the middle team member',
  'Change the services style to bento grid',
  'Update the phone to +353 1 234 5678',
  'Add an announcement bar about Christmas hours',
  'Change the testimonials to the draggable style',
  'Rename "Home" nav item to "Start"',
  'Update SEO title to Murphy Plumbing — Dublin 2',
  'Add our Instagram to the socials',
  'Make the rating stat 4.9',
] as const;

export function SiteAIChat() {
  const { editMode, onAIEdit } = useSiteContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  // Agency picks the model. Defaults to the "edit" default (Sonnet) —
  // live-edit chat runs constantly, so balanced speed/cost beats the
  // heaviest model. Persisted in localStorage so the choice sticks
  // across reloads.
  const [model, setModel] = useState<AiModelKey>(() => {
    if (typeof window === 'undefined') return defaultModelFor('edit');
    const stored = window.localStorage.getItem('bmb:ai-chat-model');
    if (stored === 'opus' || stored === 'sonnet' || stored === 'haiku') {
      return stored;
    }
    return defaultModelFor('edit');
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bmb:ai-chat-model', model);
  }, [model]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to the latest message when history changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!editMode || !onAIEdit) return null;

  const submit = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setHistory((h) => [...h, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      // Pass the selected model through so the host routes the edit
      // to the user's preferred Claude tier.
      const summary = await onAIEdit(text, { model });
      setHistory((h) => [
        ...h,
        { role: 'ai', text: summary || 'Done — the site was updated.' },
      ]);
    } catch (e) {
      setHistory((h) => [
        ...h,
        { role: 'ai', text: `Couldn't apply that: ${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activeModel = AI_MODELS.find((m) => m.key === model)!;

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[60] inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-[1.03] md:bottom-6"
        style={{
          background: 'var(--bmb-site-primary)',
          boxShadow: '0 12px 32px -8px rgba(0,0,0,0.25)',
        }}
        aria-label="Ask AI to edit this site"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Ask AI</span>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-x-4 bottom-4 z-[70] flex max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl md:inset-auto md:bottom-6 md:right-6 md:max-h-[70vh] md:w-[400px]"
            role="dialog"
            aria-modal="true"
            aria-label="AI site editor"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ background: 'var(--bmb-site-primary)' }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">Ask AI</p>
                  <p className="mt-0.5 text-[11px] leading-none text-white/80">
                    Say what to change in plain English
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Model picker — dropdown above the chat so the agency
                    can swap between Opus / Sonnet / Haiku mid-session
                    without leaving the conversation. */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/30"
                    title={`Model: ${activeModel.label} (${activeModel.blurb})`}
                    aria-expanded={modelMenuOpen}
                    aria-haspopup="menu"
                  >
                    {activeModel.label}
                    <ChevronDown className={`h-3 w-3 transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {modelMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl"
                    >
                      {AI_MODELS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={model === m.key}
                          onClick={() => {
                            setModel(m.key);
                            setModelMenuOpen(false);
                          }}
                          className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                            model === m.key
                              ? 'bg-[color:var(--bmb-site-primary)]/10'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 bg-white">
                            {model === m.key ? (
                              <span
                                className="block h-full w-full rounded-full"
                                style={{
                                  background: 'var(--bmb-site-primary)',
                                  border: '2px solid white',
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold">{m.label}</span>
                              <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-500">
                                {m.cost}
                              </span>
                              <span className="text-[9px] font-medium text-slate-500">
                                {m.speed}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {m.blurb}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {history.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-900">
                      <MessageSquare className="mr-1.5 inline h-3 w-3 -translate-y-px" />
                      Try something like...
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInput(s)}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700 transition-colors hover:border-[color:var(--bmb-site-primary)] hover:bg-white hover:text-[color:var(--bmb-site-primary)]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                history.map((m, i) => <ChatBubble key={i} message={m} />)
              )}
              {loading ? (
                <ChatBubble message={{ role: 'ai', text: 'Thinking…' }} pending />
              ) : null}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-end gap-2 border-t border-slate-100 bg-white p-3"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="e.g. 'Make the hero darker and add a pricing section'"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[color:var(--bmb-site-primary)] focus:bg-white disabled:opacity-50"
                style={{ maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: 'var(--bmb-site-primary)' }}
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ChatBubble({ message, pending }: { message: Message; pending?: boolean }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-slate-900 text-white'
            : pending
              ? 'bg-white text-slate-500 italic'
              : 'bg-white text-slate-700 ring-1 ring-slate-100'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
