import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      // Pure logic, no services needed: `npm test`
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      // Against the local Supabase stack (`npx supabase start`): `npm run test:db`
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Realtime and storage tests share the one local stack.
          fileParallelism: false,
        },
      },
    ],
  },
});
