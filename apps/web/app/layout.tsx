import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://boostmybranding.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: 'BoostMyBranding - Social media done for you',
    template: '%s | BoostMyBranding',
  },
  description:
    'A dedicated social team for modern local businesses. Thoughtful posts in your voice, planned and published every month. Websites built to match.',
  keywords: [
    'social media management',
    'social media agency',
    'done for you social media',
    'local business marketing',
    'social media for small business',
    'content creation service',
    'Instagram management',
    'Facebook management',
    'LinkedIn management',
    'TikTok management',
    'social media scheduling',
    'website design for small business',
  ],
  authors: [{ name: 'BoostMyBranding' }],
  creator: 'BoostMyBranding',
  publisher: 'BoostMyBranding',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '500x500' }],
    apple: '/favicon.png',
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'BoostMyBranding - Social media done for you',
    description:
      'A dedicated social team for modern local businesses. Thoughtful posts in your voice, planned and published every month.',
    url: BASE,
    siteName: 'BoostMyBranding',
    locale: 'en_IE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BoostMyBranding - Social media done for you',
    description:
      'A dedicated social team for modern local businesses. Thoughtful posts in your voice, planned and published every month.',
    creator: '@boostmybranding',
  },
  alternates: {
    canonical: BASE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes here when ready:
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
