import SeoLanding from '../components/SeoLanding';

export default function FlooringContractorSoftware() {
  return (
    <SeoLanding
      title="Flooring Contractor Software | MyForeman"
      description="Flooring contractor software for installs, refinishing, and repairs. Measure on site, quote with materials, schedule crews, and invoice on completion. Free 14-day trial."
      canonicalPath="/flooring-contractor-software"
      heroEyebrow="Flooring Contractor Software"
      h1="Flooring software"
      h1Highlight="for installs & refinishing."
      heroSub="Hardwood, LVP, tile, carpet, refinishing, repairs. Quote the room with materials and labor, schedule the multi-day install, and document the prep work for warranty."
      features={[
        { title: 'Measure & quote on site', body: 'Square footage by room, materials, labor, demo, leveling. Quote signed before you order the floor.' },
        { title: 'Crew scheduling', body: 'Multi-day installs handled on one calendar. Assign installers, drop the job on the schedule, customer gets the daily heads-up.' },
        { title: 'Materials & job costing', body: 'Track flooring brand, color, SKU, and quantity per job. See real profit per install, not just revenue.' },
        { title: 'Before / after photos', body: 'Document the subfloor, the install, and the finish. Customer sees the proof on the invoice and warranty calls go smoothly.' },
        { title: 'Deposits & balance billing', body: 'Take a deposit at quote acceptance, the balance on completion. Card payments auto-mark paid through Stripe.' },
        { title: 'AI business insights', body: 'See your most profitable products, average tickets by floor type, and customers due for a refresh.' },
      ]}
    />
  );
}
