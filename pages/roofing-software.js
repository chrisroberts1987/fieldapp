import SeoLanding from '../components/SeoLanding';

export default function RoofingSoftware() {
  return (
    <SeoLanding
      title="Roofing Contractor Software | MyForeman"
      description="Roofing software for repairs, replacements, and storm work. Quote on site, schedule crews, track materials, and invoice fast. Built for roofing contractors. Free 14-day trial."
      canonicalPath="/roofing-software"
      heroEyebrow="Roofing Software"
      h1="Roofing software"
      h1Highlight="for crews who work."
      heroSub="Repair, full replacement, storm response, gutter work — every project quoted, every crew scheduled, every invoice closed. From the truck, not the office."
      features={[
        { title: 'Quote on the truck', body: 'Build a roof replacement quote with materials, labor, and tear-off line items. Send for digital signature before you leave the driveway.' },
        { title: 'Crew scheduling', body: 'Drop full-day or multi-day jobs on the calendar, assign your crew, and the customer gets an automated heads-up the morning of.' },
        { title: 'Project photos & docs', body: 'Document the roof condition before, during, and after. Attach insurance claim numbers, permit numbers, and inspection results to the job.' },
        { title: 'Materials & job costing', body: 'Track shingles, underlayment, and labor against the quote. See actual margin per job, not just revenue.' },
        { title: 'Invoicing & payments', body: 'Invoice on completion. Stripe-powered card payments mark the invoice paid automatically. Check, Zelle, and Venmo also supported.' },
        { title: 'AI business insights', body: 'See which job types make you money, your average ticket by service, and outstanding receivables — without spreadsheets.' },
      ]}
    />
  );
}
