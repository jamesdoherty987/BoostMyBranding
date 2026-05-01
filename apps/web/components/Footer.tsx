import Link from 'next/link';
import { Logo } from '@boost/ui';
import { Instagram, Linkedin, Twitter } from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3002';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-slate-600">
              Social growth, done for you. Social media that sounds like you, written by a real team.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="#features" className="hover:text-slate-900">Features</Link></li>
              <li><Link href="#how-it-works" className="hover:text-slate-900">How it works</Link></li>
              <li><Link href="/examples" className="hover:text-slate-900">Examples</Link></li>
              <li><Link href="/blog" className="hover:text-slate-900">Blog</Link></li>
              <li><Link href="#pricing" className="hover:text-slate-900">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Company</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="mailto:hello@boostmybranding.com" className="hover:text-slate-900">Contact</a></li>
              <li><Link href={PORTAL_URL} className="hover:text-slate-900">Client login</Link></li>
              <li><Link href={DASHBOARD_URL} className="hover:text-slate-900">Team login</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Follow</div>
            <div className="mt-3 flex gap-3">
              <a href="https://instagram.com/boostmybranding" target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-slate-900" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
              <Link href="#" className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-slate-900" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </Link>
              <Link href="#" className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-slate-900" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} BoostMyBranding. All rights reserved.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
