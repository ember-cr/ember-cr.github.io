import { useEffect, useState, useCallback } from "react";

const KEY = "ember.liquidGlass";
const EVENT = "ember:liquid-glass-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

/** Tiny global store backed by localStorage + a custom event. */
export function useLiquidGlass() {
  const [enabled, setEnabled] = useState<boolean>(() => read());

  useEffect(() => {
    const onChange = () => setEnabled(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !read();
    window.localStorage.setItem(KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { enabled, toggle };
}