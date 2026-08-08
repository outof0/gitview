/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as vscode from "vscode";
import {
  getGitSubmenuCommands,
  GIT_CONTEXT_SLOTS,
  GIT_SUBMENU_COMMAND_SPECS,
} from "../../commands/explorerGitMenuManifest";
import {
  findExtension,
  FUNCTIONAL_COVERAGE,
} from "./explorerGitMenu.helpers";

const GIT_SUBMENU_COMMANDS = getGitSubmenuCommands();

suite("Explorer Git context menu (integration)", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "gitview extension should be loaded");
    await ext!.activate();
  });

  test("manifest lists every gitView.git submenu command", () => {
    assert.deepStrictEqual(
      GIT_SUBMENU_COMMANDS,
      GIT_SUBMENU_COMMAND_SPECS.map((spec) => spec.command),
    );
  });

  test("registers all Git submenu commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of GIT_SUBMENU_COMMANDS) {
      assert.ok(commands.includes(id), `command ${id} should be registered`);
    }
  });

  test("Git submenu is contributed on explorer, editor, and SCM context slots", () => {
    const menus =
      (findExtension()?.packageJSON as { contributes?: { menus?: Record<string, unknown[]> } })
        ?.contributes?.menus ?? {};
    for (const slot of GIT_CONTEXT_SLOTS) {
      const entries = (menus[slot] ?? []) as Array<{ submenu?: string }>;
      assert.ok(
        entries.some((e) => e.submenu === "gitView.git"),
        `${slot} should expose gitView.git`,
      );
    }
  });

  test("every contributed Git submenu command has an explicit functional coverage owner", () => {
    for (const commandId of GIT_SUBMENU_COMMANDS) {
      const owners = FUNCTIONAL_COVERAGE.get(commandId) ?? [];
      assert.ok(
        owners.length > 0,
        `${commandId} must have functional coverage, not only manifest coverage`,
      );
    }
  });
});
