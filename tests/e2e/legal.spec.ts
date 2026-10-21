// Legal: the Impressum and the privacy notice are public and linked from
// every page, and from the attendance form where the data is collected.
import { expect, test } from "./fixtures";

for (const [path, heading] of [
  ["/impressum", "Impressum / Legal notice"],
  ["/privacy", "Privacy notice"],
  ["/datenschutz", "Datenschutzerklärung"],
]) {
  test(`${path} is public`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("info@esnmesa.org").first()).toBeVisible();
  });
}

test("the login page links both in its footer", async ({ page }) => {
  await page.goto("/login");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Impressum / Legal notice" }).click();
  await expect(page.getByText("VR 200385")).toBeVisible();
  await page.goBack();
  await footer.getByRole("link", { name: "Privacy / Datenschutz" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
});

test("the attendance form explains the data processing and links the notice", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  await expect(page.getByText("Data processing", { exact: true })).toBeVisible();
  await expect(page.getByText("info@esnmesa.org")).toBeVisible();
  // The box links the full notice, in a new tab so the form keeps what was entered.
  const [boxNotice] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "privacy notice", exact: true }).click(),
  ]);
  await expect(boxNotice.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
  await boxNotice.close();
  // The footer links open a new tab as well.
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Impressum / Legal notice" })).toHaveAttribute("target", "_blank");
  const [notice] = await Promise.all([
    page.waitForEvent("popup"),
    footer.getByRole("link", { name: "Privacy / Datenschutz" }).click(),
  ]);
  await expect(notice.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
});
