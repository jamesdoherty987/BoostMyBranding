import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Commander } from '@/components/Commander';
import { Toaster, PageTransition } from '@boost/ui';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BoostMyBranding — Agency Dashboard',
  description: 'Manage clients, approve posts, schedule content.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden md:pl-64">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <Commander />
        <Toaster />
      </body>
    </html>
  );
}
