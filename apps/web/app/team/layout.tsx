import type { Metadata, Viewport } from 'next';

/**
 * Internal-only team sign-in route. Keep it out of search indexes — the
 * only people who should know this URL are team members.
 */
export const metadata: Metadata = {
  title: 'Team sign in',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
