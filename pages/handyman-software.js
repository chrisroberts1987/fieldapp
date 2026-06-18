import SeoLanding from '../components/SeoLanding';

export default function HandymanSoftware() {
  return (
    <SeoLanding
      title="Handyman Software for Solo & Small Crews | MyForeman"
      description="Handyman business software for solos and small crews. Take a call, drop the job on the schedule, send the invoice, and get paid. From $39/mo. Free 14-day trial."
      canonicalPath="/handyman-software"
      heroEyebrow="Handyman Software"
      h1="Handyman software that"
      h1Highlight="doesn't get in your way."
      heroSub="From a quick faucet swap to a full kitchen punch-list. Everything you need to book the job, do the work, and get paid, in one app, on your phone."
      features={[
        { title: 'Fast job booking', body: 'Take the call, drop the customer details on the calendar, set the price, done. No 20-field forms.' },
        { title: 'Photo job records', body: 'Snap before and after photos, attach them to the job, and the customer sees them on their invoice. Proof of work without the hassle.' },
        { title: 'Quick estimates', body: 'Type up a quote in 60 seconds, send it from your phone, customer signs and approves. Move on.' },
        { title: 'Invoice in seconds', body: 'Hit "send invoice" when the job is done. Customer pays by card, Venmo, Zelle, Cash App, or check. Auto-marked paid for Stripe payments.' },
        { title: 'Mileage tracking', body: 'Logs your drives between jobs for the tax deduction. No more guessing in April.' },
        { title: 'AI business insights', body: 'Plain-English answers about which jobs make you money, which customers pay late, and what to charge.' },
      ]}
    />
  );
}
