import { defineConfig, devices } from "@playwright/test";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./tests/helpers/local";

// End-to-end tests against the local Supabase stack (`npx supabase start`).
// Playwright starts the app on its own port with the local stack's keys.
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // The dev server compiles each page on its first visit.
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Participants sign on their phones (public form); organisers check the list on theirs.
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /public-form|participant-table/ },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is quicker to start.
    command: process.env.CI
      ? `npx next build && npx next start --port ${PORT}`
      : `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN: "esnmesa.org",
    },
  },
});
