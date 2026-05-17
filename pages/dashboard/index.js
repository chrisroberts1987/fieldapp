import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Dashboard() {
const router = useRouter();
const [user, setUser] = useState(null);

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
if (!session) router.push('/login');
else setUser(session.user);
});
}, []);

const signOut = async () => {
await supabase.auth.signOut();
router.push('/login');
};

if (!user) return (
<div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>
Loading...
</div>
);

return (
<div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
<div style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.1em'}}>FIELDAPP</div>
<button onClick={signOut} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#7a8db0',padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>
Sign Out
</button>
</div>
<div style={{padding:20}}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:6}}>DASHBOARD</div>
<div style={{fontSize:13,color:'#7a8db0',marginBottom:24}}>Welcome, {user.email}</div>
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
{[
{ label:'Customers', color:'#54d4f8', route:'/customers' },
{ label:'Jobs', color:'#4f9eff', route:'/jobs' },
{ label:'Invoices', color:'#2edf87', route:'/invoices' },
{ label:'Crew', color:'#fb923c', route:'/crew' },
{ label:'Insights', color:'#b197fc', route:'/insights' },
].map(item => (
<div key={item.label}
onClick={() => router.push(item.route)}
style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'20px 16px',cursor:'pointer',transition:'border-color .15s'}}
onMouseOver={e => e.currentTarget.style.borderColor=item.color}
onMouseOut={e => e.currentTarget.style.borderColor='#2e3f60'}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',color:item.color}}>{item.label}</div>
</div>
))}
</div>
<div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:16,fontSize:13,color:'#7a8db0',lineHeight:1.6}}>
App is connected to Supabase. More screens coming next.
</div>
</div>
</div>
);
}