import SeoLanding from '../components/SeoLanding';

export default function PoolServiceSoftware() {
  return (
    <SeoLanding
      title="Pool Service Software for Cleaning & Maintenance | MyForeman"
      description="Pool service software for weekly cleaning routes, equipment repairs, and chemical service. Route scheduling, recurring billing, customer history. Free 14-day trial."
      canonicalPath="/pool-service-software"
      heroEyebrow="Pool Service Software"
      h1="Pool service software"
      h1Highlight="for the weekly route."
      heroSub="Cleaning, chemicals, equipment repairs, openings and closings. Route your week, bill the recurring customers, log every reading, without a stack of paper logs."
      features={[
        { title: 'Recurring route plans', body: 'Weekly or bi-weekly cleaning routes auto-generate the work orders, notify the customer, and invoice on the cadence you set.' },
        { title: 'Chemical & reading log', body: 'Log chlorine, pH, alkalinity, and every chemical added. Stays attached to the customer history.' },
        { title: 'Equipment & repair tracking', body: 'Service calls for pumps, filters, heaters. Quote on site, schedule the repair, and re-bill if it comes back.' },
        { title: 'Route-day scheduling', body: 'See the day on a map. Customer gets an automated heads-up the morning of and an "On My Way" text when you depart.' },
        { title: 'Recurring billing', body: 'Card-on-file monthly billing through Stripe. Invoices auto-mark paid. Manual methods supported too.' },
        { title: 'AI business insights', body: 'See your most profitable routes, customers due for an equipment check, and accounts behind on payment.' },
      ]}
    />
  );
}
