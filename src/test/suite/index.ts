import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

// Loaded by @vscode/test-electron inside the VS Code extension host. Builds the
// mocha runner, discovers compiled *.test.js files in this directory and
// resolves/rejects based on the failure count.
export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 60_000,
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    glob("**/*.test.js", { cwd: testsRoot })
      .then((files) => {
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          mocha.run((failures) => {
            if (failures > 0) {
              reject(new Error(`${failures} integration test(s) failed.`));
            } else {
              resolve();
            }
          });
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => reject(err));
  });
}
