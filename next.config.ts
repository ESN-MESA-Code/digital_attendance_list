import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF export reads the bundled Liberation Sans files from disk at
  // runtime; keep them in the serverless bundle of every PDF route.
  outputFileTracingIncludes: {
    "/api/export/event/[id]/pdf": ["./lib/pdf/fonts/*.ttf"],
    "/api/export/events/pdf": ["./lib/pdf/fonts/*.ttf"],
  },
  // No framing (clickjacking on the forms), no MIME sniffing, and the QR code
  // token in /event/[token] never leaves the site in a Referer header.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
