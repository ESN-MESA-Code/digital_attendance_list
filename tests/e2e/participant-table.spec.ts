// The organiser's participant list: one line per person on a phone, a table
// elsewhere – names only.
import { ORGANISER, admin, anonClient, participantRow } from "../helpers/local";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ signInAsOrganiser }) => {
  await signInAsOrganiser();
});

test("shows each participant compactly", async ({ page, event }, testInfo) => {
  await anonClient().from("participants").insert([
    participantRow(event.id),
    participantRow(event.id, { first_name: "Maximiliane-Theresa", last_name: "Wolfeschlegelsteinhausen" }),
    participantRow(event.id, { first_name: "Ana" }),
  ]);
  // A kiosk sign-in (inserted directly: kiosk rows need an organiser's session).
  await admin
    .from("participants")
    .insert(participantRow(event.id, { last_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER.email }));

  const phone = testInfo.project.name === "phone";
  // Pixel 7 is 412 px wide; check the narrower phones too.
  if (phone) await page.setViewportSize({ width: 375, height: 812 });

  await page.goto(`/dashboard/events/${event.id}`);
  const items = phone ? page.getByTestId("participant-card") : page.locator("tbody tr");
  await expect(items).toHaveCount(4);

  if (phone) {
    await expect(page.getByRole("table")).toBeHidden();
    await expect(items.nth(0)).toContainText("Max Mustermann");
    await expect(items.nth(3).getByText("K", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("columnheader")).toHaveText(["#", "Surname", "First Name"]);
    await expect(items.nth(3).getByText("Kiosk", { exact: true }).last()).toBeVisible();
  }

  // One line per person
  const lines = await items.evaluateAll((els) =>
    els.map((el) => {
      const centres: number[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0) centres.push((r.top + r.bottom) / 2);
      }
      centres.sort((a, b) => a - b);
      return centres.filter((c, i) => i === 0 || c - centres[i - 1] > 6).length;
    })
  );
  for (const n of lines) expect(n).toBe(1);

  // The page itself never scrolls sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  if (phone) {
    const card = page.locator("div.rounded-xl", { has: items.first() });
    await card.screenshot({ path: testInfo.outputPath("phone-participants.png") });
  }
});
