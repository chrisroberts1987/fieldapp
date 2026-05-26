// Client-only inner map. Never import directly — go through
// MapView.js which dynamic-imports this with ssr:false. Leaflet
// touches `window` on load, which breaks Next.js SSR builds if
// imported eagerly.

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon points at relative URLs that don't
// resolve under bundlers. Inline a small SVG pin instead — no extra
// asset to ship, and we get color-per-pin for free.
function pinIcon(color = '#4f9eff') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path fill="${color}" stroke="#0d1726" stroke-width="1.5"
        d="M14 1c-7.2 0-13 5.8-13 13 0 9.7 13 23 13 23s13-13.3 13-23c0-7.2-5.8-13-13-13z"/>
      <circle cx="14" cy="14" r="5" fill="#0d1726"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], map.getZoom());
      return;
    }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, [points, map]);
  return null;
}

export default function MapViewInner({ points, zoom }) {
  const first = points[0];
  const center = [first.lat, first.lng];
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', background: '#0f1626' }}
      attributionControl={true}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}/>
      {points.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={pinIcon(p.color || '#4f9eff')}>
          {p.label && <Popup>{p.label}</Popup>}
        </Marker>
      ))}
      {points.length > 1 && (
        <Polyline
          positions={points.map(p => [p.lat, p.lng])}
          pathOptions={{ color: '#4f9eff', weight: 3, dashArray: '6, 6', opacity: 0.7 }}/>
      )}
      <FitBounds points={points}/>
    </MapContainer>
  );
}
