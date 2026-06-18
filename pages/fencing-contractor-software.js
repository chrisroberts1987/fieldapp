import SeoLanding from '../components/SeoLanding';

export default function FencingContractorSoftware() {
  return (
    <SeoLanding
      title="Fencing Contractor Software | MyForeman"
      description="Fencing contractor software for installs, repairs, and gate work. Quote by linear foot, schedule crews for multi-day jobs, and invoice on completion. Free 14-day trial."
      canonicalPath="/fencing-contractor-software"
      heroEyebrow="Fencing Contractor Software"
      h1="Fencing contractor software"
      h1Highlight="from quote to last post."
      heroSub="Wood, vinyl, chain-link, aluminum, gates and operators. Measure on site, quote by the foot, schedule the multi-day install, and bill once the last post is set."
      features={[
        { title: 'Measure & quote on site', body: 'Linear feet, material, height, gate count, post hardware — priced and signed on the truck.' },
        { title: 'Multi-day crew scheduling', body: 'Drop a 3-day install on the calendar, assign your crew, and the customer gets the daily heads-up.' },
        { title: 'Permit & utility-locate tracking', body: 'Attach permit numbers, locate request IDs, and inspection results to each job so nothing slips at final.' },
        { title: 'Materials & job costing', body: 'Track posts, panels, concrete, and hardware against the quote. See real profit per job.' },
        { title: 'Deposits & balance billing', body: 'Take a deposit at quote acceptance, balance on completion. Card payments auto-mark paid through Stripe.' },
        { title: 'AI business insights', body: 'See your most profitable fence types, average tickets, and accounts due for a follow-up.' },
      ]}
    />
  );
}
