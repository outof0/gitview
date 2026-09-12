import { useEffect, useState } from "react";

/**
 * True only once `active` has stayed true for `delayMs`.
 *
 * Boot placeholders use this so a fast host reply goes straight to content
 * instead of flashing a loading state that lives for one or two frames.
 */
export function useDelayedFlag(active: boolean, delayMs = 200): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return visible;
}
