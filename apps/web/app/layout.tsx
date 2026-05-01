import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'BoostMyBranding — Social media done for you',
  description:
    'A dedicated social team for modern local businesses. Thoughtful posts in your voice, planned and published every month. Websites built to match.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'BoostMyBranding',
    description: 'Social media and websites done for you, by a real team.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
