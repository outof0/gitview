import { expect, type ElectronApplication, type Frame, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication as ElectronApp } from "playwright";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import {
  getGitSubmenuItems,
  isFileOnlyScope,
  type GitSubmenuRenderOptions,
} from "../../src/types/gitSubmenu";
import { prepareSilentVsCodeApp } from "../../src/test/helpers/silentVsCodeApp";
import { resolveDownloadedVsCodeExecutable } from "../../src/test/helpers/vscodeExecutable";

const exec = promisify(execFile);

export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const TEST_WORKSPACE = path.join(PROJECT_ROOT, "test-conflict-repo");

export type NativeMenuClick = {
  menuId: number;
  callbackChannel: string;
  itemId: number;
  label: string;
};

export type NativeVsCodeSession = {
  app: ElectronApp;
  page: Page;
  userDataDir: string;
  extensionsDir?: string;
  workspacePath: string;
  /** Stop the off-screen window watcher (called from close helpers). */
  stopSilentWatcher?: () => void;
};

type NativeVsCodeLaunchOptions = {
  vsixPath?: string;
  /** Written to User/settings.json before launch (gitView.* keys). */
  settings?: Record<string, unknown>;
};

let vscodeExecutablePathPromise: Promise<string> | undefined;

function vscodeExecutablePath(): Promise<string> {
  vscodeExecutablePathPromise ??= downloadAndUnzipVSCode({
    extensionDevelopmentPath: PROJECT_ROOT,
  }).then((executablePath) =>
    resolveDownloadedVsCodeExecutable(executablePath),
  );
  return vscodeExecutablePathPromise;
}

export async function git(args: string[]): Promise<string> {
  return gitAt(TEST_WORKSPACE, args);
}

export async function gitAt(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd });
  return stdout;
}

export async function prepareMergeRepo(): Promise<void> {
  await exec("bash", ["scripts/setup-test-repo.sh"], {
    cwd: PROJECT_ROOT,
    timeout: 60_000,
  });
}

export async function prepareCleanGitRepo(): Promise<void> {
  await prepareMergeRepo();
  await git(["merge", "--abort"]).catch(() => "");
  await git(["rebase", "--abort"]).catch(() => "");
  await git(["cherry-pick", "--abort"]).catch(() => "");
  await git(["reset", "--hard", "HEAD"]);
  await git(["clean", "-fd"]);
  await git(["stash", "clear"]).catch(() => "");
  await fs
    .rm(path.join(TEST_WORKSPACE, ".git", "gitview-shelves"), {
      recursive: true,
      force: true,
    })
    .catch(() => undefined);
}

async function closeVsCodeSignInPrompt(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /Continue without Signing In/i })
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
}

/**
 * Install main-process hooks so VS Code runs as a background agent:
 * no Dock, no focus steal, windows kept off-screen at opacity 0.
 * Playwright still drives the page via CDP (confirmed with hidden windows).
 *
 * VS Code re-shows / repositions the workbench after load — so we re-park on
 * show/move/resize as well as via the interval watcher.
 */
