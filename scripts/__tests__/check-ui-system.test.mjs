import { describe, expect, it } from "vitest";
import { auditUiText, summarizeUiFindings } from "../check-ui-system.mjs";

describe("UI system audit", () => {
  it("finds component-local controls, theme values, geometry, and scroll owners", () => {
    const findings = auditUiText(
      "webview/src/components/git/Example.tsx",
      `<button className="rounded-sm text-[#fff] bg-black/40 w-[23px] overflow-x-auto" style={{ color: "var(--vscode-foreground)" }} /><Button variant="unstyled" />`,
    );

    expect(findings.map((finding) => finding.rule).sort()).toEqual([
      "ad-hoc-horizontal-scroll",
      "direct-vscode-token",
      "literal-color",
      "literal-color",
      "literal-pixel-class",
      "non-system-radius",
      "raw-interactive",
      "unstyled-button-variant",
    ]);
  });

  it("allows native elements and the explicit scroll owner inside UI primitives", () => {
    const findings = [
      ...auditUiText(
        "webview/src/components/ui/Button.tsx",
        `<button type="button" />`,
      ),
      ...auditUiText(
        "webview/src/components/ui/ScrollArea.tsx",
        `<div className="overflow-auto" />`,
      ),
    ];

    expect(summarizeUiFindings(findings)["raw-interactive"]).toBe(0);
    expect(summarizeUiFindings(findings)["unstyled-button-variant"]).toBe(0);
    expect(summarizeUiFindings(findings)["ad-hoc-horizontal-scroll"]).toBe(0);
  });
});
