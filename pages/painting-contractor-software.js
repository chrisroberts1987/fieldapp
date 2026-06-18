import SeoLanding from '../components/SeoLanding';

export default function PaintingContractorSoftware() {
  return (
    <SeoLanding
      title="Painting Contractor Software | MyForeman"
      description="Painting software for interior and exterior contractors. Build accurate quotes, schedule crews, track materials, and invoice fast. From $39/mo. Free 14-day trial."
      canonicalPath="/painting-contractor-software"
      heroEyebrow="Painting Contractor Software"
      h1="Painting software"
      h1Highlight="from estimate to walkthrough."
      heroSub="Interior, exterior, cabinet refinishing, deck staining. Quote the job, schedule the crew, document the prep work, and close the invoice, all from your phone."
      features={[
        { title: 'Room-by-room estimates', body: 'Line-item by room or surface. Add prep, primer, paint, and labor. Send for digital signature in two taps.' },
        { title: 'Crew scheduling', body: 'Multi-day jobs handled. Assign painters, drop the job on the calendar, and the customer gets the daily heads-up.' },
        { title: 'Color & product tracking', body: 'Log the paint brand, sheen, and color code per surface. Customers love the documentation; warranty calls get easier.' },
        { title: 'Before / after photos', body: 'Snap walls before the prep, after the paint. Attach to the job. Customers see the proof on the invoice.' },
        { title: 'Invoicing & deposits', body: 'Take a deposit at quote acceptance, balance at completion. Card payments auto-mark paid. Check, Venmo, Zelle supported.' },
        { title: 'AI business insights', body: 'See your most profitable job types, average ticket by service, and customers due for a refresh.' },
      ]}
    />
  );
}
