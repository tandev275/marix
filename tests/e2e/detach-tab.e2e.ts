/**
 * E2E: moving a terminal tab into its own window.
 *
 * The value of this test is the data path, not the gesture. A detached tab keeps
 * its PTY alive in the main process; output produced while the tab is in flight
 * must be buffered and replayed into the new window, and keystrokes typed there
 * must reach the same shell.
 */
import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;
let userDataDir: string;

const terminalText = (p: Page) => p.locator('.xterm-rows').last();
const tabs = (p: Page) => p.getByTestId('session-tab');

async function openLocalTerminal(p: Page) {
  const before = await p.locator('.xterm-screen').count();
  // Opening a session collapses the sidebar and swaps the hosts panel for the
  // terminal, so the button has to be brought back for each additional tab.
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

async function typeIntoTerminal(p: Page, command: string) {
  await p.locator('.xterm-screen').last().click();
  await p.keyboard.type(`${command}\r`);
}

test.describe('Detach tab to a new window', () => {
  test.beforeAll(async () => {
    // Never touch the developer's real Marix profile: it holds saved servers and
    // may already have live sessions.
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
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SANDBOX: process.env.CI ? '1' : undefined,
      },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('open-local-terminal').waitFor({ timeout: 20000 });
  });

  test.afterAll(async () => {
    // Windows hold live shells, so a normal close would pop the confirm modal and
    // block teardown. Destroy them from the main process to bypass it. Destroying
    // the last window quits the app, so the process may exit before evaluate()
    // resolves — don't wait on it past a moment.
    const timeout = (ms: number) => new Promise(r => setTimeout(r, ms));
    await Promise.race([
      electronApp?.evaluate(({ BrowserWindow }) => {
        for (const win of BrowserWindow.getAllWindows()) win.destroy();
      }).catch(() => {}),
      timeout(3000),
    ]);
    await Promise.race([electronApp?.close().catch(() => {}), timeout(5000)]);
    try { electronApp?.process()?.kill('SIGKILL'); } catch {} // app can take seconds to quit; don't hang teardown
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('keeps the shell alive and loses no output across the move', async () => {
    // Two tabs: detaching is only offered when the window would not be emptied.
    await openLocalTerminal(page);
    await openLocalTerminal(page);

    // Produce scrollback that exists only in this window's xterm — the kind of
    // history that was being lost when the tab moved to a fresh window.
    await typeIntoTerminal(page, 'echo HISTORY_BEFORE_DETACH');
    await expect(terminalText(page)).toContainText('HISTORY_BEFORE_DETACH', { timeout: 15000 });

    // Confirm the tab we are about to move has a working shell.
    await typeIntoTerminal(page, 'echo BEFORE_MOVE_OK');
    await expect(terminalText(page)).toContainText('BEFORE_MOVE_OK', { timeout: 15000 });

    // Emit output *after* the tab has left this window but before the new one has
    // bound it. This is the gap the router's buffer exists to cover.
    await typeIntoTerminal(page, 'sleep 2; echo BUFFERED_ACROSS_MOVE');

    const newWindowPromise = electronApp.waitForEvent('window');

    await tabs(page).last().click({ button: 'right' });
    await page.getByTestId('detach-tab').click();

    const detached = await newWindowPromise;
    await detached.waitForLoadState('domcontentloaded');

    // The pre-detach scrollback was serialized and replayed into the new window's
    // fresh xterm — history is not lost across the move.
    await expect(terminalText(detached)).toContainText('HISTORY_BEFORE_DETACH', { timeout: 20000 });

    // The shell kept running while unowned, and its output was replayed here.
    await expect(terminalText(detached)).toContainText('BUFFERED_ACROSS_MOVE', { timeout: 20000 });

    // Keystrokes from the new window reach the same shell, and its output comes back.
    await typeIntoTerminal(detached, 'echo AFTER_MOVE_OK');
    await expect(terminalText(detached)).toContainText('AFTER_MOVE_OK', { timeout: 15000 });

    // The source window kept its other tab and never saw the moved tab's output.
    await expect(tabs(page)).toHaveCount(1);
    await expect(terminalText(page)).not.toContainText('AFTER_MOVE_OK');
  });
});
