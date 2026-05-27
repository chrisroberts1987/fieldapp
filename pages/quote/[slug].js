// Legacy route. The standalone quote-request form was retired in
// favor of /book/<slug>, which does the same thing PLUS an AI
// receptionist and a date/time picker. Old printed QR codes and
// shared links keep working — we just redirect.

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LegacyQuoteRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { slug } = router.query;
    if (slug) router.replace(`/book/${slug}`);
  }, [router.isReady, router.query]);
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#7a8db0',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif',fontSize:14}}>
      Loading...
    </div>
  );
}
