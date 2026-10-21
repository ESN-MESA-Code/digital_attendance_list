import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF export reads the bundled Liberation Sans files from disk at
  // runtime; keep them in the serverless bundle for that route.
  outputFileTracingIncludes: {
    "/api/export/event/[id]/pdf": ["./lib/pdf/fonts/*.ttf"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
