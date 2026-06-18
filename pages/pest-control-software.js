import SeoLanding from '../components/SeoLanding';

export default function PestControlSoftware() {
  return (
    <SeoLanding
      title="Pest Control Software for Small Operators | MyForeman"
      description="Pest control software for solo operators and small crews. Recurring service plans, route scheduling, instant invoicing, and customer history. Free 14-day trial."
      canonicalPath="/pest-control-software"
      heroEyebrow="Pest Control Software"
      h1="Pest control software"
      h1Highlight="built for the route."
      heroSub="Monthly, quarterly, and one-off service calls. Track treatments, schedule the route, invoice on completion, and keep every customer history a tap away."
      features={[
        { title: 'Recurring service plans', body: 'Monthly, quarterly, or annual treatments. Auto-generated work orders, customer reminders, and recurring invoices on the cadence you set.' },
        { title: 'Route-day scheduling', body: 'Lay out your stops for the day. Customer gets an automated heads-up the morning of and an "On My Way" text when you depart.' },
        { title: 'Treatment & product log', body: 'Log every product applied with quantity, location, and notes. Stays attached to the customer history for compliance and follow-ups.' },
        { title: 'Customer history at a glance', body: 'Open the customer record and see every visit, every treatment, and every invoice in one timeline.' },
        { title: 'Invoicing & auto-billing', body: 'Card-on-file recurring billing through Stripe — invoices auto-mark paid. Check and digital wallets supported too.' },
        { title: 'AI business insights', body: 'See your most profitable service plans, customers due for renewal, and accounts behind on payment.' },
      ]}
    />
  );
}
