import SeoLanding from '../components/SeoLanding';

export default function JunkRemovalSoftware() {
  return (
    <SeoLanding
      title="Junk Removal Software for Haul-Away Crews | MyForeman"
      description="Junk removal software for residential and commercial haul-away. Same-day scheduling, on-site quoting by volume, instant invoicing, and crew dispatch. Free 14-day trial."
      canonicalPath="/junk-removal-software"
      heroEyebrow="Junk Removal Software"
      h1="Junk removal software"
      h1Highlight="from call to dump."
      heroSub="Same-day calls, full-truck loads, single-item pickups, estate cleanouts. Quote by volume, dispatch the crew, invoice on the way back from the transfer station."
      features={[
        { title: 'Same-day dispatch', body: 'Customer calls about a couch or a whole basement. Drop it on the schedule, the crew gets the address and access notes.' },
        { title: 'Quote by volume', body: 'Reusable line items for quarter-load, half-load, full-load, single items, mattresses. Quote signed before the gate opens.' },
        { title: 'Photo job records', body: 'Snap before / after photos, attach to the customer record. Best marketing tool you have.' },
        { title: 'On-site card payments', body: 'Stripe-powered payments at the truck. Invoice auto-marks paid the moment funds land. Cash and digital wallets supported too.' },
        { title: 'Commercial accounts', body: 'Track ongoing PO\'d work for property managers, real-estate agents, and contractors who call you again and again.' },
        { title: 'AI business insights', body: 'See your highest-margin call types, best repeat customers, and revenue trends by week.' },
      ]}
    />
  );
}
