// Shared loading + empty state primitives. Use these on every list
// page so contractors get the same look-and-feel whether they're in
// Jobs, Customers, Mileage, or anywhere else.
//
// Pattern:
//   if (loading) return <PageLoading label="Loading jobs..." />;
//   if (!rows.length) return <EmptyState icon="🔧" title="No jobs yet" hint="..." actionLabel="+ NEW JOB" onAction={openNew}/>;

export function PageLoading({ label = 'Loading...' }) {
  return (
    <div style={{
      minHeight:'40vh',
      display:'flex', alignItems:'center', justifyContent:'center',
      gap:12, color:'#7a8db0', fontSize:13, padding:'40px 20px',
    }}>
      <Spinner/>
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoading({ label = 'Loading...' }) {
  return (
    <div style={{
      minHeight:'100vh',
      background:'#111827',
      color:'#f0f4ff',
      fontFamily:"'Inter',system-ui,sans-serif",
      display:'flex', alignItems:'center', justifyContent:'center',
      gap:12, fontSize:14,
    }}>
      <Spinner/>
      <span>{label}</span>
    </div>
  );
}

export function Spinner({ size = 18, color = '#4f9eff' }) {
  return (
    <span style={{
      display:'inline-block',
      width:size, height:size,
      border:`2px solid ${color}33`,
      borderTopColor: color,
      borderRadius:'50%',
      animation:'mf-spin 0.8s linear infinite',
    }}>
      <style jsx>{`
        @keyframes mf-spin { to { transform: rotate(360deg); } }
      `}</style>
    </span>
  );
}

// Empty state for list pages. Big-icon-with-CTA pattern.
//   <EmptyState
//     icon="🔧"
//     title="No jobs yet"
//     hint="Schedule your first job to get started."
//     actionLabel="+ NEW JOB"
//     onAction={openNew}
//   />
export function EmptyState({ icon, title, hint, actionLabel, onAction }) {
  return (
    <div style={{
      background:'#1e2a42',
      border:'1px dashed #2e3f60',
      borderRadius:14,
      padding:'40px 24px',
      textAlign:'center',
      color:'#7a8db0',
    }}>
      {icon && (
        <div style={{fontSize:44, lineHeight:1, marginBottom:12}}>{icon}</div>
      )}
      <div style={{
        fontFamily:"'Bebas Neue',Impact,sans-serif",
        fontSize:22, letterSpacing:'.06em', color:'#f0f4ff', marginBottom:6,
      }}>
        {title?.toUpperCase()}
      </div>
      {hint && (
        <div style={{fontSize:13, color:'#7a8db0', lineHeight:1.55, maxWidth:380, margin:'0 auto'}}>{hint}</div>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction}
          style={{
            marginTop:18,
            background:'#4f9eff', border:'none', borderRadius:10,
            color:'#fff', padding:'12px 22px',
            fontFamily:"'Bebas Neue',Impact,sans-serif",
            fontSize:15, letterSpacing:'.08em',
            cursor:'pointer',
          }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
