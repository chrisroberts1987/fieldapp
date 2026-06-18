import SeoLanding from '../components/SeoLanding';

export default function ElectricalContractorSoftware() {
  return (
    <SeoLanding
      title="Electrical Contractor Software | MyForeman"
      description="Electrical contractor software for service calls, panel upgrades, and new construction. Schedule crews, quote on site, invoice fast, and track every job. Free 14-day trial."
      canonicalPath="/electrical-contractor-software"
      heroEyebrow="Electrical Contractor Software"
      h1="Built for electrical contractors,"
      h1Highlight="from service to new build."
      heroSub="Panel upgrades, EV charger installs, troubleshoots, and rough-in. Every job ticketed, every quote tracked, every invoice paid — without an office manager."
      features={[
        { title: 'Crew scheduling', body: 'Assign electricians by license level, drag jobs across the week, and see who is overbooked before the customer is.' },
        { title: 'Quotes & change orders', body: 'Build a quote with line-itemed materials and labor, send for digital signature, and track approved change orders against the original scope.' },
        { title: 'Permit & inspection tracking', body: 'Attach the permit number, inspection date, and pass/fail to each job so nothing falls through the cracks at final.' },
        { title: 'Materials & job costing', body: 'Log materials per job from your phone. See real profit per job, not just revenue.' },
        { title: 'Customer payment portal', body: 'Customers pay invoices online by card, or use Venmo, Zelle, Cash App, or check. Auto-marked paid when funds land.' },
        { title: 'AI business insights', body: 'See your most profitable service types, jobs that ran over budget, and slow-paying customers. Plain-English answers.' },
      ]}
    />
  );
}
