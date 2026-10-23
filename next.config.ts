import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Files read from disk at runtime must be in the serverless bundle: pages
  // rendered on request read their legal texts from legal/*.md.
  outputFileTracingIncludes: {
    "/event/[token]": ["./legal/*.md"],
    "/kiosk/[id]": ["./legal/*.md"],
    "/confidentiality": ["./legal/*.md"],
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
