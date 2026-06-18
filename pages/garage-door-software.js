import SeoLanding from '../components/SeoLanding';

export default function GarageDoorSoftware() {
  return (
    <SeoLanding
      title="Garage Door Software for Contractors | MyForeman"
      description="Garage door software for repairs, installs, and openers. Schedule calls, quote on site, take card payments, and track every spring and panel. Free 14-day trial."
      canonicalPath="/garage-door-software"
      heroEyebrow="Garage Door Software"
      h1="Garage door software"
      h1Highlight="for service & install crews."
      heroSub="Broken springs, panel replacements, opener installs, smart-home upgrades. Take the call, dispatch the truck, quote on site, invoice on completion."
      features={[
        { title: 'Service-call dispatch', body: 'Customer calls about a broken spring, you drop the job on the schedule, and the tech gets an automated heads-up with the address and details.' },
        { title: 'On-site quoting', body: 'Build a quote on the truck for springs, panels, openers, or smart hubs. Send for digital signature before you swap a part.' },
        { title: 'Parts & opener catalog', body: 'Reusable line items for the parts you sell most. Quote in under a minute.' },
        { title: 'Same-day invoicing', body: 'Send the invoice before you leave the driveway. Card payments through Stripe auto-mark paid the moment the funds land.' },
        { title: 'Photos & warranty docs', body: 'Document the install with photos, attach to the customer record, and warranty calls a year later actually go smoothly.' },
        { title: 'AI business insights', body: 'See your most profitable repair types, average tickets by service, and customers due for an opener upgrade.' },
      ]}
    />
  );
}
