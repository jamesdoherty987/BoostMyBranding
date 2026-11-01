import type { Metadata } from 'next';
import { BarberSite } from '../../barber-website';

export const metadata: Metadata = {
  title: 'Ash & Blade — Neighbourhood Barbers',
  description:
    'Demo barbershop site built with Aceternity-powered blocks from BoostMyBranding.',
  robots: { index: false, follow: false },
};

/**
 * Live preview of the barber-website demo folder.
 * Visit /barber while running the web app.
 */
export default function BarberDemoPage() {
  return <BarberSite />;
}
