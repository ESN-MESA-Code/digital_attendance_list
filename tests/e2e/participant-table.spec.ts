// The organiser's participant list: a two-line card per person on a phone
// (name, then the rest, signature to the right), the full table elsewhere.
import { ORGANISER, admin, anonClient, participantRow } from "../helpers/local";
import { sampleSignature } from "../helpers/png";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ signInAsOrganiser }) => {
  await signInAsOrganiser();
});

test("shows each participant compactly", async ({ page, event }, testInfo) => {
  const signature = await sampleSignature();
  await anonClient().from("participants").insert([
    participantRow(event.id, signature, { esn_card: true }),
    participantRow(event.id, signature, {
      first_name: "Maximiliane-Theresa",
      last_name: "Wolfeschlegelsteinhausen",
      nationality: "GB",
      university: "Other",
      exchange_program: "Full-time degree",
    }),
    participantRow(event.id, signature, { university: "LMU", exchange_program: "LMUexchange" }),
  ]);
  // A kiosk sign-in (inserted directly: kiosk rows need an organiser's session).
  await admin
    .from("participants")
    .insert(participantRow(event.id, signature, { last_name: "Kiosk", entry_method: "kiosk", recorded_by: ORGANISER.email }));

  const phone = testInfo.project.name === "phone";
  // Pixel 7 is 412 px wide; check the narrower phones too.
  if (phone) await page.setViewportSize({ width: 375, height: 812 });

  await page.goto(`/dashboard/events/${event.id}`);
  const items = phone ? page.getByTestId("participant-card") : page.locator("tbody tr");
  await expect(items).toHaveCount(4);
  await expect(page.getByRole(phone ? "list" : "table").last()).toBeVisible();
  // Wait for the signatures to load so the layout is final.
  await expect(page.getByAltText(/signature$/).filter({ visible: true }).first()).toBeVisible();

  if (phone) {
    await expect(page.getByRole("table")).toBeHidden();
    // Full name first, short labels on the second line
    await expect(items.nth(0)).toContainText("Max Mustermann");
    const long = items.nth(1);
    await expect(long).toContainText("GB · Oth · FT · ESN – ·");
    await expect(items.nth(0)).toContainText("ESN ✓");
    await expect(items.nth(2)).toContainText("LMUex");
    await expect(items.nth(3).getByText("K", { exact: true })).toBeVisible();
  }

  // Lines of text per item (a wrapped text node has client rects at several
  // heights), and where the signature sits.
  const layout = await items.evaluateAll((els) =>
    els.map((el) => {
      const centres: number[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0) centres.push((r.top + r.bottom) / 2);
      }
      // Text of different sizes on one line still shares roughly its middle.
      centres.sort((a, b) => a - b);
      const lines = centres.filter((c, i) => i === 0 || c - centres[i - 1] > 6).length;
      const box = el.getBoundingClientRect();
      const sig = el.querySelector("img")!.getBoundingClientRect();
      return { lines, box, sig };
    })
  );
  for (const { lines, box, sig } of layout) {
    if (phone) {
      expect(lines).toBe(2);
      // The signature fills the right-hand column across both lines.
      expect(box.right - sig.right).toBeLessThan(12);
      expect(sig.height).toBeGreaterThan(box.height * 0.6);
      expect(box.height).toBeLessThan(60);
    } else {
      expect(lines).toBe(1);
    }
  }

  // The page itself never scrolls sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  if (phone) {
    const card = page.locator("div.rounded-xl", { has: items.first() });
    await card.screenshot({ path: testInfo.outputPath("phone-participants.png") });
  }
});
