import { expect, test } from "@playwright/test";

test("six navigable compositions expose their complete source and remount as an assembly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?gallery28");
  const navigation = page.getByRole("navigation", { name: "Examples" });
  const names = [
    "Basics",
    "Indicators and panes",
    "Data and history",
    "Replay and date navigation",
    "Independent charts",
    "Extensions and lifecycle",
  ];
  await expect(navigation.getByRole("link")).toHaveText(names);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(names);
  for (const name of names) {
    const link = navigation.getByRole("link", { name, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    const destination = page.locator((await link.getAttribute("href")) ?? "missing");
    await expect(destination).toBeFocused();
    await expect(destination.getByRole("heading", { name, exact: true })).toBeVisible();
    const source = destination
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: /^Read the/ }) })
      .first();
    await source.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(source.locator("code")).toContainText("<Chart.");
    await source.locator("summary").press("Enter");
  }
  await expect(
    page.locator("#basics").getByRole("heading", { name: "Native panes" }),
  ).toBeAttached();
  await expect(
    page.locator("#data-history").getByRole("heading", { name: "Service-backed history" }),
  ).toBeAttached();
  await expect(page.locator("#extensions").locator("code").last()).toContainText("class");
  await page.getByRole("button", { name: "Unmount gallery", exact: true }).click();
  await expect(navigation).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Remount gallery", exact: true }).click();
  await expect(navigation.getByRole("link")).toHaveText(names);
  await expect(page.locator("#data-history").getByText(/32 candles/)).toBeVisible();
  await expect(
    page.locator("#replay-date").getByRole("button", { name: "Start replay", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
