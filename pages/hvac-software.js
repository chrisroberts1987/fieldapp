import SeoLanding from '../components/SeoLanding';

export default function HvacSoftware() {
  return (
    <SeoLanding
      title="HVAC Software for Contractors | MyForeman"
      description="HVAC software for contractors and service techs. Schedule installs, dispatch crews, send digital estimates, invoice on the spot, and get paid faster. Free 14-day trial."
      canonicalPath="/hvac-software"
      heroEyebrow="HVAC Software"
      h1="Run your HVAC business"
      h1Highlight="from one app."
      heroSub="Install, maintenance, and repair calls, all tracked from the first phone call to the final invoice. Built for HVAC contractors who'd rather be in the field than buried in paperwork."
      features={[
        { title: 'Service & install scheduling', body: 'Drag-and-drop your tech roster across the week. Multi-day installs, recurring maintenance contracts, and on-call work all live on the same calendar.' },
        { title: 'On-site estimates', body: 'Build a quote on the truck for a new system or repair, send it from your phone, and let the customer accept and sign digitally before you leave the driveway.' },
        { title: 'Invoices that get paid', body: 'Auto-bill after the job. Stripe-powered card payments mark the invoice paid the moment the funds land. Manual methods (check, Zelle, Venmo) supported too.' },
        { title: 'Maintenance agreements', body: 'Track seasonal tune-ups, filter changes, and warranty visits. The system reminds you (and the customer) when service is due.' },
        { title: 'Crew time & mileage', body: 'Techs clock in from the job site. Mileage logs auto-populate for tax season. Approvals stay with the foreman.' },
        { title: 'AI business insights', body: 'See which jobs make you money, which customers pay late, and where your revenue is leaking. Plain-English answers, no spreadsheets.' },
      ]}
    />
  );
}
