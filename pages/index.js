import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Home() {
const router = useRouter();

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
if (session) {
router.push('/dashboard');
} else {
router.push('/login');
}
});
}, []);

return (
<div style={{
minHeight: '100vh',
background: '#111827',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
color: '#f0f4ff',
fontFamily: 'sans-serif'
}}>
Loading...
</div>
);
}
