import SeoLanding from '../components/SeoLanding';

export default function MovingCompanySoftware() {
  return (
    <SeoLanding
      title="Moving Company Software for Local Movers | MyForeman"
      description="Moving company software for local movers and packing crews. Quote by hour or weight, schedule trucks and crews, take card payments, and re-book repeat clients. Free 14-day trial."
      canonicalPath="/moving-company-software"
      heroEyebrow="Moving Company Software"
      h1="Moving company software"
      h1Highlight="for the local route."
      heroSub="Local moves, packing services, labor-only loading, single-item shuttles. Quote the job, schedule the truck and crew, invoice on completion, and keep the calendar full."
      features={[
        { title: 'Truck & crew scheduling', body: 'Assign trucks and movers to jobs. Multi-day moves and back-to-back same-day jobs handled on one calendar.' },
        { title: 'Hourly + flat-rate quoting', body: 'Quote by hour, by weight, by volume, or a flat-rate per move. Reusable line items keep it fast.' },
        { title: 'Customer ETA & "On My Way"', body: 'Customer gets a heads-up the morning of and a live "On My Way" text when the crew leaves the yard.' },
        { title: 'Inventory & damage photos', body: 'Document furniture and boxes with photos at pickup. Protects you on damage claims.' },
        { title: 'Card payments + manual methods', body: 'Stripe-powered card payments at the door auto-mark invoices paid. Check, Venmo, Zelle, Cash App all supported.' },
        { title: 'AI business insights', body: 'See your most profitable move types, busiest weekends, and customers due for follow-up.' },
      ]}
    />
  );
}
