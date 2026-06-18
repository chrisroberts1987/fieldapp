import SeoLanding from '../components/SeoLanding';

export default function WindowCleaningSoftware() {
  return (
    <SeoLanding
      title="Window Cleaning Software for Residential & Commercial | MyForeman"
      description="Window cleaning software for residential routes and commercial accounts. Recurring service, on-site quoting, route scheduling, and instant invoicing. Free 14-day trial."
      canonicalPath="/window-cleaning-software"
      heroEyebrow="Window Cleaning Software"
      h1="Window cleaning"
      h1Highlight="run from the route."
      heroSub="Residential routes, commercial accounts, screen cleaning, hard-water removal. Quote on site, route the day, and bill the recurring customers without thinking about it."
      features={[
        { title: 'Recurring service plans', body: 'Monthly, quarterly, or biannual cleans. The system creates the work orders, reminds the customer, and bills on the cadence you set.' },
        { title: 'Pane / window counting', body: 'Quote by pane, story, or square foot. Reusable line items keep the math out of the conversation.' },
        { title: 'Route-day scheduling', body: 'See the day on a map. Move a job, the customer gets the updated ETA automatically.' },
        { title: 'Commercial accounts', body: 'Track ongoing contracts and PO numbers for office buildings, storefronts, and property managers.' },
        { title: 'Card payments', body: 'Stripe-powered card payments mark invoices paid the moment funds land. Check, Venmo, and Zelle supported too.' },
        { title: 'AI business insights', body: 'See your highest-margin services, accounts due for follow-up, and revenue trends by month.' },
      ]}
    />
  );
}
