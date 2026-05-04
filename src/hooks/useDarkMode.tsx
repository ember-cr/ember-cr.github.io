import { useEffect, useState, useCallback } from "react";

const KEY = "ember.darkMode";
const EVENT = "ember:dark-mode-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function apply(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", enabled);
}

export function useDarkMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const v = read();
    apply(v);
    return v;
  });

  useEffect(() => {
    const onChange = () => {
      const v = read();
      apply(v);
      setEnabled(v);
    };
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
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { enabled, toggle };
}