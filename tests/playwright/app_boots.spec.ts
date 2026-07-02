// app_boots.spec.ts - smoke test: the app boots and responds to interaction.
//
// Verifies the ESM bundle loads, renders its core panels, and that switching
// a regimen preset plus moving the time scrubber updates the chart and a
// metric chip.
import { test, expect } from "@playwright/test";

test("app boots and updates on preset and time interaction", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForLoadState("domcontentloaded");

  // Boot assertions: core panels are populated, not empty placeholders.
  const chartRoot = page.locator("#chart-root");
  const presetGrid = page.locator("#preset-button-grid");
  const lifeStatus = page.locator("#metric-life-status");

  await expect(chartRoot).not.toBeEmpty();
  await expect(presetGrid.locator(".preset-button")).not.toHaveCount(0);
  await expect(lifeStatus).not.toHaveText("");

  // Snapshot pre-interaction state to compare against after the interaction.
  const chartBefore = await chartRoot.innerHTML();
  const burdenBefore = await page.locator("#metric-total-burden").innerText();

  // Interaction 1: click a different regimen preset than whatever is active.
  const presetButtons = presetGrid.locator(".preset-button");
  const activeButton = presetGrid.locator(".preset-button.is-active");
  const activeRegimenId = await activeButton.first().getAttribute("data-regimen-id");
  const otherButton = presetButtons.filter({
    hasNot: page.locator(`[data-regimen-id="${activeRegimenId}"]`),
  });
  await otherButton.first().click();

  // Interaction 2: move the time scrubber forward.
  const timeScrubber = page.locator("#time-scrubber");
  const maxAttr = await timeScrubber.getAttribute("max");
  const maxValue = Number(maxAttr);
  const targetValue = String(Math.max(1, Math.floor(maxValue / 2)));
  await timeScrubber.fill(targetValue);
  await timeScrubber.dispatchEvent("input");

  // Assert the chart and a metric changed from the pre-interaction snapshot.
  await expect.poll(async () => await chartRoot.innerHTML()).not.toBe(chartBefore);
  await expect
    .poll(async () => await page.locator("#metric-total-burden").innerText())
    .not.toBe(burdenBefore);
});
