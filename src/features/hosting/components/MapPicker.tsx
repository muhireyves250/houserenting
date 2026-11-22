"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { Crosshair, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/**
 * Click (or tap) to put the pin on the place; drag it, zoom in and out. "Use my location" moves the pin to where the
 * phone is, only when asked (standing elsewhere never moves it), and it can still be corrected by hand.
 */
export function MapPicker({ lat, lng, label, onChange }: { lat: number; lng: number; label: string; onChange: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations("MapPicker");
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied" | "done">("idle");
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
    mapRef.current = map;
    return () => map.remove();
    // The map is created once; later pin moves come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (n: number) => Math.round(n * 1e6) / 1e6;
        const p = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
        markerRef.current?.setLngLat([p.lng, p.lat]);
        mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 17 });
        onChangeRef.current(p.lat, p.lng);
        setLocating("done");
      },
      () => setLocating("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  return (
    <div className="relative size-full">
      <div ref={ref} className="size-full" role="application" aria-label={label} />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-end justify-between gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={locating === "busy"}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink shadow-md ring-1 ring-black/10 hover:bg-canvas disabled:opacity-60"
        >
          {locating === "busy" ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Crosshair className="size-4 text-primary" aria-hidden="true" />}
          {t("useMyLocation")}
        </button>
        <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 font-mono text-[11px] text-ink shadow ring-1 ring-black/10 tabular-nums">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
      </div>
      {locating !== "idle" && locating !== "busy" && (
        <p role="status" className="pointer-events-none absolute inset-x-2 top-2 rounded-xl bg-white/95 px-3 py-2 text-[12px] font-medium text-ink shadow ring-1 ring-black/10">
          {locating === "denied" ? t("denied") : t("checkPin")}
        </p>
      )}
    </div>
  );
}
