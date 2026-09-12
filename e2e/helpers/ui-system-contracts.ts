import { expect, type Frame, type Page } from "@playwright/test";

type ScreenSurface = Frame | Page;

export async function expectUiSurfaceAccessible(
  surface: ScreenSurface,
  rootTestId: string,
): Promise<void> {
  const violations = await surface.evaluate((testId) => {
    const root = document.querySelector(`[data-testid="${testId}"]`);
    if (!root) {
      throw new Error(`Missing accessibility root: ${testId}`);
    }

    const issues: string[] = [];
    const selector =
      'button,input,select,textarea,a[href],[role="button"],[role="menuitem"],[role="menuitemradio"],[role="tab"]';
    const controls = Array.from(root.querySelectorAll<HTMLElement>(selector));
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const describe = (element: HTMLElement) =>
      element.getAttribute("data-testid") ??
      element.getAttribute("aria-label") ??
      element.tagName.toLowerCase();
    const accessibleName = (element: HTMLElement) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      const labelledText = labelledBy
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      const ownLabel =
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
          ? element.labels?.[0]?.textContent
          : undefined;
      return (
        element.getAttribute("aria-label") ??
        labelledText ??
        ownLabel ??
        element.getAttribute("title") ??
        element.textContent ??
        ""
      ).trim();
    };
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        r: parts[0] ?? 0,
        g: parts[1] ?? 0,
        b: parts[2] ?? 0,
        a: parts[3] ?? 1,
      };
    };
    const composite = (
      foreground: { r: number; g: number; b: number; a: number },
      background: { r: number; g: number; b: number; a: number },
    ) => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }
      return {
        r:
          (foreground.r * foreground.a +
            background.r * background.a * (1 - foreground.a)) /
          alpha,
        g:
          (foreground.g * foreground.a +
            background.g * background.a * (1 - foreground.a)) /
          alpha,
        b:
          (foreground.b * foreground.a +
            background.b * background.a * (1 - foreground.a)) /
          alpha,
        a: alpha,
      };
    };
    const background = (element: HTMLElement | null) => {
      const layers: Array<{ r: number; g: number; b: number; a: number }> = [];
      let current: HTMLElement | null = element;
      while (current) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color.a > 0) {
          layers.push(color);
          if (color.a === 1) {
            break;
          }
        }
        current = current.parentElement;
      }
      let result = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) {
        result = composite(layer, result);
      }
      return result;
    };
    const luminance = (color: { r: number; g: number; b: number }) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return (
        0.2126 * channel(color.r) +
        0.7152 * channel(color.g) +
        0.0722 * channel(color.b)
      );
    };

    for (const control of controls) {
      if (
        !visible(control) ||
        control.closest('[aria-hidden="true"]') ||
        control.matches(".monaco-editor textarea") ||
        control.closest(".monaco-editor")
      ) {
        continue;
      }
      const name = accessibleName(control);
      if (!name) {
        issues.push(`${describe(control)} has no accessible name`);
      }
      const disabled =
        control.hasAttribute("disabled") ||
        control.getAttribute("aria-disabled") === "true";
      if (!disabled && control.tabIndex < 0) {
        issues.push(`${describe(control)} is not keyboard focusable`);
      }

      const style = getComputedStyle(control);
      const bg = background(control);
      const isBackgroundGraphic =
        !(control instanceof HTMLInputElement) &&
        !(control instanceof HTMLSelectElement) &&
        !(control instanceof HTMLTextAreaElement) &&
        control.textContent?.trim() === "" &&
        control.children.length === 0;
      const foreground = isBackgroundGraphic
        ? composite(parse(style.backgroundColor), background(control.parentElement))
        : composite(parse(style.color), bg);
      const comparisonBackground = isBackgroundGraphic
        ? background(control.parentElement)
        : bg;
      const light = luminance(foreground);
      const dark = luminance(comparisonBackground);
      const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      const fontSize = Number.parseFloat(style.fontSize);
      const minimum = isBackgroundGraphic || fontSize >= 18 ? 3 : 4.5;
      if (name && ratio < minimum) {
        issues.push(
          `${describe(control)} contrast ${ratio.toFixed(2)} is below ${minimum}:1`,
        );
      }
    }
    return issues;
  }, rootTestId);

  expect(violations, violations.join("\n")).toEqual([]);
}

export async function expectUiSurfaceLayout(
  surface: ScreenSurface,
  rootTestId: string,
): Promise<void> {
  const root = surface.getByTestId(rootTestId);
  await expect(root).toBeVisible();

  const metrics = await root.evaluate((element) => {
    const rootRect = element.getBoundingClientRect();
    const declaredScrollOwners = Array.from(
      element.querySelectorAll<HTMLElement>("[data-scroll-owner]"),
    ).map((owner) => {
      const style = getComputedStyle(owner);
      return {
        axis: owner.dataset.scrollOwner,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    });
    return {
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      left: rootRect.left,
      top: rootRect.top,
      right: rootRect.right,
      bottom: rootRect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      declaredScrollOwners,
    };
  });

  expect(metrics.clientWidth).toBeGreaterThan(0);
  expect(metrics.clientHeight).toBeGreaterThan(0);
  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.top).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

  for (const owner of metrics.declaredScrollOwners) {
    if (owner.axis === "vertical") {
      expect(owner.overflowY).toBe("auto");
      expect(owner.overflowX).toBe("hidden");
    } else if (owner.axis === "horizontal") {
      expect(owner.overflowX).toBe("auto");
      expect(owner.overflowY).toBe("hidden");
    } else if (owner.axis === "both") {
      expect(owner.overflowX).toBe("auto");
      expect(owner.overflowY).toBe("auto");
    }
  }
}
