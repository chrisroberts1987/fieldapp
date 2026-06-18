import SeoLanding from '../components/SeoLanding';

export default function ServiceTitanAlternative() {
  return (
    <SeoLanding
      title="ServiceTitan Alternative for Small Contractors | MyForeman"
      description="A ServiceTitan alternative built for small and growing contractors. All features included from $39/mo, no minimums, no annual contracts, no enterprise sales call. Free 14-day trial."
      canonicalPath="/servicetitan-alternative"
      heroEyebrow="ServiceTitan Alternative"
      h1="A small-business alternative"
      h1Highlight="to ServiceTitan."
      heroSub="ServiceTitan is built for the enterprise field-service company with a dispatch desk and a CFO. MyForeman is built for the contractor running the business from a truck — same workflow concepts, none of the overhead."
      features={[
        { title: 'No annual contract', body: 'Month-to-month. Cancel from settings. No minimum-seat commitments, no enterprise sales process.' },
        { title: 'Transparent self-serve pricing', body: 'See the price online. Sign up, start the trial, decide for yourself. No "request a quote" gate.' },
        { title: 'Built for solo & small crew', body: 'You don\'t need a dispatcher to use it. The whole app works from your phone.' },
        { title: 'AI business insights', body: 'Plain-English answers about your numbers. Which jobs are profitable, what to charge, who pays late.' },
        { title: 'Same core workflow', body: 'Leads, scheduling, dispatching, on-site work, invoicing, and payments. Without the enterprise feature bloat you\'d never turn on.' },
        { title: 'Fast onboarding', body: 'CSV-import customers and jobs. Be live by tomorrow, not next quarter.' },
      ]}
      comparison={{
        competitor: 'ServiceTitan',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: 'Custom quote' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo required' },
          { feature: 'Contract length',                     mf: 'Month-to-month', them: 'Annual' },
          { feature: 'Minimum users / seats',               mf: 'None',         them: 'Minimums apply' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Add-on' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: 'Demo only' },
          { feature: 'Setup time',                          mf: 'Same day',     them: 'Weeks' },
        ],
      }}
    />
  );
}