async function installSilentMainProcessHooks(app: ElectronApp): Promise<void> {
  if (process.env.HEADED) {
    return;
  }
  await app
    .evaluate(async ({ BrowserWindow, app: electronApp }) => {
      const g = globalThis as typeof globalThis & {
        __gitviewSilentHooks?: boolean;
        __gitviewSilentParked?: WeakSet<object>;
      };
      g.__gitviewSilentParked ??= new WeakSet<object>();

      type Parkable = {
        isDestroyed?: () => boolean;
        setSkipTaskbar?: (v: boolean) => void;
        setOpacity?: (n: number) => void;
        setPosition?: (x: number, y: number) => void;
        setSize?: (w: number, h: number) => void;
        hide?: () => void;
        setMenuBarVisibility?: (v: boolean) => void;
        getBounds?: () => { x: number; y: number; width: number; height: number };
        on?: (event: string, cb: () => void) => void;
      };

      const park = (win: Parkable) => {
        try {
          if (win.isDestroyed?.()) {
            return;
          }
          win.setSkipTaskbar?.(true);
          win.setMenuBarVisibility?.(false);
          win.setOpacity?.(0);
          win.setPosition?.(-20_000, -20_000);
          win.setSize?.(800, 600);
          win.hide?.();
        } catch {
          // window may be mid-destroy
        }
      };

      const attach = (win: Parkable) => {
        park(win);
        if (g.__gitviewSilentParked!.has(win as object)) {
          return;
        }
        g.__gitviewSilentParked!.add(win as object);
        // VS Code shows the workbench after ready-to-show and may later restore bounds.
        win.on?.("ready-to-show", () => park(win));
        win.on?.("show", () => park(win));
        win.on?.("restore", () => park(win));
        win.on?.("move", () => {
          const b = win.getBounds?.();
          if (b && (b.x > -10_000 || b.y > -10_000)) {
            park(win);
          }
        });
        win.on?.("resize", () => {
          const b = win.getBounds?.();
          if (b && (b.x > -10_000 || b.y > -10_000)) {
            park(win);
          }
        });
      };

      // macOS: accessory = no Dock tile, does not become active app.
      if (process.platform === "darwin") {
        try {
          electronApp.dock?.hide();
          (
            electronApp as { setActivationPolicy?: (p: string) => void }
          ).setActivationPolicy?.("accessory");
        } catch {
          // ignore
        }
      }

      if (!g.__gitviewSilentHooks) {
        g.__gitviewSilentHooks = true;
        electronApp.on("browser-window-created", (_event, win) => {
          attach(win);
        });
      }

      for (const win of BrowserWindow.getAllWindows()) {
        attach(win);
      }
    })
    .catch(() => undefined);
}

/** Re-apply park to any windows that re-showed (dialogs, workbench restore). */
async function concealNativeVsCodeWindows(app: ElectronApp): Promise<void> {
  if (process.env.HEADED) {
    return;
  }
  await installSilentMainProcessHooks(app);
  await app
    .evaluate(async ({ BrowserWindow, app: electronApp }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          win.setSkipTaskbar?.(true);
          win.setOpacity?.(0);
          win.setPosition(-20_000, -20_000);
          win.setSize(800, 600);
          win.hide?.();
        } catch {
          // ignore
        }
      }
      if (process.platform === "darwin") {
        electronApp.dock?.hide();
      }
    })
    .catch(() => undefined);
}

/** Keep re-parking windows during long suites (VS Code recreates UI surfaces). */
function startSilentWindowWatcher(app: ElectronApp): () => void {
  if (process.env.HEADED) {
    return () => undefined;
  }
  const timer = setInterval(() => {
    void concealNativeVsCodeWindows(app);
  }, 400);
  // unref so the interval does not keep Node alive after tests finish
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function focusExplorer(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+E" : "Control+Shift+E",
  );
}

export async function focusSourceControl(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+G" : "Control+Shift+G",
  );
}

function vscodeCliPath(executablePath: string): string {
  if (process.platform === "darwin") {
    return path.resolve(
      path.dirname(executablePath),
      "../Resources/app/bin/code",
    );
  }
  return path.resolve(path.dirname(executablePath), "code");
}

