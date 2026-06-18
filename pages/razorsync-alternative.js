import SeoLanding from '../components/SeoLanding';

export default function RazorSyncAlternative() {
  return (
    <SeoLanding
      title="RazorSync Alternative for Field Service | MyForeman"
      description="A RazorSync alternative with self-serve signup, AI insights included, and every feature from $39/mo. Built for solo contractors and small crews. Free 14-day trial."
      canonicalPath="/razorsync-alternative"
      heroEyebrow="RazorSync Alternative"
      h1="A modern alternative"
      h1Highlight="to RazorSync."
      heroSub="The field-service workflow you'd expect, from dispatch to schedule to quote to invoice to get paid, with a phone-first interface, AI insights included, and no minimum-user commitments."
      features={[
        { title: 'Self-serve signup', body: 'Start the 14-day trial in minutes. No demo call required.' },
        { title: 'No minimum seats', body: 'Solo plan from $39/mo. Add Crew or Business plans as you grow. No "minimum 3 users" gotchas.' },
        { title: 'AI business insights', body: 'Plain-English answers about your business numbers, built into every plan.' },
        { title: 'Card + manual payments', body: 'Stripe-powered card payments auto-mark invoices paid. Venmo, Zelle, Cash App, and check all supported.' },
        { title: 'Mobile-first design', body: 'Built for contractors running the business from the field. Every feature works on a phone.' },
        { title: 'CSV migration', body: 'Import customers, jobs, and invoices during signup. Be running by tomorrow.' },
      ]}
      comparison={{
        competitor: 'RazorSync',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '~$85/mo' },
          { feature: 'Minimum users',                       mf: 'None',         them: 'Minimums apply' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo recommended' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Not included' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Customer portal',                     mf: 'Included',     them: 'Higher tier' },
          { feature: 'CSV import / data migration',         mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: '14 days' },
        ],
      }}
    />
  );
}
