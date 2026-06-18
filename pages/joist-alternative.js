import SeoLanding from '../components/SeoLanding';

export default function JoistAlternative() {
  return (
    <SeoLanding
      title="Joist Alternative for Contractors | MyForeman"
      description="A Joist alternative that's a full business OS. MyForeman gives you quotes plus scheduling, jobs, customers, online payments, and AI insights from $39/mo. Free 14-day trial."
      canonicalPath="/joist-alternative"
      heroEyebrow="Joist Alternative"
      h1="More than estimates."
      h1Highlight="Run the whole business."
      heroSub="Joist is great for sending a quick estimate. But if you also need to schedule the job, track the customer, send the invoice, and see what's making you money, MyForeman is the upgrade."
      features={[
        { title: 'Estimates + everything else', body: 'Send quotes like you do today, plus jobs, customers, scheduling, invoicing, and payments — all in one app.' },
        { title: 'Online card payments', body: 'Stripe-powered card payments at standard rates. Customer pays online, invoice auto-marks paid.' },
        { title: 'Scheduling calendar', body: 'Drag-and-drop jobs across the week. Multi-day jobs and recurring service handled.' },
        { title: 'Customer database', body: 'Every customer\'s history — quotes, jobs, invoices, payments — in one timeline.' },
        { title: 'AI business insights', body: 'Plain-English answers about your numbers — which jobs make money, which customers pay late.' },
        { title: 'Mobile-first design', body: 'Built for the truck. Every feature works on a phone without compromise.' },
      ]}
      comparison={{
        competitor: 'Joist',
        rows: [
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Invoicing',                           mf: 'Included',     them: 'Included' },
          { feature: 'Scheduling calendar',                 mf: 'Included',     them: 'Not included' },
          { feature: 'Job / work order tracking',           mf: 'Included',     them: 'Limited' },
          { feature: 'Customer database',                   mf: 'Included',     them: 'Basic' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Higher tier' },
          { feature: 'Recurring jobs / billing',            mf: 'Included',     them: 'Not included' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Not included' },
          { feature: 'Free trial',                          mf: '14 days',      them: 'Free tier available' },
        ],
      }}
    />
  );
}
