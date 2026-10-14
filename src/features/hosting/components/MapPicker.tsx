"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Click (or tap) to put the pin on the place; the pin can also be dragged. */
export function MapPicker({ lat, lng, label, onChange }: { lat: number; lng: number; label: string; onChange: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: [lng, lat],
      zoom: 13,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const marker = new maplibregl.Marker({ color: "#0057b8", draggable: true }).setLngLat([lng, lat]).addTo(map);
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      onChangeRef.current(round(p.lat), round(p.lng));
    });
    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      onChangeRef.current(round(event.lngLat.lat), round(event.lngLat.lng));
    });
    markerRef.current = marker;
    return () => map.remove();
    // The map is created once; later pin moves come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="size-full" role="application" aria-label={label} />;
}
