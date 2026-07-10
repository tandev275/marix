/**
 * E2E: closing detached windows must not crash the main process.
 *
 * The 'closed' handler used to read win.webContents.id after the webContents was
 * destroyed, throwing "Object has been destroyed" — an uncaught exception that
 * popped an Electron error dialog and stalled every following close. This drives
 * the real confirm-close path (which calls win.destroy()) for both windows and
 * asserts the main process logged no uncaught exception.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;
let mainStderr = '';

const tabs = (p: Page) => p.getByTestId('session-tab');

async function openLocalTerminal(p: Page) {
  const before = await p.locator('.xterm-screen').count();
  const button = p.getByTestId('open-local-terminal');
  if (!(await button.isVisible())) {
    if (!(await p.getByTestId('nav-hosts').isVisible())) {
      await p.getByTestId('toggle-sidebar').click();
    }
    await p.getByTestId('nav-hosts').click();
  }
  await button.click();
  await expect(p.locator('.xterm-screen')).toHaveCount(before + 1, { timeout: 15000 });
}

test.describe('Closing detached windows', () => {
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
    electronApp.process().stderr?.on('data', d => { mainStderr += d.toString(); });
    page = await electronApp.firstWindow();
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
    try { electronApp?.process()?.kill('SIGKILL'); } catch {}
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('closing the detached window, then the original, crashes neither', async () => {
    await openLocalTerminal(page);
    await openLocalTerminal(page);

    // Detach a tab into its own window.
    const newWindowPromise = electronApp.waitForEvent('window');
    await tabs(page).last().click({ button: 'right' });
    await page.getByTestId('detach-tab').click();
    const detached = await newWindowPromise;
    await detached.waitForLoadState('domcontentloaded');
    await detached.getByTestId('session-tab').first().waitFor({ timeout: 15000 });

    // Close the detached window through the real confirm path (X -> confirm).
    await detached.getByTestId('window-close').click();
    await detached.getByTestId('confirm-modal-confirm').click({ timeout: 15000 });
    await expect.poll(() => electronApp.windows().length, { timeout: 15000 }).toBe(1);

    // The original window's close must still work — this is what "did nothing" before.
    await page.getByTestId('window-close').click();
    await page.getByTestId('confirm-modal-confirm').click({ timeout: 15000 });
    await expect.poll(() => electronApp.windows().length, { timeout: 15000 }).toBe(0);

    expect(mainStderr, `main stderr:\n${mainStderr}`).not.toMatch(/Object has been destroyed|Uncaught Exception/);
  });
});
