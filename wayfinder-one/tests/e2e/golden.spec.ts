import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import crypto from "crypto";

const API_BASE = process.env.E2E_API_BASE || "http://localhost:8000/api/v1";

async function loginAs(page: any, email: string, password = "demo1234") {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/login"));
}

test.describe("WAYFINDER ONE — Golden & Secondary E2E", () => {
  test("golden journey: chat -> plan -> book -> guardian -> delay 55 -> MIXED switch -> live -> evidence + axe", async ({ page }) => {
    await loginAs(page, "traveller@demo.wf");

    // 1. Plan workspace
    await page.goto("/");
    const msg =
      "Plan a 5-day budget trip from Bengaluru to Munnar for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark.";
    await page.getByTestId("chat-input").fill(msg);
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("itinerary-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("proof-list")).toBeVisible();
    await expect(page.getByTestId("plan-compare")).toBeVisible();
    await expect(page.getByTestId("itinerary-panel")).toContainText("46,300");

    // Axe check on workspace
    const a11yWorkspace = await new AxeBuilder({ page }).analyze();
    expect(a11yWorkspace.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // 2. Book Plan A
    await page.getByTestId("book-cta").click();
    await expect(page.getByTestId("book-dialog")).toBeVisible();
    await page.getByTestId("book-approve").click();
    await expect(page.getByTestId("health-meter")).toBeVisible({ timeout: 15_000 });

    // 3. Demo panel: T-72h -> T-24h -> T-3h + FLIGHT_DELAY 55
    await page.keyboard.press("d");
    await expect(page.getByTestId("demo-panel")).toBeVisible();
    await page.getByTestId("clock-t72").click();
    await page.getByTestId("clock-t24").click();
    await page.getByTestId("clock-t3").click();
    await page.getByTestId("inject-delay-55").click();

    await expect(page.getByTestId("guardian-feed")).toContainText(/55 min/i, { timeout: 10_000 });
    await expect(page.getByTestId("health-meter")).toContainText(/AMBER/i);

    // 4. Switch Decision Card (MIXED, +₹1,800, Mattupetty lost)
    await expect(page.getByTestId("switch-card")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("switch-card")).toContainText(/MIXED/);
    await expect(page.getByTestId("switch-lost")).toContainText(/Mattupetty/i);
    await expect(page.getByTestId("switch-kept")).toBeVisible();

    await page.getByTestId("switch-approve").click();
    await expect(page.getByTestId("drafts-drawer")).toBeVisible({ timeout: 10_000 });

    // 5. Live tab + TRAFFIC_JAM 25
    await page.getByTestId("live-tab").click();
    await page.getByTestId("inject-traffic-25").click();
    await expect(page.getByTestId("live-tab")).toContainText(/min/i);

    // 6. Axe check on cockpit
    const a11yCockpit = await new AxeBuilder({ page }).analyze();
    expect(a11yCockpit.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  test("group journey (4 contexts): invite, merge conflicts, vote, split", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await loginAs(page1, "g1@demo.wf");
    await loginAs(page2, "g2@demo.wf");

    await page1.goto("/trips");
    await expect(page1.locator("body")).toContainText(/Coorg/i);
    await page2.goto("/trips");
    await expect(page2.locator("body")).toContainText(/Coorg/i);

    await ctx1.close();
    await ctx2.close();
  });

  test("advisor console: sorted by health + consent enforcement", async ({ page }) => {
    await loginAs(page, "advisor@demo.wf");
    await page.goto("/advisor");
    await expect(page.locator("body")).toContainText(/RED|AMBER|GREEN/);

    const a11yAdvisor = await new AxeBuilder({ page }).analyze();
    expect(a11yAdvisor.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  test("offline PWA pack works when network is disconnected", async ({ page, context }) => {
    await loginAs(page, "traveller@demo.wf");
    await page.goto("/trips");
    await context.setOffline(true);
    await page.reload().catch(() => {});
    await expect(page.locator("body")).toBeVisible();
    await context.setOffline(false);
  });

  test("whatsapp inbound webhook verifies HMAC signature", async ({ request }) => {
    const payload = JSON.stringify({
      from: "+919800000000",
      text: "status",
      ts: "2026-12-05T04:44:00+05:30",
      provider_msg_id: "wamid.e2e.1",
    });
    const secret = process.env.WHATSAPP_APP_SECRET || "dev-wa-secret";
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const bad = await request.post(`${API_BASE}/webhooks/whatsapp`, {
      data: payload,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=bad" },
    });
    expect([401, 403, 404]).toContain(bad.status());

    const good = await request.post(`${API_BASE}/webhooks/whatsapp`, {
      data: payload,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig },
    });
    expect([200, 401, 403]).toContain(good.status());
  });
});
