import SeoLanding from '../components/SeoLanding';

export default function PlumbingSoftware() {
  return (
    <SeoLanding
      title="Plumbing Software for Contractors | MyForeman"
      description="Plumbing business software for service calls, repairs, and remodels. Schedule jobs, send estimates, invoice on site, accept card payments, and track every drain. Free 14-day trial."
      canonicalPath="/plumbing-software"
      heroEyebrow="Plumbing Software"
      h1="Plumbing software that"
      h1Highlight="works as hard as you do."
      heroSub="Emergency calls, repipes, water heater installs, drain cleaning — every job priced, scheduled, and invoiced from your phone. No more clipboards or end-of-week paperwork."
      features={[
        { title: 'Service-call dispatch', body: 'Take a call, drop it on the schedule, and route the closest plumber. Customer gets an automated "On My Way" text with ETA.' },
        { title: 'On-site quoting', body: 'Price a repair or replacement on the truck. Customer signs and approves on your phone before you start the work.' },
        { title: 'Same-day invoicing', body: 'Send the invoice before you leave the job site. Stripe-powered card payments mark it paid automatically when the customer taps to pay.' },
        { title: 'Emergency-call workflow', body: 'After-hours service requests come in through your customer portal with priority flags so nothing slips overnight.' },
        { title: 'Job photos & signatures', body: 'Document the before/after, capture customer signatures, and attach everything to the job record for warranty disputes.' },
        { title: 'AI business insights', body: 'See which call types make money, your average ticket by service, and which customers are due for follow-up. No spreadsheets needed.' },
      ]}
    />
  );
}