async function launchNativeVsCodeOnce(
  workspacePath = TEST_WORKSPACE,
  options: NativeVsCodeLaunchOptions = {},
): Promise<NativeVsCodeSession> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "nd-vsc-"));
  const executablePath = await vscodeExecutablePath();
  // Mark test VS Code as LSUIElement agent (no Dock / no focus steal) before launch.
  await prepareSilentVsCodeApp(executablePath);
  const extensionsDir = path.join(userDataDir, "extensions");
  await fs.mkdir(extensionsDir, { recursive: true });

  const userSettingsDir = path.join(userDataDir, "User");
  await fs.mkdir(userSettingsDir, { recursive: true });
  await fs.writeFile(
    path.join(userSettingsDir, "settings.json"),
    JSON.stringify(
      {
        "workbench.chat.enabled": false,
        "window.restoreWindows": "none",
        "git.enabled": true,
        "git.autoRepositoryDetection": true,
        ...options.settings,
      },
      null,
      2,
    ),
  );

  if (options.vsixPath) {
    await exec(
      vscodeCliPath(executablePath),
      [
        "--user-data-dir",
        userDataDir,
        "--extensions-dir",
        extensionsDir,
        "--install-extension",
        options.vsixPath,
        "--force",
      ],
      { timeout: 60_000 },
    );
  }

  const app = await electron.launch({
    executablePath,
    // Native VS Code e2e: headless + agent mode unless HEADED=1.
    headless: !process.env.HEADED,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-updates",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      // Park before first paint (paired with LSUIElement + runtime hooks).
      ...(!process.env.HEADED
        ? ["--window-position=-20000,-20000", "--window-size=800,600"]
        : []),
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extensionsDir}`,
      ...(options.vsixPath ? [] : [`--extensionDevelopmentPath=${PROJECT_ROOT}`]),
      workspacePath,
    ],
    timeout: 60_000,
  });

  // Install hide hooks immediately — race first window creation.
  const hooksReady = installSilentMainProcessHooks(app);
  const page = await app.firstWindow({ timeout: 30_000 });
  await hooksReady;
  await concealNativeVsCodeWindows(app);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.locator(".monaco-workbench").waitFor({ timeout: 30_000 });
  await concealNativeVsCodeWindows(app);
  const stopSilentWatcher = startSilentWindowWatcher(app);
  await closeVsCodeSignInPrompt(page);
  await installNativeMenuClickHook(app);
  await expect
    .poll(() => !page.isClosed(), { timeout: 5_000 })
    .toBe(true);
  return {
    app,
    page,
    userDataDir,
    extensionsDir,
    workspacePath,
    stopSilentWatcher,
  };
}

export async function launchNativeVsCode(
  workspacePath = TEST_WORKSPACE,
  options: NativeVsCodeLaunchOptions = {},
): Promise<NativeVsCodeSession> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await launchNativeVsCodeOnce(workspacePath, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function dismissVsCodeOverlays(page: Page): Promise<void> {
  if (page.isClosed()) {
    return;
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
}

export async function findWebviewFrame(
  app: ElectronApplication,
  testId: string,
): Promise<Frame | null> {
  for (const page of app.windows()) {
    for (const frame of page.frames()) {
      if ((await frame.getByTestId(testId).count()) > 0) {
        return frame;
      }
    }
  }
  return null;
}

export async function closeNativeVsCode(session: NativeVsCodeSession): Promise<void> {
  session.stopSilentWatcher?.();
  const child = session.app.process();
  await Promise.race([
    session.app.close(),
    new Promise((resolve) => setTimeout(resolve, 8_000)),
  ]).catch(() => undefined);
  if (!child.killed) {
    child.kill("SIGKILL");
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  await fs
    .rm(session.userDataDir, { recursive: true, force: true })
    .catch(() => undefined);
}

async function installNativeMenuClickHook(app: ElectronApp): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    if (globalThis.__gitviewNativeMenuHookInstalled) {
      return;
    }

    globalThis.__gitviewNativeMenuHookInstalled = true;
    globalThis.__gitviewNativeMenuClick = null;
    globalThis.__gitviewNativeMenus = [];
    globalThis.__gitviewNativeMenuTargetLabels = null;

    function normalizeLabel(label: unknown): string {
      return String(label ?? "").replace(/…/g, "...");
    }

    function findByPath(
      items: Array<{
        id: number;
        label?: string;
        enabled?: boolean;
        submenu?: unknown[];
      }>,
      pathParts: string[],
    ): { id: number; label?: string } | undefined {
      const [head, ...rest] = pathParts;
      for (const item of items) {
        if (normalizeLabel(item.label) !== head) {
          continue;
        }
        if (rest.length === 0) {
          if (item.enabled !== false) {
            return item;
          }
          continue;
        }
        if (Array.isArray(item.submenu)) {
          const match = findByPath(
            item.submenu as Array<{
              id: number;
              label?: string;
              enabled?: boolean;
              submenu?: unknown[];
            }>,
            rest,
          );
          if (match) {
            return match;
          }
        }
      }
      return undefined;
    }

    ipcMain.on(
      "vscode:contextmenu",
      (
        event,
        menuId: number,
        items: Array<{ id: number; label?: string; submenu?: unknown[] }>,
        callbackChannel: string,
      ) => {
        function plain(
          menuItems: Array<{ id: number; label?: string; submenu?: unknown[] }>,
        ): unknown[] {
        return menuItems.map((menuItem) => ({
          id: menuItem.id,
          label: normalizeLabel(menuItem.label),
          enabled: (menuItem as { enabled?: boolean }).enabled,
          submenu: Array.isArray(menuItem.submenu)
            ? plain(
                menuItem.submenu as Array<{
                  id: number;
                  label?: string;
                  enabled?: boolean;
                  submenu?: unknown[];
                }>,
              )
              : undefined,
          }));
        }

        globalThis.__gitviewNativeMenus.push({
          menuId,
          callbackChannel,
          labels: items.map((item) => normalizeLabel(item.label)),
          targetLabels: globalThis.__gitviewNativeMenuTargetLabels,
          items: plain(items),
        });

        const targetLabels = globalThis.__gitviewNativeMenuTargetLabels;
        if (!Array.isArray(targetLabels)) {
          return;
        }

        const item = findByPath(items, targetLabels);
        if (!item) {
          return;
        }

        globalThis.__gitviewNativeMenuClick = {
          menuId,
          callbackChannel,
          itemId: item.id,
          label: normalizeLabel(item.label),
        };
        setTimeout(() => {
          event.sender.send(callbackChannel, item.id, {});
          event.sender.send("vscode:onCloseContextMenu", menuId);
        }, 50);
      },
    );
  });
}

function normalizeNativeMenuLabel(label: unknown): string {
  return String(label ?? "").replace(/…/g, "...");
}

type NativeMenuTreeItem = {
  label?: string;
  enabled?: boolean;
  submenu?: NativeMenuTreeItem[];
};

function nativeMenuPathState(
  menus: Array<{ items?: NativeMenuTreeItem[] }>,
  pathLabels: string[],
): { found: boolean; enabled: boolean } {
  for (const menu of menus) {
    let items = menu.items ?? [];
    let enabled = true;
    let found = true;
    for (const part of pathLabels) {
      const item = items.find(
        (row) => normalizeNativeMenuLabel(row.label) === part,
      );
      if (!item) {
        found = false;
        break;
      }
      enabled = item.enabled !== false;
      items = item.submenu ?? [];
    }
    if (found) {
      return { found: true, enabled };
    }
  }
  return { found: false, enabled: false };
}

async function openExplorerContextMenu(
  page: Page,
  resourceName: string,
): Promise<void> {
  await page.bringToFront();
  await focusExplorer(page);
  const targetRow = page
    .locator(`.monaco-list-row[aria-label="${resourceName}"]`)
    .first();
  await targetRow.waitFor({ state: "visible", timeout: 15_000 });
  await targetRow.click();
  const box = await targetRow.boundingBox();
  expect(
    box,
    `Explorer row for ${resourceName} should have a bounding box`,
  ).not.toBeNull();
  const clickX = box!.x + Math.min(Math.max(80, box!.width * 0.35), box!.width - 8);
  await page.mouse.click(clickX, box!.y + box!.height / 2, { button: "right" });
}

async function pollNativeGitMenuPathState(
  session: NativeVsCodeSession,
  resourceName: string,
  menuLabel: string,
): Promise<{ found: boolean; enabled: boolean }> {
  const { app, page } = session;
  const expectedLabel = menuLabel.replace(/…/g, "...");
  const menuPath = ["Git", expectedLabel];

  await runVsCodeCommand(page, "GitView: Refresh Git Status").catch(
    () => undefined,
  );
  await page.waitForTimeout(400);
  await app.evaluate(() => {
    globalThis.__gitviewNativeMenus = [];
    // Do not auto-click: we only inspect enablement.
    globalThis.__gitviewNativeMenuTargetLabels = null;
    globalThis.__gitviewNativeMenuClick = null;
  });
  await openExplorerContextMenu(page, resourceName);
  await page.waitForTimeout(250);
  const menus = await app.evaluate(() => globalThis.__gitviewNativeMenus);
  await page.keyboard.press("Escape").catch(() => undefined);
  return nativeMenuPathState(menus, menuPath);
}

export async function waitForNativeGitMenuItemEnabled(
  session: NativeVsCodeSession,
  resourceName: string,
  menuLabel: string,
  timeoutMs = 60_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await pollNativeGitMenuPathState(
          session,
          resourceName,
          menuLabel,
        );
        return state.found && state.enabled;
      },
      { timeout: timeoutMs },
    )
    .toBe(true);
}

/** Assert a native Git submenu item is visible but disabled (e.g. stash mid-merge). */
export async function waitForNativeGitMenuItemDisabled(
  session: NativeVsCodeSession,
  resourceName: string,
  menuLabel: string,
  timeoutMs = 60_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await pollNativeGitMenuPathState(
          session,
          resourceName,
          menuLabel,
        );
        return state.found && !state.enabled;
      },
      { timeout: timeoutMs },
    )
    .toBe(true);
}

export async function clickNativeGitMenu(
  session: NativeVsCodeSession,
  resourceName: string,
  menuLabel: string,
): Promise<NativeMenuClick> {
  const { app, page } = session;
  const expectedLabel = menuLabel.replace(/…/g, "...");
  const menuPath = ["Git", expectedLabel];
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    await runVsCodeCommand(page, "GitView: Refresh Git Status").catch(
      () => undefined,
    );
    await page.waitForTimeout(400);

    await app.evaluate(
      (_electronModule, expectedLabels) => {
        globalThis.__gitviewNativeMenuClick = null;
        globalThis.__gitviewNativeMenus = [];
        globalThis.__gitviewNativeMenuTargetLabels = expectedLabels;
      },
      ["Git", menuLabel],
    );

    await openExplorerContextMenu(page, resourceName);

    const clickDeadline = Date.now() + 2_000;
    while (Date.now() < clickDeadline) {
      const clicked = await app.evaluate(
        () => globalThis.__gitviewNativeMenuClick as NativeMenuClick | null,
      );
      if (clicked?.label === expectedLabel) {
        // Context menu is already closed by the ipc hook (`vscode:onCloseContextMenu`).
        // Escape here would dismiss a commit/quick-input prompt that opens right after.
        return clicked;
      }
      await page.waitForTimeout(100);
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    const menus = await app.evaluate(() => globalThis.__gitviewNativeMenus);
    const state = nativeMenuPathState(menus, menuPath);
    if (state.found && !state.enabled) {
      await page.waitForTimeout(800);
      continue;
    }
    await page.waitForTimeout(300);
  }

  const menus = await app.evaluate(() => globalThis.__gitviewNativeMenus);
  throw new Error(
    `Native Git menu item "${expectedLabel}" was not clicked. Captured menus: ${JSON.stringify(
      menus,
    ).slice(0, 4_000)}`,
  );
}

export async function runVsCodeCommand(
  page: Page,
  commandTitle: string,
): Promise<void> {
  if (page.isClosed()) {
    throw new Error(
      "VS Code window closed before running command palette — prior test may have crashed Electron",
    );
  }
  await dismissVsCodeOverlays(page);
  await page.bringToFront();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P",
  );
  await page.locator(".quick-input-widget").waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.keyboard.type(commandTitle);
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
}

export async function waitForWebviewFrame(
  app: ElectronApplication,
  testId: string,
  timeout = 45_000,
): Promise<Frame> {
  let frame: Frame | undefined;
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (page.isClosed()) {
            continue;
          }
          for (const candidate of page.frames()) {
            try {
              if ((await candidate.getByTestId(testId).count()) > 0) {
                frame = candidate;
                return true;
              }
            } catch {
              // Frame may detach while the webview reloads.
            }
          }
        }
        return false;
      },
      { timeout },
    )
    .toBe(true);
  if (!frame) {
    throw new Error(`Timed out waiting for webview [data-testid="${testId}"]`);
  }
  return frame;
}

export async function openConflictsDialog(
  session: NativeVsCodeSession,
): Promise<Frame> {
  let list = await findWebviewFrame(
    session.app,
    "conflicts-file-row-file.txt",
  );
  if (list) {
    await expect(list.getByText("Merging branch")).toBeVisible({
      timeout: 10_000,
    });
    return list;
  }

  await runVsCodeCommand(
    session.page,
    "Resolve conflict",
  );

  // Command may jump straight into the merge resolver when a file was selected.
  const merge = await findWebviewFrame(session.app, "pane-left");
  if (merge) {
    await merge.getByTestId("merge-cancel").click();
    list = await waitForWebviewFrame(
      session.app,
      "conflicts-file-row-file.txt",
    );
  } else {
    list = await waitForWebviewFrame(
      session.app,
      "conflicts-file-row-file.txt",
    );
  }

  await expect(list.getByText("Merging branch")).toBeVisible({
    timeout: 10_000,
  });
  return list;
}

/** Webview mounted in VS Code — not stuck on the HTML boot placeholder. */
export async function expectMergeResolverWebviewBoot(
  frame: Frame,
  relativePath: string,
): Promise<void> {
  await expect(frame.getByTestId("pane-left")).toBeVisible({ timeout: 30_000 });
  await expect(
    frame.getByText(`Resolve Conflicts — ${relativePath}`),
  ).toBeVisible();
  await expect(frame.getByText("Loading GitView")).toHaveCount(0);
  await expect(frame.getByText("Loading merge resolver")).toHaveCount(0);
  const center = frame.getByTestId("pane-center");
  const monacoError = frame.getByTestId("monaco-center-error");
  if ((await monacoError.count()) > 0) {
    const message = await monacoError.textContent();
    throw new Error(`Monaco failed to load in webview: ${message ?? "(no message)"}`);
  }
  await expect(frame.getByTestId("monaco-center-loading")).toHaveCount(0, {
    timeout: 90_000,
  });
  await expect(center).toHaveAttribute("data-monaco-ready", "true", {
    timeout: 90_000,
  });
  await expect(center.locator(".monaco-editor .view-line").first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function openMergeResolver(
  session: NativeVsCodeSession,
  relativePath: string,
): Promise<Frame> {
  const existing = await findWebviewFrame(session.app, "pane-left");
  if (existing) {
    await expectMergeResolverWebviewBoot(existing, relativePath);
    return existing;
  }

  const conflicts = await openConflictsDialog(session);
  await conflicts.getByTestId(`conflicts-file-row-${relativePath}`).click();
  await conflicts.getByRole("button", { name: "Merge..." }).click();
  const frame = await waitForWebviewFrame(session.app, "pane-left");
  await expectMergeResolverWebviewBoot(frame, relativePath);
  return frame;
}

export async function openGitWorkspace(
  session: NativeVsCodeSession,
): Promise<Frame> {
  const existing = await findWebviewFrame(session.app, "git-workspace-app");
  if (existing) {
    return existing;
  }
  await runVsCodeCommand(session.page, "GitView: Open Git workspace");
  return waitForWebviewFrame(session.app, "git-workspace-app");
}

/** Leave merge resolver and return to the conflicts list when possible. */
export async function leaveMergeResolver(
  session: NativeVsCodeSession,
): Promise<void> {
  const mergeFrame = await findWebviewFrame(session.app, "pane-left");
  if (!mergeFrame) {
    return;
  }
  await mergeFrame.getByTestId("merge-cancel").click();
  await waitForWebviewFrame(session.app, "conflicts-file-row-file.txt");
}

type GitSubmenuExpectOptions = GitSubmenuRenderOptions & {
  isFolder?: boolean;
};

export async function expectGitSubmenuInFrame(
  frame: Frame,
  opts: GitSubmenuExpectOptions = {},
): Promise<void> {
  for (const item of getGitSubmenuItems(opts)) {
    const row = frame.getByTestId(item.testId);
    await expect(row, item.title).toBeVisible();
    await expect(row).toContainText(item.title);
    if (opts.isFolder && isFileOnlyScope(item.scope)) {
      await expect(row).toHaveClass(/cursor-not-allowed/);
    }
  }
}

async function frameHasText(
  frame: Frame,
  pattern: string | RegExp,
): Promise<boolean> {
  return frame
    .getByText(pattern)
    .first()
    .isVisible({ timeout: 250 })
    .catch(() => false);
}

async function pageHasText(
  page: Page,
  pattern: string | RegExp,
): Promise<boolean> {
  if (
    await page
      .getByText(pattern)
      .first()
      .isVisible({ timeout: 250 })
      .catch(() => false)
  ) {
    return true;
  }
  for (const frame of page.frames()) {
    if (await frameHasText(frame, pattern)) {
      return true;
    }
  }
  return false;
}

export async function expectTextInAnyWindow(
  app: ElectronApplication,
  pattern: string | RegExp,
): Promise<void> {
  await expect
    .poll(
      async () => {
        for (const page of app.windows()) {
          if (await pageHasText(page, pattern)) {
            return true;
          }
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

export async function acceptQuickPick(
  page: Page,
  query?: string,
  timeoutMs = 30_000,
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .locator(".quick-input-widget")
          .isVisible({ timeout: 500 })
          .catch(() => false),
      { timeout: timeoutMs },
    )
    .toBe(true);
  if (query) {
    await page.keyboard.type(query);
    await page.waitForTimeout(500);
  }
  await page.keyboard.press("Enter");
}

/**
 * Accepts one step of a multi-step prompt. Waiting for a row unique to the step
 * avoids racing Enter against the previous step, which reuses the same widget.
 */
export async function acceptQuickPickStep(
  page: Page,
  expectedItem: string | RegExp,
  query?: string,
): Promise<void> {
  await expect
    .poll(
      async () =>
        page
          .locator(".quick-input-widget")
          .getByText(expectedItem)
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false),
      { timeout: 20_000 },
    )
    .toBe(true);
  if (query) {
    await page.keyboard.type(query);
    await page.waitForTimeout(500);
  }
  await page.keyboard.press("Enter");
}

export async function focusScmView(page: Page): Promise<void> {
  await page.bringToFront();
  await dismissVsCodeOverlays(page);
  const activityButton = page.getByRole("button", { name: /^Source Control/i });
  await expect(activityButton).toBeVisible({ timeout: 20_000 });
  await activityButton.click();
  await expect
    .poll(
      async () =>
        page
          .locator(".scm-view, .scm-editor, .scm-input")
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false),
      { timeout: 20_000 },
    )
    .toBe(true);
}

export async function seedScmCommitMessage(
  page: Page,
  message: string,
): Promise<void> {
  await focusScmView(page);
  const inputEditor = page
    .locator(
      ".scm-view .scm-editor .monaco-editor, .scm-view .scm-input .monaco-editor, .scm-editor .monaco-editor",
    )
    .first();
  await expect(inputEditor).toBeVisible({ timeout: 15_000 });
  await inputEditor.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(message);
  await expect(
    page.locator(".scm-view .scm-editor, .scm-view .scm-input, .scm-editor").first(),
  ).toContainText(message, { timeout: 5_000 });
}

export async function expectDiffEditor(page: Page, fileName: string): Promise<void> {
  await expect(page.locator(".monaco-diff-editor").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(".tabs-container").first()).toContainText(
    fileName,
    {
      timeout: 10_000,
    },
  );
}

export async function commitFile(
  cwd: string,
  relativePath: string,
  content: string,
  message: string,
): Promise<string> {
  const absolutePath = path.join(cwd, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
  await gitAt(cwd, ["add", relativePath]);
  await gitAt(cwd, ["commit", "-m", message]);
  return (await gitAt(cwd, ["rev-parse", "HEAD"])).trim();
}

export async function setupRemote(): Promise<{
  remoteParent: string;
  remoteRoot: string;
  remoteClone: string;
}> {
  const remoteParent = await fs.mkdtemp(
    path.join(os.tmpdir(), "gitview-native-remote-"),
  );
  const remoteRoot = path.join(remoteParent, "origin.git");
  const remoteClone = path.join(remoteParent, "clone");

  await gitAt(remoteParent, ["init", "--bare", remoteRoot]);
  await git(["remote", "remove", "origin"]).catch(() => "");
  await git(["remote", "add", "origin", remoteRoot]);
  await git(["push", "-u", "origin", "master"]);
  await gitAt(remoteParent, ["clone", remoteRoot, remoteClone]);
  await gitAt(remoteClone, ["config", "user.email", "gitview@test.com"]);
  await gitAt(remoteClone, ["config", "user.name", "GitView Diff Test"]);

  return { remoteParent, remoteRoot, remoteClone };
}

export async function remoteCommit(
  remoteClone: string,
  relativePath: string,
  content: string,
  message: string,
): Promise<string> {
  const sha = await commitFile(remoteClone, relativePath, content, message);
  await gitAt(remoteClone, ["push", "origin", "master"]);
  return sha;
}
