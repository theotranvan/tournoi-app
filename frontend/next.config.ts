import type { NextConfig } from "next";

const isMobile = process.env.BUILD_TARGET === "mobile";

const backendUrl =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ??
  "https://tournoi-app-bpk4.onrender.com";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: isMobile ? "export" : "standalone",
  turbopack: {},
  ...(isMobile && { images: { unoptimized: true } }),
  typescript: {
    ignoreBuildErrors: true,
  },
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
