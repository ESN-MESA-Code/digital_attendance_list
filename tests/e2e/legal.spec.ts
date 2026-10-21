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
    await expect(page.getByText("it@esnmesa.org").first()).toBeVisible();
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

test("the attendance form links the privacy notice in a new tab", async ({ page, event }) => {
  await page.goto(`/event/${event.public_token}`);
  const link = page.getByRole("link", { name: "How we handle your data" });
  await expect(link).toHaveAttribute("target", "_blank");
  const [notice] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await expect(notice.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
  // The footer links open new tabs too, so the form keeps what was entered.
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Impressum / Legal notice" })
  ).toHaveAttribute("target", "_blank");
});
