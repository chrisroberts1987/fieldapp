import SeoLanding from '../components/SeoLanding';

export default function LocksmithSoftware() {
  return (
    <SeoLanding
      title="Locksmith Software for Mobile & Shop Pros | MyForeman"
      description="Locksmith software for lockouts, rekeys, smart locks, and commercial work. Mobile dispatch, on-site quoting, card payments, and customer history. Free 14-day trial."
      canonicalPath="/locksmith-software"
      heroEyebrow="Locksmith Software"
      h1="Locksmith software"
      h1Highlight="for mobile & shop work."
      heroSub="Lockouts, rekeys, smart-lock installs, master-key systems, commercial hardware. From the panicked midnight call to the commercial bid, all in one app."
      features={[
        { title: 'Mobile dispatch', body: 'Lockout calls come in, you drop them on the schedule, the tech gets the address and gate code. Customer gets an ETA text.' },
        { title: 'On-site quoting', body: 'Rekey, lock supply, smart-lock install — priced and signed on your phone before you start the work.' },
        { title: 'Customer key & lock history', body: 'Track which keys you cut, which locks you installed, and which combinations you set. Customer history at a tap.' },
        { title: 'Card payments on site', body: 'Take card payments at the curb through Stripe. Invoice auto-marks paid. Venmo, Zelle, Cash App, and check also supported.' },
        { title: 'Commercial recurring contracts', body: 'Track ongoing service agreements for commercial accounts — building rekeys, master-key updates, hardware swaps.' },
        { title: 'AI business insights', body: 'See which job types are most profitable, residential vs. commercial revenue split, and accounts due for follow-up.' },
      ]}
    />
  );
}
