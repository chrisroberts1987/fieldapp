import { useRouter } from 'next/router';
import Logo from '../components/Logo';

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
        <p style={{color:'#7a8db0',fontSize:13,marginBottom:32}}>Last updated: {new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })}</p>
        <div style={{fontSize:15,lineHeight:1.7,color:'#c8d4ee'}}>
          <p>This page is a placeholder. Full terms will be published before general availability. In the meantime, the short version:</p>
          <ul style={{marginTop:16,paddingLeft:20}}>
            <li>MyForeman is currently in trial. We may add, change, or remove features as we figure out what works.</li>
            <li>Don't use MyForeman for anything illegal or to abuse other users.</li>
            <li>You are responsible for the accuracy of the information you enter — customers, jobs, invoices, payments.</li>
            <li>We provide MyForeman "as is" during the trial period. We'll do our best to keep things running but make no warranty.</li>
            <li>Either party can end the trial at any time. If we end it on you, we'll give you a way to export your data.</li>
          </ul>
          <p style={{marginTop:24,fontSize:13,color:'#7a8db0'}}>Questions? Email hello@myforeman.app.</p>
        </div>
      </div>
    </div>
  );
}
