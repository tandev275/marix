/**
 * E2E: tearing a terminal tab off by dragging it out of the tab strip.
 *
 * Playwright's synthetic mouse cannot start a native HTML5 drag, so we dispatch
 * the drag events directly with controlled coordinates. This exercises exactly
 * the decision this feature adds — a drag ending inside the strip reorders, one
 * ending below/outside it tears the tab into a new window. The data-integrity of
 * the moved session is covered separately by detach-tab.e2e.ts.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;

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

// Drive the tab's own drag handlers. Two evaluate calls, so React commits the
// dragstart state update (which sets the dragged tab id) before dragend reads it.
async function dragTab(p: Page, tabIndex: number, end: { clientX: number; clientY: number; screenX: number; screenY: number }) {
  await p.evaluate((i) => {
    const el = document.querySelectorAll('[data-testid="session-tab"]')[i] as HTMLElement;
    el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
  }, tabIndex);

  await p.waitForTimeout(100);

  await p.evaluate(({ i, end }) => {
    const el = document.querySelectorAll('[data-testid="session-tab"]')[i] as HTMLElement;
    el.dispatchEvent(new DragEvent('dragend', {
      bubbles: true, cancelable: true, dataTransfer: new DataTransfer(),
      clientX: end.clientX, clientY: end.clientY, screenX: end.screenX, screenY: end.screenY,
    }));
  }, { i: tabIndex, end });
}

test.describe('Tear a tab off by dragging', () => {
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
      env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_SANDBOX: process.env.CI ? '1' : undefined },
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('open-local-terminal').waitFor({ timeout: 20000 });

    await openLocalTerminal(page);
    await openLocalTerminal(page);
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

  test('a drag ending inside the tab strip does not open a window', async () => {
    expect(electronApp.windows().length).toBe(1);
    await expect(tabs(page)).toHaveCount(2);

    // End the drag high up, within the title bar where the strip lives.
    await dragTab(page, 1, { clientX: 300, clientY: 12, screenX: 300, screenY: 60 });
    await page.waitForTimeout(500);

    expect(electronApp.windows().length).toBe(1);
    await expect(tabs(page)).toHaveCount(2);
  });

  test('a drag ending below the strip tears the tab into a new window', async () => {
    const newWindowPromise = electronApp.waitForEvent('window');

    // End the drag deep in the terminal area, well below the tab strip.
    await dragTab(page, 1, { clientX: 500, clientY: 500, screenX: 500, screenY: 540 });

    const detached = await newWindowPromise;
    await detached.waitForLoadState('domcontentloaded');

    // New window owns exactly the torn-off tab; the source window keeps the other.
    await expect(tabs(detached)).toHaveCount(1, { timeout: 15000 });
    await expect(tabs(page)).toHaveCount(1);
    expect(electronApp.windows().length).toBe(2);
  });
});
