import { useRouter } from 'next/router';

// Small in-section tab strip used to switch between related pages that
// share a single top-nav slot (e.g. Expenses ↔ Mileage, Crew ↔ Approvals).
export default function SubNav({ items, active }) {
  const router = useRouter();
  return (
    <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
      {items.map(it => {
        const on = active === it.route;
        return (
          <button key={it.route} onClick={() => router.push(it.route)}
            style={{
              background: on ? '#4f9eff22' : 'transparent',
              border: '1.5px solid ' + (on ? '#4f9eff' : '#2e3f60'),
              color: on ? '#4f9eff' : '#c8d4ee',
              borderRadius: 999,
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}>
            {it.label}
            {typeof it.badge === 'number' && it.badge > 0 && (
              <span style={{marginLeft:6,background:'#f26060',color:'#fff',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:999}}>
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
