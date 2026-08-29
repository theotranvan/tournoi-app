import type { NextConfig } from "next";

const isMobile = process.env.BUILD_TARGET === "mobile";
const isDev = process.env.NODE_ENV === "development";

const backendUrl =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ??
  "https://tournoi-app-bpk4.onrender.com";

const wsBackend = backendUrl.replace(/^http/, "ws");

// Restrict where the page may open connections. This is the key XSS mitigation:
// even if a script is injected, it can't exfiltrate the JWT to an arbitrary host.
// Dev additionally needs localhost + HMR sockets.
const connectSrc = isDev
  ? `'self' http://localhost:* ws://localhost:* ${backendUrl} ${wsBackend}`
  : `'self' ${backendUrl} ${wsBackend}`;

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next injects inline bootstrap scripts (no nonce without middleware); dev
  // additionally needs 'unsafe-eval' for HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src ${connectSrc}`,
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera/mic/geo are unused (access codes are text, not scanned QR).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  output: isMobile ? "export" : "standalone",
  turbopack: {},
  ...(isMobile && { images: { unoptimized: true } }),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
