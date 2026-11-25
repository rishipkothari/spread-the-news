"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";
const KEY = "prism.theme";

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Light/dark switch. Until the visitor presses it, the site follows the device setting (and keeps following it
 * when the device switches); after that their choice is remembered on this device.
 */
export default function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(current());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(KEY); } catch {}
      if (stored === "light" || stored === "dark") return;
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      setTheme(current());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const flip = () => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch {}
    setTheme(next);
  };

  const label = theme === "dark" ? "Switch to light" : "Switch to dark";
  return (
    <button type="button" className={className} onClick={flip} aria-label={label} title={label}>
      {withLabel && <span>{theme === "dark" ? "Dark" : "Light"}</span>}
      {theme === "dark" ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  );
}
