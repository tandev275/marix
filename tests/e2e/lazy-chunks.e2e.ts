/**
 * E2E: the renderer bundle is code-split, so lazily-imported UI (here the backup
 * modal) lives in a separate chunk. Under file:// with a strict CSP, a script-tag
 * chunk load can silently fail — this test proves a lazy chunk actually loads and
 * its component renders, and that nothing logged a chunk-load or CSP error.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;
const errors: string[] = [];

test.describe('Lazy chunk loading', () => {
  test.beforeAll(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marix-e2e-'));
    const launchArgs = [
      path.join(__dirname, '../../dist/main/index.js'),
      `--user-data-dir=${userDataDir}`,
    ];
    if (process.env.CI) {
      launchArgs.unshift('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage');
    }
    electronApp = await electron.launch({
      args: launchArgs,
      env: { ...process.env, NODE_ENV: 'production', ELECTRON_DISABLE_SANDBOX: process.env.CI ? '1' : undefined },
    });
    page = await electronApp.firstWindow();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('open-local-terminal').waitFor({ timeout: 20000 });
  });

  test.afterAll(async () => {
    const timeout = (ms: number) => new Promise(r => setTimeout(r, ms));
    await Promise.race([
      electronApp?.evaluate(({ BrowserWindow }) => {
        for (const win of BrowserWindow.getAllWindows()) win.destroy();
      }).catch(() => {}),
      timeout(3000),
    ]);
    await Promise.race([electronApp?.close().catch(() => {}), timeout(5000)]);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('a lazily-imported component loads its chunk and renders', async () => {
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('open-backup-create').click();

    // If the chunk fails to load (CSP/file:// issue), Suspense never resolves and
    // this element never appears.
    await expect(page.getByTestId('backup-modal')).toBeVisible({ timeout: 15000 });

    const chunkErrors = errors.filter(e =>
      /ChunkLoadError|Loading chunk|Content Security Policy|Refused to load/i.test(e));
    expect(chunkErrors, `chunk/CSP errors: ${chunkErrors.join(' | ')}`).toHaveLength(0);
  });
});
