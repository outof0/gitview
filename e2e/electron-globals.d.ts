export {};

declare global {
  var __gitviewNativeMenuHookInstalled: boolean | undefined;
  var __gitviewNativeMenuClick: unknown;
  var __gitviewNativeMenus: Array<Record<string, unknown>>;
  var __gitviewNativeMenuTargetLabels: string[] | null;
}
