import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BoostMyBranding — Social growth on autopilot',
  description:
    'AI-powered social media, websites, and content for modern local businesses. We run your social. You run your business.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'BoostMyBranding',
    description: 'Social growth on autopilot for modern local brands.',
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
