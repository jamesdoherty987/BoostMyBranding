import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy - BoostMyBranding',
  description: 'How BoostMyBranding collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return (
    <main className="bg-white">
      <Navbar />

      <article className="mx-auto max-w-3xl px-4 pb-20 pt-32 md:pt-40">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 1 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Who we are</h2>
            <p className="mt-2">
              BoostMyBranding (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides social
              media management and website services for local businesses. This policy explains
              how we collect, use, and protect your personal information when you use our
              website, client portal, or services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Information we collect</h2>
            <p className="mt-2">We may collect the following information:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Account information:</strong> name, email address, phone number, and
                business details you provide when signing up or contacting us.
              </li>
              <li>
                <strong>Content:</strong> photos, logos, brand materials, and text you upload
                or share with us for use in your social media posts and website.
              </li>
              <li>
                <strong>Usage data:</strong> pages visited, features used, browser type, device
                type, and IP address collected automatically when you use our platform.
              </li>
              <li>
                <strong>Payment information:</strong> billing details processed securely through
                Stripe. We do not store your full card number on our servers.
              </li>
              <li>
                <strong>Communications:</strong> messages you send us through the portal chat,
                email, or contact forms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. How we use your information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To provide and improve our social media management and website services.</li>
              <li>To create, schedule, and publish content on your behalf.</li>
              <li>To communicate with you about your account, content, and billing.</li>
              <li>To send you service updates and important notices.</li>
              <li>To analyse usage patterns and improve our platform.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. How we share your information</h2>
            <p className="mt-2">
              We do not sell your personal information. We may share your data with:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Service providers:</strong> hosting (Render, Cloudflare), payment
                processing (Stripe), email delivery (Resend), and image processing services
                that help us deliver our platform.
              </li>
              <li>
                <strong>Social media platforms:</strong> when we publish content on your behalf
                to platforms like Instagram, Facebook, LinkedIn, TikTok, and others you
                authorise.
              </li>
              <li>
                <strong>Legal requirements:</strong> if required by law, regulation, or legal
                process.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Data security</h2>
            <p className="mt-2">
              We use industry-standard security measures to protect your information, including
              encrypted connections (HTTPS), secure authentication, and access controls. Your
              uploaded content is stored on Cloudflare R2 with restricted access. Payment data
              is handled entirely by Stripe and never touches our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Data retention</h2>
            <p className="mt-2">
              We retain your account information and content for as long as your account is
              active. If you cancel your subscription, we will delete your content within 90
              days unless you request earlier deletion. Usage data is retained in anonymised
              form for analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Your rights</h2>
            <p className="mt-2">You have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal information.</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Request a copy of your data in a portable format.</li>
              <li>Withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:contact@boostmybranding.com" className="text-[#1D9CA1] hover:underline">
                contact@boostmybranding.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Cookies</h2>
            <p className="mt-2">
              We use essential cookies to keep you logged in and remember your preferences. We
              do not use third-party advertising or tracking cookies. Analytics data is
              collected server-side without cookies where possible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Changes to this policy</h2>
            <p className="mt-2">
              We may update this policy from time to time. We will notify you of significant
              changes by email or through a notice on our website. Your continued use of our
              services after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Contact us</h2>
            <p className="mt-2">
              If you have questions about this privacy policy or how we handle your data,
              contact us at{' '}
              <a href="mailto:contact@boostmybranding.com" className="text-[#1D9CA1] hover:underline">
                contact@boostmybranding.com
              </a>.
            </p>
          </section>
        </div>
      </article>

      <Footer />
    </main>
  );
}
