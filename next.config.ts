import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Files read from disk at runtime must be in the serverless bundle: the
  // bundled Liberation Sans fonts for the PDF routes, the legal texts for
  // the attendance forms.
  outputFileTracingIncludes: {
    "/api/export/event/[id]/pdf": ["./lib/pdf/fonts/*.ttf"],
    "/api/export/events/pdf": ["./lib/pdf/fonts/*.ttf"],
    // Pages rendered on request read their legal texts from legal/*.md.
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
