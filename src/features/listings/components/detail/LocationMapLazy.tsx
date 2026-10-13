"use client";

import dynamic from "next/dynamic";

// MapLibre needs the browser (window, WebGL); load it client-side only.
export const LocationMapLazy = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eceef1]" />,
});
