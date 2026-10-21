// Security: organiser pages and exports need an esnmesa.org login; forged
// sessions don't count; responses carry protective headers.
import { SIGNOUT_ORGANISER, forgedJwt, sessionCookies } from "../helpers/local";
import { expect, test } from "./fixtures";

const someId = "00000000-0000-4000-8000-000000000000";
const pages = ["/dashboard", "/dashboard/events", `/dashboard/events/${someId}`, `/kiosk/${someId}`];
const apis = [
  `/api/export/event/${someId}/csv`,
  `/api/export/event/${someId}/pdf`,
  `/api/export/events/pdf?ids=${someId}`,
];

test.describe("signed out", () => {
  for (const path of pages) {
    test(`${path} redirects to the login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
      await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    });
  }

  for (const path of apis) {
    test(`${path} answers 401`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe("forged sessions", () => {
  // Tokens signed with the right key but for users that don't exist in
  // Supabase Auth – the server must ask Auth, not trust the cookie.
  for (const email of ["someone@esnmesa.org", "someone@gmail.com"]) {
    test(`a forged token for ${email} is rejected`, async ({ context, page, baseURL }) => {
      const access_token = forgedJwt(email);
      await context.addCookies(
        sessionCookies(
          {
            access_token,
            refresh_token: "forged",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: someId, email, app_metadata: { provider: "google" }, user_metadata: { custom_claims: { hd: "esnmesa.org" } } },
          },
          baseURL!
        )
      );
      await page.goto("/dashboard/events");
      await expect(page).toHaveURL(/\/login/);
      expect((await page.request.get(apis[0])).status()).toBe(401);
    });
  }
});

test("sign-out ends the organiser session", async ({ page, signInAsOrganiser }) => {
  await signInAsOrganiser(SIGNOUT_ORGANISER);
  await page.goto("/dashboard/events");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard/events");
  await expect(page).toHaveURL(/\/login/);
});

test("the auth callback without a code goes back to the login, ignoring next", async ({ page }) => {
  await page.goto("/auth/callback?next=//evil.example");
  await expect(page).toHaveURL(/\/login\?error=missing_code/);
});

test("responses forbid framing and MIME sniffing and keep the token out of Referer", async ({ request }) => {
  for (const path of ["/login", "/event/some-token"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("same-origin");
  }
});
