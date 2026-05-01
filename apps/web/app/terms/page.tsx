import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service - BoostMyBranding',
  description: 'Terms and conditions for using BoostMyBranding services.',
};

export default function TermsPage() {
  return (
    <main className="bg-white">
      <Navbar />

      <article className="mx-auto max-w-3xl px-4 pb-20 pt-32 md:pt-40">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 1 May 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-700">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Agreement to terms</h2>
            <p className="mt-2">
              By accessing or using BoostMyBranding&apos;s website, client portal, or services,
              you agree to be bound by these Terms of Service. If you do not agree, please do
              not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Services</h2>
            <p className="mt-2">
              BoostMyBranding provides social media content creation, scheduling, publishing,
              and website design services for businesses. Our services include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Monthly social media content planning and creation.</li>
              <li>Content scheduling and publishing across authorised platforms.</li>
              <li>Photo enhancement and editing for social media use.</li>
              <li>Website design, hosting, and maintenance.</li>
              <li>Monthly performance reporting.</li>
              <li>Ongoing communication and support through the client portal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Subscriptions and payment</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Services are provided on a monthly subscription basis. Pricing is as displayed
                on our website at the time of sign-up.
              </li>
              <li>
                Payment is processed securely through Stripe. You authorise us to charge your
                payment method on a recurring monthly basis.
              </li>
              <li>
                Website packages include a one-time setup fee in addition to the monthly
                subscription.
              </li>
              <li>
                Prices may change with 30 days&apos; written notice. Existing subscribers will
                be notified by email before any price change takes effect.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Cancellation</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                You may cancel your subscription at any time after the initial 3-month period
                by contacting us through the portal or by email.
              </li>
              <li>
                Cancellation takes effect at the end of the current billing period. No refunds
                are provided for partial months.
              </li>
              <li>
                Setup fees for website packages are non-refundable once work has commenced.
              </li>
              <li>
                Upon cancellation, your content will remain accessible for 30 days. After that,
                it will be deleted unless you request an export.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Your content</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                You retain ownership of all photos, logos, and brand materials you provide to
                us.
              </li>
              <li>
                By uploading content, you grant us a licence to use, edit, and publish it on
                your behalf across the platforms you authorise.
              </li>
              <li>
                You confirm that you have the right to use all content you provide and that it
                does not infringe on any third party&apos;s rights.
              </li>
              <li>
                Content we create for you (captions, graphics, website copy) is owned by you
                once your subscription payment for that period is received.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Our responsibilities</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                We will deliver the agreed number of posts per month as outlined in your
                subscription plan.
              </li>
              <li>
                All content is reviewed internally before publishing. We take reasonable care
                to ensure quality and accuracy.
              </li>
              <li>
                We will respond to portal messages within one business day.
              </li>
              <li>
                Website clients receive ongoing hosting and reasonable maintenance as part of
                their subscription.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Limitations of liability</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                We do not guarantee specific results such as follower counts, engagement rates,
                or revenue increases. Social media performance depends on many factors outside
                our control.
              </li>
              <li>
                We are not liable for any changes to social media platform algorithms, policies,
                or availability that may affect your content&apos;s performance.
              </li>
              <li>
                Our total liability for any claim arising from our services is limited to the
                amount you paid us in the 3 months preceding the claim.
              </li>
              <li>
                We are not responsible for any loss of business, revenue, or data arising from
                the use of our services, except where caused by our negligence.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Acceptable use</h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide content that is unlawful, defamatory, or infringes on others&apos; rights.</li>
              <li>Use our services for any illegal purpose.</li>
              <li>Attempt to access other users&apos; accounts or data.</li>
              <li>Interfere with the operation of our platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Termination</h2>
            <p className="mt-2">
              We reserve the right to suspend or terminate your account if you breach these
              terms, fail to make payment, or engage in conduct that we reasonably believe is
              harmful to our business or other users. We will provide reasonable notice where
              possible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. We will notify you of material
              changes by email at least 14 days before they take effect. Continued use of our
              services after changes are posted constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">11. Governing law</h2>
            <p className="mt-2">
              These terms are governed by the laws of Ireland. Any disputes will be subject to
              the exclusive jurisdiction of the Irish courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
            <p className="mt-2">
              Questions about these terms? Email us at{' '}
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
