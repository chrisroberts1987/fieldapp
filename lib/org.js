import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useOrg(user) {
  const [orgId, setOrgId] = useState(null);
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }

    (async () => {
      const { data: m } = await supabase
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!m) { setLoading(false); return; }

      setOrgId(m.org_id);
      setRole(m.role);

      const { data: o } = await supabase
        .from('organizations')
        .select('id, name, plan, trial_ends_at, owner_name, phone, business_email, address, logo_url, license_number, default_tax_rate')
        .eq('id', m.org_id)
        .maybeSingle();

      if (cancelled) return;
      setOrg(o || null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { orgId, org, role, loading };
}
