import { useRouter } from 'next/router';
export default function Page() {
const router = useRouter();
return (
<div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:'sans-serif',padding:20}}>
<button onClick={() => router.push('/dashboard')} style={{background:'none',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,marginBottom:16}}>← Back</button>
<div style={{fontFamily:'monospace',fontSize:24}}>{router.pathname.replace('/','').toUpperCase()}</div>
<p style={{color:'#7a8db0',marginTop:8}}>Coming soon.</p>
</div>
);
}
