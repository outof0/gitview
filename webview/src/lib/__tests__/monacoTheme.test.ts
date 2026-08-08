import { describe, expect, it } from "vitest";
import { pickMonacoTheme } from "../monacoTheme";

describe("pickMonacoTheme", () => {
  it("maps VS Code webview themes to GitView Monaco themes (no line wash)", () => {
    expect(pickMonacoTheme("dark")).toBe("gitview-dark");
    expect(pickMonacoTheme("light")).toBe("gitview-light");
    expect(pickMonacoTheme("high-contrast")).toBe("gitview-hc-dark");
    expect(pickMonacoTheme("high-contrast-light")).toBe("gitview-hc-light");
  });
});
