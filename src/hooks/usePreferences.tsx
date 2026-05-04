import { useEffect, useState, useCallback } from "react";

export type PrefKey =
  | "reduceMotion"
  | "disableParallax"
  | "disableBgAnim"
  | "muteSounds"
  | "disableClickSounds"
  | "disableTitleFlash"
  | "disableGlassBlur";

export type ThemeKey = "sunset" | "ocean" | "emerald" | "rose";

interface UserPrefs {
  reduceMotion: boolean;
  disableParallax: boolean;
  disableBgAnim: boolean;
  muteSounds: boolean;
  disableClickSounds: boolean;
  disableTitleFlash: boolean;
  disableGlassBlur: boolean;
  theme: ThemeKey;
  volume: number;
}

const STORAGE_KEY = "ember.prefs";
const EVENT = "ember:prefs-change";

const DEFAULTS: UserPrefs = {
  reduceMotion: false,
  disableParallax: false,
  disableBgAnim: false,
  muteSounds: false,
  disableClickSounds: false,
  disableTitleFlash: false,
  disableGlassBlur: false,
  theme: "sunset",
  volume: 80,
};

function read(): UserPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function apply(prefs: UserPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("pref-reduce-motion", prefs.reduceMotion);
  root.classList.toggle("pref-no-parallax", prefs.disableParallax || prefs.reduceMotion);
  root.classList.toggle("pref-no-bg-anim", prefs.disableBgAnim || prefs.reduceMotion);
  root.classList.toggle("pref-mute", prefs.muteSounds);
  root.classList.toggle("pref-no-title-flash", prefs.disableTitleFlash);
  root.classList.toggle("pref-no-blur", prefs.disableGlassBlur);

  // Apply theme classes
  const themes: ThemeKey[] = ["sunset", "ocean", "emerald", "rose"];
  themes.forEach((t) => root.classList.toggle(`theme-${t}`, prefs.theme === t));
}

// Apply immediately on import to avoid flash
if (typeof window !== "undefined") apply(read());

export function isPrefActive(key: PrefKey): boolean {
  if (typeof document === "undefined") return false;
  const map: Record<PrefKey, string> = {
    reduceMotion: "pref-reduce-motion",
    disableParallax: "pref-no-parallax",
    disableBgAnim: "pref-no-bg-anim",
    muteSounds: "pref-mute",
    disableTitleFlash: "pref-no-title-flash",
    disableGlassBlur: "pref-no-blur",
  };
  return document.documentElement.classList.contains(map[key]);
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPrefs>(() => {
    const p = read();
    apply(p);
    return p;
  });

  useEffect(() => {
    const onChange = () => {
      const p = read();
      apply(p);
      setPrefs(p);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setPref = useCallback((key: keyof UserPrefs, value: any) => {
    const next = { ...read(), [key]: value };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    apply(DEFAULTS);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { prefs, setPref, reset };
}