import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  images: {
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
