import { expect, test } from "@playwright/test";

const TEST_SYMBOL = "E2ETEST.NS";

test.describe("Watchlist dashboard", () => {
  test.afterEach(async ({ request }) => {
    // Best-effort cleanup in case a test fails mid-way and leaves the
    // symbol behind for the next run.
    await request.delete(`/api/watchlist/${TEST_SYMBOL}`).catch(() => {});
  });

  test("shows the seeded watchlist with live prices", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What Did I Miss?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "INFY.NS" })).toBeVisible();
    await expect(page.getByText(/^₹/).first()).toBeVisible();
  });

  test("adding a symbol shows it on the dashboard, removing takes it off", async ({ page }) => {
    await page.goto("/");

    await page.getByPlaceholder("Add a symbol, e.g. WIPRO.NS").fill(TEST_SYMBOL);
    await page.getByRole("button", { name: "Add" }).click();

    const card = page.getByTestId(`stock-card-${TEST_SYMBOL}`);
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Remove from watchlist" }).click();

    await expect(card).not.toBeVisible();
  });

  test("stock detail page shows a price chart", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "View details →" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Last 20 trading days")).toBeVisible();
    await expect(page.locator("svg.recharts-surface")).toBeVisible();
  });

  test("switching a demo scenario changes that symbol's classification", async ({ page, request }) => {
    // Establish a known-normal checkpoint first, independent of whatever
    // scenario/checkpoint state a previous test run left behind, so the
    // PRICE_SHOCK comparison below is deterministic.
    await request.post("/api/demo/scenario", { data: { symbol: "INFY.NS", scenario: "NORMAL_MARKET" } });
    await page.goto("/");
    await expect(page.getByTestId("stock-card-INFY.NS")).toBeVisible();

    const infyCard = page.getByTestId("stock-card-INFY.NS");
    await infyCard.getByRole("combobox").selectOption("PRICE_SHOCK");

    await page.reload();

    await expect(
      page.getByTestId("stock-card-INFY.NS").getByText("Significant", { exact: true }),
    ).toBeVisible();

    // Clean up so this scenario doesn't leak into other tests/runs.
    await infyCard.getByRole("combobox").selectOption("NORMAL_MARKET");
  });
});
