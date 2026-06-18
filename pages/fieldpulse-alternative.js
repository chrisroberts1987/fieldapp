import SeoLanding from '../components/SeoLanding';

export default function FieldPulseAlternative() {
  return (
    <SeoLanding
      title="FieldPulse Alternative for Contractors | MyForeman"
      description="A FieldPulse alternative with simpler pricing and AI insights included from $39/mo. Scheduling, quotes, invoicing, online payments, and customer portal, all in one app. Free 14-day trial."
      canonicalPath="/fieldpulse-alternative"
      heroEyebrow="FieldPulse Alternative"
      h1="A focused alternative"
      h1Highlight="to FieldPulse."
      heroSub="Same kind of field-service workflow, including scheduling, quotes, jobs, and invoicing, with a cleaner mobile experience, AI insights included, and straightforward pricing from $39/mo."
      features={[
        { title: 'AI insights, included', body: 'Plain-English answers about your business. Which jobs make money, where your revenue is leaking, who to follow up with.' },
        { title: 'Built mobile-first', body: 'Designed for contractors running the business from a phone. Every feature works on the truck without feeling like a desktop app squeezed onto a screen.' },
        { title: 'Self-serve signup', body: 'No demo call required. Start the free trial, decide for yourself, cancel from settings if it\'s not for you.' },
        { title: 'Card payments + manual methods', body: 'Stripe-powered online payments, plus Venmo, Zelle, Cash App, PayPal, and check. Customer picks how they want to pay.' },
        { title: 'Customer portal', body: 'Customers see their quotes, invoices, and job history in one place. Self-service portal included on every plan.' },
        { title: 'Same-day migration', body: 'Import customers, jobs, and invoices from CSV during onboarding. Be running the business by tomorrow.' },
      ]}
      comparison={{
        competitor: 'FieldPulse',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '~$65/mo' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Limited' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo recommended' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Customer self-service portal',        mf: 'Included',     them: 'Included' },
          { feature: 'Recurring jobs / billing',            mf: 'Included',     them: 'Included' },
          { feature: 'CSV import / data migration',         mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: '7 days' },
        ],
      }}
    />
  );
}
