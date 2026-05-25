import { useRouter } from 'next/router';
import Logo from '../components/Logo';

// Plain-English Terms. Not legal advice — when the business gets to
// a point where it matters, run this past a real attorney.

export default function Terms() {
  const router = useRouter();
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <nav style={{padding:'18px 20px',maxWidth:1080,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <a onClick={() => router.push('/')} style={{cursor:'pointer'}}><Logo size="sm" /></a>
        <button onClick={() => router.push('/')} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>← BACK</button>
      </nav>

      <div style={{maxWidth:720,margin:'40px auto 80px',padding:'0 20px'}}>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:48,letterSpacing:'.06em',marginBottom:12}}>TERMS OF SERVICE</h1>
        <p style={{color:'#7a8db0',fontSize:13,marginBottom:32}}>
          Last updated: {new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })}
        </p>

        <div style={{fontSize:15,lineHeight:1.7,color:'#c8d4ee'}}>
          <p style={lead}>
            These Terms govern your use of MyForeman ("MyForeman", "we", "us"), a software service for field-service contractors. By creating an account or using MyForeman, you agree to these Terms. If you don't agree, please don't use the service.
          </p>

          <Section title="1. Your Data, Your Business">
            <p>
              Everything you put into MyForeman is <strong style={hi}>your data</strong>: your customers, leads, quotes, jobs, invoices, expenses, crew, mileage, and uploaded files. You own it. You can export it. You can delete it.
            </p>
            <p>
              We will never sell your data, share it with advertisers, or use it to train third-party AI models without your explicit consent. We process your data only to operate MyForeman for you (storing it, displaying it back to you, sending the emails and notifications you trigger, and powering the AI features you opt into).
            </p>
          </Section>

          <Section title="2. Service Availability">
            <p>
              We aim for high availability but make no guaranteed uptime promise during the trial and early commercial period. We perform routine maintenance, deploy updates, and depend on upstream providers (cloud hosting, database, email) that may experience their own outages.
            </p>
            <p>
              When we know about planned maintenance that will cause downtime, we'll communicate in advance. If a major outage occurs, we'll provide status updates and work to restore service quickly.
            </p>
          </Section>

          <Section title="3. Payment, Trial, and Cancellation">
            <p>
              MyForeman offers a 14-day free trial. You must enter a payment method to start the trial. You will not be charged during the trial period. At the end of the trial, your subscription begins automatically at the plan price you selected, billed monthly or annually as chosen.
            </p>
            <p>
              You can <strong style={hi}>cancel at any time</strong> from the Settings page. After cancellation, you'll continue to have access through the end of your current billing period and then your account moves to read-only for 30 days so you can export your data before it's deleted.
            </p>
            <p>
              We don't offer prorated refunds for partial periods. Annual plans are not refundable except where required by law.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to use MyForeman to:</p>
            <ul style={ulStyle}>
              <li>Violate any law or regulation (including tax, employment, consumer protection, or anti-spam laws);</li>
              <li>Send unsolicited bulk email or text messages;</li>
              <li>Impersonate another person or business;</li>
              <li>Upload malware, exploit vulnerabilities, attempt to reverse engineer the service, or interfere with other accounts;</li>
              <li>Scrape, harvest, or attempt to gain unauthorized access to data that isn't yours;</li>
              <li>Resell the service or expose it as a public API.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules, with a refund of unused prepaid time where reasonable.
            </p>
          </Section>

          <Section title="5. Customer Communications You Send">
            <p>
              MyForeman lets you send quotes, invoices, feedback requests, and crew invites to people you have a business relationship with. <strong style={hi}>You are responsible</strong> for ensuring you have the right to contact them at the address or phone number you provided, and for following applicable anti-spam and consumer protection laws (CAN-SPAM, TCPA, state equivalents).
            </p>
          </Section>

          <Section title="6. AI Features">
            <p>
              MyForeman uses a third-party AI provider to power features like invoice extraction from photos and monthly business coaching recommendations. When you use those features, the relevant inputs are sent to that provider under their terms. We don't grant providers the right to train their models on your data unless you explicitly opt in.
            </p>
            <p>
              AI output is generated automatically and may contain errors. <strong style={hi}>Always review AI-extracted data and AI recommendations</strong> before relying on them for invoicing, customer communications, tax filing, or business decisions.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, MyForeman is provided <strong style={hi}>"as is" and "as available"</strong>, without warranty of any kind. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, or lost data, even if we have been advised of the possibility.
            </p>
            <p>
              Our total liability for any claim arising out of these Terms or your use of MyForeman is limited to the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
            <p>
              MyForeman is not an accountant, lawyer, or tax advisor. Tax estimates, deductibility flags, and financial reports in MyForeman are tools to help you organize your records. Always confirm tax filings and legal compliance with a qualified professional.
            </p>
          </Section>

          <Section title="8. Indemnification">
            <p>
              You agree to indemnify and hold MyForeman harmless from any claim, loss, or expense arising from your use of the service in violation of these Terms, your violation of any law, or your infringement of any third party's rights.
            </p>
          </Section>

          <Section title="9. Changes to These Terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we'll notify you by email or by posting a notice in the app at least 14 days before the changes take effect. Continued use after the effective date constitutes acceptance.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by the laws of the <strong style={hi}>State of Texas</strong>, without regard to its conflict of laws principles. Any dispute that can't be resolved informally will be brought exclusively in the state or federal courts located in Travis County, Texas, and both parties consent to the jurisdiction of those courts.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these Terms? Email{' '}
              <a href="mailto:support@myforemanhq.com" style={linkStyle}>support@myforemanhq.com</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{marginTop:28}}>
      <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:10}}>
        {title.toUpperCase()}
      </h2>
      {children}
    </div>
  );
}

const lead      = { fontSize: 15.5, lineHeight: 1.65, color: '#c8d4ee' };
const hi        = { color: '#f0f4ff' };
const ulStyle   = { margin: '8px 0 0 0', paddingLeft: 20 };
const linkStyle = { color: '#4f9eff', textDecoration: 'none' };
