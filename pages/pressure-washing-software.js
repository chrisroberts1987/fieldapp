import SeoLanding from '../components/SeoLanding';

export default function PressureWashingSoftware() {
  return (
    <SeoLanding
      title="Pressure Washing Software | MyForeman"
      description="Pressure washing software for soft-wash and power-wash contractors. Quote on site, route your day, take card payments, and re-book seasonal customers automatically. Free 14-day trial."
      canonicalPath="/pressure-washing-software"
      heroEyebrow="Pressure Washing Software"
      h1="Pressure washing"
      h1Highlight="run from your phone."
      heroSub="Houses, driveways, decks, concrete, soft-wash roofs. Quote in 60 seconds, route your day, invoice on completion, and re-book seasonal customers without lifting a finger."
      features={[
        { title: 'On-site quotes', body: 'Square footage, surface type, soft-wash vs power-wash, priced and sent for signature in under a minute.' },
        { title: 'Route-friendly scheduling', body: 'See the day on a map. Move a job, the customer gets the updated ETA automatically.' },
        { title: 'Seasonal re-booking', body: 'Recurring plans for spring driveways, fall siding, and yearly roof soft-washes. The system reminds the customer when it is time.' },
        { title: 'Invoice on completion', body: 'Take card payments on site through Stripe. Invoice auto-marks paid. Venmo, Zelle, Cash App, and check all supported.' },
        { title: 'Before & after photos', body: 'Snap the dirty, snap the clean, and the customer sees both on their invoice. Best marketing tool you have.' },
        { title: 'AI business insights', body: 'See which job types pay best, which customers are due for a re-clean, and how your average ticket trends.' },
      ]}
    />
  );
}
