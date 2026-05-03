'use client';

import { createContext, useContext } from 'react';

/**
 * Shared context for site blocks. Lets the renderer pass embedded-mode,
 * edit-mode state, and API configuration into every block without threading
 * props through ten layers. Blocks should treat all fields as optional and
 * fall back to safe defaults if the context isn't set.
 */
export interface SiteContextValue {
  embedded: boolean;
  /** Fully qualified API URL for lead submission etc. No trailing slash. */
  apiUrl?: string;
  /** Client id, used by blocks that need to POST on behalf of a client. */
  clientId?: string;
  /** Business name, used by blocks that need it for a11y / headings. */
  businessName: string;
  /**
   * When true, `InlineEditable` wrappers render as click-to-edit controls.
   * Only set in the dashboard preview — the public site always has this off.
   */
  editMode?: boolean;
  /**
   * Called with (path, value) when an inline editable field commits a new
   * value. The dashboard wires this to the `updateWebsiteField` API, which
   * patches the config without a full Claude round-trip.
   */
  onFieldChange?: (path: string, value: unknown) => void;
  /**
   * Which page of a multipage site is currently rendering. Used by the nav
   * to mark the active link and by `InlineEditable` to route edits to the
   * right page override. `'home'` for the homepage.
   */
  currentPageSlug?: string;
  /**
   * Index of the active page in `config.pages`. `InlineEditable` uses this
   * to build paths like `pages.2.hero.headline`. Set alongside
   * `currentPageSlug`; undefined for single-page sites.
   */
  pageIndex?: number;
  /**
   * Full list of client image URLs (in index order). Blocks that use
   * `imageIndex`-style references can pass this to `InlineImage` so a
   * click-in-edit-mode opens the media library picker instead of going
   * to a text-edit state.
   */
  images?: string[];
  /**
   * Called by `InlineImage` when the user clicks an image in edit mode.
   * The dashboard opens a picker overlay; on selection it calls the
   * same `onFieldChange` path with `{imageIndex: n}` or `{imageUrl: 's'}`.
   *
   * Receives the path prefix of the field to update — e.g. `about` or
   * `team.members.2` — and the current value shape so the picker knows
   * whether to set `imageIndex` or `imageUrl`.
   */
  onImageClick?: (context: { path: string; fieldName: 'imageIndex' | 'imageUrl' | 'photoIndex' | 'photoUrl' }) => void;
  /**
   * Called by `SiteAIChat` when the user submits a natural-language edit.
   * The host wires this to the `editWebsiteWithAI` API and returns a short
   * summary of what changed (or throws with a clear error message).
   *
   * Only runs in edit mode. Leave undefined to hide the floating chat.
   */
  onAIEdit?: (instruction: string) => Promise<string>;
}

export const SiteContext = createContext<SiteContextValue>({
  embedded: false,
  businessName: '',
});

export const useSiteContext = () => useContext(SiteContext);
