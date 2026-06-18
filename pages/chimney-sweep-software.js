import SeoLanding from '../components/SeoLanding';

export default function ChimneySweepSoftware() {
  return (
    <SeoLanding
      title="Chimney Sweep Software for Service Pros | MyForeman"
      description="Chimney sweep and inspection software. Seasonal scheduling, on-site quoting, inspection photos, and same-day invoicing. Built for chimney pros. Free 14-day trial."
      canonicalPath="/chimney-sweep-software"
      heroEyebrow="Chimney Sweep Software"
      h1="Chimney sweep software"
      h1Highlight="for a busy season."
      heroSub="Sweeps, inspections, cap and damper installs, masonry repairs. Schedule the fall rush, document every chimney with photos, and bill on completion."
      features={[
        { title: 'Seasonal scheduling', body: 'Book out the fall and winter on one calendar. Move jobs, the customer gets the updated ETA automatically.' },
        { title: 'Inspection photo records', body: 'Snap photos of the flue, crown, damper, and cap. Attach to the customer record for warranty and insurance follow-ups.' },
        { title: 'On-site quoting', body: 'Sweep + inspection priced and signed before you set up. Add-ons like cap installs and waterproofing in two taps.' },
        { title: 'Annual reminders', body: 'Customer gets a polite "time for your annual sweep?" reminder. Easy recurring revenue every fall.' },
        { title: 'Same-day invoicing', body: 'Card payments through Stripe auto-mark paid. Check, Venmo, and Zelle supported too.' },
        { title: 'AI business insights', body: 'See your most profitable services, accounts due for next year, and revenue trends across the season.' },
      ]}
    />
  );
}
