'use client';

/**
 * Accessible ⌘K / ctrl+K command palette. No external deps beyond Framer
 * Motion. Consumers pass in an array of `CommandItem`s and control `open`
 * via the `useCommandPaletteHotkey` hook (or manually).
 *
 * There's also a global event (`bmb:palette-open`) you can dispatch from
 * anywhere (e.g. a sidebar button) to open the palette without prop-drilling.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from './cn';
import { Kbd } from './kbd';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  icon?: ReactNode;
  shortcut?: string[];
  onSelect: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

export const PALETTE_OPEN_EVENT = 'bmb:palette-open';
export const PALETTE_TOGGLE_EVENT = 'bmb:palette-toggle';

export function openCommandPalette() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
  }
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Type to search…',
}: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay =
        it.label.toLowerCase() +
        ' ' +
        (it.hint ?? '').toLowerCase() +
        ' ' +
        (it.keywords ?? []).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [q, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const g = it.group ?? 'Actions';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = filtered[active];
        if (pick) {
          pick.onSelect();
          onOpenChange(false);
          setQ('');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onOpenChange]);

  // Scroll active item into view
  useEffect(() => {
    if (!open) return;
    const container = listRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLElement>(`[data-cmd-idx="${active}"]`);
    if (btn) btn.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-start justify-center bg-slate-900/40 p-4 pt-[18vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          role="presentation"
        >
          <motion.div
            initial={{ y: -12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="h-8 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <Kbd>esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No matches.</div>
              ) : (
                grouped.map(([group, rows]) => (
                  <div key={group}>
                    <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {group}
                    </div>
                    {rows.map((it) => {
                      const idx = filtered.indexOf(it);
                      const isActive = idx === active;
                      return (
                        <button
                          key={it.id}
                          data-cmd-idx={idx}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => {
                            it.onSelect();
                            onOpenChange(false);
                            setQ('');
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            isActive
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          {it.icon ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                              {it.icon}
                            </span>
                          ) : null}
                          <span className="flex-1 truncate">{it.label}</span>
                          {it.hint ? (
                            <span className="truncate text-xs text-slate-400">{it.hint}</span>
                          ) : null}
                          {it.shortcut ? (
                            <span className="flex gap-1">
                              {it.shortcut.map((k) => (
                                <Kbd key={k}>{k}</Kbd>
                              ))}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="mx-3 inline-flex items-center gap-1">
                <Kbd>↵</Kbd> select
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>esc</Kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Opens on ⌘K / ctrl+K. Also listens for the global `bmb:palette-open` event
 * so any button or link can programmatically open the palette.
 */
export function useCommandPaletteHotkey(setOpen: (fn: (v: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(() => true);
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    window.addEventListener(PALETTE_TOGGLE_EVENT, onToggle);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
      window.removeEventListener(PALETTE_TOGGLE_EVENT, onToggle);
    };
  }, [setOpen]);
}
