'use client';

import { createContext, useContext } from 'react';

/**
 * Shared context for site blocks. Lets the renderer pass embedded-mode and
 * API configuration into every block without threading props through ten
 * layers. Blocks should treat all fields as optional and fall back to safe
 * defaults if the context isn't set.
 */
export interface SiteContextValue {
  embedded: boolean;
  /** Fully qualified API URL for lead submission etc. No trailing slash. */
  apiUrl?: string;
  /** Client id, used by blocks that need to POST on behalf of a client. */
  clientId?: string;
  /** Business name, used by blocks that need it for a11y / headings. */
  businessName: string;
}

export const SiteContext = createContext<SiteContextValue>({
  embedded: false,
  businessName: '',
});

export const useSiteContext = () => useContext(SiteContext);
