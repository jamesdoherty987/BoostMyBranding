'use client';

/**
 * Inline-editable text primitive. In public/rendered mode it's a plain
 * element with the given tag. In edit mode (opted into via the Site
 * context's `editMode`) it becomes a click-to-edit contenteditable with
 * a subtle hover outline.
 *
 * Edits are committed on blur (or Enter for single-line fields) and
 * handed to the context's `onFieldChange` callback, which the dashboard
 * wires to the API. Escape cancels without persisting.
 *
 * IMPORTANT — why we don't use `dangerouslySetInnerHTML` + contentEditable:
 *   Setting innerHTML on a contenteditable on every render nukes the
 *   browser selection (cursor jumps to start mid-typing, selection lost,
 *   IME composition breaks). Instead we render text content ONCE on mount
 *   and whenever the external value changes AND we're not currently
 *   editing. Inside the editing session, the DOM is the source of truth.
 *
 * Safe for SSR: the contenteditable only activates when `editMode` is
 * true, which only happens in the dashboard preview.
 */

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
} from 'react';
import { useSiteContext } from './context';

interface InlineEditableProps {
  /** Dotted path into the config, e.g. "hero.headline" or "services.0.title". */
  path: string;
  /** The current string value. */
  value: string;
  /** HTML tag to render when not editing. Default 'span'. */
  as?: ElementType;
  /** Tailwind classes applied in both render and edit modes. */
  className?: string;
  /** Placeholder shown when value is empty in edit mode. */
  placeholder?: string;
  /** If true, allow multi-line (textarea-style) editing. Default single-line. */
  multiline?: boolean;
  /** Max characters accepted. Values longer than this get trimmed on commit. */
  maxLength?: number;
}

export function InlineEditable({
  path,
  value,
  as,
  className,
  placeholder = 'Click to edit…',
  multiline = false,
  maxLength = 2000,
}: InlineEditableProps) {
  const { editMode, onFieldChange } = useSiteContext();
  const Tag: ElementType = (as ?? 'span') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);

  // When the external value changes AND we're not editing, sync the DOM.
  // This handles:
  //   - AI-driven config updates while the panel is idle
  //   - initial mount (React sets textContent from JSX children anyway, but
  //     we re-run this so the contenteditable starts in the right state)
  // We deliberately DO NOT write to the DOM while `editing` is true — that
  // would clobber the user's cursor and composition state.
  useEffect(() => {
    if (editing) return;
    const el = ref.current;
    if (!el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value, editing]);

  // Non-edit mode: plain element, no extras. We render `value` here and
  // React will reconcile text content on future updates normally.
  if (!editMode) {
    return <Tag className={className}>{value}</Tag>;
  }

  const commit = (next: string) => {
    const trimmed = next.slice(0, maxLength);
    setEditing(false);
    if (trimmed !== value) {
      onFieldChange?.(path, trimmed);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Reset the DOM to the original value and bail out of editing.
      if (ref.current) ref.current.textContent = value;
      setEditing(false);
      (e.target as HTMLElement).blur();
      return;
    }
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };

  const editingClass = editing
    ? 'outline outline-2 outline-offset-2 outline-[#1D9CA1] bg-[#1D9CA1]/5 rounded-md'
    : 'hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-[#1D9CA1]/40 hover:bg-[#1D9CA1]/5 cursor-text rounded-md transition-all';

  // Show placeholder when empty via a data attribute + CSS `::before` hook.
  // We keep the element empty so the cursor-can-land-here UX still works.
  const isEmpty = !value || value.trim().length === 0;

  return (
    <Tag
      ref={ref as any}
      className={`${className ?? ''} ${editingClass} ${
        isEmpty ? 'before:text-slate-400 before:content-[attr(data-placeholder)]' : ''
      }`}
      contentEditable
      suppressContentEditableWarning
      data-inline-path={path}
      data-placeholder={placeholder}
      role="textbox"
      aria-label={`Edit ${path}`}
      onFocus={() => setEditing(true)}
      onBlur={(e: ReactFocusEvent<HTMLElement>) =>
        commit(e.currentTarget.textContent ?? '')
      }
      onKeyDown={onKeyDown}
    >
      {/* Initial render — after this, the effect above keeps DOM in sync
          without re-rendering children (which would break the cursor). */}
      {value}
    </Tag>
  );
}
