import SeoLanding from '../components/SeoLanding';

export default function WorkizAlternative() {
  return (
    <SeoLanding
      title="Workiz Alternative for Field Service Pros | MyForeman"
      description="A Workiz alternative with simpler pricing, every feature included from $39/mo, and AI business insights built in. Free 14-day trial, no demo call required."
      canonicalPath="/workiz-alternative"
      heroEyebrow="Workiz Alternative"
      h1="A cleaner alternative"
      h1Highlight="to Workiz."
      heroSub="Same core field-service workflow — call inbox, scheduling, quoting, invoicing, payments — with flatter pricing, AI insights included, and a self-serve signup that doesn't require a sales call."
      features={[
        { title: 'Self-serve signup', body: 'Sign up, start the 14-day trial, decide for yourself. No demo gate, no quote request.' },
        { title: 'All features, all plans', body: 'AI insights, customer portal, recurring jobs, and online payments are all included from $39/mo. Nothing locked behind enterprise tiers.' },
        { title: 'Mobile-first workflow', body: 'Built for contractors running the business from a truck. Every feature works on a phone, not just a downsized desktop layout.' },
        { title: 'AI business insights', body: 'Plain-English answers about your numbers — which jobs make money, which customers pay late, where your revenue is leaking.' },
        { title: 'Stripe-powered payments', body: 'Card payments at standard processing rates. Invoices auto-mark paid. Venmo, Zelle, Cash App, and check supported too.' },
        { title: 'Fast onboarding', body: 'CSV-import customers and jobs during signup. Be running the business by tomorrow.' },
      ]}
      comparison={{
        competitor: 'Workiz',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '~$65/mo' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo recommended' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Higher tier' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Customer self-service portal',        mf: 'Included',     them: 'Higher tier' },
          { feature: 'Recurring jobs / billing',            mf: 'Included',     them: 'Included' },
          { feature: 'CSV import / data migration',         mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: '7 days' },
        ],
      }}
    />
  );
}
