import { expect, test } from "@playwright/test";

const TEST_SYMBOL = "E2ETEST.NS";

async function getSeededUsers(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/users");
  const { users } = (await res.json()) as { users: { id: string; name: string }[] };
  const meghan = users.find((u) => u.name === "Meghan");
  const siya = users.find((u) => u.name === "Siya");
  if (!meghan || !siya) throw new Error("Expected seeded demo users Meghan and Siya to exist");
  return { meghan, siya, users };
}

test.describe("Watchlist dashboard", () => {
  test.afterEach(async ({ request }) => {
    // Best-effort cleanup in case a test fails mid-way and leaves the
    // symbol behind for the next run — try every seeded user, since we
    // don't know which one the UI happened to default to.
    const { users } = await getSeededUsers(request);
    for (const user of users) {
      await request.delete(`/api/watchlist/${TEST_SYMBOL}?userId=${user.id}`).catch(() => {});
    }
  });

  test("shows the seeded watchlist with live prices", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What Did I Miss?" })).toBeVisible();
    // Defaults to the first seeded user (Meghan), whose watchlist includes
    // INFY.NS.
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
    // Navigate directly rather than clicking through — the symbol may
    // render as a full "worth a look" card or a compact row depending on
    // its classification, and either way its symbol text links here.
    await page.goto("/stock/INFY.NS");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Last 20 trading days")).toBeVisible();
    await expect(page.locator("svg.recharts-surface")).toBeVisible();
  });

  test("simulating a market condition still classifies through the real change engine", async ({
    page,
    request,
  }) => {
    // Establish a known-normal checkpoint first, independent of whatever
    // scenario/checkpoint state a previous test run left behind, so the
    // PRICE_SHOCK comparison below is deterministic.
    await request.post("/api/demo/scenario", { data: { symbol: "INFY.NS", scenario: "NORMAL_MARKET" } });
    await page.goto("/");
    await expect(page.getByTestId("stock-card-INFY.NS")).toBeVisible();

    // Simulation controls live in the collapsed "Market simulation" panel.
    await page.getByRole("button", { name: /market simulation/i }).click();
    const scenarioSelect = page.getByTestId("simulation-scenario-INFY.NS");
    await scenarioSelect.selectOption("PRICE_SHOCK");

    await page.reload();

    // The panel never assigns "Significant" directly — it only forces the
    // synthetic price; this classification is the real change engine's own
    // conclusion from that price move.
    await expect(
      page.getByTestId("stock-card-INFY.NS").getByText("Significant", { exact: true }),
    ).toBeVisible();

    // Clean up so this scenario doesn't leak into other tests/runs.
    await page.getByRole("button", { name: /market simulation/i }).click();
    await page.getByTestId("simulation-scenario-INFY.NS").selectOption("NORMAL_MARKET");
  });

  test("switching users immediately loads each user's own, isolated watchlist", async ({ page, request }) => {
    const { meghan, siya } = await getSeededUsers(request);

    await page.goto("/");

    // Defaults to the first seeded user (Meghan) — their watchlist has
    // INFY.NS but not Siya's HDFCBANK.NS.
    await expect(page.getByTestId("user-switcher")).toHaveValue(meghan.id);
    await expect(page.getByRole("link", { name: "INFY.NS" })).toBeVisible();
    await expect(page.getByTestId("stock-card-HDFCBANK.NS")).toHaveCount(0);

    // Switching users is a plain client-side selection (no login) — the
    // dashboard should update immediately with no reload.
    await page.getByTestId("user-switcher").selectOption(siya.id);
    await expect(page.getByTestId("stock-card-HDFCBANK.NS")).toBeVisible();
    await expect(page.getByRole("link", { name: "INFY.NS" })).toHaveCount(0);
  });

  test("a checkpoint committed for one user never affects another user's classification", async ({
    page,
    request,
  }) => {
    const { meghan, siya } = await getSeededUsers(request);
    const symbol = "ISOTEST.NS";

    // Both users track the exact same symbol, so they're comparing the
    // same shared MarketObservation history — any difference in what they
    // see can only come from their own independent checkpoint.
    await request.post("/api/watchlist", { data: { userId: meghan.id, symbol } });
    await request.post("/api/watchlist", { data: { userId: siya.id, symbol } });
    await request.post("/api/demo/scenario", { data: { symbol, scenario: "NORMAL_MARKET" } });

    try {
      // Meghan visits first — establishing THEIR baseline checkpoint at
      // today's (pre-shock) price.
      await page.goto("/");
      await expect(page.getByTestId("user-switcher")).toHaveValue(meghan.id);
      await expect(page.getByTestId(`stock-card-${symbol}`)).toBeVisible();

      // Now the shared underlying price shocks.
      await request.post("/api/demo/scenario", { data: { symbol, scenario: "PRICE_SHOCK" } });

      // Siya visits for the very first time. They have no checkpoint at
      // all — their baseline gets established fresh, right now, at the
      // already-shocked price. They must never inherit Meghan's
      // "Significant" read of the same move.
      await page.getByTestId("user-switcher").selectOption(siya.id);
      const siyaCard = page.getByTestId(`stock-card-${symbol}`);
      await expect(siyaCard).toBeVisible();
      await expect(siyaCard.getByText("Significant", { exact: true })).toHaveCount(0);

      // Meghan, switched back to, still sees it as significant — their
      // checkpoint predates the shock, unaffected by Siya's visit.
      await page.getByTestId("user-switcher").selectOption(meghan.id);
      await page.reload();
      await expect(
        page.getByTestId(`stock-card-${symbol}`).getByText("Significant", { exact: true }),
      ).toBeVisible();
    } finally {
      await request.post("/api/demo/scenario", { data: { symbol, scenario: "NORMAL_MARKET" } });
      await request.delete(`/api/watchlist/${symbol}?userId=${meghan.id}`).catch(() => {});
      await request.delete(`/api/watchlist/${symbol}?userId=${siya.id}`).catch(() => {});
    }
  });
});
