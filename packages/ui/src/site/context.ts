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
}

export const SiteContext = createContext<SiteContextValue>({
  embedded: false,
  businessName: '',
});

export const useSiteContext = () => useContext(SiteContext);
