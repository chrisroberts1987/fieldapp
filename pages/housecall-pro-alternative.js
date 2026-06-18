import SeoLanding from '../components/SeoLanding';

export default function HousecallProAlternative() {
  return (
    <SeoLanding
      title="Housecall Pro Alternative for Contractors | MyForeman"
      description="A Housecall Pro alternative without the tiered pricing. MyForeman includes scheduling, invoicing, online payments, and AI insights from $39/mo. Free 14-day trial."
      canonicalPath="/housecall-pro-alternative"
      heroEyebrow="Housecall Pro Alternative"
      h1="A leaner alternative"
      h1Highlight="to Housecall Pro."
      heroSub="If you've outgrown Housecall Pro's starter plan but don't want to jump to a four-figure monthly bill for features you need, MyForeman gives you the whole feature set from $39/mo."
      features={[
        { title: 'No feature paywalls', body: 'AI insights, customer portal, recurring jobs, online payments, and quotes are all included from the entry plan.' },
        { title: 'Built for solo & small crew', body: 'Doesn\'t assume you have an office manager. The whole app works from your phone, in the truck.' },
        { title: 'AI business insights', body: 'Plain-English answers about your business. Which jobs make money, which customers pay late, what to focus on.' },
        { title: 'Card payments included', body: 'Stripe-powered payments at standard card-processing rates. Customer pays, invoice auto-marks paid. No upcharge for the feature itself.' },
        { title: 'Multi-trade ready', body: 'HVAC, plumbing, electrical, handyman, landscaping, roofing. The workflow adapts to your trade without configuration.' },
        { title: 'Straightforward signup', body: 'Self-serve. No demo call required. Free 14-day trial, cancel from settings anytime.' },
      ]}
      comparison={{
        competitor: 'Housecall Pro',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '$65/mo (Basic)' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Higher tier' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Recurring service plans',             mf: 'Included',     them: 'Higher tier' },
          { feature: 'Customer self-service portal',        mf: 'Included',     them: 'Higher tier' },
          { feature: 'Crew GPS / employee tracking',        mf: 'Optional',     them: 'Higher tier' },
          { feature: 'Free trial',                          mf: '14 days',      them: '14 days' },
          { feature: 'Self-serve signup',                   mf: 'Yes',          them: 'Demo required' },
        ],
      }}
    />
  );
}
