import { expect, test } from "@playwright/test";

test("dashboard exposes the operational state", async ({ page, isMobile }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await expect(page.getByText("Lumina desk lamp").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Queue activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest change" })).toBeVisible();
  if (!isMobile) await expect(page.getByText("All systems nominal")).toBeVisible();
});

test("new monitor editor maps selectors to structured values", async ({ page }) => {
  await page.goto("/monitors/new");

  await expect(page.getByRole("heading", { name: "Configure extraction" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Extraction schema" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Normalized output" })).toBeVisible();
  await expect(page.locator(".json-output")).toContainText('"price"');
  await expect(page.locator(".selector-price")).toBeVisible();

  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(page.getByText("3/3 fields extracted")).toBeVisible();

  await page.getByRole("button", { name: "Add extraction field" }).click();
  await page.getByLabel("Key for field 4").fill("github_url");
  await page.getByLabel("Selector for field 4").fill('a[href="https://github.com/JMDcore"]');
  await page.getByLabel("Type for field 4").selectOption("url");
  await page.getByLabel("Attribute for field 4").fill("href");
  await page.getByLabel("Multiple values").nth(3).check();

  await expect(page.getByLabel("Key for field 4")).toHaveValue("github_url");
  await expect(page.getByLabel("Attribute for field 4")).toHaveValue("href");
  await expect(page.getByLabel("Multiple values").nth(3)).toBeChecked();
});

test("monitor detail renders diff, capture and processing log", async ({ page }) => {
  await page.goto("/monitors/20000000-0000-4000-8000-000000000001");

  await expect(page.getByRole("heading", { name: "Lumina desk lamp" })).toBeVisible();
  await expect(page.getByText("Captured page")).toBeVisible();
  await expect(page.getByText("Change comparison")).toBeVisible();
  await expect(page.locator(".diff-list")).toContainText("129");
  await expect(page.locator(".diff-list")).toContainText("109");
  await expect(page.getByText("Run log")).toBeVisible();
});

test("controlled target exposes stable extraction selectors", async ({ page }) => {
  await page.goto("/demo/lumina-desk-lamp.html");

  await expect(page.locator("h1")).toHaveText("Lumina desk lamp");
  await expect(page.locator("[data-price]")).toHaveAttribute("data-price", "109.00");
  await expect(page.locator("[data-stock]")).toHaveText(/Only 4 left/);
});

test("responsive application has no horizontal page overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only layout assertion");
  await page.goto("/");

  await expect(page.locator(".mobile-nav")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});
