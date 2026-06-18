import SeoLanding from '../components/SeoLanding';

export default function CarpetCleaningSoftware() {
  return (
    <SeoLanding
      title="Carpet Cleaning Software for Service Pros | MyForeman"
      description="Carpet cleaning software for residential and commercial pros. Quote by the room, route the day, invoice on completion, and re-book repeat customers automatically. Free 14-day trial."
      canonicalPath="/carpet-cleaning-software"
      heroEyebrow="Carpet Cleaning Software"
      h1="Carpet cleaning"
      h1Highlight="from booking to re-book."
      heroSub="Steam, encapsulation, upholstery, tile and grout, commercial accounts. Route the day, invoice on completion, and automatically remind the customer when it's time for the next cleaning."
      features={[
        { title: 'On-site quoting', body: 'Price by room, square foot, or stairs in under a minute. Send for digital signature before you set up the van.' },
        { title: 'Route-friendly scheduling', body: 'See the day on a map. Move a job and the customer gets the updated ETA automatically.' },
        { title: 'Add-on services', body: 'Reusable line items for protectant, deodorizer, pet treatment. Upsell at the door instead of after the fact.' },
        { title: 'Re-book reminders', body: 'Customer gets a polite "time for your next clean?" reminder on a cadence you set. Free recurring revenue.' },
        { title: 'Card payments + manual methods', body: 'Stripe-powered card payments mark invoices paid automatically. Cash, check, Venmo, and Zelle supported too.' },
        { title: 'AI business insights', body: 'See your highest-margin jobs, busiest months, and customers due for a follow-up clean.' },
      ]}
    />
  );
}
