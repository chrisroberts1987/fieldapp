import SeoLanding from '../components/SeoLanding';

const COMPETITORS = [
  { label:'Jobber',         href:'/jobber-alternative',         title:'MyForeman vs Jobber',         body:'Same scheduling and invoicing workflow without the tiered feature paywalls. Every feature included from $39/mo.' },
  { label:'Housecall Pro',  href:'/housecall-pro-alternative',  title:'MyForeman vs Housecall Pro',  body:'A leaner alternative that does not gate AI insights, recurring jobs, or customer portal behind higher tiers.' },
  { label:'ServiceTitan',   href:'/servicetitan-alternative',   title:'MyForeman vs ServiceTitan',   body:'For contractors who do not need an enterprise dispatch desk. Month-to-month pricing, no minimums.' },
  { label:'Invoice Simple', href:'/invoice-simple-alternative', title:'MyForeman vs Invoice Simple', body:'Invoicing plus scheduling, jobs, customers, and AI insights. The next step up when invoicing is not enough.' },
  { label:'FieldPulse',     href:'/fieldpulse-alternative',     title:'MyForeman vs FieldPulse',     body:'A cleaner mobile experience, AI insights included on every plan, self-serve signup. Same field-service workflow.' },
  { label:'Workiz',         href:'/workiz-alternative',         title:'MyForeman vs Workiz',         body:'Same core call-to-invoice workflow with flatter pricing and AI insights included on every plan.' },
  { label:'RazorSync',      href:'/razorsync-alternative',      title:'MyForeman vs RazorSync',      body:'No minimum seats, self-serve signup, AI insights included. Built for solo contractors and small crews.' },
  { label:'Service Fusion', href:'/service-fusion-alternative', title:'MyForeman vs Service Fusion', body:'Month-to-month pricing, AI insights included, no demo required to sign up.' },
  { label:'Joist',          href:'/joist-alternative',          title:'MyForeman vs Joist',          body:'Estimates plus the rest of the business. Scheduling, customers, jobs, invoicing, and payments in one app.' },
];

export default function Compare() {
  return (
    <SeoLanding
      title="MyForeman vs Other Contractor Software | Comparison"
      description="See how MyForeman compares to Jobber, Housecall Pro, ServiceTitan, FieldPulse, Workiz, and other contractor and field-service software platforms. Honest, factual comparisons. Free 14-day trial."
      canonicalPath="/compare"
      heroEyebrow="Honest Comparisons"
      h1="How MyForeman compares"
      h1Highlight="to the other guys."
      heroSub="Same core workflow as most field-service platforms, with flatter pricing, AI insights included from $39/mo, and a self-serve signup. Here is how we stack up against the platforms you have probably already evaluated."
      features={[
        { title: 'All features, all plans', body: 'AI insights, customer portal, recurring jobs, online payments, and quoting all included from the entry plan. No "upgrade to unlock" gates.' },
        { title: 'Self-serve signup', body: 'No demo call required. Start the free 14-day trial in minutes, cancel from settings if it is not for you.' },
        { title: 'Month-to-month pricing', body: 'No annual contracts, no minimum seats. Pay monthly, cancel anytime.' },
        { title: 'AI business insights', body: 'Plain-English answers about your business numbers. Built in, not an add-on.' },
        { title: 'Mobile-first interface', body: 'Built for contractors who run the business from a phone, not a back office.' },
        { title: 'Honest, factual claims', body: 'Comparison pages reflect publicly listed pricing and feature availability. We do not trash competitors; we just show our positioning.' },
      ]}
      trades={COMPETITORS}
    />
  );
}
