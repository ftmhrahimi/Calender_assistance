/**
 * Smoke test: load the unpacked extension in real Chromium and verify
 * - the manifest is accepted (service worker registers),
 * - the popup renders and runs its module scripts,
 * - the options page renders, saves config, and the popup sees it.
 *
 * Run with: node tests/smoke.extension.mjs
 * Requires a Chromium binary (CHROMIUM_PATH env var, default
 * /opt/pw-browsers/chromium) and playwright-core.
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../extension');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

function assert(cond, msg) {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
}

const userDataDir = mkdtempSync(join(tmpdir(), 'ca-smoke-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: CHROMIUM,
  headless: true,
  args: [
    '--headless=new',
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`
  ]
});

try {
  // 1. Service worker must register — proves the manifest and module imports load.
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;
  assert(/^[a-p]{32}$/.test(extensionId), `unexpected extension id: ${extensionId}`);
  console.log(`service worker registered (${extensionId})`);

  // 2. The onInstalled handler opens the options page on first install.
  //    Give it a moment, then check it exists (non-fatal if timing differs).
  await new Promise((r) => setTimeout(r, 1000));
  const optionsOpened = context
    .pages()
    .some((p) => p.url().includes(`${extensionId}/options/options.html`));
  console.log(`options page auto-opened on install: ${optionsOpened}`);

  // 3. Options page renders, accepts input, and persists to chrome.storage.
  const options = await context.newPage();
  const consoleErrors = [];
  options.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  options.on('pageerror', (e) => consoleErrors.push(String(e)));
  await options.goto(`chrome-extension://${extensionId}/options/options.html`);
  await options.fill('#api-key', 'smoke-test-key');
  await options.fill('#duration', '45');
  await options.click('#save');
  await options.waitForSelector('#save-result:has-text("Saved.")', { timeout: 5000 });
  const stored = await options.evaluate(() =>
    chrome.storage.local.get(['deepinfraApiKey', 'defaultDurationMinutes'])
  );
  assert(stored.deepinfraApiKey === 'smoke-test-key', 'API key not persisted');
  assert(stored.defaultDurationMinutes === 45, 'duration not persisted');
  console.log('options page saves config');

  // 4. Popup renders; with a key configured it must NOT show the setup warning.
  const popup = await context.newPage();
  popup.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  popup.on('pageerror', (e) => consoleErrors.push(String(e)));
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.waitForSelector('#parse-btn');
  await new Promise((r) => setTimeout(r, 500));
  const errorVisible = await popup.isVisible('#error');
  assert(!errorVisible, 'popup shows an error despite configured API key');
  console.log('popup renders with no setup warning');

  // 5. Empty input must produce a friendly validation error, not a crash.
  await popup.click('#parse-btn');
  await popup.waitForSelector('#error:not([hidden])', { timeout: 5000 });
  const errText = await popup.textContent('#error-text');
  assert(/describe the event/i.test(errText), `unexpected validation text: ${errText}`);
  console.log('popup validates empty input');

  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);
  console.log('SMOKE PASS');
} finally {
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
}
