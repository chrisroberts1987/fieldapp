import SeoLanding from '../components/SeoLanding';

const TRADES = [
  { label:'HVAC',                href:'/hvac-software',                  title:'HVAC contractors',          body:'Install, maintenance, and repair calls scheduled, quoted, and invoiced from one app.' },
  { label:'Plumbing',            href:'/plumbing-software',              title:'Plumbing businesses',       body:'Service-call dispatch, on-site quoting, and same-day invoicing for plumbers.' },
  { label:'Electrical',          href:'/electrical-contractor-software', title:'Electrical contractors',    body:'Crew scheduling, change orders, and permit tracking for electrical contractors.' },
  { label:'Handyman',            href:'/handyman-software',              title:'Handyman pros',             body:'Fast bookings, quick quotes, and instant invoicing for solo handymen and small crews.' },
  { label:'Landscaping',         href:'/landscaping-software',           title:'Landscaping crews',         body:'Recurring jobs, route-friendly scheduling, and seasonal billing for lawn and yard work.' },
  { label:'Roofing',             href:'/roofing-software',               title:'Roofing contractors',       body:'Quote on the truck, schedule the crew, and document the project from tear-off to final.' },
  { label:'Painting',            href:'/painting-contractor-software',   title:'Painting contractors',      body:'Room-by-room estimates, color logs, and deposit-to-balance invoicing.' },
  { label:'Pressure Washing',    href:'/pressure-washing-software',      title:'Pressure washing pros',     body:'On-site quotes, route-day scheduling, and seasonal re-booking — all from your phone.' },
  { label:'Pest Control',        href:'/pest-control-software',          title:'Pest control operators',    body:'Recurring service plans, treatment logs, and route-day scheduling for small operators.' },
  { label:'Pool Service',        href:'/pool-service-software',          title:'Pool service businesses',   body:'Weekly route plans, chemical readings, and recurring billing for pool maintenance.' },
  { label:'Garage Door',         href:'/garage-door-software',           title:'Garage door pros',          body:'Service-call dispatch, on-site quoting, and warranty docs for garage door techs.' },
  { label:'Locksmith',           href:'/locksmith-software',             title:'Locksmith businesses',      body:'Mobile dispatch, on-site quoting, and customer key history for locksmiths.' },
  { label:'Carpet Cleaning',     href:'/carpet-cleaning-software',       title:'Carpet cleaning pros',      body:'Room-based quoting, route scheduling, and re-book reminders for cleaning crews.' },
  { label:'Appliance Repair',    href:'/appliance-repair-software',      title:'Appliance repair techs',    body:'Service-call dispatch, parts tracking, and warranty-vs-billable separation.' },
  { label:'Window Cleaning',     href:'/window-cleaning-software',       title:'Window cleaning pros',      body:'Recurring service, pane-based quoting, and route-day scheduling for residential & commercial.' },
  { label:'Chimney Sweep',       href:'/chimney-sweep-software',         title:'Chimney sweeps',            body:'Seasonal scheduling, inspection photos, and annual re-book reminders.' },
  { label:'Junk Removal',        href:'/junk-removal-software',          title:'Junk removal crews',        body:'Same-day dispatch, volume-based quoting, and on-site card payments for haul-away work.' },
  { label:'Moving Company',      href:'/moving-company-software',        title:'Local moving companies',    body:'Truck & crew scheduling, hourly + flat-rate quoting, and damage-claim photos.' },
  { label:'Flooring',            href:'/flooring-contractor-software',   title:'Flooring contractors',      body:'Room-by-room quoting, multi-day install scheduling, and material job costing.' },
  { label:'Fencing',             href:'/fencing-contractor-software',    title:'Fencing contractors',       body:'Linear-foot quoting, permit tracking, and multi-day crew scheduling.' },
];

export default function ContractorSoftware() {
  return (
    <SeoLanding
      title="Contractor Software for Field Service Businesses | MyForeman"
      description="The all-in-one contractor software for invoicing, scheduling, quotes, and AI-powered business insights. Built for HVAC, plumbing, electrical, handyman, landscaping, roofing, and 20+ field service trades. Free 14-day trial."
      canonicalPath="/contractor-software"
      heroEyebrow="Contractor Software"
      h1="One app to run"
      h1Highlight="your entire contracting business."
      heroSub="Leads, estimates, scheduling, jobs, invoices, payments, and AI insights — all in one place. Built for the trades, priced for the field, with every feature included from $39/mo."
      features={[
        { title: 'Lead capture & follow-up', body: 'Every call, web form, and referral lands in one inbox. Stop losing money to lost sticky notes.' },
        { title: 'Quotes & estimates', body: 'Build professional quotes in two minutes, send for digital signature, and convert to a job with one tap.' },
        { title: 'Drag-and-drop scheduling', body: 'See your week at a glance. Multi-day jobs, recurring service, crew assignments — all in one calendar.' },
        { title: 'On-the-job mobile workflow', body: 'Clock in, document the work, capture customer signatures, and close out the job from your phone.' },
        { title: 'Invoices that get paid', body: 'Auto-bill after the job. Stripe-powered card payments mark invoices paid instantly. Manual methods supported.' },
        { title: 'AI business insights', body: 'Plain-English answers about which jobs make you money, which customers pay late, and where to grow.' },
      ]}
      trades={TRADES}
    />
  );
}
