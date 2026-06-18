import SeoLanding from '../components/SeoLanding';

export default function JobberAlternative() {
  return (
    <SeoLanding
      title="Jobber Alternative for Contractors | MyForeman"
      description="Looking for a Jobber alternative? MyForeman gives you scheduling, invoicing, quotes, and AI insights with every feature included from $39/mo. No tiered paywalls. Free 14-day trial."
      canonicalPath="/jobber-alternative"
      heroEyebrow="Jobber Alternative"
      h1="A simpler alternative"
      h1Highlight="to Jobber."
      heroSub="Most of what contractors love about Jobber, like scheduling, quoting, and invoicing, without the tiered pricing where the features you actually need sit two plans up. MyForeman includes every feature from the entry plan."
      features={[
        { title: 'All features, all plans', body: 'AI insights, customer portal, online payments, quotes, and scheduling are all included from $39/mo. Nothing locked behind upgrades.' },
        { title: 'Designed for mobile-first', body: 'Built for contractors who run the business from a phone, not a back office. Every feature works on the truck.' },
        { title: 'AI business insights', body: 'Plain-English answers about your numbers. Which jobs make money, which customers pay late, where revenue is leaking.' },
        { title: 'Honest pricing', body: 'Flat per-user pricing. No surprise charges for SMS, online payments (beyond Stripe fees), or AI features.' },
        { title: 'Multi-user crews', body: 'Add foreman, supervisor, and crew members. Each role sees what they need, nothing they don\'t.' },
        { title: 'Same-day migration', body: 'Import customers, jobs, and invoices from a CSV during signup. Be running the business by tomorrow.' },
      ]}
      comparison={{
        competitor: 'Jobber',
        rows: [
          { feature: 'Starting price',                      mf: '$39/mo',       them: '$39/mo (Core)' },
          { feature: 'AI business insights',                mf: 'Included',     them: 'Limited' },
          { feature: 'Online card payments',                mf: 'Included',     them: 'Included' },
          { feature: 'Quoting & estimates',                 mf: 'Included',     them: 'Included' },
          { feature: 'Recurring jobs',                      mf: 'Included',     them: 'Higher tier' },
          { feature: 'Customer hub / portal',               mf: 'Included',     them: 'Higher tier' },
          { feature: 'Automated job follow-ups',            mf: 'Included',     them: 'Higher tier' },
          { feature: 'CSV import / data migration',         mf: 'Included',     them: 'Included' },
          { feature: 'Free trial',                          mf: '14 days',      them: '14 days' },
        ],
      }}
    />
  );
}
