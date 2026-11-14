"use client";
// Leaflet map with a draggable field pin. Loaded only in the browser (see dynamic import in
// the setup page). Tiles come from OpenStreetMap, so offline the map is blank but the pin
// and the coordinate boxes still work.
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pin = L.divIcon({ className: "", html: '<div class="field-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 26] });

function ClickToMove({ onChange }: { onChange: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([lat, lon])) map.setView([lat, lon], Math.max(map.getZoom(), 11));
  }, [lat, lon, map]);
  return null;
}

export default function MapPicker({ lat, lon, onChange }: { lat: number; lon: number; onChange: (lat: number, lon: number) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const position = markerRef.current?.getLatLng();
        if (position) onChange(position.lat, position.lng);
      },
    }),
    [onChange],
  );
  return (
    <MapContainer center={[lat, lon]} zoom={11} scrollWheelZoom className="h-72 w-full rounded-xl border border-leaf-200 sm:h-96" aria-label="Map: drag the pin to your field">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lon]} draggable icon={pin} ref={markerRef} eventHandlers={handlers} keyboard title="Field location" />
      <ClickToMove onChange={onChange} />
      <Recenter lat={lat} lon={lon} />
    </MapContainer>
  );
}
