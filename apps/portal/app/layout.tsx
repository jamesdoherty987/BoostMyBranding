import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster, PageTransition } from '@boost/ui';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BoostMyBranding — Client Portal',
  description: 'Upload photos, chat with your BoostMyBranding team, see what\'s going live.',
  manifest: '/manifest.json',
  icons: { icon: '/icon-192.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#48D886',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <PageTransition>{children}</PageTransition>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[sw] registration failed:', err))); }`,
          }}
        />
      </body>
    </html>
  );
}
