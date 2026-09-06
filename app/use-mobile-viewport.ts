"use client";
import { useEffect } from "react";

/** iOS keyboards resize/pan the visual viewport without resizing the layout viewport. */
export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const mobile = window.matchMedia("(max-width: 767px)");
    let frame = 0;
    let keyboardOpen = false;
    const update = () => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement &&
        (focused.matches('textarea, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"])') || focused.isContentEditable);
      const occluded = document.documentElement.clientHeight - viewport.height;
      // Ignore browser toolbar changes and pinch zoom; keep tracking the keyboard's closing animation.
      keyboardOpen = mobile.matches && Math.abs(viewport.scale - 1) < 0.05 &&
        occluded > 120 && (editing || keyboardOpen);
      root.dataset.mobileKeyboard = String(keyboardOpen);
      if (keyboardOpen) {
        root.style.setProperty("--mobile-viewport-height", `${viewport.height}px`);
        root.style.setProperty("--mobile-viewport-top", `${viewport.offsetTop}px`);
      } else {
        root.style.removeProperty("--mobile-viewport-height");
        root.style.removeProperty("--mobile-viewport-top");
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      delete root.dataset.mobileKeyboard;
      root.style.removeProperty("--mobile-viewport-height");
      root.style.removeProperty("--mobile-viewport-top");
    };
  }, []);
}
