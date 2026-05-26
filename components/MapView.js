// Leaflet-based map display, OpenStreetMap tiles, no API key.
//
// Public API (always import this file — it lazy-loads the actual
// Leaflet bundle on the client so Next.js SSR doesn't try to
// evaluate `window` during build):
//
//   <MapView points={[{ lat, lng, label, color }]}
//            height={220} zoom={13} />
//
// - One pin per point.
// - If 2+ points, draws a dashed line between them and auto-fits
//   the viewport to include all pins.
// - If 0 points, renders a flat placeholder (no map call).
//
// Leaflet is ~40kB gzipped; only loaded on pages that render this.

import dynamic from 'next/dynamic';

const InnerMap = dynamic(() => import('./MapViewInner'), {
  ssr: false,
  loading: () => (
    <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f1626',color:'#7a8db0',fontSize:12,borderRadius:8}}>
      Loading map…
    </div>
  ),
});

export default function MapView({ points = [], height = 220, zoom = 13 }) {
  if (!points || points.length === 0) {
    return (
      <div style={{height,background:'#0f1626',border:'1px dashed #2e3f60',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'#7a8db0',fontSize:12}}>
        No GPS coordinates on file.
      </div>
    );
  }
  return (
    <div style={{height,borderRadius:8,overflow:'hidden',border:'1px solid #2e3f60',position:'relative'}}>
      <InnerMap points={points} zoom={zoom}/>
    </div>
  );
}
