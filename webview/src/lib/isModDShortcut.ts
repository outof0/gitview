export function isModDShortcut(event: KeyboardEvent): boolean {
  if (event.key !== "d" && event.key !== "D") {
    return false;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
    return false;
  }
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return false;
  }
  return true;
}
