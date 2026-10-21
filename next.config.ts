import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF export reads the bundled Liberation Sans files from disk at
  // runtime; keep them in the serverless bundle for that route.
  outputFileTracingIncludes: {
    "/api/export/event/[id]/pdf": ["./lib/pdf/fonts/*.ttf"],
  },
};

export default nextConfig;
