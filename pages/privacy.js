import { useRouter } from 'next/router';
import Logo from '../components/Logo';

// Plain-English privacy policy. Not legal advice — get an attorney
// to review before claiming compliance with any specific regulation.

export default function Privacy() {
  const router = useRouter();
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <nav style={{padding:'18px 20px',maxWidth:1080,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <a onClick={() => router.push('/')} style={{cursor:'pointer'}}><Logo size="sm" /></a>
        <button onClick={() => router.push('/')} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>← BACK</button>
      </nav>

      <div style={{maxWidth:720,margin:'40px auto 80px',padding:'0 20px'}}>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:48,letterSpacing:'.06em',marginBottom:12}}>PRIVACY POLICY</h1>
        <p style={{color:'#7a8db0',fontSize:13,marginBottom:32}}>
          Last updated: {new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })}
        </p>

        <div style={{fontSize:15,lineHeight:1.7,color:'#c8d4ee'}}>
          <p style={lead}>
            MyForeman is built for small contractors and field-service businesses. We collect the minimum data we need to make the product work, store it securely, and never sell it. This page explains what we collect, why we collect it, who we share it with, and the rights you have over your data.
          </p>

          <Section title="1. What We Collect">
            <p><strong style={hi}>Account information.</strong> When you sign up we collect your name, email, and an encrypted password. If you sign up through an invite, we also link you to the inviting organization.</p>
            <p><strong style={hi}>Business profile.</strong> Your business name, phone, business email, address, optional logo and license number, default tax rates. These appear on the quotes and invoices you send.</p>
            <p><strong style={hi}>Operational records you enter.</strong> Customers, leads, quotes, jobs, invoices, expenses, mileage, crew memberships, time logs, notifications, and feedback submissions. We collect this because it's the thing you're trying to manage.</p>
            <p><strong style={hi}>Files you upload.</strong> Logos, expense receipts, and invoice import attachments are stored in our managed file storage so we can render them back to you and (for receipts) attach them to expense records.</p>
            <p><strong style={hi}>Usage and technical data.</strong> IP address on API requests (used for rate limiting), browser type, and basic error logs. We do not use Google Analytics, Facebook Pixel, or any third-party advertising trackers.</p>
            <p><strong style={hi}>Payment information.</strong> If you start a paid trial or subscription, your card details are handled directly by a PCI-compliant payment processor. We never see, store, or transmit your full card number ourselves — only a tokenized customer reference returned to us.</p>
          </Section>

          <Section title="2. How We Use Data">
            <ul style={ulStyle}>
              <li><strong style={hi}>To run the product:</strong> displaying your data back to you, sending the emails you trigger (quotes, invoices, feedback requests, crew invites), generating tax estimates and reports.</li>
              <li><strong style={hi}>To power AI features:</strong> invoice extraction from receipts/PDFs and the monthly AI business coach. Inputs to those features are sent to our AI provider only at the moment you use the feature.</li>
              <li><strong style={hi}>To secure the service:</strong> rate-limiting abuse, detecting fraudulent sign-ups, troubleshooting bugs you report.</li>
              <li><strong style={hi}>To communicate with you:</strong> account confirmations, password resets, important service notices, and (only if you opt in) occasional product updates.</li>
            </ul>
            <p>We do <strong style={hi}>not</strong> use your data to train AI models, sell it to advertisers, or share it with third parties beyond the service providers below.</p>
          </Section>

          <Section title="3. Service Providers We Use">
            <p>To deliver MyForeman, we rely on a small set of vetted infrastructure providers. They process data on our behalf under their own privacy and security commitments. We don't publish the specific vendor names here to reduce the surface for targeted social-engineering or supply-chain attacks; if you have a regulatory or due-diligence need to know who they are, contact{' '}
              <a href="mailto:privacy@myforemanhq.com" style={linkStyle}>privacy@myforemanhq.com</a> and we'll share details under NDA.</p>
            <p>The categories of providers we use:</p>
            <ul style={ulStyle}>
              <li><strong style={hi}>Application hosting + database + file storage</strong> — stores your account, business data, uploaded logos, and expense receipts. Encrypted at rest and in transit.</li>
              <li><strong style={hi}>Payment processor</strong> — PCI-compliant; handles all subscription billing and card processing. We only see a tokenized customer reference, never your card number.</li>
              <li><strong style={hi}>AI provider</strong> — powers the AI invoice extraction and AI Coach features. Only the inputs to those specific features (the invoice photo, your business snapshot) are sent, only at the moment you invoke them. We've contractually disallowed the provider from training models on your data.</li>
              <li><strong style={hi}>Transactional email delivery</strong> — sends the quotes, invoices, feedback requests, and crew invites you trigger, under your business name as the display sender.</li>
            </ul>
            <p>Each provider is contractually required to handle data according to enterprise-grade privacy and security standards.</p>
          </Section>

          <Section title="4. Your Rights">
            <p>You always have the right to:</p>
            <ul style={ulStyle}>
              <li><strong style={hi}>Access</strong> your data — view it directly in MyForeman, or request an export.</li>
              <li><strong style={hi}>Correct</strong> inaccurate information — edit it in MyForeman, or contact us if you can't.</li>
              <li><strong style={hi}>Export</strong> your data — accountant-ready CSV exports are available for tax records today; broader exports on request.</li>
              <li><strong style={hi}>Delete</strong> your account and all associated data — use the "Delete Account" control under Settings, or email{' '}
                <a href="mailto:privacy@myforemanhq.com" style={linkStyle}>privacy@myforemanhq.com</a>. Account deletion is permanent.</li>
              <li><strong style={hi}>Object or restrict</strong> certain processing — for example, opt out of non-essential email communications.</li>
            </ul>
          </Section>

          <Section title="5. GDPR (EU/UK Residents)">
            <p>
              If you're in the European Union or United Kingdom, the General Data Protection Regulation gives you additional protections. We process your personal data on the legal bases of <strong style={hi}>contract</strong> (to provide the service you signed up for) and <strong style={hi}>legitimate interest</strong> (to secure the service and prevent abuse). You can exercise the rights in Section 4 at any time. To file a complaint, you may contact your local data protection authority.
            </p>
            <p>
              MyForeman is operated from the United States. By using the service, you consent to your data being transferred to and processed in the U.S. We use providers that offer EU Standard Contractual Clauses or equivalent safeguards for international transfers.
            </p>
          </Section>

          <Section title="6. CCPA (California Residents)">
            <p>
              If you're a California resident, the California Consumer Privacy Act gives you specific rights. You can request to know what personal information we have collected, to delete it, and to opt out of any "sale" of personal information. We <strong style={hi}>do not sell personal information</strong>, so the opt-out is automatic for everyone.
            </p>
            <p>
              We will not discriminate against you for exercising your CCPA rights. To make a request, email{' '}
              <a href="mailto:privacy@myforemanhq.com" style={linkStyle}>privacy@myforemanhq.com</a>.
            </p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>
              MyForeman uses cookies and browser local storage only for things essential to running the app:
            </p>
            <ul style={ulStyle}>
              <li>Keeping you signed in (an authentication session token).</li>
              <li>Remembering your role and most recent organization on the dashboard.</li>
              <li>Remembering whether you've seen the first-time tour.</li>
            </ul>
            <p>
              We do not use advertising cookies, tracking pixels, or cross-site cookies. You can clear your browser's storage at any time, which will sign you out.
            </p>
          </Section>

          <Section title="8. Data Retention">
            <p>
              We keep your data for as long as your account is active. After you delete your account, we remove your data from active systems within 30 days. Backups are retained for an additional 30 days and then expire. Some records (billing receipts, fraud-prevention logs) may be retained longer where required by law.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              MyForeman is not directed to children under 16, and we do not knowingly collect personal information from them. If you believe a child has signed up, contact{' '}
              <a href="mailto:privacy@myforemanhq.com" style={linkStyle}>privacy@myforemanhq.com</a> and we'll delete the account.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use industry-standard practices: encrypted connections (HTTPS) everywhere, encrypted-at-rest storage, row-level security policies in the database, rate limiting on sensitive endpoints, and access controls limiting who on our team can view production data. No system is ever fully secure, but we work hard to keep yours safe.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this policy from time to time. If we make material changes, we'll notify you in advance by email or by an in-app notice. Continued use after the effective date constitutes acceptance.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Privacy questions or requests? Email{' '}
              <a href="mailto:privacy@myforemanhq.com" style={linkStyle}>privacy@myforemanhq.com</a>.
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
