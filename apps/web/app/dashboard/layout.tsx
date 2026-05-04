/**
 * Dashboard layout — mounted under `/dashboard/*`. Nested under the web
 * root layout, so it doesn't render html/body. Adds the agency sidebar,
 * the global Commander (⌘K), and a dedicated Toaster so toast
 * notifications from the dashboard don't collide with marketing-site ones.
 */

import type { Metadata } from 'next';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Commander } from '@/components/dashboard/Commander';
import { Toaster, PageTransition } from '@boost/ui';
import './dashboard.css';

export const metadata: Metadata = {
  title: 'BoostMyBranding — Agency Dashboard',
  description: 'Manage clients, approve posts, schedule content.',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-root min-h-screen antialiased">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden md:pl-64">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Commander />
      <Toaster />
    </div>
  );
}
