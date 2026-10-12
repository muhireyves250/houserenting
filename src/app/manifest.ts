import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Space Rental",
    short_name: "Space Rental",
    description: "Rent houses, lodges and apartments in Rwanda.",
    start_url: "/",
    display: "standalone",
    background_color: "#0057b8",
    theme_color: "#0057b8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
