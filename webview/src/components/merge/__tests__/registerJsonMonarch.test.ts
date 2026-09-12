import { describe, expect, it, vi } from "vitest";
import { registerJsonMonarch } from "../registerJsonMonarch";

describe("registerJsonMonarch", () => {
  it("registers a monarch tokenizer instead of Monaco's JSON language service", () => {
    const register = vi.fn();
    const setLanguageConfiguration = vi.fn();
    const setMonarchTokensProvider = vi.fn();

    registerJsonMonarch({
      languages: {
        register,
        setLanguageConfiguration,
        setMonarchTokensProvider,
      },
    } as never);

    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "json",
        extensions: expect.arrayContaining([".json"]),
      }),
    );
    expect(setMonarchTokensProvider).toHaveBeenCalledWith(
      "json",
      expect.objectContaining({ tokenPostfix: ".json" }),
    );
    expect(setLanguageConfiguration).toHaveBeenCalledWith(
      "json",
      expect.anything(),
    );
  });
});
