/**
 * Visual Test Script — 使用 Playwright 截图验证 demo 站
 *
 * 用法: node scripts/visual-test.mjs
 */

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "fs";

const BASE_URL = "http://localhost:3002";
const OUTPUT_DIR = "test-results/visual";

const pages = [
  { path: "/", name: "home", viewports: [390, 768, 1024, 1280] },
  { path: "/demo", name: "demo", viewports: [390, 768, 1024, 1280] },
  { path: "/gallery", name: "gallery", viewports: [390, 768, 1024, 1280] },
  { path: "/roadmap", name: "roadmap", viewports: [390, 768, 1024, 1280] },
];

async function main() {
  console.log("🚀 Starting visual test...\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });

  let totalSuccess = 0;
  let totalFail = 0;

  for (const pageConfig of pages) {
    console.log(`\n📄 Testing: ${pageConfig.path}`);

    const page = await context.newPage();

    // 监听页面错误
    page.on("pageerror", (err) => {
      console.log(`  ⚠️ Page error on ${pageConfig.path}: ${err.message}`);
    });

    // 监听控制台消息
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`  ⚠️ Console error on ${pageConfig.path}: ${msg.text()}`);
      }
    });

    for (const width of pageConfig.viewports) {
      const viewportName =
        width <= 420 ? "mobile" : width <= 800 ? "tablet" : width <= 1100 ? "laptop" : "desktop";
      const filename = `${pageConfig.name}-${width}.png`;

      await page.setViewportSize({ width, height: 900 });
      
      try {
        console.log(`  → Loading ${viewportName} (${width}px)...`);
        const response = await page.goto(`${BASE_URL}${pageConfig.path}`, { 
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        
        if (!response) {
          console.log(`  ❌ ${viewportName}: No response`);
          totalFail++;
          continue;
        }
        
        if (response.status() >= 400) {
          console.log(`  ❌ ${viewportName}: HTTP ${response.status()}`);
          totalFail++;
          continue;
        }
        
        // 等待内容渲染
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: `${OUTPUT_DIR}/${filename}`,
          fullPage: true,
          type: "png",
        });
        console.log(`  ✅ ${viewportName} → ${filename}`);
        totalSuccess++;
      } catch (err) {
        console.log(`  ❌ ${viewportName} (${width}px) → Error: ${err.message}`);
        totalFail++;
      }
    }

    await page.close();
  }

  await browser.close();
  console.log(`\n${"=".repeat(40)}`);
  console.log(`✨ Done! ${totalSuccess} screenshots saved, ${totalFail} failed`);
  console.log(`📁 Output: ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
