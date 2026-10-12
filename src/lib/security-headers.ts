export function securityHeaders({ isProd }: { isProd: boolean }): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    // Next.js injects inline bootstrap scripts; tighten to nonces in a later phase.
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
    "font-src 'self'",
    "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ];
  if (isProd) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  return headers;
}
