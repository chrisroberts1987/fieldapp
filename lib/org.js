import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useOrg(user) {
  const [orgId, setOrgId] = useState(null);
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null); // user.id we've loaded for, or 'no-user'

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setOrgId(null);
      setOrg(null);
      setRole(null);
      setLoadedFor('no-user');
      return;
    }

    (async () => {
      const { data: m } = await supabase
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!m) {
        setOrgId(null);
        setOrg(null);
        setRole(null);
        setLoadedFor(user.id);
        return;
      }

      setOrgId(m.org_id);
      setRole(m.role);

      const { data: o } = await supabase
        .from('organizations')
        .select('id, name, plan, trial_ends_at, owner_name, phone, business_email, address, logo_url, license_number, default_tax_rate')
        .eq('id', m.org_id)
        .maybeSingle();

      if (cancelled) return;
      setOrg(o || null);
      setLoadedFor(user.id);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Derived: loading is true until the load completes for the CURRENT user.id
  // (or for the signed-out state). This avoids the race where setLoading(true)
  // inside the effect would be invisible to other effects in the same render.
  const loading = !user ? loadedFor !== 'no-user' : loadedFor !== user.id;

  return { orgId, org, role, loading };
}
