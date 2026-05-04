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
 * Multipage routing:
 *   When the active page is a sub-page (`currentPageSlug !== 'home'`),
 *   per-page block paths are automatically rewritten to point at the
 *   page's override. Example on an About sub-page: typing in an
 *   InlineEditable with `path="hero.headline"` writes to
 *   `pages.<N>.hero.headline`, not to the root `hero.headline`.
 *
 *   Global fields (brand.*, meta.*, navigation) are never remapped.
 *
 * IMPORTANT — why we don't use `dangerouslySetInnerHTML` + contentEditable:
 *   Setting innerHTML on a contenteditable on every render nukes the
 *   browser selection (cursor jumps to start mid-typing, selection lost,
 *   IME composition breaks). Instead we render text content ONCE on mount
 *   and whenever the external value changes AND we're not currently
 *   editing. Inside the editing session, the DOM is the source of truth.
 */

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
} from 'react';
import { useSiteContext } from './context';
import { remapPathForPage } from './path-remap';

interface InlineEditableProps {
  /** Dotted path into the config, e.g. "hero.headline" or "services.0.title". */
  path: string;
  /**
   * The current string value. Accepts null/undefined defensively so
   * blocks don't have to thread `?? ''` at every call site — we coerce
   * to an empty string internally. This matters in practice because
   * legacy configs often have missing optional fields that the type
   * system says are required.
   */
  value: string | null | undefined;
  /** HTML tag to render when not editing. Default 'span'. */
  as?: ElementType;
  /** Tailwind classes applied in both render and edit modes. */
  className?: string;
  /** Inline styles applied in both render and edit modes. */
  style?: React.CSSProperties;
  /** Placeholder shown when value is empty in edit mode. */
  placeholder?: string;
  /** If true, allow multi-line (textarea-style) editing. Default single-line. */
  multiline?: boolean;
  /** Max characters accepted. Values longer than this get trimmed on commit. */
  maxLength?: number;
}

export function InlineEditable({
  path,
  value: rawValue,
  as,
  className,
  style,
  placeholder = 'Click to edit…',
  multiline = false,
  maxLength = 2000,
}: InlineEditableProps) {
  const { editMode, onFieldChange, currentPageSlug, pageIndex } = useSiteContext();
  // Coerce null/undefined to empty string once so every read inside the
  // component (textContent comparison, commit, initial render) can assume
  // a string.
  const value = typeof rawValue === 'string' ? rawValue : '';
  const Tag: ElementType = (as ?? 'span') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (editing) return;
    const el = ref.current;
    if (!el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value, editing]);

  // Non-edit mode: plain element, no extras. React reconciles normally.
  // We use createElement directly because JSX's type inference on a
  // local-variable component trips React 19's strict prop inference
  // (collapses to `never`). createElement bypasses that safely.
  if (!editMode) {
    return createElement(Tag, { className, style }, value);
  }

  const commit = (next: string) => {
    const trimmed = next.slice(0, maxLength);
    setEditing(false);
    if (trimmed === value) return;
    // Rewrite the path so edits on a sub-page land in that page's override
    // rather than stomping the homepage's root field.
    const writePath = remapPathForPage(path, currentPageSlug, pageIndex);
    onFieldChange?.(writePath, trimmed);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
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

  const isEmpty = !value || value.trim().length === 0;

  // In edit mode: same createElement approach to bypass JSX's strict
  // type inference on dynamic tags.
  return createElement(
    Tag,
    {
      ref,
      className: `${className ?? ''} ${editingClass} ${
        isEmpty ? 'before:text-slate-400 before:content-[attr(data-placeholder)]' : ''
      }`,
      style,
      contentEditable: true,
      suppressContentEditableWarning: true,
      'data-inline-path': path,
      'data-placeholder': placeholder,
      role: 'textbox',
      'aria-label': `Edit ${path}`,
      onFocus: () => setEditing(true),
      onBlur: (e: ReactFocusEvent<HTMLElement>) =>
        commit(e.currentTarget.textContent ?? ''),
      onKeyDown,
    },
    value,
  );
}
