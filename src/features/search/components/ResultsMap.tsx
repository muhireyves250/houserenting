"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { SAMPLE_NIGHTS } from "@/features/listings/pricing";
import type { ListingCardData } from "@/features/listings/service";
import { pinLabel, pinPrice, resultsBounds, RWANDA_CENTER } from "@/features/search/map";
import type { SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";

// OpenFreeMap "Positron": clean light-grey vector basemap; free, no key, commercial use allowed.
const STYLE = "https://tiles.openfreemap.org/styles/positron";

// The marker root is positioned by MapLibre (it owns its transform); the pin inside it can scale freely.
type Pin = { marker: maplibregl.Marker; root: HTMLDivElement; pin: HTMLButtonElement };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function ResultsMap({
  listings,
  mode,
  activeId,
  onActive,
  visibleKey,
}: {
  listings: ListingCardData[];
  mode: SearchMode;
  activeId: string | null;
  /** A pin is hovered (id) or left (null). */
  onActive: (id: string | null) => void;
  visibleKey: string;
}) {
  const t = useTranslations("Search");
  const tListings = useTranslations("Listings");
  const tType = useTranslations("ListingType");
  const locale = useLocale();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pinsRef = useRef(new Map<string, Pin>());
  // Latest callbacks for listeners attached once per marker.
  const onActiveRef = useRef(onActive);
  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [RWANDA_CENTER[1], RWANDA_CENTER[0]],
      zoom: 7.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pins and their previews, rebuilt when the results change; then frame them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    for (const { marker } of pins.values()) marker.remove();
    pins.clear();

    for (const listing of listings) {
      const price = pinPrice(listing, mode);
      if (!price) continue;

      const root = el("div", "price-pin-root");
      const pin = el("button", "price-pin", pinLabel(price.amount, locale));
      pin.type = "button";
      pin.setAttribute("aria-label", `${listing.title}, ${formatRWF(price.amount, locale)}`);
      root.append(pin);
      root.addEventListener("mouseenter", () => onActiveRef.current(listing.id));
      root.addEventListener("mouseleave", () => onActiveRef.current(null));

      // Preview card, built with DOM APIs (text never parsed as HTML).
      const href = `/listings/${listing.id}`;
      const card = el("a", "listing-preview");
      card.href = `/${locale}${href}`;
      card.addEventListener("click", (event) => {
        event.preventDefault();
        router.push(href);
      });
      const cover = listing.photos[0];
      if (cover) {
        const img = el("img", "listing-preview-photo");
        img.src = `${cover.url}${cover.url.includes("?") ? "&" : "?"}w=480&q=70&auto=format&fit=crop`;
        img.alt = "";
        card.append(img);
      }
      const body = el("span", "listing-preview-body");
      body.append(
        el("span", "listing-preview-title", tListings("typeIn", { type: tType(listing.type), city: listing.city })),
        el("span", "listing-preview-name", listing.title),
      );
      const priceLine = el("span", "listing-preview-price");
      priceLine.append(
        el("b", "", formatRWF(price.amount, locale)),
        document.createTextNode(
          ` ${price.unit === "NIGHT" ? tListings("forNightsShort", { count: SAMPLE_NIGHTS }) : tListings(`perUnit.${price.unit}`)}`,
        ),
      );
      body.append(priceLine);
      card.append(body);

      const popup = new maplibregl.Popup({ offset: 22, closeButton: false, maxWidth: "260px", className: "listing-popup" }).setDOMContent(card);
      const marker = new maplibregl.Marker({ element: root, anchor: "center" }).setLngLat([listing.lng, listing.lat]).setPopup(popup).addTo(map);
      pins.set(listing.id, { marker, root, pin });
    }

    const bounds = resultsBounds(listings);
    if (!bounds) map.jumpTo({ center: [RWANDA_CENTER[1], RWANDA_CENTER[0]], zoom: 7.5 });
    else if (listings.length === 1) map.jumpTo({ center: [bounds[0][1], bounds[0][0]], zoom: 13.5 });
    else
      map.fitBounds(
        [
          [bounds[0][1], bounds[0][0]],
          [bounds[1][1], bounds[1][0]],
        ],
        { padding: 72, maxZoom: 13.5, duration: 0 },
      );
  }, [listings, mode, locale, router, tListings, tType]);

  // Highlight the active pin and lift it above its neighbours.
  useEffect(() => {
    for (const [id, { root, pin }] of pinsRef.current) {
      const active = id === activeId;
      pin.setAttribute("data-active", String(active));
      root.style.setProperty("z-index", active ? "10" : "");
    }
  }, [activeId, listings]);

  // Shown again (phones' Map / List toggle): re-measure the canvas.
  useEffect(() => {
    mapRef.current?.resize();
  }, [visibleKey]);

  return <div ref={containerRef} className="size-full" role="region" aria-label={t("mapLabel")} />;
}
