import { chromium } from "playwright";

function parseEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`Invalid ${name}="${raw}" (expected a finite number).`);
    process.exit(1);
  }

  return value;
}

const targetUrl = process.env.PERF_URL ?? "http://localhost:5173";
const clickProcessingBudgetMs = parseEnvNumber("PERF_CLICK_PROCESSING_BUDGET_MS", 16);
const wallBudgetMs = parseEnvNumber("PERF_CLICK_WALL_BUDGET_MS", 80);
const allowedStorageWrites = parseEnvNumber("PERF_ALLOWED_STORAGE_WRITES", 0);

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    return chromium.launch({ headless: true });
  }
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.getByText("Avery Stone", { exact: true }).first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    window.__snowballPerf = {
      clicks: [],
      longTasks: [],
      storageWrites: 0,
      storageWriteMs: 0,
      eventTimingSupported: true
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "click") {
            window.__snowballPerf.clicks.push({
              duration: entry.duration,
              processingMs: entry.processingEnd - entry.processingStart,
              startTime: entry.startTime
            });
          }
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 0 });
    } catch {
      window.__snowballPerf.eventTimingSupported = false;
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__snowballPerf.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long task observation is best effort in local browsers.
    }

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithPerfProbe(...args) {
      const start = performance.now();
      try {
        return originalSetItem.apply(this, args);
      } finally {
        window.__snowballPerf.storageWrites += 1;
        window.__snowballPerf.storageWriteMs += performance.now() - start;
      }
    };
  });

  async function settle() {
    const settledAt = await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))))
    );
    await page.waitForTimeout(25);
    return settledAt;
  }

  async function measure(name, action) {
    const before = await page.evaluate(() => ({
      clicks: window.__snowballPerf.clicks.length,
      longTasks: window.__snowballPerf.longTasks.length,
      storageWrites: window.__snowballPerf.storageWrites,
      storageWriteMs: window.__snowballPerf.storageWriteMs,
      eventTimingSupported: window.__snowballPerf.eventTimingSupported,
      t: performance.now()
    }));
    await action();
    const settledAt = await settle();

    const after = await page.evaluate(() => ({
      clicks: window.__snowballPerf.clicks,
      longTasks: window.__snowballPerf.longTasks,
      storageWrites: window.__snowballPerf.storageWrites,
      storageWriteMs: window.__snowballPerf.storageWriteMs,
      eventTimingSupported: window.__snowballPerf.eventTimingSupported,
      t: performance.now()
    }));

    return {
      name,
      wallMs: round(settledAt - before.t),
      browserMs: round(settledAt - before.t),
      clickEvents: after.clicks.slice(before.clicks).map((event) => ({
        duration: round(event.duration),
        processingMs: round(event.processingMs)
      })),
      longTasks: after.longTasks.slice(before.longTasks).map((task) => round(task.duration)),
      storageWrites: after.storageWrites - before.storageWrites,
      storageWriteMs: round(after.storageWriteMs - before.storageWriteMs),
      eventTimingSupported: before.eventTimingSupported && after.eventTimingSupported
    };
  }

  const selectBlake = () => page.getByText("Blake Chen", { exact: true }).first().click();
  const selectAvery = () => page.getByText("Avery Stone", { exact: true }).first().click();

  await measure("warmup select Blake Chen", selectBlake);
  await measure("warmup select Avery Stone", selectAvery);

  const results = [
    await measure("select Blake Chen", selectBlake),
    await measure("select Avery Stone", selectAvery),
    await measure("select Operations Team", () => page.getByText("Operations Team", { exact: true }).first().click()),
    await measure("select visible task", () => page.getByRole("button", { name: /Operations review of the task shell/ }).first().click())
  ];

  const failures = results.flatMap((result) => checksFor(result));
  console.log(JSON.stringify({ targetUrl, budgets: { clickProcessingBudgetMs, wallBudgetMs, allowedStorageWrites }, results, failures }, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function checksFor(result) {
  const failures = [];
  const maxProcessingMs = Math.max(0, ...result.clickEvents.map((event) => event.processingMs));

  if (!result.eventTimingSupported) {
    failures.push(`${result.name}: Event Timing API was unavailable, so click processing could not be measured`);
  } else if (result.clickEvents.length === 0) {
    failures.push(`${result.name}: captured no click Event Timing entries`);
  }

  if (result.wallMs > wallBudgetMs) {
    failures.push(`${result.name}: wall time ${result.wallMs}ms exceeded ${wallBudgetMs}ms`);
  }

  if (result.eventTimingSupported && maxProcessingMs > clickProcessingBudgetMs) {
    failures.push(`${result.name}: click processing ${maxProcessingMs}ms exceeded ${clickProcessingBudgetMs}ms`);
  }

  if (result.longTasks.length > 0) {
    failures.push(`${result.name}: produced long tasks ${result.longTasks.join(", ")}ms`);
  }

  if (result.storageWrites > allowedStorageWrites) {
    failures.push(`${result.name}: wrote storage ${result.storageWrites} times`);
  }

  return failures;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
