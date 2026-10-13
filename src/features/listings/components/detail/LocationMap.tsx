"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const HOUSE_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 3.2 2.6 11a1 1 0 0 0 1.3 1.5l.6-.5V20a1 1 0 0 0 1 1h4.5v-5.5h4V21h4.5a1 1 0 0 0 1-1v-8l.6.5A1 1 0 0 0 21.4 11Z"/></svg>';

/** A listing's neighbourhood: one house marker; page scroll passes over it (Ctrl + scroll / two fingers to zoom). */
export function LocationMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: [lng, lat],
      zoom: 13.5,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const marker = document.createElement("div");
    marker.className = "home-marker";
    marker.innerHTML = HOUSE_SVG;
    new maplibregl.Marker({ element: marker, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);

  return <div ref={ref} className="size-full" role="region" aria-label={label} />;
}
