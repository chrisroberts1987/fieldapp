import SeoLanding from '../components/SeoLanding';

export default function ApplianceRepairSoftware() {
  return (
    <SeoLanding
      title="Appliance Repair Software for Service Techs | MyForeman"
      description="Appliance repair software for service techs and small shops. Service-call dispatch, parts tracking, warranty work, and same-day invoicing. Free 14-day trial."
      canonicalPath="/appliance-repair-software"
      heroEyebrow="Appliance Repair Software"
      h1="Appliance repair software"
      h1Highlight="for the next service call."
      heroSub="Diagnostics, parts ordering, warranty work, in-warranty vs out-of-warranty billing. Every call ticketed, every part tracked, every invoice closed before you leave."
      features={[
        { title: 'Service-call dispatch', body: 'Customer calls about a fridge or dishwasher, you drop it on the schedule, the tech gets the model and symptom on their phone.' },
        { title: 'Parts tracking', body: 'Log the parts ordered per job and the customer name they\'re for. Schedule the return visit when the part arrives.' },
        { title: 'Warranty vs paid work', body: 'Track in-warranty jobs separately from billable ones so your numbers actually reflect the business.' },
        { title: 'On-site quoting', body: 'Diagnostic done, repair priced, signed and approved on your phone before you order the part.' },
        { title: 'Same-day invoicing', body: 'Card payments through Stripe auto-mark paid. Check, Venmo, and Zelle supported too.' },
        { title: 'AI business insights', body: 'See your most profitable repair types, average tickets by appliance, and customers due for follow-up.' },
      ]}
    />
  );
}
