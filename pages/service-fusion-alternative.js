import SeoLanding from '../components/SeoLanding';

export default function ServiceFusionAlternative() {
  return (
    <SeoLanding
      title="Service Fusion Alternative for Contractors | MyForeman"
      description="A Service Fusion alternative with month-to-month pricing, AI insights included, and self-serve signup from $39/mo. Built for small contractors. Free 14-day trial."
      canonicalPath="/service-fusion-alternative"
      heroEyebrow="Service Fusion Alternative"
      h1="A simpler alternative"
      h1Highlight="to Service Fusion."
      heroSub="Same core dispatch-and-invoice workflow with month-to-month pricing, AI insights included, and a signup flow that doesn't require a sales call. Built for the contractor who wants a phone-first experience."
      features={[
        { title: 'Month-to-month pricing', body: 'No annual contracts, no minimum commitments. Cancel from settings anytime.' },
        { title: 'Self-serve signup', body: 'Start the trial in minutes. No demo gate.' },
        { title: 'AI business insights', body: 'Plain-English answers about your business — included on every plan.' },
        { title: 'Stripe-powered card payments', body: 'Invoices auto-mark paid when funds land. Venmo, Zelle, Cash App, and check supported too.' },
        { title: 'Mobile-first workflow', body: 'Designed for contractors running the business from a phone.' },
        { title: 'Same-day migration', body: 'CSV-import customers and jobs during signup. Be live by tomorrow.' },
      ]}
      comparison={{
        competitor: 'Service Fusion',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '~$165/mo' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo recommended' },
          { feature: 'Contract length',                     mf: 'Month-to-month', them: 'Annual common' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Not included' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Customer portal',                     mf: 'Included',     them: 'Included' },
          { feature: 'CSV import / data migration',         mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: 'Demo only' },
        ],
      }}
    />
  );
}
