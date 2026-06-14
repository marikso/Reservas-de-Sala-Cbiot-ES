const { chromium } = require("playwright");

async function getModalText(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(2000);
  await page.locator(".sala-card-mapa").first().click();
  await page.waitForTimeout(1000);
  const title = await page.locator(".reserva-header h2").textContent().catch(() => "");
  const subtitle = await page.locator(".reserva-header p").textContent().catch(() => "");
  const btn = await page.locator(".reserva-footer-actions .btn-primary").textContent().catch(() => "");
  const checkbox = await page.locator(".reserva-label-text").textContent().catch(() => "");
  await page.screenshot({ path: `C:/Users/maria/Desktop/modal_${label}.png` });
  console.log(`[${label}] título: "${title}" | subtítulo: "${subtitle}" | botão: "${btn}" | checkbox: "${checkbox}"`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await getModalText(browser, "current");
  await browser.close();
})();
