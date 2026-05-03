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
import { MessageSquare, Send, X, Sparkles, Loader2 } from 'lucide-react';
import { useSiteContext } from './context';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

/**
 * Suggested starter prompts shown on first open. Kept short and
 * actionable — the user can click to insert into the input.
 */
const SUGGESTIONS = [
  'Make the hero darker and more premium',
  'Rewrite the headline to be punchier',
  'Add a menu page',
  'Change the primary color to navy',
  'Add a section about our sourcing story',
  'Make the tone friendlier',
] as const;

export function SiteAIChat() {
  const { editMode, onAIEdit } = useSiteContext();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
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
      const summary = await onAIEdit(text);
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
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
