import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Pages already opened show again instantly from memory (data refreshes after any change, and after 3 minutes).
    staleTimes: { dynamic: 180, static: 600 },
  },
  serverExternalPackages: ["@node-rs/argon2"],
  images: {
    // In dev the browser loads photos straight from Unsplash/Cloudinary: on slow connections the local optimizer's
    // fetches time out (504). Production keeps optimised images.
    unoptimized: process.env.NODE_ENV === "development",
    // 90 for the hero photo; 75 (default) elsewhere.
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isProd: process.env.NODE_ENV === "production" }) }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
