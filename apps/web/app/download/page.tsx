import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { DownloadContent } from './DownloadContent';

export const metadata: Metadata = {
  title: 'Download the App',
  description:
    'Install the BoostMyBranding client portal on your phone or desktop for quick access to your social media dashboard.',
  alternates: { canonical: '/download' },
};

export default function DownloadPage() {
  return (
    <main className="bg-white">
      <Navbar />
      <DownloadContent />
      <Footer />
    </main>
  );
}
