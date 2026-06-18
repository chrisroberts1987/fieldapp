import SeoLanding from '../components/SeoLanding';

export default function InvoiceSimpleAlternative() {
  return (
    <SeoLanding
      title="Invoice Simple Alternative for Contractors | MyForeman"
      description="An Invoice Simple alternative that's a full business OS. MyForeman gives you invoicing plus scheduling, quotes, customers, AI insights, and online payments from $39/mo. Free 14-day trial."
      canonicalPath="/invoice-simple-alternative"
      heroEyebrow="Invoice Simple Alternative"
      h1="More than invoices."
      h1Highlight="Run the whole business."
      heroSub="Invoice Simple is great for sending an invoice. But if you also need to schedule the job, track the customer, send the quote, and see what's making you money, MyForeman is the upgrade."
      features={[
        { title: 'Invoicing, but more', body: 'Send invoices like you do today, plus quoting, scheduling, jobs, customers, and payments — in one app.' },
        { title: 'Online card payments', body: 'Stripe-powered card payments at standard rates. Customer pays online, invoice auto-marks paid.' },
        { title: 'Customer database', body: 'Every customer\'s job history, invoices, and payments live in one timeline. No spreadsheets to maintain.' },
        { title: 'Quotes & estimates', body: 'Build a quote in two minutes, send for digital signature, convert to a job with one tap.' },
        { title: 'Scheduling calendar', body: 'See your week at a glance. Drag-and-drop jobs across days.' },
        { title: 'AI business insights', body: 'Plain-English answers about which jobs make you money and which customers pay late.' },
      ]}
      comparison={{
        competitor: 'Invoice Simple',
        rows: [
          { feature: 'Invoicing',                           mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Limited' },
          { feature: 'Scheduling calendar',                 mf: 'Included',     them: 'Not included' },
          { feature: 'Job / work order tracking',           mf: 'Included',     them: 'Not included' },
          { feature: 'Customer database',                   mf: 'Included',     them: 'Basic' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Recurring jobs / billing',            mf: 'Included',     them: 'Not included' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Not included' },
          { feature: 'Mobile + web app',                    mf: 'Included',     them: 'Included' },
        ],
      }}
    />
  );
}
