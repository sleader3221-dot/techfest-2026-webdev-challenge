import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const desktop = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
export function useHoverIntent() {
  const nav = useRef<HTMLElement>(null);
  const [enabled, setEnabled] = useState(() => matchMedia(desktop).matches);
  const [active, setActive] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const keyboard = useRef(false);
  const restoring = useRef(false);
  const location = useLocation();
  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  const close = useCallback(() => {
    cancel();
    setActive(null);
  }, [cancel]);
  const leave = useCallback(() => {
    cancel();
    timer.current = window.setTimeout(close, 150);
  }, [cancel, close]);
  const triggers = () =>
    Array.from(
      nav.current?.querySelectorAll<HTMLAnchorElement>(
        '[data-slot="mega-trigger"]',
      ) ?? [],
    );
  function open(index: number) {
    cancel();
    setActive(index);
  }
  function hover(index: number) {
    cancel();
    if (active === null)
      timer.current = window.setTimeout(() => open(index), 80);
    else open(index);
  }
  useEffect(() => {
    close();
  }, [location.key, close]);
  useEffect(() => {
    const query = matchMedia(desktop);
    const resize = () => {
      setEnabled(query.matches);
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboard.current = true;
    };
    const onPointer = (event: PointerEvent) => {
      keyboard.current = false;
      if (!nav.current?.contains(event.target as Node)) close();
    };
    query.addEventListener("change", resize);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      cancel();
      query.removeEventListener("change", resize);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [cancel, close]);
  useEffect(() => {
    if (!enabled) return;
    const header = nav.current?.closest("header");
    if (!header) return;
    const blur = (e: FocusEvent) => {
      if (!header.contains(e.relatedTarget as Node | null)) close();
    };
    header.addEventListener("pointerleave", leave);
    if (active !== null) header.addEventListener("pointerenter", cancel);
    header.addEventListener("focusout", blur);
    return () => {
      header.removeEventListener("pointerleave", leave);
      header.removeEventListener("pointerenter", cancel);
      header.removeEventListener("focusout", blur);
    };
  }, [active, enabled, leave, cancel, close]);
  useEffect(() => {
    if (active === null) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        restoring.current = true;
        triggers()[active]?.focus({ preventScroll: true });
        restoring.current = false;
        close();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [active, close]);
  return {
    nav,
    enabled,
    active,
    close,
    cancel,
    leave,
    hover,
    open,
    triggers,
    focus: (index: number) => {
      if (keyboard.current && !restoring.current) open(index);
    },
  };
}
