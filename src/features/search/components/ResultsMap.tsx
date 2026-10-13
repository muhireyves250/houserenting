"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { ListingCardData } from "@/features/listings/service";
import { pinLabel, pinPrice, resultsBounds, RWANDA_CENTER } from "@/features/search/map";
import type { SearchMode } from "@/features/search/params";
import { Link } from "@/i18n/navigation";
import { SAMPLE_NIGHTS } from "@/features/listings/pricing";
import { formatRWF } from "@/lib/format";

// OpenStreetMap's standard tiles: no key, attribution required, fine for normal traffic
// (https://operations.osmfoundation.org/policies/tiles/). Swap for a keyed provider at scale; update the CSP too.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const bold = (chunks: ReactNode) => <span className="font-bold text-ink">{chunks}</span>;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pinIcon(label: string, active: boolean) {
  return L.divIcon({
    className: "price-pin-anchor",
    html: `<span class="price-pin" data-active="${active}">${escapeHtml(label)}</span>`,
    iconSize: [0, 0],
  });
}

/** Frames all results (or Rwanda when there are none); re-measures when the map is shown again. */
function FitResults({ listings, visibleKey }: { listings: ListingCardData[]; visibleKey: string }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const bounds = resultsBounds(listings);
    if (!bounds) map.setView(RWANDA_CENTER, 8);
    else if (listings.length === 1) map.setView(bounds[0], 14);
    else map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14 });
  }, [map, listings, visibleKey]);
  return null;
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
  const pins = useMemo(
    () => listings.map((listing) => ({ listing, price: pinPrice(listing, mode) })).flatMap(({ listing, price }) => (price ? [{ listing, price }] : [])),
    [listings, mode],
  );

  return (
    <MapContainer
      center={RWANDA_CENTER}
      zoom={8}
      zoomControl={false}
      scrollWheelZoom
      className="size-full"
      aria-label={t("mapLabel")}
    >
      <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
      <ZoomControl position="topright" />
      <FitResults listings={listings} visibleKey={visibleKey} />
      {pins.map(({ listing, price }) => {
        const active = listing.id === activeId;
        return (
          <Marker
            key={listing.id}
            position={[listing.lat, listing.lng]}
            icon={pinIcon(pinLabel(price.amount, locale), active)}
            zIndexOffset={active ? 1000 : 0}
            title={listing.title}
            alt={listing.title}
            eventHandlers={{ mouseover: () => onActive(listing.id), mouseout: () => onActive(null) }}
          >
            <Popup closeButton={false} offset={[0, -14]} className="listing-popup">
              <Link href={`/listings/${listing.id}`} className="block w-60 overflow-hidden rounded-2xl text-ink no-underline">
                {listing.photos[0] && (
                  <span className="relative block aspect-[4/3] bg-canvas">
                    <Image src={listing.photos[0].url} alt="" fill sizes="240px" className="object-cover" />
                  </span>
                )}
                <span className="flex flex-col gap-0.5 px-3.5 py-3">
                  <span className="text-sm font-semibold">{tListings("typeIn", { type: tType(listing.type), city: listing.city })}</span>
                  <span className="truncate text-xs text-muted">{listing.title}</span>
                  <span className="mt-1 text-sm text-muted tabular-nums">
                    {price.unit === "NIGHT" ? (
                      tListings.rich("forNights", { price: formatRWF(price.amount, locale), count: SAMPLE_NIGHTS, b: bold })
                    ) : (
                      <>
                        {bold(formatRWF(price.amount, locale))} {tListings(`perUnit.${price.unit}`)}
                      </>
                    )}
                  </span>
                </span>
              </Link>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
