import { useRouter } from 'next/router';
import Logo from '../components/Logo';

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
        <p style={{color:'#7a8db0',fontSize:13,marginBottom:32}}>Last updated: {new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })}</p>
        <div style={{fontSize:15,lineHeight:1.7,color:'#c8d4ee'}}>
          <p>This page is a placeholder. A full privacy policy will be published before general availability. In the meantime, here's the short version:</p>
          <ul style={{marginTop:16,paddingLeft:20}}>
            <li>We only collect the information you provide to run your business in MyForeman: account email, your business profile, your customers, jobs, invoices, and leads.</li>
            <li>Your data is yours. We never sell it. We never share it with third parties for advertising.</li>
            <li>We use Supabase to store and authenticate data. We use Vercel to host this app. Both are subject to their own privacy and data handling terms.</li>
            <li>You can delete your account and your data at any time by contacting us at hello@myforeman.app.</li>
          </ul>
          <p style={{marginTop:24,fontSize:13,color:'#7a8db0'}}>Questions? Email hello@myforeman.app.</p>
        </div>
      </div>
    </div>
  );
}
