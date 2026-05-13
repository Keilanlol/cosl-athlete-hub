import { useEffect, useState, useCallback } from "react";

/**
 * Controlled tab state synchronized to window.location.hash so that:
 * - Reloads / data refreshes that briefly unmount Tabs do not reset the active tab
 * - The current tab is shareable via URL and survives navigation back/forward
 */
export function useHashTab(defaultValue: string) {
  const read = () => {
    if (typeof window === "undefined") return defaultValue;
    const h = window.location.hash.replace(/^#/, "");
    return h || defaultValue;
  };
  const [value, setValue] = useState<string>(read);

  useEffect(() => {
    const onHash = () => setValue(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((v: string) => {
    setValue(v);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = v;
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return [value, set] as const;
}
