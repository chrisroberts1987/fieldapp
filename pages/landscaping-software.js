import SeoLanding from '../components/SeoLanding';

export default function LandscapingSoftware() {
  return (
    <SeoLanding
      title="Landscaping Software for Lawn & Yard Crews | MyForeman"
      description="Landscaping software for lawn care, yard work, and full-service crews. Recurring jobs, route scheduling, digital quotes, and instant invoicing. Free 14-day trial."
      canonicalPath="/landscaping-software"
      heroEyebrow="Landscaping Software"
      h1="Landscaping software"
      h1Highlight="built for the season."
      heroSub="From weekly mows to spring cleanups and full installs. Route your crews, send the quotes, bill the recurring customers — without losing a Sunday to admin."
      features={[
        { title: 'Recurring job plans', body: 'Set up weekly, bi-weekly, or monthly maintenance schedules once. The system creates the work orders, sends the reminders, and invoices on the cadence you set.' },
        { title: 'Route-friendly scheduling', body: 'See the whole week on one calendar. Move a job, the customer gets the updated ETA automatically.' },
        { title: 'Seasonal estimates', body: 'Quote for spring cleanup, mulch installs, irrigation startups, fall leaf removal. Send for digital signature in two taps.' },
        { title: 'Recurring billing', body: 'Auto-invoice your maintenance customers monthly. Card on file, auto-marked paid. Manual methods (check, Venmo, Zelle) also supported.' },
        { title: 'Crew time & assignments', body: 'Assign trucks and crews. Crew members clock in from the job site on their phone.' },
        { title: 'AI business insights', body: 'See your most profitable services, customers due for an upsell, and accounts behind on payment.' },
      ]}
    />
  );
}
